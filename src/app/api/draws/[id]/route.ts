import { getSnapshot, performAction, StoreError } from "@/server/store";
import type { ActionRequest } from "@/shared/types";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function handleError(error: unknown) {
  const message =
    error instanceof StoreError
      ? error.message
      : "Błąd połączenia z magazynem stanu. Spróbuj ponownie.";
  const status = error instanceof StoreError ? error.status : 500;
  return Response.json({ error: message }, { status });
}

/** `?t=` – capability token uczestnika, `?a=` – token administratora. */
export async function GET(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const snapshot = await getSnapshot(
      id,
      url.searchParams.get("t"),
      url.searchParams.get("a"),
    );
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const body = (await request.json()) as ActionRequest;
    const result = await performAction(id, body);
    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
