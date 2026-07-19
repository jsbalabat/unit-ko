"use client";

import { useState, useEffect } from "react";
import { fetchProfile, saveProfile } from "@/services/profileService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  User,
  Mail,
  Calendar,
  Loader2,
  AlertCircle,
  Edit2,
  Save,
  X,
  CreditCard,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Read-only payout values previously reused the edit-mode chrome (border +
// muted fill), so view mode looked editable and an unset field looked like an
// empty input. Padding is kept so toggling edit doesn't shift the layout.
function ReadOnlyValue({
  value,
  className,
}: {
  value?: string;
  className?: string;
}) {
  const isSet = Boolean(value?.trim());

  return (
    <p
      className={cn(
        "px-3 py-2 text-sm",
        isSet ? "text-foreground" : "italic text-muted-foreground",
        isSet && className,
      )}
    >
      {isSet ? value : "Not set"}
    </p>
  );
}

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  role?: string;
  // Payment details
  payment_bank_name?: string;
  payment_account_name?: string;
  payment_account_number?: string;
  payment_gcash_number?: string;
  payment_paymaya_number?: string;
  payment_other_details?: string;
}

export function UserProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  // The bank channel is persisted and tenant-visible as soon as any of its
  // fields is set, so gating this card on the bank *name* alone showed
  // "Not configured" for a landlord who had entered account name and number.
  const hasBankChannel = Boolean(
    userProfile?.payment_bank_name?.trim() ||
      userProfile?.payment_account_name?.trim() ||
      userProfile?.payment_account_number?.trim(),
  );

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    payment_bank_name: "",
    payment_account_name: "",
    payment_account_number: "",
    payment_gcash_number: "",
    payment_paymaya_number: "",
    payment_other_details: "",
  });

  useEffect(() => {
    let ignore = false;
    fetchProfile()
      .then((loaded) => {
        if (ignore) return;
        setUserProfile({
          id: loaded.id,
          email: loaded.email,
          created_at: loaded.createdAt,
          role: loaded.role,
          ...loaded.form,
        });
        setFormData(loaded.form);
      })
      .catch((err) => {
        if (ignore) return;
        console.error("Error fetching user profile:", err);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleSave = async () => {
    if (!userProfile) return;

    setSaving(true);
    setError(null);

    try {
      const loaded = await saveProfile(formData);
      setUserProfile({
        id: loaded.id,
        email: loaded.email,
        created_at: loaded.createdAt,
        role: loaded.role,
        ...loaded.form,
      });
      setFormData(loaded.form);
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err instanceof Error ? err.message : "Failed to update profile");
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: userProfile?.full_name || "",
      phone: userProfile?.phone || "",
      payment_bank_name: userProfile?.payment_bank_name || "",
      payment_account_name: userProfile?.payment_account_name || "",
      payment_account_number: userProfile?.payment_account_number || "",
      payment_gcash_number: userProfile?.payment_gcash_number || "",
      payment_paymaya_number: userProfile?.payment_paymaya_number || "",
      payment_other_details: userProfile?.payment_other_details || "",
    });
    setIsEditing(false);
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const formatDate = (dateString: string) => {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    return `${monthNames[month]} ${day}, ${year}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading profile...</span>
      </div>
    );
  }

  if (error && !userProfile) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={userProfile?.avatar_url} />
              <AvatarFallback className="text-2xl">
                {getInitials(userProfile?.full_name, userProfile?.email)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <h1 className="text-2xl font-bold">
                  {userProfile?.full_name || "No name set"}
                </h1>
                <div className="flex gap-2 sm:min-w-[180px] justify-end">
                  {!isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="gap-2 w-full sm:w-auto"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        disabled={saving}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-2"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Save
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4" />
                  <span>{userProfile?.email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Joined{" "}
                    {userProfile?.created_at &&
                      formatDate(userProfile.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              {isEditing ? (
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  placeholder="Enter your full name"
                />
              ) : (
                <div className="px-3 py-2 border rounded-md bg-muted/50">
                  {userProfile?.full_name || "Not set"}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              {isEditing ? (
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="Enter your phone number"
                />
              ) : (
                <div className="px-3 py-2 border rounded-md bg-muted/50">
                  {userProfile?.phone || "Not set"}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Email Address</Label>
              <div className="px-3 py-2 border rounded-md bg-muted/50 opacity-60">
                {userProfile?.email}
              </div>
              <p className="text-xs text-muted-foreground">
                Email cannot be changed from this page
              </p>
            </div>

            <div className="space-y-2">
              <Label>User ID</Label>
              <div className="px-3 py-2 border rounded-md bg-muted/50 opacity-60 text-xs font-mono truncate">
                {userProfile?.id}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Channels (Landlord Only) */}
      {userProfile?.role === "landlord" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Linked Accounts
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Quick access to payment platforms and methods
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* GCash */}
              <div className="border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer hover:shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">GCash</h3>
                      <p className="text-xs text-muted-foreground">E-Wallet</p>
                    </div>
                  </div>
                  {userProfile?.payment_gcash_number && (
                    <div
                      className="h-2 w-2 rounded-full bg-green-500"
                      title="Active"
                    />
                  )}
                </div>
                {userProfile?.payment_gcash_number ? (
                  <p className="text-xs font-mono">
                    {userProfile.payment_gcash_number}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Not configured
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 text-xs"
                  onClick={() => window.open("https://www.gcash.com", "_blank")}
                >
                  Open GCash
                </Button>
              </div>

              {/* PayMaya */}
              <div className="border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer hover:shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">PayMaya</h3>
                      <p className="text-xs text-muted-foreground">E-Wallet</p>
                    </div>
                  </div>
                  {userProfile?.payment_paymaya_number && (
                    <div
                      className="h-2 w-2 rounded-full bg-green-500"
                      title="Active"
                    />
                  )}
                </div>
                {userProfile?.payment_paymaya_number ? (
                  <p className="text-xs font-mono">
                    {userProfile.payment_paymaya_number}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Not configured
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 text-xs"
                  onClick={() =>
                    window.open("https://www.paymaya.com", "_blank")
                  }
                >
                  Open PayMaya
                </Button>
              </div>

              {/* Bank Transfer */}
              <div className="border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer hover:shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Bank Transfer</h3>
                      <p className="text-xs text-muted-foreground">
                        Direct Deposit
                      </p>
                    </div>
                  </div>
                  {hasBankChannel && (
                    <div
                      className="h-2 w-2 rounded-full bg-green-500"
                      title="Active"
                    />
                  )}
                </div>
                {hasBankChannel ? (
                  <p className="text-xs">
                    {userProfile?.payment_bank_name ||
                      userProfile?.payment_account_name}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Not configured
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 text-xs"
                  onClick={() => setIsEditing(true)}
                >
                  Configure
                </Button>
              </div>
            </div>

            <Alert className="mt-4 bg-muted/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Configure your payment details below to activate these payment
                channels for your tenants.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Payment Details (Landlord Only) */}
      {userProfile?.role === "landlord" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Payment Details (Visible to Tenants)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Add your payment information so tenants know where to send rent
              payments
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bank Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <CreditCard className="h-4 w-4" />
                Bank Account Details
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="payment_bank_name">Bank Name</Label>
                  {isEditing ? (
                    <Input
                      id="payment_bank_name"
                      value={formData.payment_bank_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payment_bank_name: e.target.value,
                        })
                      }
                      placeholder="e.g., BDO, BPI, Metrobank"
                    />
                  ) : (
                    <ReadOnlyValue value={userProfile?.payment_bank_name} />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_account_name">Account Name</Label>
                  {isEditing ? (
                    <Input
                      id="payment_account_name"
                      value={formData.payment_account_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payment_account_name: e.target.value,
                        })
                      }
                      placeholder="Full name on account"
                    />
                  ) : (
                    <ReadOnlyValue value={userProfile?.payment_account_name} />
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="payment_account_number">Account Number</Label>
                  {isEditing ? (
                    <Input
                      id="payment_account_number"
                      value={formData.payment_account_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payment_account_number: e.target.value,
                        })
                      }
                      placeholder="Bank account number"
                    />
                  ) : (
                    <ReadOnlyValue
                      value={userProfile?.payment_account_number}
                      className="font-mono"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* E-Wallet Details */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Wallet className="h-4 w-4" />
                E-Wallet Details
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="payment_gcash_number">GCash Number</Label>
                  {isEditing ? (
                    <Input
                      id="payment_gcash_number"
                      value={formData.payment_gcash_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payment_gcash_number: e.target.value,
                        })
                      }
                      placeholder="09XXXXXXXXX"
                    />
                  ) : (
                    <ReadOnlyValue
                      value={userProfile?.payment_gcash_number}
                      className="font-mono"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_paymaya_number">PayMaya Number</Label>
                  {isEditing ? (
                    <Input
                      id="payment_paymaya_number"
                      value={formData.payment_paymaya_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payment_paymaya_number: e.target.value,
                        })
                      }
                      placeholder="09XXXXXXXXX"
                    />
                  ) : (
                    <ReadOnlyValue
                      value={userProfile?.payment_paymaya_number}
                      className="font-mono"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Other Payment Details */}
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="payment_other_details">
                  Additional Payment Instructions
                </Label>
                {isEditing ? (
                  <textarea
                    id="payment_other_details"
                    value={formData.payment_other_details}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        payment_other_details: e.target.value,
                      })
                    }
                    placeholder="Add any additional payment instructions or details..."
                    className="w-full h-24 px-3 py-2 text-sm border rounded-md focus:ring-1 resize-none"
                  />
                ) : (
                  <ReadOnlyValue
                    value={userProfile?.payment_other_details}
                    className="whitespace-pre-wrap"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Include any special instructions for tenants (e.g., reference
                  numbers, preferred payment times)
                </p>
              </div>
            </div>

            {!isEditing && (
              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
                  These payment details will be visible to all your tenants when
                  they view their billing information.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
