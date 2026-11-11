import { headers } from "next/headers";
import QRCode from "qrcode";
import { listAssets } from "@/server/safety/repo";
import { requirePerson } from "@/server/safety/session";
import { Empty, Screen } from "@/components/safety/ui";

/**
 * Printable QR stickers. Each code is simply the link to the item's page, so
 * a phone's normal camera opens it — no scanner app needed.
 */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  await requirePerson();
  const { code } = await searchParams;
  const h = await headers();
  const base =
    process.env.APP_URL?.replace(/\/$/, "") ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const all = await listAssets({});
  const assets = code ? all.filter((a) => a.code === code.toUpperCase()) : all;
  const labels = await Promise.all(
    assets.map(async (a) => ({
      asset: a,
      svg: await QRCode.toString(`${base}/safety/a/${a.code}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
    }))
  );

  return (
    <Screen title="QR labels" back={{ href: code ? `/safety/a/${code.toUpperCase()}` : "/safety/admin", label: "Back" }}>
      <p className="mb-4 text-sm text-slate-600 print:hidden">
        Print this page onto sticker sheets (use your browser&apos;s Print). Scanning a label with a phone camera opens
        that item. Labels link to <span className="font-mono">{base}</span>.
      </p>
      {labels.length === 0 ? (
        <Empty>No equipment to label yet.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {labels.map(({ asset, svg }) => (
            <div key={asset.id} className="break-inside-avoid rounded-xl border border-slate-300 bg-white p-3 text-center">
              <div className="mx-auto w-28" dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="mt-1 font-mono text-base font-bold text-slate-900">{asset.code}</div>
              <div className="truncate text-xs text-slate-600">{asset.name}</div>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
