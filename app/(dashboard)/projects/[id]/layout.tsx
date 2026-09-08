import Link from "next/link";
import {ProjectDetailsForm} from "@/components/project-details-form";
import { FilePlus2 } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { getAuthContext } from "@/lib/data";
import { currency } from "@/lib/utils";
import{ProjectAssignment}from"@/components/project-assignment";import{hasPermission}from"@/lib/permission-policy";

export default async function ProjectDetailLayout({children,params}:{children:React.ReactNode;params:Promise<{id:string}>}) {
  const {id}=await params;
  const {supabase,company,membership}=await getAuthContext();
  const {data:project}=await supabase.from("projects").select("*").eq("id",id).single();
  if(!project)return children;
  const [{data:estimate},{data:depositInvoices}]=await Promise.all([
    supabase.from("estimates").select("deposit_required").eq("id",project.estimate_id).single(),
    supabase.from("invoices").select("total,amount_paid,status").eq("project_id",id).eq("invoice_type","deposit")
  ]);
  const valid=(depositInvoices||[]).filter(row=>row.status!=="void");
  const invoiced=valid.reduce((sum,row)=>sum+Number(row.total),0);
  const paid=valid.reduce((sum,row)=>sum+Number(row.amount_paid),0);
  const canAssign=hasPermission(membership?.role,"projects.edit");const{data:members}=canAssign?await supabase.from("company_members").select("user_id,display_name,email").eq("company_id",company!.id).eq("status","active"): {data:[]};
  return <><Card className="mb-6 p-4 sm:p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="grid flex-1 gap-3 sm:grid-cols-3"><Metric label="Deposit Required" value={estimate?.deposit_required||0}/><Metric label="Deposit Invoiced" value={invoiced}/><Metric label="Deposit Paid" value={paid}/></div><div className="flex flex-wrap gap-2"><Link href={`/invoices/new?project=${id}&type=deposit`}><Button size="sm"><FilePlus2 className="h-4 w-4"/>Deposit</Button></Link><Link href={`/invoices/new?project=${id}&type=progress`}><Button size="sm" variant="secondary">Progress</Button></Link><Link href={`/invoices/new?project=${id}&type=final`}><Button size="sm" variant="secondary">Final</Button></Link><Link href={`/invoices/new?project=${id}&type=custom&import=1`}><Button size="sm" variant="secondary">Custom</Button></Link></div></div>{canAssign&&<div className="mt-4 border-t pt-4"><ProjectAssignment projectId={id} members={members||[]}/><ProjectDetailsForm project={project}/></div>}</Card>{children}</>
}
function Metric({label,value}:{label:string;value:number}){return <div className="rounded-lg bg-orange-50 px-4 py-3"><p className="text-xs font-bold uppercase text-orange-700">{label}</p><p className="mt-1 text-xl font-black text-orange-950">{currency(value)}</p></div>}
