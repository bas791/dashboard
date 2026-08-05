import { NextResponse } from "next/server";
import { getStore } from "@/server/store";

/**
 * One-shot snapshot endpoint. Used as a polling fallback if SSE is
 * unavailable (some corporate proxies), and handy for debugging:
 * `curl localhost:3000/api/snapshot`
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getStore().getSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
