import { Button } from "@/components/button";
import Link from "next/link";

export default function LandlordDashboard() {
  return (
    // Landing Page
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
      <h1 className="text-4xl font-bold text-center">
        Packages. More to come soon here.
      </h1>
      <Link href="/dashboard/landlord">
        <Button size="choice">Proceed</Button>
      </Link>
    </main>
  );
}
