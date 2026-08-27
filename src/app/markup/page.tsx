import type { Metadata } from "next";
import { MarkupWorkspace } from "@/components/markup/MarkupWorkspace";

export const metadata: Metadata = {
  title: "Mould & Growth Photo Report",
  description:
    "Drop site photos in and have the mould, lichen and moss outlined and written up as a client report.",
};

export default function MarkupPage() {
  return (
    <main className="min-h-screen bg-zinc-900 print:bg-white">
      <MarkupWorkspace />
    </main>
  );
}
