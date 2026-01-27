"use client";

import { useState, useEffect } from "react";
import { withLandlordAuth } from "@/components/auth/withLandlordAuth";
import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/button";
import {
  Building,
  MapPin,
  Loader2,
  AlertCircle,
  Archive,
  User,
  Calendar,
  FileText,
  Eye,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  fetchArchivedTenants,
  type ArchivedTenant,
} from "@/services/archiveService";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface BillingEntry {
  id: string;
  due_date: string;
  rent_due: number;
  other_charges: number;
  gross_due: number;
  status: string;
  billing_period: number;
}

function ArchivesPage() {
  const [archivedTenants, setArchivedTenants] = useState<ArchivedTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArchive, setSelectedArchive] = useState<ArchivedTenant | null>(
    null,
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    loadArchivedTenants();
  }, []);

  const loadArchivedTenants = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchArchivedTenants();
    if (fetchError) {
      setError(fetchError);
    } else {
      setArchivedTenants(data || []);
    }
    setLoading(false);
  };

  const handleViewDetails = (archive: ArchivedTenant) => {
    setSelectedArchive(archive);
    setIsDetailsOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg animate-pulse">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Loading archived data...</span>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="pb-12">
        <div className="container mx-auto px-4 md:px-6 py-6 max-w-7xl">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Archive className="h-6 w-6" />
                <h1 className="text-2xl md:text-3xl font-bold">
                  Archived Rentals
                </h1>
              </div>
              <p className="text-muted-foreground">
                View history of completed and terminated rental agreements
              </p>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Archives
                    </p>
                    <p className="text-2xl font-bold">
                      {archivedTenants.length}
                    </p>
                  </div>
                  <Archive className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Revenue
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(
                        archivedTenants.reduce(
                          (sum, t) => sum + t.total_paid,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Properties with History
                    </p>
                    <p className="text-2xl font-bold">
                      {new Set(archivedTenants.map((t) => t.property_id)).size}
                    </p>
                  </div>
                  <Building className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Empty State */}
          {archivedTenants.length === 0 && (
            <div className="text-center py-10 px-4 border rounded-xl bg-muted/20">
              <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">No Archives Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Archived tenant data will appear here when you reset properties
                for new tenants.
              </p>
            </div>
          )}

          {/* Archives Grid */}
          {archivedTenants.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {archivedTenants.map((archive) => (
                <Card
                  key={archive.id}
                  className="hover:shadow-md transition-all"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-1">
                          {archive.property_name}
                        </CardTitle>
                        <CardDescription className="flex items-center text-xs mt-1">
                          <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">
                            {archive.property_location}
                          </span>
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {archive.property_type}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium truncate">
                        {archive.tenant_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {formatDate(archive.rent_start_date)} -{" "}
                        {formatDate(archive.rent_end_date)}
                      </span>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Total Paid
                        </span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(archive.total_paid)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Due</span>
                        <span className="font-medium">
                          {formatCurrency(archive.total_due)}
                        </span>
                      </div>
                    </div>
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-1">
                        Archive Reason:
                      </p>
                      <p className="text-sm line-clamp-2">
                        {archive.archive_reason}
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleViewDetails(archive)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Details Dialog */}
      {selectedArchive && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-xl">
                Archive Details: {selectedArchive.property_name}
              </DialogTitle>
              <DialogDescription>
                Archived on {formatDate(selectedArchive.archived_at)}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Property & Tenant Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Property Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">
                          {selectedArchive.property_name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-medium">
                          {selectedArchive.property_type}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location:</span>
                        <span className="font-medium">
                          {selectedArchive.property_location}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Tenant Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">
                          {selectedArchive.tenant_name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Contact:</span>
                        <span className="font-medium">
                          {selectedArchive.contact_number}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Contract Length:
                        </span>
                        <span className="font-medium">
                          {selectedArchive.contract_months} months
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Financial Summary */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    Financial Summary
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">
                          Monthly Rent
                        </p>
                        <p className="text-lg font-bold">
                          {formatCurrency(selectedArchive.rent_amount)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">
                          Total Due
                        </p>
                        <p className="text-lg font-bold">
                          {formatCurrency(selectedArchive.total_due)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">
                          Total Paid
                        </p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(selectedArchive.total_paid)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(
                            selectedArchive.total_due -
                              selectedArchive.total_paid,
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator />

                {/* Archive Reason */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Archive Reason
                  </h3>
                  <p className="text-sm bg-muted/50 p-4 rounded-lg">
                    {selectedArchive.archive_reason}
                  </p>
                </div>

                {/* Billing History */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Billing History</h3>
                  <div className="space-y-2">
                    {JSON.parse(selectedArchive.billing_entries).map(
                      (entry: BillingEntry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium">
                              Month {entry.billing_period}
                            </span>
                            <span className="text-muted-foreground">
                              Due: {formatDate(entry.due_date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-medium">
                              {formatCurrency(entry.gross_due)}
                            </span>
                            <Badge
                              variant={
                                entry.status.toLowerCase().includes("paid") ||
                                entry.status.toLowerCase().includes("good")
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {entry.status}
                            </Badge>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default withLandlordAuth(ArchivesPage);
