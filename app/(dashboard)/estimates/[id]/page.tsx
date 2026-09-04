import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { EstimateBuilder } from "@/components/estimate-builder";
import { EstimateTimeline } from "@/components/estimate-timeline";
import { EstimateWorkflowActions } from "@/components/estimate-workflow-actions";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getAuthContext } from "@/lib/data";
import { currency, shortDate } from "@/lib/utils";
import type { EstimateEvent } from "@/lib/database.types";

const tones={draft:"slate",sent:"blue",viewed:"orange",approved:"green",rejected:"red",expired:"slate"} as const;
export default async function EditEstimatePage({params}:{params:Promise<{id:string}>}){
  const{id}=await params;const{supabase,company}=await getAuthContext();
  const[{data:estimate},{data:items},{data:customers},{data:sites},{data:rates},{data:events},{data:changeOrders}]=await Promise.all([
    supabase.from("estimates").select("*").eq("id",id).single(),supabase.from("estimate_items").select("*").eq("estimate_id",id).order("sort_order"),supabase.from("customers").select("*").order("name"),supabase.from("job_sites").select("*").order("job_name"),supabase.from("rate_library").select("*").order("service_name"),supabase.from("estimate_events").select("*").eq("estimate_id",id).order("created_at",{ascending:false}),supabase.from("change_orders").select("*").eq("estimate_id",id).order("created_at",{ascending:false})
  ]);if(!estimate)notFound();const customer=customers?.find(row=>row.id===estimate.customer_id);const locked=estimate.status==="approved"||estimate.status==="rejected";
  return <><PageHeader title={estimate.estimate_number} description={`${customer?.name||"Customer"} · ${estimate.project_name}`} action={<EstimateWorkflowActions id={id} status={estimate.status} token={estimate.public_token} customerEmail={customer?.email}/>}/>
    <div className="mb-6 grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Estimate Status</p><div className="mt-2 flex items-center gap-3"><Badge tone={tones[estimate.status]}>{estimate.status}</Badge><strong className="text-2xl">{currency(estimate.total)}</strong></div></div><div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm"><DateLabel label="Created" value={estimate.created_at}/><DateLabel label="Sent" value={estimate.sent_at}/><DateLabel label="First Viewed" value={estimate.first_viewed_at}/><DateLabel label="Last Viewed" value={estimate.last_viewed_at}/><DateLabel label={estimate.status==="rejected"?"Rejected":"Approved"} value={estimate.status==="rejected"?estimate.rejected_at:estimate.approved_at}/><div><p className="text-xs text-slate-400">View Count</p><p className="font-semibold">{estimate.view_count}</p></div></div></div>
        {locked&&<div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">This {estimate.status} estimate is preserved as a historical document. Create a new estimate version or a change order instead of changing the approved response.</div>}
        {!!changeOrders?.length&&<div className="mt-6 border-t border-slate-200 pt-5"><h2 className="font-semibold">Change Orders</h2><div className="mt-3 grid gap-2">{changeOrders.map(order=><Link key={order.id} href={`/change-orders/${order.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-orange-500"/><span><strong className="block text-sm">{order.change_order_number}</strong><span className="text-xs text-slate-500">{order.description}</span></span></span><span className="text-right"><Badge tone={order.status==="approved"?"green":order.status==="rejected"?"red":order.status==="viewed"?"orange":order.status==="sent"?"blue":"slate"}>{order.status}</Badge><strong className="ml-3 text-sm">{currency(order.total)}</strong></span></Link>)}</div></div>}
      </Card>
      <Card className="p-5"><h2 className="mb-4 font-semibold">Activity</h2><EstimateTimeline events={(events||[]) as EstimateEvent[]}/></Card>
    </div>
    {!locked&&<EstimateBuilder company={company!} customers={customers||[]} sites={sites||[]} rates={rates||[]} estimate={estimate} existingItems={items||[]} suggestedNumber={estimate.estimate_number}/>}
  </>;
}
function DateLabel({label,value}:{label:string;value:string|null}){return <div><p className="text-xs text-slate-400">{label}</p><p className="font-semibold">{shortDate(value)}</p></div>}
