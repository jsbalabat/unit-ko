import { Button } from "@/components/button";
import { ModeToggle } from "@/components/mode-toggle";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "UnitKo",
  description:
    "A platform for lessors and lessees to connect and manage their agreements.",
};

export default function Home() {
  return (
    <main className="relative min-h-screen">
      {/* ModeToggle positioned at top right */}
      <div className="absolute top-4 right-4 z-10">
        <ModeToggle />
      </div>
      {/* Landing Page */}
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <h1 className="text-4xl font-bold text-center">Welcome to UnitKo!</h1>
        <p className="text-lg text-center text-gray-600 max-w-md">
          Select your role to get started
        </p>
        <Link href="/auth/landlord/login">
          <Button size="choice">Landlord</Button>
        </Link>
        <Link href="/auth/tenant/login">
          <Button size="choice">Tenant</Button>
        </Link>
      </div>
    </main>
  );
}

