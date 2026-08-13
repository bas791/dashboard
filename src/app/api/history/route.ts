import { NextRequest, NextResponse } from "next/server";
import { fetchHistory } from "@/server/history";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const raw = Number.parseInt(request.nextUrl.searchParams.get("days") ?? "14", 10);
  const days = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 60) : 14;
  return NextResponse.json(await fetchHistory(days));
}
