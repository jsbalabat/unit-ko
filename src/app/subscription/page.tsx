"use client";

import { useState, useEffect } from "react";
import { withLandlordAuth } from "@/components/auth/withLandlordAuth";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileText,
  CreditCard,
  Download,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Crown,
  Zap,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Link from "next/link";

interface MonthlyStatement {
  id: string;
  period: string;
  year: number;
  amount: number;
  status: "paid" | "pending" | "overdue";
  dueDate: string;
  paidDate?: string;
}

interface UserSubscription {
  plan: "free" | "basic" | "premium" | "enterprise";
  status: "active" | "cancelled" | "expired";
  currentPeriodEnd?: string;
  propertyLimit: number;
  propertiesUsed: number;
}

const PLAN_DETAILS = {
  free: {
    name: "Free Plan",
    price: 0,
    icon: FileText,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    features: [
      "Up to 3 properties",
      "Basic billing management",
      "Standard support",
    ],
  },
  basic: {
    name: "Basic Plan",
    price: 299,
    icon: Zap,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    features: [
      "Up to 10 properties",
      "Advanced billing management",
      "Priority support",
      "Payment reminders",
    ],
  },
  premium: {
    name: "Premium Plan",
    price: 799,
    icon: Crown,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    features: [
      "Up to 50 properties",
      "Complete management suite",
      "24/7 priority support",
      "Advanced analytics",
      "Custom reports",
    ],
  },
  enterprise: {
    name: "Enterprise Plan",
    price: 1999,
    icon: Crown,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    features: [
      "Unlimited properties",
      "Full feature access",
      "Dedicated account manager",
      "Custom integrations",
      "White-label options",
    ],
  },
};

function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription>({
    plan: "free",
    status: "active",
    propertyLimit: 3,
    propertiesUsed: 0,
  });
  const [statements, setStatements] = useState<MonthlyStatement[]>([]);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch user profile with subscription info
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;

      if (user) {
        // Get profile with subscription data
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("subscription_plan, subscription_status")
          .eq("id", user.id)
          .single();

        if (!profileError && profile) {
          // Get property count
          const { count, error: countError } = await supabase
            .from("properties")
            .select("*", { count: "exact", head: true });

          if (!countError) {
            const plan = (profile.subscription_plan || "free") as
              | "free"
              | "basic"
              | "premium"
              | "enterprise";
            const propertyLimits = {
              free: 3,
              basic: 10,
              premium: 50,
              enterprise: 999,
            };

            setSubscription({
              plan,
              status: (profile.subscription_status || "active") as
                | "active"
                | "cancelled"
                | "expired",
              propertyLimit: propertyLimits[plan],
              propertiesUsed: count || 0,
            });
          }
        }
      }

      // Generate mock monthly statements for demonstration
      const mockStatements: MonthlyStatement[] = [
        {
          id: "1",
          period: "January",
          year: 2026,
          amount: 299,
          status: "pending",
          dueDate: "2026-01-31",
        },
        {
          id: "2",
          period: "December",
          year: 2025,
          amount: 299,
          status: "paid",
          dueDate: "2025-12-31",
          paidDate: "2025-12-30",
        },
        {
          id: "3",
          period: "November",
          year: 2025,
          amount: 299,
          status: "paid",
          dueDate: "2025-11-30",
          paidDate: "2025-11-28",
        },
      ];

      setStatements(mockStatements);
    } catch (err) {
      console.error("Error fetching subscription data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load subscription data",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = (statementId: string) => {
    toast.info("Redirecting to payment gateway...");
    // In production, redirect to actual payment gateway
    window.open("https://www.gcash.com", "_blank");
  };

  const handleDownloadStatement = (statementId: string) => {
    toast.success("Downloading statement...");
    // In production, generate and download PDF
  };

  const handleUpgradePlan = (plan: string) => {
    toast.info(`Upgrade to ${plan} coming soon!`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { variant: "default" | "destructive" | "outline"; icon: any }
    > = {
      paid: { variant: "default", icon: CheckCircle },
      pending: { variant: "outline", icon: AlertCircle },
      overdue: { variant: "destructive", icon: AlertCircle },
    };

    const { variant, icon: Icon } = variants[status] || variants.pending;

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const currentPlan = PLAN_DETAILS[subscription.plan];
  const PlanIcon = currentPlan.icon;

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg animate-pulse">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Loading subscription data...</span>
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
                <FileText className="h-6 w-6" />
                <h1 className="text-2xl md:text-3xl font-bold">
                  Subscription & Billing
                </h1>
              </div>
              <p className="text-muted-foreground">
                Manage your subscription plan and view monthly statements
              </p>
            </div>
            <Link href="/dashboard/landlord">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Current Plan Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlanIcon className={`h-5 w-5 ${currentPlan.color}`} />
                  Current Subscription
                </CardTitle>
                <CardDescription>
                  Your active plan and usage details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">{currentPlan.name}</h3>
                      <p className="text-muted-foreground text-sm">
                        Status:{" "}
                        <span className="font-medium capitalize">
                          {subscription.status}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold">
                        {formatCurrency(currentPlan.price)}
                      </p>
                      <p className="text-sm text-muted-foreground">per month</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">
                        Properties Used
                      </span>
                      <span className="font-medium">
                        {subscription.propertiesUsed} /{" "}
                        {subscription.propertyLimit === 999
                          ? "Unlimited"
                          : subscription.propertyLimit}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            (subscription.propertiesUsed /
                              subscription.propertyLimit) *
                              100,
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Plan Features:</p>
                    <ul className="space-y-1">
                      {currentPlan.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {subscription.plan !== "enterprise" && (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgradePlan("premium")}
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade Plan
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open("https://www.gcash.com", "_blank")}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payment Channels
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleDownloadStatement("current")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Latest Statement
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => toast.info("Billing history coming soon")}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  View Full History
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Statements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Monthly Statements
              </CardTitle>
              <CardDescription>
                View and manage your monthly billing statements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No statements available yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {statements.map((statement) => (
                    <div
                      key={statement.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium">
                            {statement.period} {statement.year}
                          </h4>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {formatDate(statement.dueDate)}
                            </span>
                            {statement.paidDate && (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-green-600" />
                                Paid: {formatDate(statement.paidDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:flex-row-reverse">
                        {statement.status === "pending" ? (
                          <Button
                            size="sm"
                            onClick={() => handlePayNow(statement.id)}
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Pay Now
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleDownloadStatement(statement.id)
                            }
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        )}
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {formatCurrency(statement.amount)}
                          </p>
                          {getStatusBadge(statement.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Plans Section */}
          <div className="mt-6">
            <h2 className="text-xl font-bold mb-4">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(PLAN_DETAILS).map(([key, plan]) => {
                const Icon = plan.icon;
                const isCurrent = subscription.plan === key;
                return (
                  <Card
                    key={key}
                    className={`relative ${
                      isCurrent ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    {isCurrent && (
                      <Badge className="absolute -top-2 -right-2">
                        Current
                      </Badge>
                    )}
                    <CardHeader>
                      <div className={`p-2 rounded-lg ${plan.bgColor} w-fit`}>
                        <Icon className={`h-5 w-5 ${plan.color}`} />
                      </div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="text-2xl font-bold">
                        {formatCurrency(plan.price)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /mo
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ul className="space-y-2">
                        {plan.features.slice(0, 3).map((feature, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-xs"
                          >
                            <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {!isCurrent && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => handleUpgradePlan(plan.name)}
                        >
                          {subscription.plan === "free" ||
                          ["basic", "premium", "enterprise"].indexOf(key) >
                            ["basic", "premium", "enterprise"].indexOf(
                              subscription.plan,
                            )
                            ? "Upgrade"
                            : "Downgrade"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default withLandlordAuth(SubscriptionPage);
