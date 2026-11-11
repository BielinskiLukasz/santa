import { createDraw, StoreError } from "@/server/store";
import type { CreateDrawInput } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateDrawInput;
    const created = await createDraw(body);
    return Response.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof StoreError
        ? error.message
        : "Nie udało się utworzyć losowania. Spróbuj ponownie.";
    const status = error instanceof StoreError ? error.status : 500;
    return Response.json({ error: message }, { status });
  }
}
