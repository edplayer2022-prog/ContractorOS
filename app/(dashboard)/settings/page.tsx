import { CompanyForm } from "@/components/company-form";
import { PageHeader } from "@/components/ui";
import { getAuthContext } from "@/lib/data";
export default async function SettingsPage(){const {user,company}=await getAuthContext();return <><PageHeader title="Settings" description="Manage company details and estimating defaults."/><CompanyForm company={company} userId={user.id} email={user.email}/></>}
