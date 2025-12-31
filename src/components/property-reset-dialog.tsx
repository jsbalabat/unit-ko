"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Archive, Loader2 } from "lucide-react";

interface PropertyResetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (remarks: string) => Promise<void>;
  propertyName: string;
  tenantName: string;
}

export function PropertyResetDialog({
  isOpen,
  onClose,
  onConfirm,
  propertyName,
  tenantName,
}: PropertyResetDialogProps) {
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!remarks.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(remarks);
      setRemarks("");
      onClose();
    } catch (error) {
      console.error("Reset failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRemarks("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <Archive className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <DialogTitle>Reset Property</DialogTitle>
              <DialogDescription className="text-sm">
                Archive current tenant and prepare for new rental
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will archive the current tenant data and reset the property
              to vacant status. This action cannot be undone.
            </AlertDescription>
          </Alert>

          {/* Property Details */}
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Property:</span>
              <span className="font-medium">{propertyName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Tenant:</span>
              <span className="font-medium">{tenantName}</span>
            </div>
          </div>

          {/* Remarks Input */}
          <div className="space-y-2">
            <Label htmlFor="remarks">
              Remarks <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="remarks"
              placeholder="e.g., Contract completed successfully, Tenant moved out on time, Early termination due to..."
              value={remarks}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setRemarks(e.target.value)
              }
              rows={4}
              className="resize-none"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Provide a reason for archiving this rental (min. 10 characters)
            </p>
          </div>

          {/* What will happen */}
          <div className="space-y-2">
            <p className="text-sm font-medium">What will happen:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Current tenant data will be archived</li>
              <li>All billing entries will be archived</li>
              <li>Property status will be set to &quot;Vacant&quot;</li>
              <li>Property will be ready for a new tenant</li>
              <li>Archived data can be viewed in the Archives section</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={
              !remarks.trim() || remarks.trim().length < 10 || isSubmitting
            }
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Archiving...
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                Archive & Reset
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
