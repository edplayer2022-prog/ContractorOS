import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { containsForbiddenPublicField, PUBLIC_TOKEN_PATTERN, type PublicChangeOrder, type PublicEstimate } from "@/lib/public-document-types";

async function requestIp() {
  const values = await headers();
  return values.get("x-forwarded-for")?.split(",")[0]?.trim() || values.get("x-real-ip") || null;
}

export async function getPublicEstimate(token: string): Promise<PublicEstimate | null> {
  if (!PUBLIC_TOKEN_PATTERN.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_estimate", { target_token: token, raw_ip: await requestIp() });
  if (error || !data || containsForbiddenPublicField(data)) return null;
  return data as unknown as PublicEstimate;
}

export async function getPublicChangeOrder(token: string): Promise<PublicChangeOrder | null> {
  if (!PUBLIC_TOKEN_PATTERN.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_change_order", { target_token: token, raw_ip: await requestIp() });
  if (error || !data || containsForbiddenPublicField(data)) return null;
  return data as unknown as PublicChangeOrder;
}
