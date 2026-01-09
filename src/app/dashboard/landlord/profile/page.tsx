"use client";

import { SiteHeader } from "@/components/site-header";
import { UserProfile } from "@/components/user-profile";

export default function ProfilePage() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <UserProfile />
      </div>
    </>
  );
}
