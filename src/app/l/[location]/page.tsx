import { notFound } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { LOCATIONS } from "@/config/team";

/**
 * Single-office dashboard: /l/auckland, /l/christchurch, …
 * Each office TV points at its own URL and only sees (and chimes for) its
 * own enquiries. Location ids come from src/config/team.ts.
 */

export function generateStaticParams() {
  return LOCATIONS.map((l) => ({ location: l.id }));
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location } = await params;
  if (!LOCATIONS.some((l) => l.id === location)) notFound();
  return <Dashboard locationId={location} />;
}
