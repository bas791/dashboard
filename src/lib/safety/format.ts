const TZ = "Pacific/Auckland";

const dateFmt = new Intl.DateTimeFormat("en-NZ", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-NZ", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** "2026-11-11" or an ISO timestamp → "11 Nov 2026" */
export function fmtDate(value: string | null): string {
  if (!value) return "—";
  // Plain dates have no timezone: pin them to midday UTC so they never shift a day.
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return value.length === 10
    ? new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(date)
    : dateFmt.format(date);
}

/** ISO timestamp → "11 Nov, 7:42 am" */
export function fmtDateTime(value: string | null): string {
  return value ? dateTimeFmt.format(new Date(value)) : "—";
}
