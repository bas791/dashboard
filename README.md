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
   `users.readonly`.
2. Copy `.env.example` to `.env.local` and fill in:

   ```bash
   DATA_SOURCE=ghl
   GHL_API_KEY=pit-xxxxxxxx
   GHL_LOCATION_ID=your-location-id
   GHL_PIPELINE_ID=            # optional; first pipeline used if empty
   ```

3. Restart the server.

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

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── stream/route.ts      # SSE: pushes snapshots to every TV
│   │   └── snapshot/route.ts    # one-shot JSON (polling fallback / debugging)
│   ├── layout.tsx               # dark theme shell
│   └── page.tsx
├── components/                  # presentational, reusable
│   ├── Dashboard.tsx            # client root: stream + tick + chime + layout
│   ├── DashboardHeader.tsx
│   ├── KpiCards.tsx
│   ├── EnquiryTable.tsx
│   ├── ResponseTimer.tsx        # count-up timer + SLA colours
│   ├── StatsPanel.tsx
│   ├── ActivityFeed.tsx
│   ├── Leaderboard.tsx
│   └── StatusBadge.tsx
├── hooks/
│   ├── useDashboardStream.ts    # SSE client + reconnect + new-enquiry diffing
│   ├── useNow.ts                # shared 1-second tick
│   └── useChime.ts              # Web Audio bell (no asset files)
├── lib/
│   ├── types.ts                 # shared domain types
│   └── time.ts                  # timer formatting + SLA maths
└── server/
    ├── config.ts                # env parsing, fail-soft fallbacks
    ├── store.ts                 # singleton store, fans out to SSE clients
    ├── stats.ts                 # pure aggregation (stats, KPIs, leaderboard)
    └── datasource/
        ├── types.ts             # DataSource interface
        ├── mock.ts              # day simulator for development/demos
        └── ghl.ts               # GoHighLevel v2 API poller + stage mapping
```

**Data flow:** a data source (mock or GHL) maintains today's enquiries and an
activity log in memory and emits change events → the store computes a full
`DashboardSnapshot` (stats, KPI counts, leaderboard) → snapshots stream to
every connected client over **Server-Sent Events** (with automatic reconnect
and a polling fallback). Response timers tick **client-side** from
`receivedAt`, so they update every second with zero network traffic.

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
