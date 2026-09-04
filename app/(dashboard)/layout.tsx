import { AppShell } from "@/components/app-shell";
import { getAuthContext } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({children}:{children:React.ReactNode}) { const {company,supabase}=await getAuthContext(); await supabase.rpc("refresh_overdue_invoices"); return <AppShell companyName={company!.name} ownerName={company!.owner_name}>{children}</AppShell>; }

