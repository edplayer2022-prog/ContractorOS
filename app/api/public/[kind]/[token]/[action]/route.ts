import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_TOKEN_PATTERN } from "@/lib/public-document-types";

export const dynamic = "force-dynamic";

function text(value: unknown, max = 300000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function requestIp(request: NextRequest) { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"); }

export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string; token: string; action: string }> }) {
  const { kind, token, action } = await params;
  if (!PUBLIC_TOKEN_PATTERN.test(token) || !["estimate", "change-order"].includes(kind) || !["approve", "reject"].includes(action)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const supabase = await createClient(); const rawIp = requestIp(request); let result;
  if (action === "approve") {
    const signatureKind = body.signatureType === "typed" ? "typed" as const : "drawn" as const;
    const args = { target_token: token, signer_name: text(body.name, 200), signer_email: text(body.email, 320), signature_kind: signatureKind, signature_value: text(body.signature), accepted_terms: body.accepted === true, request_user_agent: request.headers.get("user-agent"), raw_ip: rawIp };
    result = kind === "estimate" ? await supabase.rpc("approve_public_estimate", args) : await supabase.rpc("approve_public_change_order", args);
  } else {
    const args = { target_token: token, reason: text(body.reason, 100), comments: text(body.comments, 2000), raw_ip: rawIp };
    result = kind === "estimate" ? await supabase.rpc("reject_public_estimate", args) : await supabase.rpc("reject_public_change_order", args);
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: result.error.message.includes("Too many") ? 429 : 400 });
  return NextResponse.json({ ok: true, data: result.data });
}
