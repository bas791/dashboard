import { LOCATIONS, teamForLocation } from "@/config/team";
import type { ActivityEvent, ActivityType, Enquiry, EnquiryStatus } from "@/lib/types";
import type { DataSource } from "./types";

/**
 * Mock data source: simulates a realistic day of enquiries so the dashboard
 * can be developed, demoed and TV-tested without GoHighLevel credentials.
 *
 * Behaviour:
 *  - seeds a handful of already-processed enquiries from earlier today
 *  - spawns a brand-new enquiry every 25–90 seconds
 *  - "salespeople" respond after a random delay (some inside SLA, some not,
 *    and some are left waiting so the red/pulsing state is visible)
 *  - responded enquiries progress through qualified → booked → won/lost
 */

const SOURCES = [
  "Website Form",
  "Facebook Ads",
  "Google Ads",
  "Instagram",
  "Phone Enquiry",
  "Referral",
];

const FIRST_NAMES = [
  "John", "Jane", "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan",
  "Sophie", "Jack", "Mia", "Lucas", "Chloe", "Ben", "Grace", "Ryan",
  "Holly", "Sam", "Ruby", "Max", "Ella", "Josh", "Amelia", "Daniel",
];

const LAST_NAMES = [
  "Smith", "Doe", "Wilson", "Taylor", "Brown", "Walker", "Thompson",
  "Anderson", "Clark", "Wright", "Mitchell", "Campbell", "Stewart",
  "Morris", "Hughes", "Baker", "Reid", "Murray", "King", "Scott",
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** A random salesperson for a location, or null if the location has no team. */
function pickRep(locationId: string): string | null {
  const team = teamForLocation(locationId);
  return team.length > 0 ? pick(team).name : null;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomPhone(): string {
  const prefix = pick(["021", "022", "027"]);
  return `${prefix} ${Math.floor(randomBetween(100, 999))} ${Math.floor(
    randomBetween(1000, 9999)
  )}`;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

interface ScheduledAction {
  runAt: number;
  run: () => void;
}

export class MockDataSource implements DataSource {
  readonly kind = "mock" as const;

  private enquiries: Enquiry[] = [];
  private activity: ActivityEvent[] = [];
  private listeners = new Set<() => void>();
  private pending: ScheduledAction[] = [];
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private nextSpawnAt = 0;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.seedHistory();
    // First fresh enquiry lands quickly so a newly-opened dashboard shows the
    // alert + timer flow within ~20 seconds.
    this.nextSpawnAt = Date.now() + 20_000;
    this.tickHandle = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;
    this.started = false;
  }

  getEnquiries(): Enquiry[] {
    return [...this.enquiries].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  }

  getActivity(): ActivityEvent[] {
    return this.activity.slice(0, 50);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private emit(): void {
    for (const l of this.listeners) l();
  }

  private log(
    type: ActivityType,
    message: string,
    locationId: string,
    at: number = Date.now()
  ): void {
    this.activity.unshift({
      id: nextId("act"),
      at: new Date(at).toISOString(),
      type,
      message,
      locationId,
    });
    this.activity = this.activity.slice(0, 100);
  }

  private tick(): void {
    const now = Date.now();
    let changed = false;

    if (now >= this.nextSpawnAt) {
      this.spawnEnquiry();
      this.nextSpawnAt = now + randomBetween(25_000, 90_000);
      changed = true;
    }

    const due = this.pending.filter((a) => a.runAt <= now);
    if (due.length > 0) {
      this.pending = this.pending.filter((a) => a.runAt > now);
      for (const action of due) action.run();
      changed = true;
    }

    if (changed) this.emit();
  }

  private schedule(delayMs: number, run: () => void): void {
    this.pending.push({ runAt: Date.now() + delayMs, run });
  }

  /** Create enquiries from earlier today so stats/leaderboard aren't empty. */
  private seedHistory(): void {
    const now = Date.now();
    const count = 14 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const receivedAt = now - randomBetween(30, 300) * 60_000;
      const responseDelay = randomBetween(30, 14 * 60) * 1000;
      const respondedAt = receivedAt + responseDelay;
      const locationId = pick(LOCATIONS).id;
      const assignedTo = pickRep(locationId);
      const status = pick<EnquiryStatus>([
        "contacted", "contacted", "chasing", "qualified", "qualified", "booked", "booked", "won", "lost",
      ]);
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      this.enquiries.push({
        id: nextId("enq"),
        contactName: name,
        phone: randomPhone(),
        source: pick(SOURCES),
        assignedTo,
        locationId,
        status,
        receivedAt: new Date(receivedAt).toISOString(),
        respondedAt: new Date(respondedAt).toISOString(),
      });
      this.log("enquiry_received", `${name} submitted a form`, locationId, receivedAt);
      if (status === "won") this.log("won", `Deal won — ${name}`, locationId, respondedAt);
      if (status === "booked")
        this.log("booked", `Appointment booked with ${name}`, locationId, respondedAt);
    }
    // One recent enquiry still waiting, already past SLA, so the red state
    // is visible immediately on load.
    const staleName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const staleReceived = now - 11.5 * 60_000;
    const staleLocation = pick(LOCATIONS).id;
    this.enquiries.push({
      id: nextId("enq"),
      contactName: staleName,
      phone: randomPhone(),
      source: pick(SOURCES),
      assignedTo: pickRep(staleLocation),
      locationId: staleLocation,
      status: "new",
      receivedAt: new Date(staleReceived).toISOString(),
      respondedAt: null,
    });
    this.log("enquiry_received", `${staleName} submitted a form`, staleLocation, staleReceived);
  }

  private spawnEnquiry(): void {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const source = pick(SOURCES);
    const locationId = pick(LOCATIONS).id;
    const assignedTo = Math.random() < 0.85 ? pickRep(locationId) : null;
    const enquiry: Enquiry = {
      id: nextId("enq"),
      contactName: name,
      phone: randomPhone(),
      source,
      assignedTo,
      locationId,
      status: "new",
      receivedAt: new Date().toISOString(),
      respondedAt: null,
    };
    this.enquiries.push(enquiry);
    this.log(
      "enquiry_received",
      source === "Phone Enquiry" ? `${name} called in` : `${name} submitted a form`,
      locationId
    );

    // 80% of enquiries get responded to, at varying speeds; the rest sit and
    // go red until (eventually) someone deals with them.
    if (Math.random() < 0.8) {
      const delay = randomBetween(40, 9 * 60) * 1000;
      this.schedule(delay, () => this.respond(enquiry.id));
    } else {
      this.schedule(randomBetween(12, 20) * 60_000, () => this.respond(enquiry.id));
    }
  }

  private respond(id: string): void {
    const enquiry = this.enquiries.find((e) => e.id === id);
    if (!enquiry || enquiry.respondedAt) return;
    enquiry.respondedAt = new Date().toISOString();
    enquiry.status = "contacted";
    const rep = enquiry.assignedTo ?? pickRep(enquiry.locationId) ?? "Someone";
    enquiry.assignedTo = rep;
    this.log("contacted", `${rep} contacted ${enquiry.contactName}`, enquiry.locationId);
    this.maybeProgress(enquiry);
  }

  /** After first contact, enquiries drift down the pipeline over time. */
  private maybeProgress(enquiry: Enquiry): void {
    if (Math.random() < 0.65) {
      this.schedule(randomBetween(1, 5) * 60_000, () => {
        if (enquiry.status !== "contacted") return;
        enquiry.status = "qualified";
        this.log("qualified", `${enquiry.contactName} marked Qualified`, enquiry.locationId);

        if (Math.random() < 0.6) {
          this.schedule(randomBetween(2, 8) * 60_000, () => {
            if (enquiry.status !== "qualified") return;
            enquiry.status = "booked";
            this.log("booked", `Appointment booked with ${enquiry.contactName}`, enquiry.locationId);

            this.schedule(randomBetween(3, 10) * 60_000, () => {
              if (enquiry.status !== "booked") return;
              const won = Math.random() < 0.7;
              enquiry.status = won ? "won" : "lost";
              this.log(
                won ? "won" : "lost",
                won
                  ? `Deal won — ${enquiry.contactName}`
                  : `Lead lost — ${enquiry.contactName}`,
                enquiry.locationId
              );
            });
          });
        }
      });
    }
  }
}
