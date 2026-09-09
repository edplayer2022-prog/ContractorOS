import { AppShell } from "@/components/app-shell";
import { CompanySwitcher,type CompanyOption } from "@/components/company-switcher";
import { permissionsFor } from "@/lib/permissions";
import { getSubscriptionContext } from "@/lib/subscriptions";
import { canUseFeature } from "@/lib/plans";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { HistoricalPlanNotice } from "@/components/historical-plan-notice";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({children}:{children:React.ReactNode}) {
 const {company,supabase,membership,subscription}=await getSubscriptionContext();
 if(!membership||!company)throw new Error("Active membership required");
 await supabase.rpc("touch_last_active");
 if(membership.role==="owner"||membership.role==="admin")await supabase.rpc("refresh_overdue_invoices");
 const {data:companies}=await supabase.rpc("list_my_companies");
 return <AppShell companyName={company.name} ownerName={membership.display_name||""} role={membership.role} plan={subscription.effective_plan} permissions={permissionsFor(membership.role).filter(permission=>canUseFeature(membership.role,subscription.effective_plan,permission))}><CompanySwitcher companies={(companies||[])as CompanyOption[]} current={company.id}/><SubscriptionBanner subscription={subscription} owner={membership.role==="owner"}/><HistoricalPlanNotice plan={subscription.effective_plan} owner={membership.role==="owner"}/>{children}</AppShell>;
}
