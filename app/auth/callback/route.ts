import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeAuthRedirect } from "@/lib/auth-redirect";
export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get("code"); const next = safeAuthRedirect(url.searchParams.get("next"));
  if (code) { const supabase = await createClient(); await supabase.auth.exchangeCodeForSession(code); }
  return NextResponse.redirect(new URL(next, url.origin));
}
