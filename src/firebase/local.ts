import type {
  ActionRequest,
  ActionResponse,
  CreateDrawInput,
  CreatedDraw,
  DrawRepository,
  Snapshot,
} from "@/shared/types";

async function jsonOrThrow<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Błąd serwera. Spróbuj ponownie.");
  return body;
}

/**
 * Lokalny backend demonstracyjny (Next.js + PostgreSQL). Zachowuje dokładnie
 * ten sam kontrakt co adapter Firestore, więc UI i silnik są niezależne od bazy.
 * Odpowiednik onSnapshot realizowany jest przez krótkie odpytywanie.
 */
export const localRepository: DrawRepository = {
  mode: "local",

  async create(input: CreateDrawInput): Promise<CreatedDraw> {
    const response = await fetch("/api/draws", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return jsonOrThrow<CreatedDraw>(response);
  },

  subscribe(drawId, token, adminToken, onSnapshot, onError) {
    let active = true;
    const params = new URLSearchParams();
    if (token) params.set("t", token);
    if (adminToken) params.set("a", adminToken);

    const tick = async () => {
      try {
        const response = await fetch(
          `/api/draws/${encodeURIComponent(drawId)}?${params.toString()}`,
          { cache: "no-store" },
        );
        const snapshot = await jsonOrThrow<Snapshot>(response);
        if (active) onSnapshot(snapshot);
      } catch (error) {
        if (active) onError(error instanceof Error ? error.message : "Brak połączenia.");
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), 1200);
    return () => {
      active = false;
      clearInterval(timer);
    };
  },

  async action(drawId: string, request: ActionRequest): Promise<ActionResponse> {
    const response = await fetch(`/api/draws/${encodeURIComponent(drawId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return jsonOrThrow<ActionResponse>(response);
  },
};
