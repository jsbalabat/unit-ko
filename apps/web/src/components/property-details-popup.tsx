"use client";

/**
 * MULTI-TENANT BILLING ARCHITECTURE
 * =================================
 *
 * Individual Billing Accounts:
 * - Each tenant in a multi-tenant property has their own billing account
 * - Individual accounts add up to the total property rent/payables
 * - Currently implemented as equal shares (total rent ÷ number of tenants)
 * - Future enhancement: Store custom individual amounts per tenant
 *
 * View Modes:
 * 1. Consolidated View: Shows sum of all tenant accounts
 *    - Displays total amounts across all tenants
 *    - Edit Billing button is DISABLED (prevents accidental bulk edits)
 *    - Payment breakdown visible on hover
 *
 * 2. Individual Tenant View: Shows single tenant's account
 *    - Displays only that tenant's portion
 *    - Edit Billing button is ENABLED (edits only this tenant's billing)
 *    - Allows tenant-specific payment tracking
 *
 * Data Model:
 * - Property.rent_amount: Total property rent
 * - BillingEntry rows are persisted per tenant account
 * - BillingEntry.gross_due and paid_amount are treated as direct row amounts
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  MapPin,
  Loader2,
  AlertCircle,
  Pencil,
  Archive,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import type { ActivityLog } from "@unitko/shared";
import { api } from "@/lib/api-client";
import { EditPropertyPopup } from "@/components/edit-property-popup";
import { EditBillingPopup } from "@/components/edit-billing-popup";
import { AmenitiesPopup } from "@/components/amenities-popup";
import { PropertyResetDialog } from "@/components/property-reset-dialog";
import { archiveAndResetProperty } from "@/services/archiveService";
import { billingStatusOf } from "./billing-status";
import {
  BillingEntry,
  BillingDisplayRow,
  Property,
  PropertyDetailsPopupProps,
  toLegacyEntry,
  parseExpenseItems,
  PropertyDetailsTab,
  PropertySoaTab,
  PropertyHistoryTab,
  PropertyTransferredDialog,
  PropertyPaymentDialog,
} from "./property-details";

export type {
  BillingEntry,
  BillingDisplayRow,
  ExpenseItem,
  Tenant,
  Property,
  PropertyNote,
  PropertyDetailsPopupProps,
} from "./property-details";
export { toLegacyEntry } from "./property-details";

export function PropertyDetailsPopup({
  propertyId,
  isOpen,
  onClose,
  onSuccess,
  defaultTab = "details",
}: PropertyDetailsPopupProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [isEditBillingPopupOpen, setIsEditBillingPopupOpen] = useState(false);
  const [isAmenitiesPopupOpen, setIsAmenitiesPopupOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState<string>("");
  const [isApplyingPayment, setIsApplyingPayment] = useState(false);
  const [showTransferred, setShowTransferred] = useState(false);
  // tenant id -> current name + unit, so the archive box can show where each
  // transferred invoice's balance now lives (the tenant's current property).
  const [tenantDirectory, setTenantDirectory] = useState<
    Map<string, { name: string; property: string | null }>
  >(new Map());
  // Transferred invoices for the whole property (all leases, incl. tenants who have
  // since moved away), so the archive box shows them even when they're no longer
  // attached to an active tenant on this unit.
  const [archivedTransfers, setArchivedTransfers] = useState<BillingEntry[]>([]);
  const [selectedTenantIndex, setSelectedTenantIndex] = useState<number | null>(
    null,
  );

  // Notes management state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // Notes are normalized rows behind the API; the JSON still rendered by this
  // component carries each note's real id, so the index-based handlers resolve
  // that id and call the endpoints (which log the activity server-side).
  const noteIdAt = (index: number): string | null => {
    if (!property?.notes) return null;
    const notes = JSON.parse(property.notes) as Array<{ id: string }>;
    return notes[index]?.id ?? null;
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !property) return;
    try {
      await api.properties.addNote(propertyId, { body: newNoteText.trim() });
      await fetchPropertyDetails();
      setNewNoteText("");
      setIsAddingNote(false);
      toast.success("Note added successfully");
    } catch (err) {
      console.error("Error adding note:", err);
      toast.error("Failed to add note");
    }
  };

  const handleUpdateNote = async (index: number) => {
    if (!editingNoteText.trim() || !property) return;
    const noteId = noteIdAt(index);
    if (!noteId) return;
    try {
      await api.properties.updateNote(propertyId, noteId, {
        body: editingNoteText.trim(),
      });
      await fetchPropertyDetails();
      setEditingNoteIndex(null);
      setEditingNoteText("");
      toast.success("Note updated successfully");
    } catch (err) {
      console.error("Error updating note:", err);
      toast.error("Failed to update note");
    }
  };

  const handleDeleteNote = async (index: number) => {
    const noteId = noteIdAt(index);
    if (!noteId) return;
    try {
      await api.properties.deleteNote(propertyId, noteId);
      await fetchPropertyDetails();
      toast.success("Note deleted successfully");
    } catch (err) {
      console.error("Error deleting note:", err);
      toast.error("Failed to delete note");
    }
  };

  const startEditingNote = (index: number, currentText: string) => {
    setEditingNoteIndex(index);
    setEditingNoteText(currentText);
  };

  const cancelEditingNote = () => {
    setEditingNoteIndex(null);
    setEditingNoteText("");
  };

  // Store view mode per property ID in localStorage
  const getStoredViewMode = (propId: string): string => {
    try {
      const stored = localStorage.getItem("propertyViewModes");
      if (stored) {
        const viewModes = JSON.parse(stored);
        return viewModes[propId] || "consolidated";
      }
    } catch (e) {
      console.error("Error reading stored view modes:", e);
    }
    return "consolidated";
  };

  const setStoredViewMode = (propId: string, mode: string) => {
    try {
      const stored = localStorage.getItem("propertyViewModes");
      const viewModes = stored ? JSON.parse(stored) : {};
      viewModes[propId] = mode;
      localStorage.setItem("propertyViewModes", JSON.stringify(viewModes));
    } catch (e) {
      console.error("Error storing view mode:", e);
    }
  };

  const [billingViewMode, setBillingViewMode] = useState<string>(() =>
    getStoredViewMode(propertyId),
  );

  // Update stored view mode when it changes
  const updateBillingViewMode = (mode: string) => {
    setBillingViewMode(mode);
    setStoredViewMode(propertyId, mode);
  };

  // Composes the property detail, its invoices, and its activity log from the
  // API into the nested, snake_case `Property` shape the rest of this component
  // renders.
  const loadedPropertyRef = useRef<string | null>(null);
  const fetchPropertyDetails = useCallback(async () => {
    if (!isOpen || !propertyId) return;

    if (loadedPropertyRef.current !== propertyId) setLoading(true);
    setError(null);

    try {
      const [detail, invoices, activity, allTenants] = await Promise.all([
        api.properties.detail(propertyId),
        api.billing.list(propertyId),
        api.activity.list({ propertyId, limit: 50 }),
        api.tenants.list(),
      ]);

      const directory = new Map<
        string,
        { name: string; property: string | null }
      >();
      for (const t of allTenants) {
        directory.set(t.id, { name: t.tenantName, property: t.propertyName });
      }
      setTenantDirectory(directory);

      setArchivedTransfers(
        invoices
          .filter((inv) => inv.status === "Transferred")
          .map((inv) => toLegacyEntry(inv, propertyId)),
      );

      const entriesByTenant = new Map<string, BillingEntry[]>();
      for (const inv of invoices) {
        if (!inv.tenantId) continue;
        const legacy = toLegacyEntry(inv, propertyId);
        const list = entriesByTenant.get(inv.tenantId) ?? [];
        list.push(legacy);
        entriesByTenant.set(inv.tenantId, list);
      }

      setProperty({
        id: detail.id,
        unit_name: detail.unitName,
        property_type: detail.propertyType ?? "",
        occupancy_status: detail.occupancyStatus,
        property_location: detail.propertyLocation ?? "",
        rent_amount: detail.rentAmount,
        max_tenants: detail.maxTenants,
        bed_space_billing_mode: detail.billingMode,
        amenities: JSON.stringify(detail.amenities.map((a) => a.code)),
        notes: JSON.stringify(
          detail.notes.map((n) => ({
            id: n.id,
            text: n.body,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
          })),
        ),
        created_at: detail.createdAt,
        updated_at: detail.createdAt,
        tenants: detail.tenants.map((t) => ({
          id: t.id,
          property_id: detail.id,
          tenant_name: t.tenantName,
          email: t.email ?? undefined,
          contact_number: t.contactNumber,
          tenant_slot: t.tenantSlot ?? undefined,
          contract_months: detail.lease?.contractPeriods ?? 0,
          rent_start_date: detail.lease?.rentStartDate ?? "",
          due_day:
            detail.lease?.dueDay != null ? String(detail.lease.dueDay) : "",
          is_active: t.isActive,
          advance_payment: detail.lease?.advancePayment ?? 0,
          security_deposit: detail.lease?.securityDeposit ?? 0,
          overflow: 0,
          created_at: "",
          updated_at: "",
          billing_entries: entriesByTenant.get(t.id) ?? [],
        })),
      });

      setActivityLogs(activity);
      loadedPropertyRef.current = propertyId;
    } catch (err) {
      console.error("Error fetching property details:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load property details",
      );
      toast.error("Failed to load property details");
    } finally {
      setLoading(false);
    }
  }, [propertyId, isOpen]);

  useEffect(() => {
    fetchPropertyDetails();
  }, [fetchPropertyDetails]);

  // Reset transient view state when modal opens or inputs change per React guidance
  const [viewAnchor, setViewAnchor] = useState({
    open: isOpen,
    propertyId,
    defaultTab,
  });
  if (
    viewAnchor.open !== isOpen ||
    viewAnchor.propertyId !== propertyId ||
    viewAnchor.defaultTab !== defaultTab
  ) {
    const openChanged = viewAnchor.open !== isOpen;
    const propertyChanged = viewAnchor.propertyId !== propertyId;
    const tabInputChanged = viewAnchor.defaultTab !== defaultTab;
    setViewAnchor({ open: isOpen, propertyId, defaultTab });
    if (isOpen && propertyId && (openChanged || propertyChanged)) {
      setBillingViewMode(getStoredViewMode(propertyId));
    }
    if (isOpen && (openChanged || tabInputChanged)) {
      setActiveTab(defaultTab);
    }
  }

  // Properties are archived (the lease ends, history is preserved), never hard-deleted
  const handleApplyPayment = async () => {
    if (!property || !activeTenant || paymentAmount === 0) return;
    if (paymentAmount < 0) {
      toast.error("Refunds aren't supported here — adjust the invoice instead.");
      return;
    }

    setIsApplyingPayment(true);
    try {
      const targetTenantId =
        selectedTenantIndex !== null && tenantIdsByIndex[selectedTenantIndex]
          ? tenantIdsByIndex[selectedTenantIndex]
          : activeTenant.id;
      const leaseId = liveBillingEntries.find(
        (entry) => entry.tenant_id === targetTenantId && entry.lease_id,
      )?.lease_id;
      if (!leaseId) throw new Error("No active lease to record against");
      const paidAt = receiptDate
        ? new Date(receiptDate).toISOString()
        : undefined;
      const notes = paymentNote.trim() || undefined;

      await api.payments.record({
        leaseId,
        amount: paymentAmount,
        paymentType:
          paymentType === "deposit" || paymentType === "advance"
            ? paymentType
            : "rent",
        paidAt,
        notes,
      });

      await fetchPropertyDetails();
      onSuccess?.();
      toast.success("Payment recorded", {
        description: `₱${paymentAmount.toLocaleString()} recorded.`,
      });

      setPaymentAmount(0);
      setPaymentType("");
      setPaymentNote("");
      setReceiptDate("");
      setSelectedTenantIndex(null);
      setIsPaymentDialogOpen(false);
    } catch (err) {
      console.error("Error applying payment:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to record payment",
      );
    } finally {
      setIsApplyingPayment(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="sm:max-w-[95%] md:max-w-[90%] lg:max-w-[900px] max-h-[90vh] p-0"
          aria-describedby="loading-description"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Property Details</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p
                id="loading-description"
                className="text-sm text-muted-foreground"
              >
                Loading property details...
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[95%] md:max-w-[90%] lg:max-w-[900px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Property
            </DialogTitle>
            <DialogDescription>
              We encountered a problem while loading the property details.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!property) return null;

  const activeTenants = (property.tenants || []).filter((t) => t.is_active);
  const activeTenant = activeTenants[0];

  const tenantProfiles = activeTenants.map((tenant) => ({
    name: tenant.tenant_name,
    email: tenant.email || "",
    phone: tenant.contact_number,
  }));

  const tenantIdsByIndex = activeTenants.map((tenant) => tenant.id);
  const paxCount = activeTenants.length || 1;

  const billingEntries =
    activeTenants.length > 1
      ? activeTenants
          .flatMap((tenant) => tenant.billing_entries || [])
          .sort(
            (a, b) =>
              new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
          )
      : activeTenant?.billing_entries || [];

  const liveBillingEntries = billingEntries.filter(
    (e) => e.status !== "Transferred",
  );

  const isIndividualBillingView =
    paxCount > 1 && billingViewMode.startsWith("tenant-");
  const selectedBillingTenantIdx = isIndividualBillingView
    ? parseInt(billingViewMode.split("-")[1], 10)
    : null;
  const selectedBillingTenant =
    selectedBillingTenantIdx !== null && !Number.isNaN(selectedBillingTenantIdx)
      ? tenantProfiles[selectedBillingTenantIdx]
      : null;
  const selectedBillingTenantId =
    selectedBillingTenantIdx !== null && !Number.isNaN(selectedBillingTenantIdx)
      ? tenantIdsByIndex[selectedBillingTenantIdx] || null
      : null;

  const billingDisplayRows: BillingDisplayRow[] = (() => {
    const sourceEntries =
      paxCount > 1 && billingViewMode.startsWith("tenant-")
        ? selectedBillingTenantId !== null
          ? liveBillingEntries.filter(
              (entry) => entry.tenant_id === selectedBillingTenantId,
            )
          : []
        : liveBillingEntries;

    const groupedRows = new Map<string, BillingDisplayRow>();

    [...sourceEntries]
      .sort(
        (a, b) =>
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
      )
      .forEach((entry) => {
        const groupKey =
          entry.period_id ?? `period-${entry.billing_period}-${entry.due_date}`;
        const expenseItems = parseExpenseItems(entry);
        const existingRow = groupedRows.get(groupKey);

        if (!existingRow) {
          groupedRows.set(groupKey, {
            key: groupKey,
            dueDate: entry.due_date,
            billingPeriod: entry.billing_period,
            rentDue: entry.rent_due,
            otherCharges: entry.other_charges,
            grossDue: entry.gross_due,
            paidAmount: entry.paid_amount || 0,
            appliedCredit: entry.applied_credit,
            balance: entry.balance,
            status: entry.status,
            expenseItems: [...expenseItems],
            sourceEntryCount: 1,
          });
          return;
        }

        existingRow.rentDue += entry.rent_due;
        existingRow.otherCharges += entry.other_charges;
        existingRow.grossDue += entry.gross_due;
        existingRow.paidAmount += entry.paid_amount || 0;
        existingRow.appliedCredit += entry.applied_credit;
        existingRow.balance += entry.balance;
        existingRow.sourceEntryCount += 1;
        existingRow.expenseItems = Array.from(
          new Map(
            [...existingRow.expenseItems, ...expenseItems].map((item) => [
              `${item.name}-${item.amount}`,
              item,
            ]),
          ).values(),
        );
      });

    return Array.from(groupedRows.values());
  })();

  const recentPayments: BillingEntry[] = liveBillingEntries
    .filter((entry) => {
      return entry.status === "Paid" || entry.status === "Partial";
    })
    .sort(
      (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime(),
    )
    .slice(0, 5);

  const upcomingPayments: BillingEntry[] = liveBillingEntries
    .filter((entry) => {
      return entry.status !== "Paid" && entry.status !== "Not Yet Set";
    })
    .sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    );

  const totalRevenue = billingDisplayRows.reduce(
    (sum, entry) => sum + entry.paidAmount,
    0,
  );

  const pendingPayments = billingDisplayRows.reduce((sum, entry) => {
    const effectiveStatus = billingStatusOf(
      entry.grossDue,
      entry.paidAmount + entry.appliedCredit,
      entry.balance,
      entry.dueDate,
    );
    const balance = Math.max(0, entry.balance);
    return effectiveStatus === "Not Yet Due" ? sum + balance : sum;
  }, 0);

  const unpaidBalance = billingDisplayRows.reduce((sum, entry) => {
    const effectiveStatus = billingStatusOf(
      entry.grossDue,
      entry.paidAmount + entry.appliedCredit,
      entry.balance,
      entry.dueDate,
    );
    const balance = Math.max(0, entry.balance);
    return effectiveStatus === "Partial" || effectiveStatus === "Overdue"
      ? sum + balance
      : sum;
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[95%] md:max-w-[90%] lg:max-w-[900px] p-0 max-h-[95vh] overflow-hidden flex flex-col"
        aria-describedby="property-details-description"
      >
        {/* Header - Sticky */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b p-4 md:p-6 pb-3 md:pb-4">
          <DialogHeader className="pb-0">
            <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
              <div className="flex items-center">
                <div
                  className={`p-2 rounded-full ${
                    property.occupancy_status === "occupied"
                      ? "bg-green-100 dark:bg-green-900/50"
                      : "bg-amber-100 dark:bg-amber-900/50"
                  } mr-3`}
                >
                  <Building
                    className={`h-5 w-5 md:h-6 md:w-6 ${
                      property.occupancy_status === "occupied"
                        ? "text-green-600 dark:text-green-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  />
                </div>
                <div>
                  <DialogTitle className="text-lg md:text-xl font-bold line-clamp-1">
                    {property.unit_name}
                  </DialogTitle>
                  <DialogDescription
                    id="property-details-description"
                    className="flex items-center mt-0.5"
                  >
                    <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs md:text-sm text-muted-foreground truncate max-w-[200px] md:max-w-[300px]">
                      {property.property_location}
                    </span>
                  </DialogDescription>
                </div>
              </div>

              <Badge
                variant="outline"
                className={`${
                  property.occupancy_status === "occupied"
                    ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/50"
                    : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/50"
                } px-2 py-1 text-xs capitalize`}
              >
                {property.occupancy_status}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* Tabs - Responsive design */}
        <Tabs
          defaultValue="details"
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="mx-4 md:mx-6 mt-4 grid grid-cols-3 w-auto">
            <TabsTrigger value="details" className="text-xs sm:text-sm">
              Property Details
            </TabsTrigger>
            <TabsTrigger value="finances" className="text-xs sm:text-sm">
              Statement of Account
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">
              Activity Log
            </TabsTrigger>
          </TabsList>

          {/* Edit button - shown only in details tab */}
          {activeTab === "details" && (
            <div className="mx-4 md:mx-6 mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditPopupOpen(true)}
                className="text-xs h-8 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Property
              </Button>
            </div>
          )}

          {/* Archived transfers button — shown only in finances tab */}
          {activeTab === "finances" && archivedTransfers.length > 0 && (
            <div className="mx-4 md:mx-6 mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTransferred(true)}
                className="text-xs h-8 gap-1.5"
              >
                <Archive className="h-3.5 w-3.5" />
                Transferred ({archivedTransfers.length})
              </Button>
            </div>
          )}

          <TabsContent
            value="details"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <PropertyDetailsTab
              property={property}
              activeTenants={activeTenants}
              activeTenant={activeTenant}
              paxCount={paxCount}
              tenantProfiles={tenantProfiles}
              tenantIdsByIndex={tenantIdsByIndex}
              upcomingPayments={upcomingPayments}
              recentPayments={recentPayments}
              onOpenAmenities={() => setIsAmenitiesPopupOpen(true)}
              isAddingNote={isAddingNote}
              setIsAddingNote={setIsAddingNote}
              newNoteText={newNoteText}
              setNewNoteText={setNewNoteText}
              editingNoteIndex={editingNoteIndex}
              editingNoteText={editingNoteText}
              setEditingNoteText={setEditingNoteText}
              handleAddNote={handleAddNote}
              handleUpdateNote={handleUpdateNote}
              handleDeleteNote={handleDeleteNote}
              startEditingNote={startEditingNote}
              cancelEditingNote={cancelEditingNote}
            />
          </TabsContent>

          <TabsContent
            value="finances"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <PropertySoaTab
              property={property}
              activeTenant={activeTenant}
              paxCount={paxCount}
              billingViewMode={billingViewMode}
              onUpdateBillingViewMode={updateBillingViewMode}
              tenantProfiles={tenantProfiles}
              tenantIdsByIndex={tenantIdsByIndex}
              liveBillingEntries={liveBillingEntries}
              billingDisplayRows={billingDisplayRows}
              totalRevenue={totalRevenue}
              pendingPayments={pendingPayments}
              unpaidBalance={unpaidBalance}
              selectedBillingTenant={selectedBillingTenant}
              selectedBillingTenantIdx={selectedBillingTenantIdx}
              onOpenPaymentDialog={() => {
                if (billingViewMode.startsWith("tenant-")) {
                  const tenantIdx = parseInt(
                    billingViewMode.split("-")[1],
                    10,
                  );
                  setSelectedTenantIndex(tenantIdx);
                } else {
                  setSelectedTenantIndex(null);
                }
                setIsPaymentDialogOpen(true);
              }}
              onOpenEditBilling={() => setIsEditBillingPopupOpen(true)}
            />
          </TabsContent>

          <TabsContent
            value="history"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <PropertyHistoryTab activityLogs={activityLogs} />
          </TabsContent>
        </Tabs>

        {/* Footer Actions - Fixed at bottom */}
        <div className="border-t mt-auto p-4 md:p-6 bg-background/95 backdrop-blur-sm flex justify-between items-center flex-wrap gap-2">
          <div className="flex gap-2">
            {property.occupancy_status === "occupied" && activeTenant && (
              <Button
                variant="outline"
                onClick={() => setIsResetDialogOpen(true)}
                className="gap-1.5 h-9 text-xs sm:text-sm border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20"
                size="sm"
              >
                <Archive className="h-3.5 w-3.5" />
                Reset Property
              </Button>
            )}
          </div>

          <Button
            onClick={onClose}
            className="h-9 text-xs sm:text-sm"
            size="sm"
          >
            Close
          </Button>
        </div>
      </DialogContent>

      <AmenitiesPopup
        isOpen={isAmenitiesPopupOpen}
        onClose={() => setIsAmenitiesPopupOpen(false)}
        currentAmenities={
          property?.amenities ? JSON.parse(property.amenities) : []
        }
        onSave={async (selectedAmenities) => {
          try {
            await api.properties.update(propertyId, {
              amenities: selectedAmenities,
            });
            await fetchPropertyDetails();
            onSuccess?.();
            toast.success("Amenities updated successfully");
          } catch (err) {
            console.error("Error updating amenities:", err);
            toast.error("Failed to update amenities");
          }
        }}
      />

      {isEditPopupOpen && (
        <EditPropertyPopup
          propertyId={propertyId}
          isOpen={isEditPopupOpen}
          onClose={() => setIsEditPopupOpen(false)}
          onSuccess={() => {
            fetchPropertyDetails();
            if (onSuccess) {
              onSuccess();
            }
          }}
          onSwitchToBilling={() => {
            setIsEditPopupOpen(false);
            setIsEditBillingPopupOpen(true);
          }}
        />
      )}

      {isEditBillingPopupOpen && activeTenant && (
        <EditBillingPopup
          propertyId={propertyId}
          tenantId={selectedBillingTenantId || activeTenant.id}
          isOpen={isEditBillingPopupOpen}
          onClose={() => setIsEditBillingPopupOpen(false)}
          onSuccess={() => {
            fetchPropertyDetails();
            if (onSuccess) {
              onSuccess();
            }
          }}
          onSwitchToProperty={() => {
            setIsEditBillingPopupOpen(false);
            setIsEditPopupOpen(true);
          }}
        />
      )}

      <PropertyResetDialog
        isOpen={isResetDialogOpen}
        onClose={() => setIsResetDialogOpen(false)}
        onConfirm={async (remarks) => {
          const targetTenantId = selectedBillingTenantId || activeTenant?.id;
          if (!targetTenantId) {
            toast.error("No active tenant found");
            return;
          }

          const result = await archiveAndResetProperty({
            propertyId: propertyId,
            tenantId: targetTenantId,
            remarks: remarks,
          });

          if (result.success) {
            toast.success("Property reset successfully");
            setIsResetDialogOpen(false);
            onClose();
            if (onSuccess) {
              onSuccess();
            }
          } else {
            toast.error(result.error || "Failed to reset property");
          }
        }}
        propertyName={property.unit_name}
        tenantName={
          selectedBillingTenantId
            ? selectedBillingTenant?.name ||
              `Tenant ${(selectedBillingTenantIdx ?? 0) + 1}`
            : activeTenant?.tenant_name || ""
        }
      />

      <PropertyTransferredDialog
        isOpen={showTransferred}
        onOpenChange={setShowTransferred}
        archivedTransfers={archivedTransfers}
        tenantDirectory={tenantDirectory}
      />

      <PropertyPaymentDialog
        isOpen={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        selectedTenantIndex={selectedTenantIndex}
        tenantProfiles={tenantProfiles}
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        paymentType={paymentType}
        setPaymentType={setPaymentType}
        receiptDate={receiptDate}
        setReceiptDate={setReceiptDate}
        paymentNote={paymentNote}
        setPaymentNote={setPaymentNote}
        isApplyingPayment={isApplyingPayment}
        onApplyPayment={handleApplyPayment}
        onCancel={() => {
          setIsPaymentDialogOpen(false);
          setPaymentAmount(0);
          setPaymentType("");
          setPaymentNote("");
          setReceiptDate("");
          setSelectedTenantIndex(null);
        }}
      />
    </Dialog>
  );
}
