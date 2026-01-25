"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard,
  Wallet,
  Building2,
  User,
  AlertCircle,
  Copy,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/button";
import { toast } from "sonner";

interface LandlordPaymentDetails {
  payment_bank_name?: string;
  payment_account_name?: string;
  payment_account_number?: string;
  payment_gcash_number?: string;
  payment_paymaya_number?: string;
  payment_other_details?: string;
  full_name?: string;
}

interface LandlordPaymentInfoProps {
  landlordId?: string;
  propertyId?: string;
}

export function LandlordPaymentInfo({
  landlordId,
  propertyId,
}: LandlordPaymentInfoProps) {
  const [paymentDetails, setPaymentDetails] =
    useState<LandlordPaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetchLandlordPaymentDetails();
  }, [landlordId, propertyId]);

  const fetchLandlordPaymentDetails = async () => {
    try {
      let landlordIdToUse = landlordId;
      let propertyIdToUse = propertyId;

      // If no landlordId provided, fetch from property
      if (!landlordIdToUse && propertyId) {
        const { data: property, error: propertyError } = await supabase
          .from("properties")
          .select("landlord_id")
          .eq("id", propertyId)
          .single();

        if (propertyError) {
          // Silently handle error
          setPaymentDetails({});
          return;
        }
        landlordIdToUse = property?.landlord_id;
      }

      // Use database function to fetch payment info (bypasses RLS)
      if (propertyIdToUse) {
        const { data, error } = await supabase.rpc(
          "get_landlord_payment_info",
          {
            property_id_param: propertyIdToUse,
          },
        );

        if (error) {
          // Silently handle error - function might not exist yet or other DB issue
          setPaymentDetails({});
          return;
        }

        // The function returns an array, get the first result
        if (data && data.length > 0) {
          setPaymentDetails(data[0]);
        } else {
          setPaymentDetails({});
        }
        return;
      }

      // Fallback: if we have landlordId but no propertyId, try direct query
      if (landlordIdToUse) {
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select(
            "payment_bank_name, payment_account_name, payment_account_number, payment_gcash_number, payment_paymaya_number, payment_other_details, full_name",
          )
          .eq("id", landlordIdToUse)
          .single();

        if (profileError) {
          // Silently handle errors - tenants without auth can't access profiles due to RLS
          setPaymentDetails({});
          return;
        }

        setPaymentDetails(data);
        return;
      }

      // No landlordId or propertyId available
      setPaymentDetails({});
    } catch (error) {
      // Silently handle any unexpected errors
      setPaymentDetails({});
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payment Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-10 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasAnyPaymentDetails =
    paymentDetails?.payment_bank_name ||
    paymentDetails?.payment_account_number ||
    paymentDetails?.payment_gcash_number ||
    paymentDetails?.payment_paymaya_number;

  if (!hasAnyPaymentDetails) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payment Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your landlord has not yet added payment details. Please contact
              them directly for payment instructions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Payment Information
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Use any of the following methods to pay your rent
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Landlord Name */}
        {paymentDetails?.full_name && (
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg">
            <User className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Pay to</p>
              <p className="font-semibold">{paymentDetails.full_name}</p>
            </div>
          </div>
        )}

        {/* Bank Details */}
        {(paymentDetails?.payment_bank_name ||
          paymentDetails?.payment_account_number) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CreditCard className="h-4 w-4" />
              Bank Transfer
            </div>

            <div className="space-y-2 pl-6">
              {paymentDetails?.payment_bank_name && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Bank</p>
                    <p className="font-medium">
                      {paymentDetails.payment_bank_name}
                    </p>
                  </div>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
              )}

              {paymentDetails?.payment_account_name && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Account Name
                    </p>
                    <p className="font-medium">
                      {paymentDetails.payment_account_name}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(
                        paymentDetails.payment_account_name!,
                        "Account Name",
                      )
                    }
                  >
                    {copiedField === "Account Name" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {paymentDetails?.payment_account_number && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Account Number
                    </p>
                    <p className="font-medium font-mono">
                      {paymentDetails.payment_account_number}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(
                        paymentDetails.payment_account_number!,
                        "Account Number",
                      )
                    }
                  >
                    {copiedField === "Account Number" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* E-Wallet Details */}
        {(paymentDetails?.payment_gcash_number ||
          paymentDetails?.payment_paymaya_number) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Wallet className="h-4 w-4" />
              E-Wallet
            </div>

            <div className="space-y-2 pl-6">
              {paymentDetails?.payment_gcash_number && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                      G
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">GCash</p>
                      <p className="font-medium font-mono">
                        {paymentDetails.payment_gcash_number}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(
                        paymentDetails.payment_gcash_number!,
                        "GCash Number",
                      )
                    }
                  >
                    {copiedField === "GCash Number" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {paymentDetails?.payment_paymaya_number && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                      PM
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">PayMaya</p>
                      <p className="font-medium font-mono">
                        {paymentDetails.payment_paymaya_number}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(
                        paymentDetails.payment_paymaya_number!,
                        "PayMaya Number",
                      )
                    }
                  >
                    {copiedField === "PayMaya Number" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Additional Instructions */}
        {paymentDetails?.payment_other_details && (
          <div className="space-y-2 pt-3 border-t">
            <p className="text-sm font-semibold">Additional Instructions</p>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">
                {paymentDetails.payment_other_details}
              </p>
            </div>
          </div>
        )}

        <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
            After making your payment, please keep your proof of payment (e.g.,
            transaction reference, screenshot) for your records.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
