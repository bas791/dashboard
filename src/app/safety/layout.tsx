import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { currentPerson } from "@/server/safety/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Safety",
  description: "Equipment register, inspections and vehicle pre-start checks",
  manifest: "/safety.webmanifest",
  appleWebApp: { capable: true, title: "Safety", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

/**
 * The safety section is used on phones outdoors, so unlike the TV wallboard
 * it is light-themed with large touch targets.
 */
export default async function SafetyLayout({ children }: { children: React.ReactNode }) {
  const person = await currentPerson();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 [color-scheme:light]">
      <header className="sticky top-0 z-10 border-b border-teal-800 bg-teal-700 text-white">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
          <Link href="/safety" className="text-lg font-bold tracking-tight">
            Safety
          </Link>
          <Link href="/safety/who" className="flex min-h-10 items-center rounded-full bg-white/15 px-3 text-sm font-medium">
            {person ? person.name : "Choose name"}
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
