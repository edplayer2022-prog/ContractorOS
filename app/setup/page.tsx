import { redirect } from "next/navigation";
import { HardHat } from "lucide-react";
import { CompanyForm } from "@/components/company-form";
import { getAuthContext } from "@/lib/data";
export const dynamic="force-dynamic";
export default async function SetupPage(){const {user,company}=await getAuthContext(false);if(company)redirect("/dashboard");return <main className="min-h-screen bg-slate-100 px-4 py-8"><div className="mx-auto max-w-5xl"><div className="mb-7 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500 text-white"><HardHat className="h-6 w-6"/></span><div><h1 className="text-2xl font-bold">Set up your company</h1><p className="text-sm text-slate-500">A few details, then you’re ready to estimate.</p></div></div><CompanyForm userId={user.id} email={user.email} setup/></div></main>}
