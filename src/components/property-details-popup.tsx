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

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  User,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  Pencil,
  Phone,
  FileText,
  ClipboardCheck,
  CreditCard,
  Home,
  Archive,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Plus,
  Minus,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { EditPropertyPopup } from "@/components/edit-property-popup";
import { EditBillingPopup } from "@/components/edit-billing-popup";
import {
  AmenitiesPopup,
  AVAILABLE_AMENITIES,
} from "@/components/amenities-popup";
import { PropertyResetDialog } from "@/components/property-reset-dialog";
import { archiveAndResetProperty } from "@/services/archiveService";
import { logActivity } from "@/services/activityLogService";
// import { ScrollArea } from "@/components/ui/scroll-area";

// Define TypeScript interfaces for data structures
interface BillingEntry {
  id: string;
  property_id: string;
  tenant_id: string;
  period_id?: string;
  due_date: string;
  rent_due: number;
  other_charges: number; // Keep for data compatibility
  gross_due: number;
  status: string;
  billing_period: number;
  paid_amount?: number;
  created_at: string;
  updated_at: string;
  expense_items?: string; // Add this field for the JSON string of expense items
}

interface BillingDisplayRow {
  key: string;
  dueDate: string;
  billingPeriod: number;
  rentDue: number;
  otherCharges: number;
  grossDue: number;
  paidAmount: number;
  status: string;
  expenseItems: ExpenseItem[];
  sourceEntryCount: number;
}

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

interface Tenant {
  id: string;
  property_id: string;
  tenant_name: string;
  email?: string;
  contact_number: string;
  tenant_slot?: number;
  contract_months: number; // Number of billing periods (weekly, monthly, quarterly, etc.)
  rent_start_date: string;
  due_day: string;
  is_active: boolean;
  advance_payment?: number;
  security_deposit?: number;
  overflow?: number;
  created_at: string;
  updated_at: string;
  billing_entries?: BillingEntry[];
}

interface Property {
  id: string;
  unit_name: string;
  property_type: string;
  occupancy_status: "occupied" | "vacant";
  property_location: string;
  rent_amount: number;
  max_tenants?: number; // Bed space support
  bed_space_billing_mode?: string; // 'unified' or 'per_tenant'
  amenities?: string; // JSON string array of amenity IDs
  notes?: string; // JSON array of notes
  created_at: string;
  updated_at: string;
  tenants?: Tenant[];
}

interface ActivityLog {
  id: string;
  property_id: string;
  tenant_id: string | null;
  user_id: string | null;
  action_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface PropertyNote {
  id: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

interface PropertyDetailsPopupProps {
  propertyId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (propertyId: string) => void;
  onSuccess?: () => void;
  defaultTab?: string;
}

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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState<string>("");
  const [isApplyingPayment, setIsApplyingPayment] = useState(false);
  const [selectedTenantIndex, setSelectedTenantIndex] = useState<number | null>(
    null,
  );

  // Notes management state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // Notes CRUD functions
  const handleAddNote = async () => {
    if (!newNoteText.trim() || !property) return;

    const currentNotes = property.notes ? JSON.parse(property.notes) : [];
    const newNote = {
      id: Date.now().toString(),
      text: newNoteText.trim(),
      createdAt: new Date().toISOString(),
    };
    const updatedNotes = [...currentNotes, newNote];

    try {
      const { error } = await supabase
        .from("properties")
        .update({ notes: JSON.stringify(updatedNotes) })
        .eq("id", propertyId);

      if (error) throw error;

      await fetchPropertyDetails();
      setNewNoteText("");
      setIsAddingNote(false);

      await logActivity({
        propertyId,
        actionType: "property_note_added",
        description: `Note added for ${property.unit_name}`,
        metadata: {
          note_text: newNote.text,
        },
      });

      toast.success("Note added successfully");
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Failed to add note");
    }
  };

  const handleUpdateNote = async (index: number) => {
    if (!editingNoteText.trim() || !property) return;

    const currentNotes = property.notes ? JSON.parse(property.notes) : [];
    currentNotes[index].text = editingNoteText.trim();
    currentNotes[index].updatedAt = new Date().toISOString();

    try {
      const { error } = await supabase
        .from("properties")
        .update({ notes: JSON.stringify(currentNotes) })
        .eq("id", propertyId);

      if (error) throw error;

      await fetchPropertyDetails();
      setEditingNoteIndex(null);
      setEditingNoteText("");

      await logActivity({
        propertyId,
        actionType: "property_note_updated",
        description: `Property note updated for ${property.unit_name}`,
        metadata: {
          note_index: index,
          note_text: editingNoteText.trim(),
        },
      });

      toast.success("Note updated successfully");
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Failed to update note");
    }
  };

  const handleDeleteNote = async (index: number) => {
    if (!property) return;

    const currentNotes = property.notes ? JSON.parse(property.notes) : [];
    currentNotes.splice(index, 1);

    try {
      const { error } = await supabase
        .from("properties")
        .update({ notes: JSON.stringify(currentNotes) })
        .eq("id", propertyId);

      if (error) throw error;

      await fetchPropertyDetails();

      await logActivity({
        propertyId,
        actionType: "property_note_deleted",
        description: `Property note removed for ${property.unit_name}`,
        metadata: {
          note_index: index,
        },
      });

      toast.success("Note deleted successfully");
    } catch (error) {
      console.error("Error deleting note:", error);
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

  // Wrap fetchPropertyDetails in useCallback to prevent recreation on every render
  const fetchPropertyDetails = useCallback(async () => {
    if (!isOpen || !propertyId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("properties")
        .select(
          `
          *,
          tenants (
            *,
            billing_entries(*)
          )
        `,
        )
        .eq("id", propertyId)
        .order("billing_period", {
          foreignTable: "tenants.billing_entries",
          ascending: true,
        })
        .single();

      if (error) throw error;

      setProperty(data as Property);

      // Fetch activity logs for this property
      const { data: logs, error: logsError } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (logsError) {
        console.error("Activity log fetch failed:", logsError);
        setActivityLogs([]);
        toast.error("Could not load activity log", {
          description: logsError.message,
        });
      } else {
        setActivityLogs(logs ?? []);
      }
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
    // Call the function in useEffect
    fetchPropertyDetails();
  }, [fetchPropertyDetails]);

  // Update view mode when property changes
  useEffect(() => {
    if (isOpen && propertyId) {
      const storedMode = getStoredViewMode(propertyId);
      setBillingViewMode(storedMode);
    }
  }, [propertyId, isOpen]);

  // Re-fetch data when edit popup closes
  useEffect(() => {
    if (!isEditPopupOpen && !isEditBillingPopupOpen && isOpen) {
      // Small delay to ensure database has been updated
      const timer = setTimeout(() => {
        fetchPropertyDetails();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isEditPopupOpen, isEditBillingPopupOpen, isOpen, fetchPropertyDetails]);

  // Sync active tab when modal opens or defaultTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Enhanced status styling with improved colors and design
  const getStatusColorClass = (status: string): string => {
    const lowerStatus = status.toLowerCase();

    // Paid - Green
    if (lowerStatus.includes("collected") || lowerStatus === "paid") {
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/50";
    }

    // Needs Monitoring - Orange/Yellow
    if (lowerStatus.includes("delayed") || lowerStatus === "needs monitoring") {
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/50";
    }

    // Problem/Urgent - Red
    if (
      lowerStatus.includes("overdue") ||
      lowerStatus.includes("problem") ||
      lowerStatus.includes("urgent")
    ) {
      return "bg-red-200 text-red-900 border-red-300 ring-1 ring-red-300/60 dark:bg-red-900/60 dark:text-red-200 dark:border-red-700/70 dark:ring-red-700/40";
    }

    // Not Yet Due / Upcoming - Blue
    if (
      lowerStatus.includes("not yet due") ||
      lowerStatus.includes("upcoming")
    ) {
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/50";
    }

    // Not Yet Set - Light Gray/Muted
    if (lowerStatus.includes("not yet set")) {
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50";
    }

    // Default / Neutral - Gray
    return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50";
  };

  // Convert billing status to payment display status
  // Capitalize status for display consistency
  const formatStatusForDisplay = (status: string): string => {
    // Keep the actual status but ensure proper capitalization
    if (status.toLowerCase() === "overdue") return "Overdue";
    if (status === "Paid") return "Paid";
    if (status === "Partial") return "Partial";
    if (status === "Not Yet Due") return "Not Yet Due";
    if (status === "Not Yet Set") return "Not Yet Set";
    return status;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "";

    // Check if it's already formatted (e.g., "Sep 14, 2025")
    if (dateString.includes(",")) {
      return dateString;
    }

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Handle ISO date string (YYYY-MM-DD)
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split("-").map(Number);
      return `${monthNames[month - 1]} ${day}, ${year}`;
    }

    // Handle full ISO datetime strings (with T or Z)
    if (dateString.includes("T") || dateString.includes("Z")) {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      return `${monthNames[month]} ${day}, ${year}`;
    }

    // Fallback: try to parse and handle as local date
    const parts = dateString.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number);
      return `${monthNames[month - 1]} ${day}, ${year}`;
    }

    // Last resort fallback
    return dateString;
  };

  const formatDueDate = (dateString: string): string => {
    if (!dateString) return "";

    // If already formatted, return as is
    if (dateString.includes(",")) {
      return dateString;
    }

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Parse the date string manually to avoid timezone conversion
    let year: number, month: number, day: number;

    if (dateString.includes("-")) {
      [year, month, day] = dateString.split("-").map(Number);
    } else if (dateString.includes("/")) {
      const parts = dateString.split("/");
      month = parseInt(parts[0]);
      day = parseInt(parts[1]);
      year = parseInt(parts[2]);
    } else {
      return dateString;
    }

    return `${monthNames[month - 1]} ${day}, ${year}`;
  };

  const formatDateTime = (dateString: string): string => {
    if (!dateString) return "";

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();

    // Format to 12-hour time with AM/PM
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");

    return `${monthNames[month]} ${day}, ${year}, ${displayHours}:${displayMinutes} ${period}`;
  };

  // Calculate days until due
  const calculateDaysUntilDue = (dueDate: string | undefined): number => {
    // Parse as local date to avoid timezone offset
    if (!dueDate) {
      return 0;
    }

    const [year, month, day] = dueDate.split("-").map(Number);
    const due = new Date(year, month - 1, day);

    // Get today at midnight local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getEffectiveBillingStatus = (
    entry:
      | BillingEntry
      | { status: string; due_date?: string; dueDate?: string },
    paidAmount: number,
    totalDue: number,
  ): string => {
    const epsilon = 0.01;

    if (totalDue < epsilon) return "Not Yet Set";
    if (paidAmount >= totalDue - epsilon) return "Paid";
    if (paidAmount > epsilon) return "Partial";

    const lowerStatus = entry.status.toLowerCase();
    const dueDateValue =
      "due_date" in entry
        ? entry.due_date
        : "dueDate" in entry
          ? (entry.dueDate ?? "")
          : "";
    const daysUntil = calculateDaysUntilDue(dueDateValue ?? "");
    const isPastDue = daysUntil < 0;

    if (
      lowerStatus.includes("paid") ||
      lowerStatus.includes("collected") ||
      lowerStatus.includes("settled")
    ) {
      return "Paid";
    }

    if (lowerStatus.includes("partial")) {
      return "Partial";
    }

    if (lowerStatus.includes("not yet set")) {
      return "Not Yet Set";
    }

    if (
      isPastDue ||
      lowerStatus.includes("overdue") ||
      lowerStatus.includes("problem") ||
      lowerStatus.includes("urgent") ||
      lowerStatus.includes("delayed")
    ) {
      return "Overdue";
    }

    if (
      lowerStatus.includes("not yet due") ||
      lowerStatus.includes("upcoming")
    ) {
      return "Not Yet Due";
    }

    return "Not Yet Due";
  };

  const parseExpenseItems = (entry: BillingEntry): ExpenseItem[] => {
    const fallbackItems: ExpenseItem[] = [
      {
        id: `default-${entry.id}`,
        name: "Miscellaneous",
        amount: entry.other_charges,
      },
    ];

    if (typeof entry.expense_items !== "string") {
      return fallbackItems;
    }

    const rawExpenseItems = entry.expense_items.trim();
    if (!rawExpenseItems) {
      return fallbackItems;
    }

    try {
      const parsed = JSON.parse(rawExpenseItems);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item === "object")
          .map((item, index) => ({
            id: String(item.id ?? `${entry.id}-${index}`),
            name: String(item.name ?? "Miscellaneous"),
            amount: Number(item.amount ?? 0),
          }));
      }
    } catch (error) {
      console.error("Failed to parse expense items:", error);
    }

    return fallbackItems;
  };

  // Handle property deletion
  const handleDeleteProperty = async () => {
    if (!property) return;

    setIsDeleting(true);

    try {
      const activeTenants = property.tenants?.filter((t) => t.is_active) || [];

      // First, delete any billing entries associated with this property
      if (activeTenants.length > 0) {
        const { error: billingDeleteError } = await supabase
          .from("billing_entries")
          .delete()
          .eq("property_id", propertyId);

        if (billingDeleteError) throw billingDeleteError;

        // Then delete the tenant
        const { error: tenantDeleteError } = await supabase
          .from("tenants")
          .delete()
          .eq("property_id", propertyId);

        if (tenantDeleteError) throw tenantDeleteError;
      }

      // Finally delete the property
      const { error: propertyDeleteError } = await supabase
        .from("properties")
        .delete()
        .eq("id", propertyId);

      if (propertyDeleteError) throw propertyDeleteError;

      // Show success message
      toast.success("Property deleted successfully", {
        description: `${property.unit_name} and all associated data have been permanently removed.`,
      });

      // Call the success callback if provided
      if (onSuccess) onSuccess();

      // Close the dialog
      onClose();
    } catch (err) {
      console.error("Error deleting property:", err);
      toast.error("Failed to delete property");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  // Handle universal payment application
  const handleApplyPayment = async () => {
    if (!property || !activeTenant || paymentAmount === 0) return;

    setIsApplyingPayment(true);

    try {
      // Build payment note with tenant information if applicable
      let finalPaymentNote = paymentNote;
      if (
        paxCount > 1 &&
        selectedTenantIndex !== null &&
        tenantProfiles.length > selectedTenantIndex
      ) {
        const tenantName =
          tenantProfiles[selectedTenantIndex]?.name ||
          `Tenant ${selectedTenantIndex + 1}`;
        const prefix = `Payment by: ${tenantName} (Share: 1/${paxCount})`;
        finalPaymentNote = paymentNote ? `${prefix}. ${paymentNote}` : prefix;
      } else if (paxCount > 1 && selectedTenantIndex === null) {
        const prefix = `Payment for all tenants (Full amount)`;
        finalPaymentNote = paymentNote ? `${prefix}. ${paymentNote}` : prefix;
      }

      // If a specific tenant is selected in pax system, apply only their share
      const isPerPersonPayment = paxCount > 1 && selectedTenantIndex !== null;

      // Handle Deposit and Advance Payment differently
      if (paymentType === "deposit" || paymentType === "advance") {
        // Update tenant's deposit or advance payment field
        const fieldToUpdate =
          paymentType === "deposit" ? "security_deposit" : "advance_payment";
        const currentValue =
          paymentType === "deposit"
            ? activeTenant.security_deposit || 0
            : activeTenant.advance_payment || 0;
        const newValue = currentValue + paymentAmount;

        const { error } = await supabase
          .from("tenants")
          .update({
            [fieldToUpdate]: newValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeTenant.id);

        if (error) throw error;

        // Refresh property details
        await fetchPropertyDetails();

        await logActivity({
          propertyId,
          tenantId: activeTenant.id,
          actionType: "payment_made",
          description: `${paymentType === "deposit" ? "Security deposit" : "Advance payment"} updated for ${property.unit_name}`,
          metadata: {
            payment_type: paymentType,
            amount: paymentAmount,
            note: finalPaymentNote,
            receipt_date: receiptDate || null,
            new_value: newValue,
          },
        });

        // Refresh again so Activity Log tab includes the newly written payment log.
        await fetchPropertyDetails();

        toast.success(
          `${paymentType === "deposit" ? "Security Deposit" : "Advance Payment"} updated successfully`,
          {
            description: `New ${paymentType === "deposit" ? "deposit" : "advance"} amount: ₱${newValue.toLocaleString()}`,
          },
        );

        // Reset and close dialog
        setPaymentAmount(0);
        setPaymentType("");
        setPaymentNote("");
        setReceiptDate("");
        setIsPaymentDialogOpen(false);
        return;
      }

      // Handle normal rent/other charges payment to billing entries
      const entries =
        selectedTenantIndex !== null && tenantIdsByIndex[selectedTenantIndex]
          ? billingEntries.filter(
              (entry) =>
                entry.tenant_id === tenantIdsByIndex[selectedTenantIndex],
            )
          : billingEntries;
      const currentOverflow = activeTenant.overflow || 0;

      // Sort entries: chronologically for positive payments, reverse for negative payments
      const sortedEntries = [...entries].sort((a, b) => {
        const dateA = new Date(a.due_date).getTime();
        const dateB = new Date(b.due_date).getTime();
        // For negative payments, sort in reverse (latest first)
        return paymentAmount < 0 ? dateB - dateA : dateA - dateB;
      });

      let remainingPayment = paymentAmount;
      let newOverflow = currentOverflow;
      const updates: Array<{
        id: string;
        paidAmount: number;
        status: string;
      }> = [];

      // For POSITIVE payments: First use overflow to pay billing entries, then add excess to overflow
      if (paymentAmount > 0) {
        // Step 1: Use existing overflow to pay off billing entries first (only if not in individual tenant mode)
        // Skip overflow distribution when paying for a specific tenant
        if (newOverflow > 0 && !isPerPersonPayment) {
          for (const entry of sortedEntries) {
            if (newOverflow <= 0) break;

            const currentPaid = entry.paid_amount || 0;
            const amountDue = entry.gross_due - currentPaid;

            if (amountDue > 0) {
              const overflowToUse = Math.min(newOverflow, amountDue);
              const newPaidAmount = currentPaid + overflowToUse;
              newOverflow -= overflowToUse;

              // Determine new status
              let newStatus = entry.status;
              const epsilon = 0.01;
              if (newPaidAmount >= entry.gross_due - epsilon) {
                newStatus = "Paid";
              } else if (newPaidAmount > epsilon) {
                newStatus = "Partial";
              } else {
                const dueDate = new Date(entry.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);
                newStatus = dueDate < today ? "overdue" : "Not Yet Due";
              }

              updates.push({
                id: entry.id,
                paidAmount: newPaidAmount,
                status: newStatus,
              });
            }
          }
        }

        // Step 2: Apply the new payment to billing entries
        for (const entry of sortedEntries) {
          if (remainingPayment <= 0) break;

          // Find if this entry was already updated from overflow
          const existingUpdate = updates.find((u) => u.id === entry.id);
          const currentPaid = existingUpdate
            ? existingUpdate.paidAmount
            : entry.paid_amount || 0;
          const amountDue = entry.gross_due - currentPaid;
          if (amountDue > 0) {
            const paymentToApply = Math.min(remainingPayment, amountDue);
            const newPaidAmount = currentPaid + paymentToApply;

            // Determine new status
            let newStatus = entry.status;
            const epsilon = 0.01;
            if (newPaidAmount >= entry.gross_due - epsilon) {
              newStatus = "Paid";
            } else if (newPaidAmount > epsilon) {
              newStatus = "Partial";
            } else {
              // Determine overdue vs not yet due
              const dueDate = new Date(entry.due_date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);
              newStatus = dueDate < today ? "overdue" : "Not Yet Due";
            }

            if (existingUpdate) {
              existingUpdate.paidAmount = newPaidAmount;
              existingUpdate.status = newStatus;
            } else {
              updates.push({
                id: entry.id,
                paidAmount: newPaidAmount,
                status: newStatus,
              });
            }

            remainingPayment -= paymentToApply;
          }
        }

        // Step 3: Any remaining payment goes to overflow
        if (remainingPayment > 0) {
          newOverflow += remainingPayment;
          remainingPayment = 0;
        }
      } else {
        // For NEGATIVE payments (refunds): Deduct from overflow FIRST (highest priority), then from billing entries

        // Step 1: Deduct from overflow first (only if not in individual tenant mode)
        if (remainingPayment < 0 && newOverflow > 0 && !isPerPersonPayment) {
          const deductFromOverflow = Math.min(
            Math.abs(remainingPayment),
            newOverflow,
          );
          newOverflow -= deductFromOverflow;
          remainingPayment += deductFromOverflow;
        }

        // Step 2: If still have remaining negative payment, deduct from billing entries
        for (const entry of sortedEntries) {
          if (remainingPayment >= 0) break;

          const currentPaid = entry.paid_amount || 0;

          if (currentPaid > 0) {
            const deductionAmount = Math.max(remainingPayment, -currentPaid);
            const newPaidAmount = currentPaid + deductionAmount;

            // Determine new status
            let newStatus = entry.status;
            const epsilon = 0.01;
            if (newPaidAmount >= entry.gross_due - epsilon) {
              newStatus = "Paid";
            } else if (newPaidAmount > epsilon) {
              newStatus = "Partial";
            } else {
              // Determine overdue vs not yet due
              const dueDate = new Date(entry.due_date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);
              newStatus = dueDate < today ? "overdue" : "Not Yet Due";
            }

            updates.push({
              id: entry.id,
              paidAmount: Math.max(0, newPaidAmount),
              status: newStatus,
            });

            remainingPayment -= deductionAmount;
          }
        }
      }

      // Update all entries in the database
      for (const update of updates) {
        const { error } = await supabase
          .from("billing_entries")
          .update({
            paid_amount: update.paidAmount,
            status: update.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", update.id);

        if (error) throw error;
      }

      // Update tenant overflow if it changed
      if (newOverflow !== currentOverflow) {
        const { error } = await supabase
          .from("tenants")
          .update({
            overflow: newOverflow,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeTenant.id);

        if (error) throw error;
      }

      // Refresh property details
      await fetchPropertyDetails();

      await logActivity({
        propertyId,
        tenantId: activeTenant.id,
        actionType: "payment_made",
        description: `Payment applied to statement of account for ${property.unit_name}`,
        metadata: {
          amount: paymentAmount,
          payment_type: paymentType,
          note: finalPaymentNote,
          receipt_date: receiptDate || null,
          overflow_before: currentOverflow,
          overflow_after: newOverflow,
          per_person: isPerPersonPayment,
          selected_tenant_index: selectedTenantIndex,
        },
      });

      // Refresh again so Activity Log tab includes the newly written payment log.
      await fetchPropertyDetails();

      // Show success message
      const tenantInfo =
        isPerPersonPayment && tenantProfiles[selectedTenantIndex!]
          ? ` by ${tenantProfiles[selectedTenantIndex!].name}`
          : "";

      if (newOverflow > currentOverflow) {
        toast.success("Payment applied successfully", {
          description: `₱${paymentAmount.toLocaleString()} applied. Excess of ₱${(newOverflow - currentOverflow).toFixed(2)} added to overflow${tenantInfo}.`,
        });
      } else if (newOverflow < currentOverflow) {
        toast.success("Payment applied successfully", {
          description: `₱${Math.abs(paymentAmount).toLocaleString()} deducted. ₱${(currentOverflow - newOverflow).toFixed(2)} deducted from overflow${tenantInfo}.`,
        });
      } else {
        toast.success("Payment applied successfully", {
          description: `₱${Math.abs(paymentAmount).toLocaleString()} has been distributed across billing entries${tenantInfo}.`,
        });
      }

      // Reset and close dialog
      setPaymentAmount(0);
      setPaymentType("");
      setPaymentNote("");
      setReceiptDate("");
      setSelectedTenantIndex(null);
      setIsPaymentDialogOpen(false);
    } catch (err) {
      console.error("Error applying payment:", err);
      toast.error("Failed to apply payment");
    } finally {
      setIsApplyingPayment(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="sm:max-w-[95%] md:max-w-[90%] lg:max-w-[900px] max-h-[90vh] p-0"
          aria-describedby="loading-description" // This correctly matches the ID below
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

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

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
          ? billingEntries.filter(
              (entry) => entry.tenant_id === selectedBillingTenantId,
            )
          : []
        : billingEntries;

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

  // Recent Transactions: Entries that have been paid (Paid or Partial) sorted by most recent
  const recentPayments: BillingEntry[] = billingEntries
    .filter((entry) => {
      const effectiveStatus = getEffectiveBillingStatus(
        entry,
        entry.paid_amount || 0,
        entry.gross_due,
      );
      return effectiveStatus === "Paid" || effectiveStatus === "Partial";
    })
    .sort(
      (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime(),
    )
    .slice(0, 5);

  // Upcoming Payments: Unpaid/Partial entries (excluding Not Yet Set), sorted by due date
  const upcomingPayments: BillingEntry[] = billingEntries
    .filter((entry) => {
      const effectiveStatus = getEffectiveBillingStatus(
        entry,
        entry.paid_amount || 0,
        entry.gross_due,
      );
      const isNotYetSet = effectiveStatus === "Not Yet Set";
      const isPaid = effectiveStatus === "Paid";
      // Include entries that are not fully paid and not "Not Yet Set"
      return !isPaid && !isNotYetSet;
    })
    .sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    );

  // Calculate financial summaries for the current view mode (consolidated or selected tenant)
  const totalRevenue = billingDisplayRows.reduce(
    (sum, entry) => sum + entry.paidAmount,
    0,
  );

  const pendingPayments = billingDisplayRows.reduce((sum, entry) => {
    const totalDue = entry.grossDue;
    const paidAmount = entry.paidAmount;
    const effectiveStatus = getEffectiveBillingStatus(
      entry,
      paidAmount,
      totalDue,
    );
    const balance = Math.max(0, totalDue - paidAmount);
    return effectiveStatus === "Not Yet Due" ? sum + balance : sum;
  }, 0);

  const unpaidBalance = billingDisplayRows.reduce((sum, entry) => {
    const totalDue = entry.grossDue;
    const paidAmount = entry.paidAmount;
    const effectiveStatus = getEffectiveBillingStatus(
      entry,
      paidAmount,
      totalDue,
    );
    const balance = Math.max(0, totalDue - paidAmount);
    return effectiveStatus === "Partial" || effectiveStatus === "Overdue"
      ? sum + balance
      : sum;
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[95%] md:max-w-[90%] lg:max-w-[900px] p-0 max-h-[95vh] overflow-hidden flex flex-col"
        aria-describedby="property-details-description" // Add this specific ID
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
                    id="property-details-description" // Use the same ID as aria-describedby
                    className="flex items-center mt-0.5"
                  >
                    <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs md:text-sm text-muted-foreground truncate max-w-[200px] md:max-w-[300px]">
                      {property.property_location}
                    </span>
                  </DialogDescription>
                </div>
              </div>

              {/* Status Badge - Responsive positioning */}
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

          <TabsContent
            value="details"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <div className="space-y-4 md:space-y-6">
              {/* Details tab content... */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <Card className="shadow-sm">
                  <CardContent className="p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                      <Building className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                      Property Information
                    </h3>
                    <div className="space-y-2 md:space-y-3 text-sm">
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Property Type
                        </span>
                        <span className="font-medium text-xs md:text-sm">
                          {property.property_type}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Monthly Rent per Tenant
                        </span>
                        <span className="font-medium text-green-600 dark:text-green-400 text-xs md:text-sm">
                          ~ {formatCurrency(property.rent_amount)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Status
                        </span>
                        <span className="font-medium text-xs md:text-sm">
                          {property.occupancy_status === "occupied" &&
                          property.max_tenants ? (
                            <span className="text-green-600 dark:text-green-400">
                              Occupied ({paxCount}/{property.max_tenants})
                            </span>
                          ) : (
                            <span className="capitalize">
                              {property.occupancy_status}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Date Added
                        </span>
                        <span className="font-medium text-xs md:text-sm">
                          {formatDate(property.created_at)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Location
                        </span>
                        <span className="font-medium break-words text-xs md:text-sm">
                          {property.property_location}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {activeTenant ? (
                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        <User className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                        Tenant Information
                      </h3>
                      <div className="space-y-4">
                        {/* Contract Details */}
                        <div className="space-y-2 md:space-y-3 text-sm">
                          <div className="grid grid-cols-2 items-center">
                            <span className="text-muted-foreground text-xs md:text-sm">
                              Number of Occupants
                            </span>
                            <span className="font-medium text-xs md:text-sm">
                              {activeTenants.length}{" "}
                              {activeTenants.length === 1
                                ? "person"
                                : "people"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 items-center">
                            <span className="text-muted-foreground text-xs md:text-sm">
                              Contract Duration
                            </span>
                            <span className="font-medium text-xs md:text-sm">
                              {activeTenant.contract_months}{" "}
                              {activeTenant.contract_months === 1
                                ? "period"
                                : "periods"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 items-center">
                            <span className="text-muted-foreground text-xs md:text-sm">
                              Rent Agreement Date
                            </span>
                            <span className="font-medium text-xs md:text-sm">
                              {formatDate(activeTenant.rent_start_date)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 items-center">
                            <span className="text-muted-foreground text-xs md:text-sm">
                              Payment Due Marker
                            </span>
                            <span className="font-medium text-xs md:text-sm">
                              {activeTenant.due_day.includes(",")
                                ? (() => {
                                    const [firstDay = "", secondDay = ""] =
                                      activeTenant.due_day.split(",");
                                    return `Days ${firstDay.trim()} and ${secondDay.trim()} of each billing period`;
                                  })()
                                : activeTenant.due_day === "last"
                                  ? "Last day of each billing period"
                                  : `Day ${activeTenant.due_day} of each billing period`}
                            </span>
                          </div>
                          {((activeTenant.advance_payment !== undefined &&
                            activeTenant.advance_payment > 0) ||
                            (activeTenant.security_deposit !== undefined &&
                              activeTenant.security_deposit > 0) ||
                            (activeTenant.overflow !== undefined &&
                              activeTenant.overflow > 0)) && (
                            <>
                              <div className="col-span-2 border-t my-2"></div>
                              {activeTenant.advance_payment !== undefined &&
                                activeTenant.advance_payment > 0 && (
                                  <div className="grid grid-cols-2 items-center">
                                    <span className="text-muted-foreground text-xs md:text-sm">
                                      Advance Payment
                                    </span>
                                    <span className="font-medium text-green-600 dark:text-green-400 text-xs md:text-sm">
                                      {formatCurrency(
                                        activeTenant.advance_payment,
                                      )}
                                    </span>
                                  </div>
                                )}
                              {activeTenant.security_deposit !== undefined &&
                                activeTenant.security_deposit > 0 && (
                                  <div className="grid grid-cols-2 items-center">
                                    <span className="text-muted-foreground text-xs md:text-sm">
                                      Security Deposit
                                    </span>
                                    <span className="font-medium text-green-600 dark:text-green-400 text-xs md:text-sm">
                                      {formatCurrency(
                                        activeTenant.security_deposit,
                                      )}
                                    </span>
                                  </div>
                                )}
                              {activeTenant.overflow !== undefined &&
                                activeTenant.overflow > 0 && (
                                  <div className="grid grid-cols-2 items-center">
                                    <span className="text-muted-foreground text-xs md:text-sm flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3" />
                                      Overflow (Excess Payment)
                                    </span>
                                    <span className="font-medium text-blue-600 dark:text-blue-400 text-xs md:text-sm">
                                      {formatCurrency(activeTenant.overflow)}
                                    </span>
                                  </div>
                                )}
                            </>
                          )}
                        </div>

                        {/* Occupant Details */}
                        {paxCount > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="text-sm font-semibold mb-3">
                              Occupant Details ({paxCount}/{paxCount} Occupied)
                            </h4>
                            <div className="space-y-3">
                              {Array.from({ length: paxCount }, (_, index) => {
                                const person = tenantProfiles[index];
                                const isOccupied =
                                  person?.name && person.name.trim() !== "";

                                return (
                                  <div
                                    key={index}
                                    className={`p-3 rounded-lg border ${
                                      isOccupied
                                        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                        : "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 border-dashed"
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div
                                        className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                          isOccupied
                                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                                            : "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600"
                                        }`}
                                      >
                                        <User className="h-5 w-5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p
                                            className={`font-medium text-sm ${
                                              isOccupied
                                                ? "text-foreground"
                                                : "text-muted-foreground italic"
                                            }`}
                                          >
                                            {isOccupied
                                              ? person.name
                                              : `Slot ${index + 1} - Vacant`}
                                          </p>
                                          {isOccupied && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                                              Occupied
                                            </span>
                                          )}
                                          {!isOccupied && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                              Available
                                            </span>
                                          )}
                                        </div>
                                        {isOccupied ? (
                                          <>
                                            {person.email && (
                                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                                <svg
                                                  xmlns="http://www.w3.org/2000/svg"
                                                  className="h-3 w-3"
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="2"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                >
                                                  <rect
                                                    width="20"
                                                    height="16"
                                                    x="2"
                                                    y="4"
                                                    rx="2"
                                                  />
                                                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                                </svg>
                                                <span className="truncate">
                                                  {person.email}
                                                </span>
                                              </div>
                                            )}
                                            {person.phone && (
                                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Phone className="h-3 w-3" />
                                                <span>{person.phone}</span>
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <p className="text-xs text-muted-foreground">
                                            No tenant assigned to this slot
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        <User className="h-4 w-4 md:h-5 md:w-5 mr-2 text-muted-foreground" />
                        Tenant Information
                      </h3>
                      <div className="flex flex-col items-center justify-center h-24 md:h-32 text-center text-muted-foreground">
                        <Building className="h-6 w-6 md:h-8 md:w-8 mb-2 opacity-40" />
                        <p className="text-xs md:text-sm">
                          This property is currently vacant
                        </p>
                        <p className="text-xs mt-1">
                          Add a tenant once the property is rented
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {property.occupancy_status === "occupied" && activeTenant && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        <Calendar className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                        Upcoming Payments
                      </h3>
                      {upcomingPayments.length > 0 ? (
                        <div className="space-y-2 md:space-y-3">
                          {upcomingPayments.slice(0, 3).map((payment) => {
                            const displayStatus = formatStatusForDisplay(
                              getEffectiveBillingStatus(
                                payment,
                                payment.paid_amount || 0,
                                payment.gross_due,
                              ),
                            );
                            const daysUntil = calculateDaysUntilDue(
                              payment.due_date,
                            );

                            // Get tenant-specific amounts and payments for multi-tenant properties
                            const showTenantDetails = paxCount > 1;
                            const tenantDetails: Array<{
                              name: string;
                              due: number;
                              paid: number;
                              balance: number;
                            }> = [];

                            if (showTenantDetails) {
                              const tenantIdx = tenantIdsByIndex.findIndex(
                                (id) => id === payment.tenant_id,
                              );
                              const person =
                                tenantIdx >= 0
                                  ? tenantProfiles[tenantIdx]
                                  : undefined;
                              const tenantName =
                                person?.name ||
                                (tenantIdx >= 0
                                  ? `Tenant ${tenantIdx + 1}`
                                  : "Tenant");

                              const tenantDue = payment.gross_due;
                              const tenantPaid = payment.paid_amount || 0;
                              const tenantBalance = tenantDue - tenantPaid;

                              if (tenantBalance > 0.01) {
                                tenantDetails.push({
                                  name: tenantName,
                                  due: tenantDue,
                                  paid: tenantPaid,
                                  balance: tenantBalance,
                                });
                              }
                            }

                            return (
                              <div
                                key={payment.id}
                                className="flex flex-col p-2 md:p-3 bg-muted/30 rounded-lg border"
                              >
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center">
                                    <Clock className="h-3.5 w-3.5 text-blue-500 mr-1.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs md:text-sm font-medium">
                                        {formatDueDate(payment.due_date)}
                                      </p>
                                      <p className="text-[10px] md:text-xs text-muted-foreground">
                                        {daysUntil < 0
                                          ? `${Math.abs(daysUntil)} days overdue`
                                          : `Due in ${daysUntil} days`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs md:text-sm font-bold block">
                                      {formatCurrency(
                                        payment.gross_due -
                                          (payment.paid_amount || 0),
                                      )}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] md:text-xs mt-1 ${getStatusColorClass(
                                        displayStatus,
                                      )}`}
                                    >
                                      {displayStatus}
                                    </Badge>
                                  </div>
                                </div>
                                {showTenantDetails &&
                                  tenantDetails.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-muted space-y-1">
                                      {tenantDetails.map((tenant, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between text-[10px] md:text-xs"
                                        >
                                          <div className="flex items-center gap-1">
                                            <User className="h-2.5 w-2.5 text-muted-foreground" />
                                            <span className="text-muted-foreground">
                                              {tenant.name}:
                                            </span>
                                          </div>
                                          <span className="font-semibold">
                                            {formatCurrency(tenant.balance)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-20 md:h-24 text-center text-muted-foreground">
                          <p className="text-xs md:text-sm">
                            No upcoming payments
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        Recent Transactions
                      </h3>
                      {recentPayments.length > 0 ? (
                        <div className="space-y-2 md:space-y-3">
                          {recentPayments.slice(0, 3).map((payment) => {
                            // Parse expense items
                            let expenseItems: ExpenseItem[] = [
                              {
                                id: `default-${payment.id}`,
                                name: "Miscellaneous",
                                amount: payment.other_charges,
                              },
                            ];

                            if (payment.expense_items) {
                              try {
                                const parsed = JSON.parse(
                                  payment.expense_items,
                                );
                                if (Array.isArray(parsed)) {
                                  expenseItems = parsed;
                                }
                              } catch {
                                expenseItems = [
                                  {
                                    id: `default-${payment.id}`,
                                    name: "Miscellaneous",
                                    amount: payment.other_charges,
                                  },
                                ];
                              }
                            }

                            const displayStatus = formatStatusForDisplay(
                              getEffectiveBillingStatus(
                                payment,
                                payment.paid_amount || 0,
                                payment.gross_due,
                              ),
                            );

                            // Get tenant-specific payment details for multi-tenant properties
                            const showTenantDetails = paxCount > 1;
                            const tenantPaymentDetails: Array<{
                              name: string;
                              amount: number;
                            }> = [];

                            if (showTenantDetails) {
                              const tenantIdx = tenantIdsByIndex.findIndex(
                                (id) => id === payment.tenant_id,
                              );
                              const person =
                                tenantIdx >= 0
                                  ? tenantProfiles[tenantIdx]
                                  : undefined;
                              const tenantName =
                                person?.name ||
                                (tenantIdx >= 0
                                  ? `Tenant ${tenantIdx + 1}`
                                  : "Tenant");
                              const tenantPaid = payment.paid_amount || 0;

                              if (tenantPaid > 0.01) {
                                tenantPaymentDetails.push({
                                  name: tenantName,
                                  amount: tenantPaid,
                                });
                              }
                            }

                            return (
                              <div
                                key={payment.id}
                                className="flex flex-col p-2 md:p-3 bg-muted/30 rounded-lg border group"
                              >
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center">
                                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground mr-1.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-xs md:text-sm font-medium">
                                        {formatDate(payment.due_date)}
                                      </p>
                                      <p className="text-[10px] md:text-xs text-muted-foreground">
                                        {payment.billing_period > 0
                                          ? `Billing Period #${payment.billing_period}`
                                          : "Additional Charge"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs md:text-sm font-bold">
                                      {formatCurrency(payment.paid_amount || 0)}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`block mt-1 text-[10px] md:text-xs ${getStatusColorClass(
                                        displayStatus,
                                      )}`}
                                    >
                                      {displayStatus}
                                    </Badge>

                                    {/* Expense items tooltip - more mobile friendly - wrapper technique */}
                                    <span className="absolute invisible group-hover:visible z-[100]">
                                      <span className="relative block right-0 bottom-full mb-1 bg-popover shadow-md rounded-md p-2 w-48 xs:w-64 border">
                                        <div className="text-xs font-medium mb-1">
                                          Expense Breakdown:
                                        </div>
                                        <div className="flex justify-between text-xs mb-1">
                                          <span>Rent</span>
                                          <span>
                                            {formatCurrency(payment.rent_due)}
                                          </span>
                                        </div>
                                        {expenseItems.map((item) => (
                                          <div
                                            key={item.id}
                                            className="flex justify-between text-xs mb-1"
                                          >
                                            <span className="truncate mr-2">
                                              {item.name}
                                            </span>
                                            <span className="flex-shrink-0">
                                              {formatCurrency(item.amount)}
                                            </span>
                                          </div>
                                        ))}
                                        <div className="border-t pt-1 mt-1 text-xs font-semibold">
                                          <div className="flex justify-between">
                                            <span>Total</span>
                                            <span>
                                              {formatCurrency(
                                                payment.gross_due,
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </span>
                                    </span>
                                  </div>
                                </div>
                                {showTenantDetails &&
                                  tenantPaymentDetails.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-muted space-y-1">
                                      {tenantPaymentDetails.map(
                                        (tenant, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center justify-between text-[10px] md:text-xs"
                                          >
                                            <div className="flex items-center gap-1">
                                              <User className="h-2.5 w-2.5 text-green-600" />
                                              <span className="text-muted-foreground">
                                                {tenant.name} paid:
                                              </span>
                                            </div>
                                            <span className="font-semibold text-green-600">
                                              {formatCurrency(tenant.amount)}
                                            </span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-20 md:h-24 text-center text-muted-foreground">
                          <p className="text-xs md:text-sm">
                            No recent transactions
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Amenities and Notes Section - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Amenities Section */}
                <Card className="shadow-sm">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base md:text-lg font-semibold flex items-center">
                        <Home className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                        What this place offers
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAmenitiesPopupOpen(true)}
                        className="text-xs h-8"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                    </div>

                    {property &&
                    property.amenities &&
                    JSON.parse(property.amenities).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {JSON.parse(property.amenities).map(
                          (amenityId: string) => {
                            const amenity = AVAILABLE_AMENITIES.find(
                              (a) => a.id === amenityId,
                            );
                            if (!amenity) return null;
                            return (
                              <div
                                key={amenity.id}
                                className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20"
                              >
                                <span className="text-muted-foreground">
                                  {amenity.icon}
                                </span>
                                <span className="text-sm">{amenity.name}</span>
                              </div>
                            );
                          },
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                        <Home className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-sm">No amenities added yet</p>
                        <p className="text-xs mt-1">
                          Click Edit to add amenities to this property
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Notes Section */}
                <Card className="shadow-sm">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base md:text-lg font-semibold flex items-center">
                        <FileText className="h-4 w-4 md:h-5 md:w-5 mr-2 text-orange-600" />
                        Property Notes
                      </h3>
                      {!isAddingNote && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddingNote(true)}
                          className="text-xs h-8"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Add Note
                        </Button>
                      )}
                    </div>

                    {/* Add Note Form */}
                    {isAddingNote && (
                      <div className="mb-4 p-3 bg-muted/30 rounded-lg border">
                        <textarea
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          placeholder="Enter your note e.g. penalty for late payment, maintenance issues, tenant complaints, etc."
                          className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none focus:ring-1 focus:ring-primary bg-background"
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={handleAddNote}
                            disabled={!newNoteText.trim()}
                            className="text-xs h-8"
                          >
                            Save Note
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsAddingNote(false);
                              setNewNoteText("");
                            }}
                            className="text-xs h-8"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Notes List */}
                    {property &&
                    property.notes &&
                    JSON.parse(property.notes).length > 0 ? (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {JSON.parse(property.notes).map(
                          (note: PropertyNote, index: number) => (
                            <div
                              key={note.id}
                              className="p-3 rounded-lg border bg-muted/20 group hover:bg-muted/30 transition-colors"
                            >
                              {editingNoteIndex === index ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingNoteText}
                                    onChange={(e) =>
                                      setEditingNoteText(e.target.value)
                                    }
                                    className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-none focus:ring-1 focus:ring-primary bg-background"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleUpdateNote(index)}
                                      disabled={!editingNoteText.trim()}
                                      className="text-xs h-7"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={cancelEditingNote}
                                      className="text-xs h-7"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm mb-2 whitespace-pre-wrap">
                                    {note.text}
                                  </p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                      {note.updatedAt
                                        ? `Updated ${formatDateTime(note.updatedAt)}`
                                        : `Added ${formatDateTime(note.createdAt)}`}
                                    </span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          startEditingNote(index, note.text)
                                        }
                                        className="h-7 w-7 p-0"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteNote(index)}
                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    ) : !isAddingNote ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                        <FileText className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-sm">No notes added yet</p>
                        <p className="text-xs mt-1">
                          Click Add Note to create a note for this property
                        </p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="finances"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <div className="space-y-4 md:space-y-6">
              {/* Finances tab content... */}
              {property.occupancy_status === "occupied" && activeTenant ? (
                <>
                  {/* Financial Overview - Ticker Strip */}
                  <div className="sticky top-0 z-20">
                    <div className="overflow-hidden bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg border shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
                      <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          View Mode
                        </span>
                        {paxCount > 1 ? (
                          <Select
                            value={billingViewMode}
                            onValueChange={updateBillingViewMode}
                          >
                            <SelectTrigger
                              id="billing-view-strip"
                              className="h-8 text-xs w-full sm:w-[240px] bg-background/90"
                            >
                              <SelectValue placeholder="Select view mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="consolidated">
                                Consolidated (All Tenants)
                              </SelectItem>
                              {tenantProfiles.map((person, idx) => (
                                <SelectItem key={idx} value={`tenant-${idx}`}>
                                  {person.name || `Tenant ${idx + 1}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {selectedBillingTenant?.name ||
                              `Tenant ${(selectedBillingTenantIdx ?? 0) + 1}`}
                          </span>
                        )}
                      </div>
                      <div className="overflow-x-auto scrollbar-hide">
                        <div className="flex items-center justify-between sm:justify-around py-3 px-4 gap-4 sm:gap-6 min-w-max sm:min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                Total Revenue
                              </div>
                              <div className="text-lg font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                                {formatCurrency(totalRevenue)}
                              </div>
                            </div>
                          </div>

                          <div className="h-10 w-px bg-border shrink-0" />

                          <div className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                Pending Payments
                              </div>
                              <div className="text-lg font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                {formatCurrency(pendingPayments)}
                              </div>
                            </div>
                          </div>

                          <div className="h-10 w-px bg-border shrink-0" />

                          <div className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                Unpaid Balance
                              </div>
                              <div className="text-lg font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                                {formatCurrency(unpaidBalance)}
                              </div>
                            </div>
                          </div>

                          <div className="h-10 w-px bg-border shrink-0" />

                          <div className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                Advance Payment
                              </div>
                              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                {activeTenant.advance_payment !== undefined &&
                                activeTenant.advance_payment > 0
                                  ? formatCurrency(activeTenant.advance_payment)
                                  : formatCurrency(0)}
                              </div>
                            </div>
                          </div>

                          <div className="h-10 w-px bg-border shrink-0" />

                          <div className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                Security Deposit
                              </div>
                              <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                                {activeTenant.security_deposit !== undefined &&
                                activeTenant.security_deposit > 0
                                  ? formatCurrency(
                                      activeTenant.security_deposit,
                                    )
                                  : formatCurrency(0)}
                              </div>
                            </div>
                          </div>

                          <div className="h-10 w-px bg-border shrink-0" />

                          <div className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                                Overflow (Excess)
                              </div>
                              <div className="text-lg font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                {activeTenant.overflow !== undefined &&
                                activeTenant.overflow > 0
                                  ? formatCurrency(activeTenant.overflow)
                                  : formatCurrency(0)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex justify-between items-center mb-4 md:mb-6 flex-wrap gap-2">
                        <h3 className="text-base md:text-lg font-semibold flex items-center">
                          <FileText className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                          Billing Table
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              // Auto-select tenant based on current view mode
                              if (billingViewMode.startsWith("tenant-")) {
                                const tenantIdx = parseInt(
                                  billingViewMode.split("-")[1],
                                );
                                setSelectedTenantIndex(tenantIdx);
                              } else {
                                setSelectedTenantIndex(null);
                              }
                              setIsPaymentDialogOpen(true);
                            }}
                            disabled={
                              paxCount > 1 && billingViewMode === "consolidated"
                            }
                            className="text-xs h-8 gap-1.5"
                            title={
                              paxCount > 1 && billingViewMode === "consolidated"
                                ? "Switch to individual tenant view to apply payment"
                                : ""
                            }
                          >
                            Apply Payment
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditBillingPopupOpen(true)}
                            disabled={
                              paxCount > 1 && billingViewMode === "consolidated"
                            }
                            className="text-xs h-8 gap-1.5"
                            title={
                              paxCount > 1 && billingViewMode === "consolidated"
                                ? "Switch to individual tenant view to edit billing"
                                : ""
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit Billing
                          </Button>
                        </div>
                      </div>

                      {/* Info banner for multi-tenant payment tracking - only show in consolidated view */}
                      {paxCount > 1 && billingViewMode === "consolidated" && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                          <div className="flex items-start gap-2">
                            <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                                Consolidated View - All {paxCount} Tenant
                                Accounts
                              </p>
                              <p className="text-xs text-blue-700 dark:text-blue-300">
                                Each tenant has their own billing account. Total
                                amounts shown are the sum of all individual
                                accounts. To edit billing or view detailed
                                breakdowns, select a specific tenant from the
                                dropdown above.
                              </p>
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1.5 italic">
                                Each tenant can have their own custom rent and
                                charges. Use &quot;Edit Billing&quot; to modify
                                individual amounts.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Individual Tenant View Indicator */}
                      {billingViewMode.startsWith("tenant-") && (
                        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4">
                          <div className="flex items-start gap-2">
                            <div className="h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <User className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-purple-900 dark:text-purple-100 mb-1">
                                Individual Account View:{" "}
                                {tenantProfiles[
                                  parseInt(billingViewMode.split("-")[1])
                                ]?.name ||
                                  `Tenant ${parseInt(billingViewMode.split("-")[1]) + 1}`}
                              </p>
                              <p className="text-xs text-purple-700 dark:text-purple-300">
                                Viewing this tenant&apos;s individual billing
                                account. Amounts shown are specific to this
                                tenant only. You can edit this tenant&apos;s
                                billing using the &quot;Edit Billing&quot;
                                button.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Responsive table with horizontal scrolling for small screens */}
                      <div className="overflow-x-auto -mx-4 sm:-mx-6">
                        <div className="inline-block min-w-full align-middle px-4 sm:px-6">
                          <div className="overflow-hidden border rounded-md">
                            {(() => {
                              // Determine if we're viewing individual tenant data
                              const isIndividualView =
                                billingViewMode.startsWith("tenant-");
                              const selectedTenantIdx = isIndividualView
                                ? parseInt(billingViewMode.split("-")[1])
                                : null;
                              // Check if selected tenant slot is vacant
                              const isVacantSlot =
                                isIndividualView &&
                                selectedTenantIdx !== null &&
                                (!tenantProfiles[selectedTenantIdx]?.name ||
                                  tenantProfiles[
                                    selectedTenantIdx
                                  ]?.name.trim() === "");

                              return (
                                <table className="min-w-full divide-y divide-border">
                                  <thead className="bg-muted/50">
                                    <tr>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        Period
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        Due Date
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        Rent Due
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        Other Charges
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        Total Due
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        Paid Amount
                                      </th>
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                      >
                                        Status
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-muted/40 bg-background">
                                    {isVacantSlot ? (
                                      <tr>
                                        <td
                                          colSpan={7}
                                          className="px-3 py-8 text-center"
                                        >
                                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <FileText className="h-8 w-8 mb-2 opacity-40" />
                                            <p className="text-sm font-medium">
                                              No records found
                                            </p>
                                            <p className="text-xs mt-1">
                                              This tenant slot is currently
                                              vacant
                                            </p>
                                          </div>
                                        </td>
                                      </tr>
                                    ) : billingDisplayRows.length > 0 ? (
                                      billingDisplayRows.map((row) => {
                                        const rowStatus =
                                          getEffectiveBillingStatus(
                                            {
                                              status: row.status,
                                              dueDate: row.dueDate,
                                            },
                                            row.paidAmount,
                                            row.grossDue,
                                          );

                                        return (
                                          <tr
                                            key={row.key}
                                            className="hover:bg-muted/30 transition-colors"
                                          >
                                            <td className="px-3 py-2 text-xs whitespace-nowrap">
                                              <div className="flex items-center">
                                                <ClipboardCheck className="h-3 w-3 text-muted-foreground mr-1.5 flex-shrink-0" />
                                                <span>
                                                  {row.billingPeriod > 0 ? (
                                                    row.billingPeriod
                                                  ) : (
                                                    <span className="text-muted-foreground italic">
                                                      —
                                                    </span>
                                                  )}
                                                </span>
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 text-xs whitespace-nowrap">
                                              {formatDueDate(row.dueDate)}
                                            </td>
                                            <td className="px-3 py-2 text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                                              {formatCurrency(row.rentDue)}
                                            </td>
                                            <td className="px-3 py-2 text-xs">
                                              <div className="group inline-block relative">
                                                <div className="flex items-center cursor-help gap-1">
                                                  <span>
                                                    {formatCurrency(
                                                      row.otherCharges,
                                                    )}
                                                  </span>
                                                  <span className="text-[10px] bg-muted rounded-full px-1 flex items-center justify-center w-4 h-4">
                                                    {row.expenseItems.length}
                                                  </span>
                                                </div>

                                                {row.expenseItems.length >
                                                  0 && (
                                                  <span className="absolute invisible group-hover:visible z-[100]">
                                                    <span className="relative block top-full right-0 mt-1 bg-popover shadow-lg rounded-md p-2 min-w-[200px] border">
                                                      <div className="text-xs font-medium mb-1.5">
                                                        {row.billingPeriod > 0
                                                          ? `Expenses for Period ${row.billingPeriod}`
                                                          : "Additional Charges"}
                                                        :
                                                      </div>
                                                      {row.expenseItems.map(
                                                        (item) => (
                                                          <div
                                                            key={item.id}
                                                            className="flex justify-between text-xs mb-1.5"
                                                          >
                                                            <span className="truncate max-w-[150px] pr-4">
                                                              {item.name}
                                                            </span>
                                                            <span className="text-right font-medium">
                                                              {formatCurrency(
                                                                item.amount,
                                                              )}
                                                            </span>
                                                          </div>
                                                        ),
                                                      )}
                                                      {row.expenseItems.length >
                                                        1 && (
                                                        <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between text-xs font-medium">
                                                          <span>
                                                            Total Expenses
                                                          </span>
                                                          <span>
                                                            {formatCurrency(
                                                              row.otherCharges,
                                                            )}
                                                          </span>
                                                        </div>
                                                      )}
                                                    </span>
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap">
                                              {formatCurrency(row.grossDue)}
                                            </td>
                                            <td className="px-3 py-2 text-xs font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                                              {formatCurrency(row.paidAmount)}
                                            </td>
                                            <td className="px-3 py-2 text-xs whitespace-nowrap">
                                              <Badge
                                                variant="outline"
                                                className={`text-[10px] px-1.5 py-0.5 ${getStatusColorClass(
                                                  rowStatus,
                                                )}`}
                                              >
                                                {rowStatus}
                                              </Badge>
                                            </td>
                                          </tr>
                                        );
                                      })
                                    ) : (
                                      <tr>
                                        <td
                                          colSpan={7}
                                          className="px-3 py-8 text-center"
                                        >
                                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <FileText className="h-8 w-8 mb-2 opacity-40" />
                                            <p className="text-sm font-medium">
                                              No billing entries yet
                                            </p>
                                            <p className="text-xs mt-1">
                                              Click &quot;Edit Property&quot; to
                                              add billing entries
                                            </p>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Per-Tenant Payment Summary */}
                      {paxCount > 1 && billingEntries.length > 0 && (
                        <div className="mt-6 cborder-t pt-6">
                          <h4 className="text-sm font-semibold mb-3 flex items-center">
                            <User className="h-4 w-4 mr-2 text-primary" />
                            Payment Summary by Tenant (Grand Total)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {Array.from({ length: paxCount }, (_, i) => {
                              const person = tenantProfiles[i];
                              const tenantId = tenantIdsByIndex[i];

                              // Calculate totals for this tenant across all billing entries
                              let tenantTotalDue = 0;
                              let tenantTotalPaid = 0;

                              billingEntries.forEach((entry) => {
                                if (tenantId && entry.tenant_id === tenantId) {
                                  tenantTotalDue += entry.gross_due;
                                  tenantTotalPaid += entry.paid_amount || 0;
                                }
                              });

                              const tenantBalance =
                                tenantTotalDue - tenantTotalPaid;
                              const isNotYetSet = tenantTotalDue <= 0.01;
                              const isPaidUp =
                                !isNotYetSet && tenantBalance <= 0.01;

                              return (
                                <div
                                  key={i}
                                  className={`p-3 rounded-lg border ${
                                    isNotYetSet
                                      ? "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800"
                                      : isPaidUp
                                        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                                        : "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <div
                                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                        isNotYetSet
                                          ? "bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300"
                                          : isPaidUp
                                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                                            : "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"
                                      }`}
                                    >
                                      <User className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">
                                        {person?.name || `Tenant ${i + 1}`}
                                      </p>
                                      <p
                                        className={`text-[10px] font-medium ${
                                          isNotYetSet
                                            ? "text-gray-600 dark:text-gray-400"
                                            : isPaidUp
                                              ? "text-green-600 dark:text-green-400"
                                              : "text-orange-600 dark:text-orange-400"
                                        }`}
                                      >
                                        {isNotYetSet
                                          ? "Not Yet Set"
                                          : isPaidUp
                                            ? "✓ Paid Up"
                                            : `₱${tenantBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} Due`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Total Due:
                                      </span>
                                      <span className="font-medium">
                                        {formatCurrency(tenantTotalDue)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        Paid:
                                      </span>
                                      <span className="font-medium text-green-600 dark:text-green-400">
                                        {formatCurrency(tenantTotalPaid)}
                                      </span>
                                    </div>
                                    {!isPaidUp && (
                                      <div className="flex justify-between pt-1 border-t">
                                        <span className="font-medium">
                                          Balance:
                                        </span>
                                        <span className="font-bold text-orange-600 dark:text-orange-400">
                                          {formatCurrency(tenantBalance)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-4"></div>
                  <h3 className="text-base md:text-lg font-medium mt-2">
                    No Financial Records
                  </h3>
                  <p className="text-muted-foreground mt-2 max-w-md text-xs md:text-sm">
                    This property is currently vacant. Financial records will be
                    available once a tenant is added to this property.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="history"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <div className="space-y-4">
              <Card className="shadow-sm">
                <CardContent className="p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center">
                    <Clock className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                    Activity Timeline
                  </h3>

                  {activityLogs.length > 0 ? (
                    <div className="space-y-3">
                      {activityLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex gap-3 pb-3 border-b last:border-b-0 last:pb-0"
                        >
                          <div className="flex-shrink-0 mt-1">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {log.action_type.includes("payment") ? (
                                <CreditCard className="h-4 w-4 text-green-600" />
                              ) : log.action_type.includes("tenant") ? (
                                <User className="h-4 w-4 text-blue-600" />
                              ) : log.action_type.includes("property") ? (
                                <Building className="h-4 w-4 text-purple-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {log.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDateTime(log.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <Clock className="h-12 w-12 mb-3 opacity-40" />
                      <p className="text-sm font-medium">No activity yet</p>
                      <p className="text-xs mt-1">
                        Activity history will appear here as changes are made
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="gap-1.5 h-9 text-xs sm:text-sm"
              size="sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Property
            </Button>
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
            const { error } = await supabase
              .from("properties")
              .update({ amenities: JSON.stringify(selectedAmenities) })
              .eq("id", propertyId);

            if (error) throw error;

            // Refresh property data
            await fetchPropertyDetails();

            await logActivity({
              propertyId,
              actionType: "property_updated",
              description: `Amenities updated for ${property?.unit_name || "property"}`,
              metadata: {
                amenities_count: selectedAmenities.length,
              },
            });

            toast.success("Amenities updated successfully");
          } catch (err) {
            console.error("Error updating amenities:", err);
            toast.error(
              "Failed to update amenities. The amenities column may not exist in the database yet.",
            );
          }
        }}
      />

      {isEditPopupOpen && (
        <EditPropertyPopup
          propertyId={propertyId}
          isOpen={isEditPopupOpen}
          onClose={() => setIsEditPopupOpen(false)}
          onSuccess={() => {
            // Refresh data when edit is successful
            fetchPropertyDetails();
            // Call parent's onSuccess to refresh dashboard
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
            // Refresh data when edit is successful
            fetchPropertyDetails();
            // Call parent's onSuccess to refresh dashboard
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
            onClose(); // Close the details popup
            // Refresh the parent component data
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

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="max-w-[90%] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive text-base sm:text-lg">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              Delete Property Permanently
            </AlertDialogTitle>
            <AlertDialogDescription
              className="space-y-2 text-xs sm:text-sm"
              asChild
            >
              <div>
                <div>
                  Are you sure you want to delete{" "}
                  <strong>{property.unit_name}</strong>? This action cannot be
                  undone and will permanently remove:
                </div>
                <ul className="list-disc pl-6 space-y-1">
                  <li>The property record</li>
                  {property.occupancy_status === "occupied" && activeTenant && (
                    <>
                      <li>
                        Tenant information for{" "}
                        {tenantProfiles.length > 1 ? (
                          <strong>
                            Multiple Tenants ({tenantProfiles.length})
                          </strong>
                        ) : (
                          <strong>{activeTenant.tenant_name}</strong>
                        )}
                      </li>
                      <li>All billing and payment records</li>
                    </>
                  )}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              disabled={isDeleting}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteProperty();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm h-8 sm:h-9"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5 sm:mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Permanently"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Universal Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base sm:text-lg">
              Apply Payment
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Enter payment amount and type. Rent applies to billing entries.
            </DialogDescription>
            {selectedTenantIndex !== null &&
              tenantProfiles[selectedTenantIndex] && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-xs text-blue-900 dark:text-blue-100">
                      <span className="font-medium">Applying to: </span>
                      <span className="font-semibold">
                        {tenantProfiles[selectedTenantIndex].name}
                      </span>
                    </p>
                  </div>
                </div>
              )}
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount" className="text-xs sm:text-sm">
                Payment Amount
              </Label>
              <div className="flex gap-1.5">
                <Input
                  id="payment-amount"
                  type="number"
                  value={paymentAmount || ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(/^0+(?=\d)/, "");
                    setPaymentAmount(parseInt(value) || 0);
                  }}
                  placeholder="Enter amount"
                  className="h-8 sm:h-9 flex-1 text-xs sm:text-sm"
                />
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={paymentAmount >= 0 ? "default" : "outline"}
                    size="icon"
                    className={`h-8 w-8 sm:h-9 sm:w-9 ${
                      paymentAmount >= 0
                        ? "!bg-emerald-500 hover:!bg-emerald-600 !text-white"
                        : ""
                    }`}
                    onClick={() => setPaymentAmount(Math.abs(paymentAmount))}
                    disabled={paymentAmount >= 0}
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={paymentAmount < 0 ? "default" : "outline"}
                    size="icon"
                    className={`h-8 w-8 sm:h-9 sm:w-9 ${
                      paymentAmount < 0
                        ? "!bg-red-500 hover:!bg-red-600 !text-white"
                        : ""
                    }`}
                    onClick={() => setPaymentAmount(-Math.abs(paymentAmount))}
                    disabled={paymentAmount <= 0}
                  >
                    <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="payment-type" className="text-xs sm:text-sm">
                  Payment Type
                </Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger
                    id="payment-type"
                    className="h-8 sm:h-9 text-xs sm:text-sm w-full"
                  >
                    <SelectValue placeholder="Choose Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent" className="text-xs sm:text-sm">
                      Rent Due
                    </SelectItem>
                    <SelectItem value="deposit" className="text-xs sm:text-sm">
                      Security Deposit
                    </SelectItem>
                    <SelectItem value="advance" className="text-xs sm:text-sm">
                      Advance Payment
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 flex-1">
                <Label htmlFor="receipt-date" className="text-xs sm:text-sm">
                  Receipt Date
                </Label>
                <Input
                  id="receipt-date"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment-note" className="text-xs sm:text-sm">
                Note
              </Label>
              <Input
                id="payment-note"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Optional note..."
                className="h-8 sm:h-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsPaymentDialogOpen(false);
                setPaymentAmount(0);
                setPaymentType("");
                setPaymentNote("");
                setReceiptDate("");
                setSelectedTenantIndex(null);
              }}
              disabled={isApplyingPayment}
              className="h-8 sm:h-9 text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApplyPayment}
              disabled={
                isApplyingPayment || paymentAmount === 0 || !paymentType
              }
              className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm"
            >
              {isApplyingPayment ? (
                <>
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>Apply Payment</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
