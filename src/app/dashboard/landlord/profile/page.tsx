"use client";

import { withLandlordAuth } from "@/components/auth/withLandlordAuth";
import { SiteHeader } from "@/components/site-header";
import { UserProfile } from "@/components/user-profile";

function ProfilePage() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <UserProfile />
      </div>
    </>
  );
}

export default withLandlordAuth(ProfilePage);
