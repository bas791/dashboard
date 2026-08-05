import type { ActivityEvent, Enquiry } from "@/lib/types";

/**
 * Contract every data source implements. The dashboard store only talks to
 * this interface, so swapping mock → GoHighLevel (or adding a second
 * sub-account later) requires no changes elsewhere.
 */
export interface DataSource {
  /** Human-readable identifier, surfaced in the UI footer. */
  readonly kind: "mock" | "ghl";

  /** Begin producing data (start timers / polling). Idempotent. */
  start(): void;

  /** Stop timers and release resources. */
  stop(): void;

  /** Today's enquiries, newest first. */
  getEnquiries(): Enquiry[];

  /** Recent activity events, newest first. */
  getActivity(): ActivityEvent[];

  /**
   * Subscribe to change notifications (new enquiry, status change, poll
   * completed). Returns an unsubscribe function.
   */
  onChange(listener: () => void): () => void;
}
