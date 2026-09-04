"use client";
import Link from "next/link";
import { useState } from "react";
import { Clipboard,Download,Eye,Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { ChangeOrderStatus } from "@/lib/database.types";
export function ChangeOrderWorkflowActions({id,status:initialStatus,token:initialToken}:{id:string;status:ChangeOrderStatus;token:string|null}){const[status,setStatus]=useState(initialStatus);const[token,setToken]=useState(initialToken);const[loading,setLoading]=useState(false);const router=useRouter();const url=token&&typeof window!=="undefined"?`${window.location.origin}/change-order/view/${token}`:"";async function send(){setLoading(true);const{data,error}=await createClient().rpc("send_change_order",{target_change_order_id:id});setLoading(false);if(error){toast.error(error.message);return;}setToken(data);setStatus("sent");toast.success("Change order is ready to share.");router.refresh();}async function copy(){if(!url)return;await navigator.clipboard.writeText(url);toast.success("Customer link copied.");}return <div className="flex flex-wrap gap-2">{status==="draft"&&<Button onClick={send} loading={loading}><Send className="h-4 w-4"/>Send Change Order</Button>}{(status==="sent"||status==="viewed")&&<><Button onClick={copy}><Clipboard className="h-4 w-4"/>Copy Customer Link</Button><Button variant="secondary" onClick={send} loading={loading}><Send className="h-4 w-4"/>Resend Link</Button></>}{token&&<><Link href={`/change-order/view/${token}`} target="_blank"><Button variant="secondary"><Eye className="h-4 w-4"/>View</Button></Link><Link href={`/change-order/view/${token}`} target="_blank"><Button variant="secondary"><Download className="h-4 w-4"/>{status==="approved"?"Download Approved PDF":"Download PDF"}</Button></Link></>}</div>}
