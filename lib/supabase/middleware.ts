import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { permissionForPath } from "@/lib/permission-policy";
export async function updateSession(request: NextRequest) {
 let response = NextResponse.next({ request });
 const path = request.nextUrl.pathname;
 const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
 cookies: { getAll: () => request.cookies.getAll(), setAll(cookiesToSet) {
  cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
  response = NextResponse.next({ request });
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
 }},
 });
 const redirectTo = (pathname: string) => {
  const result = NextResponse.redirect(new URL(pathname, request.url));
  response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
  return result;
 };
 const { data: { user } } = await supabase.auth.getUser();
 const publicPath = /^\/(estimate\/view|change-order\/view|invoice\/view|invite|api\/public)\//.test(path);
 const authPath = ["/login", "/sign-up", "/forgot-password", "/reset-password"].includes(path) || path.startsWith("/auth/");
 if (!user && !authPath && !publicPath) return redirectTo("/login");
 if (authPath || publicPath || path === "/membership-inactive") return response;
 if (!user) return response;
 const [{ data: profile }, { data: members, error }] = await Promise.all([
  supabase.from("users").select("company_id").eq("id", user.id).maybeSingle(),
  supabase.from("company_members").select("company_id,role,status").eq("user_id", user.id),
 ]);
 if (error) return new NextResponse("Unable to verify access", { status: 503 });
 const active = (members || []).filter(m => m.status === "active");
 const member = active.find(m => m.company_id === profile?.company_id) || active[0];
 if (!member) return members?.length ? redirectTo("/membership-inactive") : path === "/setup" ? response : redirectTo("/setup");
 if (member.company_id !== profile?.company_id) {
  const { error: switchError } = await supabase.rpc("switch_company", { target_company: member.company_id });
  if (switchError) return new NextResponse("Access Denied", { status: 403 });
 }
 if (path === "/setup") return redirectTo("/dashboard");
 const required = permissionForPath(path);
 if (required) {
  const { data: allowed } = await supabase.rpc("has_company_permission", { target_company_id: member.company_id, permission_name: required });
  if (!allowed) return redirectTo("/access-denied");
 }
 const dashboard = member.role === "owner" || member.role === "admin" ? "/dashboard" : `/dashboard/${member.role}`;
 if (path.startsWith("/dashboard") && path !== dashboard) return redirectTo(dashboard);
 return response;
}
