# Sales Command Centre

A real-time sales operations dashboard built to run fullscreen on a large office
TV. It shows every enquiry received today, starts a colour-coded response timer
the moment a lead arrives, plays a bell so the team hears new enquiries, and
tracks daily stats and a salesperson leaderboard — all updating live.

![Stack](https://img.shields.io/badge/Next.js%2015-React%2019-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)

## Features

- **Header** — live clock, date, enquiries today, average first-response time,
  and how many leads are currently waiting.
- **KPI cards** — totals for Waiting / Contacted / Qualified / Booked / Won / Lost.
- **Live enquiry table** — newest first: time received, customer, phone, source,
  assigned salesperson, status, response timer, SLA indicator.
- **Response timer (the headline feature)** — every new enquiry starts a
  count-up timer at `00:00`. Green under 5 minutes, orange 5–10, red and
  pulsing past 10. When the lead is contacted (or moves pipeline stage in
  GoHighLevel) the timer stops and shows **✓ Responded — in 3m 42s**.
- **New enquiry alert** — a bell chime (synthesised in-browser, played once per
  enquiry) plus a highlighted row.
- **Daily stats** — average / fastest / slowest response, SLA %, responded
  within 5 minutes, number over SLA.
- **Live activity feed** — form submissions, contacts, bookings, wins.
- **Leaderboard** — per-salesperson assigned / responded / average response /
  booked / sales / conversion %.
- **TV mode** — dark theme, large type, high contrast. Press **F** (or
  double-click) for fullscreen; the cursor hides automatically.
- **Multiple locations + NZ map** — every office gets its own board at
  `/l/<location-id>`, and `/` is the NZ-wide view with a live map of all
  locations (dots go orange/red as SLAs slip; click a dot to jump to that
  office's board).
- **Photo mark-up** — a separate tool at `/markup`: drop site photos in and
  Claude circles the mould, lichen, moss and algae, writes the notes, and the
  page prints straight to a client-ready PDF. See below.

## Adding your employees and locations

Everything lives in one file: [`src/config/team.ts`](src/config/team.ts).

```ts
export const LOCATIONS: OfficeLocation[] = [
  { id: "auckland", name: "Auckland", shortName: "AKL", lat: -36.85, lng: 174.76 },
  // add your sites — lat/lng from Google Maps (right-click → copy coordinates)
];

export const TEAM: TeamMember[] = [
  { name: "Sarah", locationId: "auckland" },
  // add your salespeople — locationId must match a location above
];
```

Save the file and restart the dev server — that's it:

- each location appears on the NZ map and gets its own TV board at `/l/<id>`
- new team members appear on the leaderboard immediately (with zeros until
  their first enquiry)
- in mock mode enquiries are assigned to each location's team automatically
- in GoHighLevel mode, `name` is matched case-insensitively against GHL user
  names, so use the same display names as GHL

**Which URL goes on which TV?**

| TV | URL |
| --- | --- |
| Head office / NZ-wide wallboard | `/` |
| Auckland office | `/l/auckland` |
| Christchurch office | `/l/christchurch` |

A location TV only shows — and only *chimes* for — its own enquiries. The
NZ-wide board shows everything, with a Branch column in the table and location
tags on the leaderboard.

## Quick start (mock data)

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. With no configuration the dashboard runs against
a built-in **mock data source** that simulates a realistic day: enquiries
arrive every 25–90 seconds, most get responded to at varying speeds, some
breach SLA so you can see the red/pulsing state.

Click anywhere once to unlock sound (browsers require one interaction before
audio can play) — after that every new enquiry chimes automatically.

## Connecting GoHighLevel

1. In GHL: **Settings → Private Integrations → New**. Grant scopes:
   `contacts.readonly`, `opportunities.readonly`, `conversations.readonly`,
   `users.readonly`. Copy the token (starts with `pit-`).
2. Find your Location ID: in GHL it's in **Settings → Business Profile**
   (also visible in the sub-account URL).
3. Copy `.env.example` to `.env.local` and fill in:

   ```bash
   DATA_SOURCE=ghl
   GHL_API_KEY=pit-xxxxxxxx
   GHL_LOCATION_ID=your-location-id
   GHL_PIPELINE_ID=            # optional; first pipeline used if empty
   ```

4. Restart the server.
5. **Verify:** open <http://localhost:3000/api/ghl/check>. It tests the
   token, lists your pipelines and shows which dashboard status each stage
   name maps to, and cross-checks GHL user names against
   `src/config/team.ts` — fix anything it flags before trusting the board.
   The header badge switches from "demo data" to "GoHighLevel" once the
   live source is active.

The server polls the GHL v2 API (`/opportunities/search`) every 15 seconds
(configurable via `GHL_POLL_INTERVAL_MS`) and maps your pipeline stages onto
dashboard statuses by stage-name keywords (new / contacted / qualified /
booked / won / lost). Unknown stage names fall back to "new" so leads are
never hidden. If credentials are missing the app falls back to mock data and
logs a warning rather than showing a blank TV.

An enquiry counts as **responded** when it leaves the "new" stage in the
pipeline (or its opportunity status becomes won/lost).

## Configuration

All settings live in environment variables — see [.env.example](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATA_SOURCE` | `mock` | `mock` or `ghl` |
| `SLA_WARN_MINUTES` | `5` | timer turns orange |
| `SLA_BREACH_MINUTES` | `10` | timer turns red + pulses |
| `DASHBOARD_TIMEZONE` | `Pacific/Auckland` | defines "today" and clock display |
| `GHL_POLL_INTERVAL_MS` | `15000` | GHL polling cadence |
| `ANTHROPIC_API_KEY` | — | required for the `/markup` photo mark-up tool |

## Photo mark-up (`/markup`)

A quoting tool that lives alongside the wallboard. Open
[http://localhost:3000/markup](http://localhost:3000/markup), drop site photos
into the page, and each one is sent to Claude, which finds the biological
growth on the building, outlines it, and writes the notes.

**What it marks.** Mould, algae, moss, lichen and the organic staining growth
leaves behind, on roofing, cladding, canopies, gutters, cappings and soffits.
The prompt is written for exactly the surfaces that get quoted here — the pans
of corrugated and trimdeck sheets, box gutters, sheet laps, parapet cappings
and shaded south-facing elevations — and it is told explicitly to rule out the
things that fool a photo: raking shadows across corrugations, rust, dirt, tyre
marks and dark-coloured materials.

**Working with the results.**

- Findings are numbered on the photo and listed beside it, colour-coded
  **light / moderate / heavy**.
- Anything Claude is under 50% sure about is drawn with a **dashed** outline
  and flagged *verify on site*, rather than quietly dropped.
- Every heading, surface, growth type, severity and note is editable — Claude
  drafts it, you have the last word before it goes to a client.
- **Add region** lets you drag a box on the photo for anything it missed.
- **Circles / Boxes** switches the outline style; **Copy notes** puts a plain
  text version on the clipboard for a quote or email; **Print / Save PDF**
  produces the report, one photo per page.
- Photos stay in the browser. They are posted to the analysis endpoint and
  never written to disk on the server.

**Setup.** Put an [Anthropic API key](https://console.anthropic.com/) in
`.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Photos are downscaled to a 1568px long edge in the browser before upload, so
a 12 MP phone photo costs about the same as a screenshot. Analysis runs two
photos at a time.

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── stream/route.ts      # SSE: pushes snapshots to every TV
│   │   ├── snapshot/route.ts    # one-shot JSON (polling fallback / debugging)
│   │   └── markup/analyze/      # Claude vision: finds growth in a site photo
│   ├── markup/page.tsx          # photo mark-up report tool
│   ├── layout.tsx               # dark theme shell
│   └── page.tsx
├── config/
│   └── team.ts                  # ⭐ YOUR locations + salespeople — edit me
├── components/                  # presentational, reusable
│   ├── Dashboard.tsx            # client root: stream + tick + chime + layout
│   ├── NzMap.tsx                # live NZ map with per-location status dots
│   ├── DashboardHeader.tsx
│   ├── KpiCards.tsx
│   ├── EnquiryTable.tsx
│   ├── ResponseTimer.tsx        # count-up timer + SLA colours
│   ├── StatsPanel.tsx
│   ├── ActivityFeed.tsx
│   ├── Leaderboard.tsx
│   ├── StatusBadge.tsx
│   └── markup/                  # photo mark-up tool
│       ├── MarkupWorkspace.tsx  # document state + analysis queue + export
│       ├── PhotoSheet.tsx       # one photo + its findings (one printed page)
│       ├── MarkupCanvas.tsx     # SVG outlines over the photo + manual drawing
│       └── FindingList.tsx      # editable notes column
├── hooks/
│   ├── useDashboardStream.ts    # SSE client + reconnect + new-enquiry diffing
│   ├── useNow.ts                # shared 1-second tick
│   └── useChime.ts              # Web Audio bell (no asset files)
├── lib/
│   ├── types.ts                 # shared domain types
│   ├── stats.ts                 # pure aggregation (stats, KPIs, leaderboard)
│   ├── time.ts                  # timer formatting + SLA maths
│   ├── markup.ts                # mark-up types, severity palette, box maths
│   └── image.ts                 # browser-side photo downscaling (EXIF-aware)
└── server/
    ├── config.ts                # env parsing, fail-soft fallbacks
    ├── store.ts                 # singleton store, fans out to SSE clients
    └── datasource/
        ├── types.ts             # DataSource interface
        ├── mock.ts              # day simulator for development/demos
        └── ghl.ts               # GoHighLevel v2 API poller + stage mapping
```

**Data flow:** a data source (mock or GHL) maintains today's enquiries and an
activity log in memory and emits change events → the store streams raw
snapshots to every connected client over **Server-Sent Events** (with
automatic reconnect and a polling fallback). Each view — a location TV or the
NZ-wide board — filters the shared stream client-side and derives its own
stats/KPIs/leaderboard with the pure functions in `src/lib/stats.ts`.
Response timers tick **client-side** from `receivedAt`, so they update every
second with zero network traffic.

### Extending it

The `DataSource` interface (`src/server/datasource/types.ts`) is the seam for
future work: multiple locations/sub-accounts become multiple data source
instances; Slack/Teams/SMS alerts subscribe to the same store the SSE route
uses; Postgres history is a store subscriber that persists snapshots. UI
panels are self-contained components fed from one snapshot object, so
wallboard rotations/slideshow mode are a matter of swapping which panels
render.

## Production

```bash
npm run build && npm start        # bare Node
# or
docker build -t sales-dashboard . && docker run -p 3000:3000 --env-file .env.local sales-dashboard
```

> **Note on Vercel:** the dashboard keeps live state in the server process
> (SSE fan-out + GHL poller), which suits a long-running server (Docker, VPS,
> Railway, Fly.io). On serverless platforms each instance polls independently —
> it works, but a single always-on container is the recommended deployment for
> an office TV.

## On the TV

1. Open the dashboard URL in the TV's browser (or a mini-PC/Chromecast).
2. Click once to enable sound, press **F** for fullscreen.
3. Done — no further interaction needed; the board reconnects automatically
   if the network blips.
