import { getStore } from "@/server/store";
import type { DashboardSnapshot } from "@/lib/types";

/**
 * Server-Sent Events stream. Each connected TV gets:
 *  - an immediate full snapshot on connect
 *  - a new snapshot whenever the data source reports a change
 *  - a periodic snapshot every 10s (keeps derived stats like "waiting over
 *    SLA" fresh and doubles as a keep-alive so proxies don't cut the stream)
 *
 * The browser's EventSource reconnects automatically if the connection drops.
 */

export const dynamic = "force-dynamic";

const REFRESH_INTERVAL_MS = 10_000;

export async function GET(request: Request): Promise<Response> {
  const store = getStore();
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (snapshot: DashboardSnapshot) => {
        try {
          controller.enqueue(
            encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`)
          );
        } catch {
          // Stream already closed — cleanup happens via abort below.
        }
      };

      send(store.getSnapshot());
      unsubscribe = store.subscribe(send);
      heartbeat = setInterval(() => send(store.getSnapshot()), REFRESH_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
