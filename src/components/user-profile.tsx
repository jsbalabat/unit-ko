"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
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
  Building,
  Loader2,
  AlertCircle,
  Edit2,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
}

interface PropertyStats {
  totalProperties: number;
  occupiedProperties: number;
  vacantProperties: number;
}

export function UserProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [propertyStats, setPropertyStats] = useState<PropertyStats>({
    totalProperties: 0,
    occupiedProperties: 0,
    vacantProperties: 0,
  });
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
  });

  useEffect(() => {
    fetchUserProfile();
    fetchPropertyStats();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("No user found");

      setUserProfile({
        id: user.id,
        email: user.email || "",
        created_at: user.created_at || "",
        full_name: user.user_metadata?.full_name || "",
        avatar_url: user.user_metadata?.avatar_url || "",
        phone: user.user_metadata?.phone || "",
      });

      setFormData({
        full_name: user.user_metadata?.full_name || "",
        phone: user.user_metadata?.phone || "",
      });
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const fetchPropertyStats = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("occupancy_status");

      if (error) throw error;

      const stats = {
        totalProperties: data?.length || 0,
        occupiedProperties:
          data?.filter((p) => p.occupancy_status === "occupied").length || 0,
        vacantProperties:
          data?.filter((p) => p.occupancy_status === "vacant").length || 0,
      };

      setPropertyStats(stats);
    } catch (err) {
      console.error("Error fetching property stats:", err);
    }
  };

  const handleSave = async () => {
    if (!userProfile) return;

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: formData.full_name,
          phone: formData.phone,
        },
      });

      if (updateError) throw updateError;

      setUserProfile({
        ...userProfile,
        full_name: formData.full_name,
        phone: formData.phone,
      });

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
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
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
                  </div>
                )}
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

      {/* Property Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Property Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-primary">
                {propertyStats.totalProperties}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Total Properties
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-3xl font-bold text-green-600">
                {propertyStats.occupiedProperties}
              </div>
              <div className="text-sm text-green-700 mt-1">Occupied</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-3xl font-bold text-amber-600">
                {propertyStats.vacantProperties}
              </div>
              <div className="text-sm text-amber-700 mt-1">Vacant</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
