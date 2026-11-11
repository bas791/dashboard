import { getPhoto } from "@/server/safety/repo";
import { currentPerson } from "@/server/safety/session";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  if (!(await currentPerson())) return new Response("Not signed in", { status: 401 });
  const photo = await getPhoto(id);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      // Photos never change once stored.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
