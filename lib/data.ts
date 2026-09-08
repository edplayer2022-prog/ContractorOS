import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Company, CompanyMember } from "@/lib/database.types";
export async function getAuthContext(requireCompany = true) {
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) redirect("/login");
 const [{ data: userRow }, { data: memberships, error }] = await Promise.all([
  supabase.from("users").select("company_id").eq("id", user.id).maybeSingle(),
  supabase.from("company_members").select("*").eq("user_id", user.id).order("accepted_at"),
 ]);
 if (error) throw new Error("Unable to verify company membership.");
 const active = (memberships || []).filter(m => m.status === "active");
 const membership = (active.find(m => m.company_id === userRow?.company_id) || active[0] || null) as CompanyMember | null;
 if (!membership) {
  if (memberships?.length) redirect("/membership-inactive");
  if (requireCompany) redirect("/setup");
  return { supabase, user, company: null as Company | null, membership };
 }
 if (membership.company_id !== userRow?.company_id) {
  const { error: switchError } = await supabase.rpc("switch_company", { target_company: membership.company_id });
  if (switchError) throw new Error("Unable to select company.");
 }
 const result = membership.role === "employee" ? await supabase.rpc("get_my_company_context") : await supabase.from("companies").select("*").eq("id", membership.company_id).maybeSingle();
 if (result.error || !result.data) throw new Error("Unable to load your company.");
 return { supabase, user, company: result.data as Company, membership };
}
