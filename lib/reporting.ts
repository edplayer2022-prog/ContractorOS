export type DatePreset="this_month"|"last_month"|"last_30_days"|"last_90_days"|"this_year"|"last_year"|"custom";
export type DateRange={preset:DatePreset;from:string;to:string;label:string;previousFrom:string;previousTo:string};

const iso=(date:Date)=>date.toISOString().slice(0,10);
const addDays=(date:Date,days:number)=>{const next=new Date(date);next.setUTCDate(next.getUTCDate()+days);return next};
const startMonth=(date:Date)=>new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1));
const endMonth=(date:Date)=>new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0));

export function dateInTimezone(timeZone="America/New_York",now=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const value=(type:string)=>parts.find(part=>part.type===type)?.value||"";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function resolveDateRange(preset:DatePreset="this_month",customFrom?:string,customTo?:string,today=iso(new Date())):DateRange{
  const now=new Date(`${today}T00:00:00Z`);let from:Date,to:Date,label:string;
  if(preset==="last_month"){const prior=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1));from=startMonth(prior);to=endMonth(prior);label="Last Month"}
  else if(preset==="last_30_days"){to=now;from=addDays(now,-29);label="Last 30 Days"}
  else if(preset==="last_90_days"){to=now;from=addDays(now,-89);label="Last 90 Days"}
  else if(preset==="this_year"){from=new Date(Date.UTC(now.getUTCFullYear(),0,1));to=now;label="This Year"}
  else if(preset==="last_year"){from=new Date(Date.UTC(now.getUTCFullYear()-1,0,1));to=new Date(Date.UTC(now.getUTCFullYear()-1,11,31));label="Last Year"}
  else if(preset==="custom"&&customFrom&&customTo&&customFrom<=customTo){from=new Date(`${customFrom}T00:00:00Z`);to=new Date(`${customTo}T00:00:00Z`);label="Custom Range"}
  else{from=startMonth(now);to=now;label="This Month";preset="this_month"}
  const days=Math.round((to.getTime()-from.getTime())/86400000)+1;
  const previousTo=addDays(from,-1),previousFrom=addDays(previousTo,-days+1);
  return{preset,from:iso(from),to:iso(to),label,previousFrom:iso(previousFrom),previousTo:iso(previousTo)};
}

export const inRange=(value:string|null|undefined,range:Pick<DateRange,"from"|"to">)=>!!value&&value.slice(0,10)>=range.from&&value.slice(0,10)<=range.to;
export const sum=(values:unknown[])=>Math.round(values.reduce<number>((total,value)=>total+(Number(value)||0),0)*100)/100;
export const safePercent=(value:number,total:number)=>total>0?Math.round(value/total*1000)/10:0;
export const approvalRate=(approved:number,rejected:number,expired:number)=>safePercent(approved,approved+rejected+expired);
export const comparisonPercent=(current:number,previous:number)=>previous!==0?Math.round((current-previous)/Math.abs(previous)*1000)/10:null;

export type AgingBucket="Current"|"1–30 Days"|"31–60 Days"|"61–90 Days"|"90+ Days";
export function agingBucket(dueDate:string,today:string):{bucket:AgingBucket;daysOverdue:number}{
  const days=Math.floor((new Date(`${today}T00:00:00Z`).getTime()-new Date(`${dueDate}T00:00:00Z`).getTime())/86400000);
  if(days<=0)return{bucket:"Current",daysOverdue:Math.max(0,days)};
  if(days<=30)return{bucket:"1–30 Days",daysOverdue:days};if(days<=60)return{bucket:"31–60 Days",daysOverdue:days};if(days<=90)return{bucket:"61–90 Days",daysOverdue:days};return{bucket:"90+ Days",daysOverdue:days};
}

export function projectProfitability(contractValue:number,estimatedCost:number,actualCost:number){
  const estimatedProfit=contractValue-estimatedCost,projectedProfit=contractValue-actualCost;
  return{estimatedProfit,projectedProfit,estimatedMargin:safePercent(estimatedProfit,contractValue),projectedMargin:safePercent(projectedProfit,contractValue)};
}
export type ProjectHealth="Healthy"|"Watch"|"At Risk";
export function projectHealth(contractValue:number,estimatedCost:number,actualCost:number,tolerancePoints=3):ProjectHealth{
  const p=projectProfitability(contractValue,estimatedCost,actualCost);
  if(actualCost>estimatedCost||p.projectedProfit<0)return"At Risk";
  if(estimatedCost>0&&(actualCost>=estimatedCost*.85||p.projectedMargin<p.estimatedMargin-tolerancePoints))return"Watch";
  return"Healthy";
}

export function csvEscape(value:unknown){const text=value==null?"":String(value);return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text}
export function toCsv(headers:string[],rows:unknown[][]){return `\uFEFF${[headers,...rows].map(row=>row.map(csvEscape).join(",")).join("\r\n")}`}
export function filterCompanyRows<T extends{company_id:string}>(rows:T[],companyId:string){return rows.filter(row=>row.company_id===companyId)}
export function customerTotals(estimates:{status:string;total:number}[],projects:{original_contract_value:number}[],invoices:{status:string;total:number;amount_paid:number;balance_due:number}[]){const active=invoices.filter(i=>i.status!=="void");return{totalEstimates:estimates.length,approvedEstimates:estimates.filter(e=>e.status==="approved").length,projects:projects.length,contractValue:sum(projects.map(p=>p.original_contract_value)),invoiced:sum(active.map(i=>i.total)),paid:sum(active.map(i=>i.amount_paid)),outstanding:sum(active.map(i=>i.balance_due))}}
