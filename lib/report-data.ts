import type{SupabaseClient}from"@supabase/supabase-js";
import type{Database,Estimate,Project,Invoice,Payment,ProjectCost,Customer,ChangeOrder,EstimateItem}from"@/lib/database.types";
import{agingBucket,approvalRate,comparisonPercent,inRange,projectHealth,projectProfitability,resolveDateRange,safePercent,sum,type DatePreset,type DateRange}from"@/lib/reporting";

type Client=SupabaseClient<Database>;
export type ReportInput={period?:string;from?:string;to?:string};
export type ReportSource={estimates:Estimate[];projects:Project[];invoices:Invoice[];payments:Payment[];costs:ProjectCost[];customers:Customer[];changes:ChangeOrder[];items:EstimateItem[]};

export async function loadReportSource(supabase:Client):Promise<ReportSource>{
  const results=await Promise.all([
    supabase.from("estimates").select("*"),supabase.from("projects").select("*"),supabase.from("invoices").select("*"),supabase.from("payments").select("*"),supabase.from("project_costs").select("*"),supabase.from("customers").select("*"),supabase.from("change_orders").select("*"),supabase.from("estimate_items").select("*")
  ]);
  const error=results.find(result=>result.error)?.error;if(error)throw new Error("Unable to load report.");
  return{estimates:results[0].data||[],projects:results[1].data||[],invoices:results[2].data||[],payments:results[3].data||[],costs:results[4].data||[],customers:results[5].data||[],changes:results[6].data||[],items:results[7].data||[]};
}

export function reportRange(input:ReportInput,today:string){return resolveDateRange((input.period||"this_month") as DatePreset,input.from,input.to,today)}
const activeInvoice=(invoice:Invoice)=>invoice.status!=="void";
const activeProject=(project:Project)=>project.status!=="cancelled";
const approvedDate=(estimate:Estimate)=>estimate.approved_at||estimate.estimate_date;

export function buildReport(source:ReportSource,range:DateRange,today:string){
  const estimates=source.estimates.filter(row=>inRange(row.estimate_date,range));
  const approved=source.estimates.filter(row=>row.status==="approved"&&inRange(approvedDate(row),range));
  const previousApproved=source.estimates.filter(row=>row.status==="approved"&&inRange(approvedDate(row),{from:range.previousFrom,to:range.previousTo}));
  const invoices=source.invoices.filter(row=>activeInvoice(row)&&inRange(row.invoice_date,range));
  const payments=source.payments.filter(row=>!row.voided_at&&inRange(row.payment_date,range));
  const projects=source.projects.filter(row=>activeProject(row)&&inRange(row.created_at,range));
  const costs=source.costs.filter(row=>inRange(row.cost_date,range));
  const newCustomers=source.customers.filter(row=>inRange(row.created_at,range));
  const approvedRevenue=sum(approved.map(row=>row.total));
  const previousApprovedRevenue=sum(previousApproved.map(row=>row.total));
  const contract=(project:Project)=>Number(project.original_contract_value)+sum(source.changes.filter(change=>change.estimate_id===project.estimate_id&&change.status==="approved").map(change=>change.total));
  const projectRows=source.projects.filter(project=>activeProject(project)&&inRange(project.created_at,range)).map(project=>{
    const projectInvoices=source.invoices.filter(invoice=>invoice.project_id===project.id&&activeInvoice(invoice));
    const actual=sum(source.costs.filter(cost=>cost.project_id===project.id).map(cost=>cost.amount));const value=contract(project);const profit=projectProfitability(value,Number(project.estimated_internal_cost),actual);
    return{...project,customer:source.customers.find(customer=>customer.id===project.customer_id),contractValue:value,invoiced:sum(projectInvoices.map(i=>i.total)),paid:sum(projectInvoices.map(i=>i.amount_paid)),actualCost:actual,...profit,health:projectHealth(value,Number(project.estimated_internal_cost),actual)};
  });
  const openInvoices=source.invoices.filter(invoice=>activeInvoice(invoice)&&Number(invoice.balance_due)>0&&inRange(invoice.invoice_date,range));
  const aging=openInvoices.map(invoice=>({...invoice,...agingBucket(invoice.due_date,today),customer:source.customers.find(c=>c.id===invoice.customer_id),project:source.projects.find(p=>p.id===invoice.project_id)}));
  const months=new Map<string,{revenue:number;payments:number}>();
  for(const estimate of approved){const key=approvedDate(estimate).slice(0,7),value=months.get(key)||{revenue:0,payments:0};value.revenue+=Number(estimate.total);months.set(key,value)}
  for(const payment of payments){const key=payment.payment_date.slice(0,7),value=months.get(key)||{revenue:0,payments:0};value.payments+=Number(payment.amount);months.set(key,value)}
  const statusCounts=Object.fromEntries(["draft","sent","viewed","approved","rejected","expired"].map(status=>[status,estimates.filter(e=>e.status===status)]));
  const eligible=statusCounts.approved.length+statusCounts.rejected.length+statusCounts.expired.length;
  const currentContract=sum(projectRows.map(row=>row.contractValue));const totalInvoiced=sum(invoices.map(row=>row.total));const totalPaid=sum(payments.map(row=>row.amount));
  const estimatedCosts=sum(projectRows.map(row=>row.estimated_internal_cost));const actualCosts=sum(projectRows.map(row=>row.actualCost));
  return{range,estimates,approved,invoices,payments,projects,costs,newCustomers,projectRows,aging,months:[...months.entries()].sort().map(([month,value])=>({month,...value})),statusCounts,
    metrics:{totalEstimates:estimates.length,sentEstimates:statusCounts.sent.length,approvedEstimates:approved.length,approvalRate:approvalRate(statusCounts.approved.length,statusCounts.rejected.length,statusCounts.expired.length),eligible,approvedRevenue,approvedRevenueComparison:comparisonPercent(approvedRevenue,previousApprovedRevenue),activeProjects:projects.filter(p=>["upcoming","in_progress","on_hold"].includes(p.status)).length,totalInvoiced,totalPaid,outstanding:sum(openInvoices.map(i=>i.balance_due)),overdueCount:aging.filter(i=>i.daysOverdue>0).length,overdueBalance:sum(aging.filter(i=>i.daysOverdue>0).map(i=>i.balance_due)),paymentsReceived:totalPaid,estimatedProfit:currentContract-estimatedCosts,currentContract,unbilled:Math.max(0,currentContract-sum(projectRows.map(p=>p.invoiced))),estimatedCosts,actualCosts,projectedProfit:currentContract-actualCosts,projectedMargin:safePercent(currentContract-actualCosts,currentContract),averageApproved:approved.length?approvedRevenue/approved.length:0,averageEstimate:estimates.length?sum(estimates.map(e=>e.total))/estimates.length:0,averageInvoice:invoices.length?totalInvoiced/invoices.length:0,averagePayment:payments.length?totalPaid/payments.length:0}}
}
