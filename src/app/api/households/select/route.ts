import { NextResponse } from "next/server";
import { z } from "zod";
import { householdSummaryRowSchema } from "@/contracts/household-membership";
import { HOUSEHOLD_SELECTION_COOKIE } from "@/domain/household-selection";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({ householdId: z.uuid() }).strict();
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" };

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 512) {
    return NextResponse.json({ error: "Ungültige Auswahl." }, { status: 413, headers: noStoreHeaders });
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ error: "Ungültige Auswahl." }, { status: 400, headers: noStoreHeaders });
  }
  if (new TextEncoder().encode(text).byteLength > 512) {
    return NextResponse.json({ error: "Ungültige Auswahl." }, { status: 413, headers: noStoreHeaders });
  }
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Ungültige Auswahl." }, { status: 400, headers: noStoreHeaders });
  }
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Auswahl." }, { status: 400, headers: noStoreHeaders });

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Sitzung nicht verfügbar." }, { status: 503, headers: noStoreHeaders });
  }
  const [{ data: userData }, { data: claimData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims()
  ]);
  if (!userData.user) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401, headers: noStoreHeaders });
  if (claimData?.claims?.aal !== "aal2") return NextResponse.json({ error: "Zwei-Faktor-Bestätigung erforderlich." }, { status: 403, headers: noStoreHeaders });

  const overview = await supabase.rpc("get_my_households");
  const households = z.array(householdSummaryRowSchema).safeParse(overview.data);
  if (overview.error || !households.success || !households.data.some((household) => household.household_id === parsed.data.householdId)) {
    return NextResponse.json({ error: "Haushaltszugriff verweigert." }, { status: 403, headers: noStoreHeaders });
  }

  const response = NextResponse.json({ selected: true }, { headers: noStoreHeaders });
  response.cookies.set(HOUSEHOLD_SELECTION_COOKIE, parsed.data.householdId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 365 * 24 * 60 * 60
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ cleared: true }, { headers: noStoreHeaders });
  response.cookies.set(HOUSEHOLD_SELECTION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0)
  });
  return response;
}
