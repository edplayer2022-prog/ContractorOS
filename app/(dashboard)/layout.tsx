import { AppShell } from "@/components/app-shell";
import { getAuthContext } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({children}:{children:React.ReactNode}) { const {company}=await getAuthContext(); return <AppShell companyName={company!.name} ownerName={company!.owner_name}>{children}</AppShell>; }
