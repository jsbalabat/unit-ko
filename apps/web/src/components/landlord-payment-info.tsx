"use client";

import { useState } from "react";
import type { PayoutChannel } from "@unitko/shared";
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

interface LandlordPaymentInfoProps {
  payoutMethods: PayoutChannel[];
  landlordName?: string | null;
}

// Presentational only — the tenant dashboard supplies the landlord's payout
// channels (resolved server-side from the tenant's own lease, so no propertyId
// is trusted from the client).
export function LandlordPaymentInfo({
  payoutMethods,
  landlordName,
}: LandlordPaymentInfoProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyButton = (value: string, label: string) => (
    <Button variant="ghost" size="sm" onClick={() => handleCopy(value, label)}>
      {copiedField === label ? (
        <CheckCircle className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  const bank = payoutMethods.find((m) => m.method === "bank");
  const gcash = payoutMethods.find((m) => m.method === "gcash");
  const paymaya = payoutMethods.find((m) => m.method === "paymaya");
  const other = payoutMethods.find((m) => m.method === "other");

  if (payoutMethods.length === 0) {
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
        {landlordName && (
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg">
            <User className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Pay to</p>
              <p className="font-semibold">{landlordName}</p>
            </div>
          </div>
        )}

        {bank && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CreditCard className="h-4 w-4" />
              Bank Transfer
            </div>
            <div className="space-y-2 pl-6">
              {bank.details && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Bank</p>
                    <p className="font-medium">{bank.details}</p>
                  </div>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              {bank.accountName && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Account Name</p>
                    <p className="font-medium">{bank.accountName}</p>
                  </div>
                  {copyButton(bank.accountName, "Account Name")}
                </div>
              )}
              {bank.accountNumber && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Account Number
                    </p>
                    <p className="font-medium font-mono">{bank.accountNumber}</p>
                  </div>
                  {copyButton(bank.accountNumber, "Account Number")}
                </div>
              )}
            </div>
          </div>
        )}

        {(gcash || paymaya) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Wallet className="h-4 w-4" />
              E-Wallet
            </div>
            <div className="space-y-2 pl-6">
              {gcash?.accountNumber && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                      G
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">GCash</p>
                      <p className="font-medium font-mono">
                        {gcash.accountNumber}
                      </p>
                    </div>
                  </div>
                  {copyButton(gcash.accountNumber, "GCash Number")}
                </div>
              )}
              {paymaya?.accountNumber && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                      PM
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">PayMaya</p>
                      <p className="font-medium font-mono">
                        {paymaya.accountNumber}
                      </p>
                    </div>
                  </div>
                  {copyButton(paymaya.accountNumber, "PayMaya Number")}
                </div>
              )}
            </div>
          </div>
        )}

        {other?.details && (
          <div className="space-y-2 pt-3 border-t">
            <p className="text-sm font-semibold">Additional Instructions</p>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{other.details}</p>
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
