import Link from "next/link";
import { listAssets } from "@/server/safety/repo";
import { requirePerson } from "@/server/safety/session";
import { AssetRow, btnPrimary, Card, Empty, input, Screen } from "@/components/safety/ui";
import { CATEGORIES } from "@/lib/safety/types";
import { LOCATIONS } from "@/config/team";

const chip = (on: boolean) =>
  `inline-flex min-h-10 items-center whitespace-nowrap rounded-full border px-3 text-sm font-medium ${
    on ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700"
  }`;

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; loc?: string; show?: string }>;
}) {
  await requirePerson();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const cat = CATEGORIES.some((c) => c.id === sp.cat) ? sp.cat : undefined;
  const loc = LOCATIONS.some((l) => l.id === sp.loc) ? sp.loc : undefined;
  const assets = await listAssets({
    search: q || undefined,
    category: cat,
    locationId: loc,
    status: sp.show === "retired" ? "retired" : undefined,
  });
  const link = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { q: q || undefined, cat, loc, show: sp.show, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const s = params.toString();
    return `/safety/assets${s ? `?${s}` : ""}`;
  };

  return (
    <Screen
      title="Equipment"
      back={{ href: "/safety", label: "Home" }}
      action={
        <Link href="/safety/assets/new" className={`${btnPrimary} shrink-0`}>
          + Add
        </Link>
      }
    >
      <form className="mb-3" action="/safety/assets">
        {cat && <input type="hidden" name="cat" value={cat} />}
        {loc && <input type="hidden" name="loc" value={loc} />}
        <input className={input} type="search" name="q" defaultValue={q} placeholder="Search name, code or serial number" />
      </form>
      <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-2">
        <Link href={link({ cat: undefined })} className={chip(!cat)}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c.id} href={link({ cat: c.id })} className={chip(cat === c.id)}>
            {c.label}
          </Link>
        ))}
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2">
        <Link href={link({ loc: undefined })} className={chip(!loc)}>
          All branches
        </Link>
        {LOCATIONS.map((l) => (
          <Link key={l.id} href={link({ loc: l.id })} className={chip(loc === l.id)}>
            {l.name}
          </Link>
        ))}
      </div>

      {assets.length === 0 ? (
        <Empty>{q || cat || loc ? "Nothing matches." : "No equipment yet. Add your first item."}</Empty>
      ) : (
        <Card className="!p-0">
          {assets.map((a) => (
            <AssetRow key={a.id} asset={a} />
          ))}
        </Card>
      )}
      <p className="mt-4 text-center text-sm">
        <Link href={link({ show: sp.show === "retired" ? undefined : "retired" })} className="font-medium text-teal-700">
          {sp.show === "retired" ? "Show current equipment" : "Show retired equipment"}
        </Link>
      </p>
    </Screen>
  );
}
