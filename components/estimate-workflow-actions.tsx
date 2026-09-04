"use client";
import Link from "next/link";
import { useState } from "react";
import { CalendarPlus, Check, Clipboard, Copy, Download, Eye, FilePlus2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { CreateProjectButton } from "@/components/create-project-button";
import type { EstimateStatus } from "@/lib/database.types";

export function EstimateWorkflowActions({id,status:initialStatus,token:initialToken,customerEmail}:{id:string;status:EstimateStatus;token:string|null;customerEmail?:string|null}){
  const [status,setStatus]=useState(initialStatus);const[token,setToken]=useState(initialToken);const[loading,setLoading]=useState(false);const[extend,setExtend]=useState(false);const router=useRouter();
  const url=token&&typeof window!=="undefined"?`${window.location.origin}/estimate/view/${token}`:"";
  async function send(){setLoading(true);const{data,error}=await createClient().rpc("send_estimate",{target_estimate_id:id});setLoading(false);if(error){toast.error(error.message);return;}setToken(data);setStatus("sent");toast.success("Estimate is ready to share.");router.refresh();}
  async function copy(){if(!url)return;await navigator.clipboard.writeText(url);toast.success("Customer link copied.");}
  async function extendExpiration(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setLoading(true);const date=new FormData(event.currentTarget).get("valid_until") as string;const{error}=await createClient().rpc("extend_estimate_expiration",{target_estimate_id:id,new_valid_until:date});setLoading(false);if(error){toast.error(error.message);return;}toast.success("Expiration extended. Send the estimate again when ready.");setStatus("draft");setExtend(false);router.refresh();}
  async function duplicate(){setLoading(true);const{data,error}=await createClient().rpc("duplicate_estimate",{target_estimate_id:id});setLoading(false);if(error){toast.error(error.message);return;}toast.success("A new draft version was created.");router.push(`/estimates/${data}`);router.refresh();}
  return <div className="flex flex-wrap items-center gap-2">
    {status==="draft"&&<Button onClick={send} loading={loading}><Send className="h-4 w-4"/>Send Estimate</Button>}
    {(status==="sent"||status==="viewed")&&<><Button onClick={copy}><Clipboard className="h-4 w-4"/>Copy Customer Link</Button><Button variant="secondary" onClick={send} loading={loading}><Send className="h-4 w-4"/>Resend Link</Button></>}
    {token&&<><Link href={`/estimate/view/${token}`} target="_blank"><Button variant="secondary"><Eye className="h-4 w-4"/>View</Button></Link><Link href={`/estimate/view/${token}`} target="_blank"><Button variant="secondary"><Download className="h-4 w-4"/>Download PDF</Button></Link></>}
    {status==="viewed"&&customerEmail&&<a href={`mailto:${customerEmail}?subject=Following up on your estimate`}><Button variant="secondary"><Check className="h-4 w-4"/>Follow Up</Button></a>}
    {status==="approved"&&<><CreateProjectButton estimateId={id}/><Link href={`/invoices/new?estimate=${id}&type=deposit`}><Button variant="secondary">Create Deposit Invoice</Button></Link><Link href={`/invoices/new?estimate=${id}&type=custom&import=1`}><Button variant="secondary">Create Invoice</Button></Link><Link href={`/change-orders/new?estimate=${id}`}><Button variant="secondary"><FilePlus2 className="h-4 w-4"/>Create Change Order</Button></Link></>}
    {(status==="approved"||status==="rejected")&&<Button variant="secondary" onClick={duplicate} loading={loading}><Copy className="h-4 w-4"/>{status==="rejected"?"Create Revised Estimate":"Duplicate"}</Button>}
    {status==="expired"&&!extend&&<Button onClick={()=>setExtend(true)}><CalendarPlus className="h-4 w-4"/>Extend Expiration Date</Button>}
    {extend&&<form onSubmit={extendExpiration} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-2"><Input name="valid_until" label="New Valid Until" type="date" required/><Button loading={loading}>Extend</Button><Button type="button" variant="ghost" onClick={()=>setExtend(false)}>Cancel</Button></form>}
  </div>;
}

