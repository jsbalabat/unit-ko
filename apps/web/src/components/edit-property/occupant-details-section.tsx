"use client";

import { User, Mail, Phone, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PersonDetail, PropertyFormData } from "./types";

interface OccupantDetailsSectionProps {
  formData: PropertyFormData;
  isLocked: boolean;
  editingPersonIndex: number | null;
  setEditingPersonIndex: (index: number | null) => void;
  onUpdatePersonDetail: (
    index: number,
    field: keyof PersonDetail,
    value: string,
  ) => void;
  onRemovePerson: (index: number) => void;
}

export function OccupantDetailsSection({
  formData,
  isLocked,
  editingPersonIndex,
  setEditingPersonIndex,
  onUpdatePersonDetail,
  onRemovePerson,
}: OccupantDetailsSectionProps) {
  return (
    <>
      {/* Person Details Section - Full Width */}
      {formData.pax > 0 && !isLocked && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-base font-semibold">
                Individual Person Details
              </h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Manage individual tenant details. All information is saved to the
            database automatically when you save changes.
            <span className="text-red-500"> * Required field</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: formData.pax }, (_, index) => {
              const person = formData.paxDetails[index] || {
                name: "",
                email: "",
                phone: "",
              };
              const isEditing = editingPersonIndex === index;

              return (
                <Card
                  key={index}
                  className={`border-blue-200 dark:border-blue-800 hover:shadow-md transition-shadow ${
                    index === 0
                      ? "ring-2 ring-blue-400 dark:ring-blue-600"
                      : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-9 w-9 rounded-full flex items-center justify-center ${
                            index === 0
                              ? "bg-blue-600 dark:bg-blue-500"
                              : "bg-blue-100 dark:bg-blue-900/30"
                          }`}
                        >
                          <User
                            className={`h-4 w-4 ${
                              index === 0
                                ? "text-white"
                                : "text-blue-600 dark:text-blue-400"
                            }`}
                          />
                        </div>
                        <div>
                          <span className="text-sm font-semibold">
                            Person {index + 1}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditingPersonIndex(isEditing ? null : index)
                          }
                          className="h-7 text-xs"
                        >
                          {isEditing ? "Done" : "Edit"}
                        </Button>
                        {index > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemovePerson(index)}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
                            title="Remove this person"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <Label
                            htmlFor={`person-${index}-name`}
                            className="text-xs mb-1"
                          >
                            Name{" "}
                            {index === 0 && (
                              <span className="text-red-500">*</span>
                            )}
                          </Label>
                          <Input
                            id={`person-${index}-name`}
                            value={person.name ?? ""}
                            onChange={(e) =>
                              onUpdatePersonDetail(
                                index,
                                "name",
                                e.target.value,
                              )
                            }
                            placeholder={
                              index === 0
                                ? "Enter full name (required)"
                                : "Enter full name"
                            }
                            className="h-9"
                            required={index === 0}
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor={`person-${index}-email`}
                            className="text-xs flex items-center gap-1 mb-1"
                          >
                            <Mail className="h-3 w-3" />
                            Email
                          </Label>
                          <Input
                            id={`person-${index}-email`}
                            type="email"
                            value={person.email ?? ""}
                            onChange={(e) =>
                              onUpdatePersonDetail(
                                index,
                                "email",
                                e.target.value,
                              )
                            }
                            placeholder="Enter email address"
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor={`person-${index}-phone`}
                            className="text-xs flex items-center gap-1 mb-1"
                          >
                            <Phone className="h-3 w-3" />
                            Phone
                          </Label>
                          <Input
                            id={`person-${index}-phone`}
                            type="tel"
                            value={person.phone ?? ""}
                            onChange={(e) =>
                              onUpdatePersonDetail(
                                index,
                                "phone",
                                e.target.value,
                              )
                            }
                            placeholder="Enter phone number"
                            className="h-9"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {person.name ? (
                          <>
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">
                                Name
                              </p>
                              <p className="text-sm font-medium">
                                {person.name}
                              </p>
                            </div>
                            {person.email && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-0.5">
                                  Email
                                </p>
                                <p className="text-xs flex items-center gap-1.5">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  {person.email}
                                </p>
                              </div>
                            )}
                            {person.phone && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-0.5">
                                  Phone
                                </p>
                                <p className="text-xs flex items-center gap-1.5">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {person.phone}
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-xs text-muted-foreground italic">
                              No details added yet
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Click Edit to add information
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Alert className="bg-amber-50 text-amber-800 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription>
          Changing these details won&apos;t automatically update existing
          billing schedules. You&apos;ll need to update payment statuses
          individually.
        </AlertDescription>
      </Alert>

      {formData.occupancyStatus === "vacant" && (
        <Alert className="bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800">
          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription>
            This property is currently vacant. Fill in the person details above
            to house a tenant — occupancy follows the lease and updates on its
            own.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
