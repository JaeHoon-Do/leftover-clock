import { GeminiError, mapContainers, type Known } from "@/server/gemini";
import { replay } from "@/server/replay";

export const maxDuration = 120;

interface MatchRequest {
  newPhoto: string;
  prevPhoto: string | null;
  known: Known[];
}

export async function POST(req: Request) {
  const body = (await req.json()) as MatchRequest;
  try {
    const { model, containers } = await replay("match", body, () => mapContainers(body));
    return Response.json({ model, containers });
  } catch (e) {
    const error = e instanceof GeminiError ? e.kind : "unreadable";
    console.error("match failed:", e instanceof Error ? e.message.slice(0, 200) : e);
    return Response.json({ error }, { status: 502 });
  }
}
