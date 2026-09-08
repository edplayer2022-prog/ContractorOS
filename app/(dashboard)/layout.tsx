import { AppShell } from "@/components/app-shell";
import { CompanySwitcher,type CompanyOption } from "@/components/company-switcher";
import { getAuthContext } from "@/lib/data";
import { permissionsFor } from "@/lib/permissions";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({children}:{children:React.ReactNode}) {
 const {company,supabase,membership}=await getAuthContext();
 if(!membership||!company)throw new Error("Active membership required");
 await supabase.rpc("touch_last_active");
 if(membership.role==="owner"||membership.role==="admin")await supabase.rpc("refresh_overdue_invoices");
 const {data:companies}=await supabase.rpc("list_my_companies");
 return <AppShell companyName={company.name} ownerName={membership.display_name||""} role={membership.role} permissions={permissionsFor(membership.role)}><CompanySwitcher companies={(companies||[])as CompanyOption[]} current={company.id}/>{children}</AppShell>;
}
