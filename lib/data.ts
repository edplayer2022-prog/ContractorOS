import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/database.types";

export async function getAuthContext(requireCompany = true) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: company } = await supabase.from("companies").select("*").eq("owner_id", user.id).maybeSingle();
  if (requireCompany && !company) redirect("/setup");
  return { supabase, user, company: company as Company | null };
}
