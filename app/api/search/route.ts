import type { Box } from "@/lib/boxes";
import { GeminiError, searchContainers, type SearchTarget } from "@/server/gemini";
import { replay } from "@/server/replay";

export const maxDuration = 120;

interface SearchRequest {
  newPhoto: string;
  claimed: Box[];
  targets: SearchTarget[];
}

export async function POST(req: Request) {
  const body = (await req.json()) as SearchRequest;
  try {
    const { model, found, notFound } = await replay("search", body, () => searchContainers(body));
    return Response.json({ model, found, notFound });
  } catch (e) {
    const error = e instanceof GeminiError ? e.kind : "unreadable";
    console.error("search failed:", e instanceof Error ? e.message.slice(0, 200) : e);
    return Response.json({ error }, { status: 502 });
  }
}
