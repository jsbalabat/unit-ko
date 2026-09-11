"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/button";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  User,
  Calendar,
  Clock,
  Pencil,
  Phone,
  FileText,
  CreditCard,
  Home,
  Trash2,
  TrendingUp,
  Plus,
} from "lucide-react";
import { AVAILABLE_AMENITIES } from "@/components/amenities-popup";
import {
  Property,
  Tenant,
  PropertyNote,
  BillingEntry,
  ExpenseItem,
  formatCurrency,
  formatDate,
  formatDueDate,
  formatDateTime,
  calculateDaysUntilDue,
  formatStatusForDisplay,
  getStatusColorClass,
} from "./types";

export interface PropertyDetailsTabProps {
  property: Property;
  activeTenants: Tenant[];
  activeTenant: Tenant | undefined;
  paxCount: number;
  tenantProfiles: Array<{ name: string; email: string; phone: string }>;
  tenantIdsByIndex: string[];
  upcomingPayments: BillingEntry[];
  recentPayments: BillingEntry[];
  onOpenAmenities: () => void;
  // Notes state & handlers
  isAddingNote: boolean;
  setIsAddingNote: (isAdding: boolean) => void;
  newNoteText: string;
  setNewNoteText: (text: string) => void;
  editingNoteIndex: number | null;
  editingNoteText: string;
  setEditingNoteText: (text: string) => void;
  handleAddNote: () => Promise<void>;
  handleUpdateNote: (index: number) => Promise<void>;
  handleDeleteNote: (index: number) => Promise<void>;
  startEditingNote: (index: number, currentText: string) => void;
  cancelEditingNote: () => void;
}

export function PropertyDetailsTab({
  property,
  activeTenants,
  activeTenant,
  paxCount,
  tenantProfiles,
  tenantIdsByIndex,
  upcomingPayments,
  recentPayments,
  onOpenAmenities,
  isAddingNote,
  setIsAddingNote,
  newNoteText,
  setNewNoteText,
  editingNoteIndex,
  editingNoteText,
  setEditingNoteText,
  handleAddNote,
  handleUpdateNote,
  handleDeleteNote,
  startEditingNote,
  cancelEditingNote,
}: PropertyDetailsTabProps) {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Property Information Card */}
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
                    paxCount > property.max_tenants ? (
                      <span
                        className="text-amber-600 dark:text-amber-400"
                        title="Over capacity — adjust capacity in Edit Property or remove tenants"
                      >
                        Occupied ({paxCount}/{property.max_tenants}) ⚠
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">
                        Occupied ({paxCount}/{property.max_tenants})
                      </span>
                    )
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

        {/* Tenant Information Card */}
        {activeTenant ? (
          <Card className="shadow-sm">
            <CardContent className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                <User className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                Tenant Information
              </h3>
              <div className="space-y-4">
                <div className="space-y-2 md:space-y-3 text-sm">
                  <div className="grid grid-cols-2 items-center">
                    <span className="text-muted-foreground text-xs md:text-sm">
                      Number of Occupants
                    </span>
                    <span className="font-medium text-xs md:text-sm">
                      {activeTenants.length}{" "}
                      {activeTenants.length === 1 ? "person" : "people"}
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
                              {formatCurrency(activeTenant.advance_payment)}
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
                              {formatCurrency(activeTenant.security_deposit)}
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
          {/* Upcoming Payments Card */}
          <Card className="shadow-sm">
            <CardContent className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                Upcoming Payments
              </h3>
              {upcomingPayments.length > 0 ? (
                <div className="space-y-2 md:space-y-3">
                  {upcomingPayments.slice(0, 3).map((payment) => {
                    const displayStatus = formatStatusForDisplay(payment.status);
                    const daysUntil = calculateDaysUntilDue(payment.due_date);

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
                        tenantIdx >= 0 ? tenantProfiles[tenantIdx] : undefined;
                      const tenantName =
                        person?.name ||
                        (tenantIdx >= 0 ? `Tenant ${tenantIdx + 1}` : "Tenant");

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
                                payment.gross_due - (payment.paid_amount || 0),
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
                        {showTenantDetails && tenantDetails.length > 0 && (
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
                  <p className="text-xs md:text-sm">No upcoming payments</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions Card */}
          <Card className="shadow-sm">
            <CardContent className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                Recent Transactions
              </h3>
              {recentPayments.length > 0 ? (
                <div className="space-y-2 md:space-y-3">
                  {recentPayments.slice(0, 3).map((payment) => {
                    let expenseItems: ExpenseItem[] = [
                      {
                        id: `default-${payment.id}`,
                        name: "Miscellaneous",
                        amount: payment.other_charges,
                      },
                    ];

                    if (payment.expense_items) {
                      try {
                        const parsed = JSON.parse(payment.expense_items);
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

                    const displayStatus = formatStatusForDisplay(payment.status);

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
                        tenantIdx >= 0 ? tenantProfiles[tenantIdx] : undefined;
                      const tenantName =
                        person?.name ||
                        (tenantIdx >= 0 ? `Tenant ${tenantIdx + 1}` : "Tenant");
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
                                      {formatCurrency(payment.gross_due)}
                                    </span>
                                  </div>
                                </div>
                              </span>
                            </span>
                          </div>
                        </div>
                        {showTenantDetails && tenantPaymentDetails.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-muted space-y-1">
                            {tenantPaymentDetails.map((tenant, idx) => (
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
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-20 md:h-24 text-center text-muted-foreground">
                  <p className="text-xs md:text-sm">No recent transactions</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Amenities and Notes Section */}
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
                onClick={onOpenAmenities}
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
                {JSON.parse(property.amenities).map((amenityId: string) => {
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
                })}
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
  );
}
