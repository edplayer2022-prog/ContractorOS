"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, PenLine, RotateCcw, X } from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { currency } from "@/lib/utils";

type Props = { kind: "estimate" | "change-order"; token: string; number: string; total: number; status: string; expired?: boolean };

export function PublicApprovalControls({ kind, token, number, total, status, expired }: Props) {
  const [mode, setMode] = useState<"none"|"approve"|"decline">("none");
  const [signatureType, setSignatureType] = useState<"drawn"|"typed">("drawn");
  const [typed, setTyped] = useState(""); const [drawn, setDrawn] = useState(""); const [loading, setLoading] = useState(false);
  const [declined, setDeclined] = useState(false); const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null); const panelRef = useRef<HTMLElement>(null); const drawing = useRef(false);

  useEffect(()=>{if(mode!=="none")panelRef.current?.scrollIntoView({behavior:"smooth",block:"start"});},[mode]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || signatureType !== "drawn") return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1); const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
    const context = canvas.getContext("2d"); if (!context) return; context.scale(ratio, ratio); context.lineWidth = 2.5; context.lineCap = "round"; context.strokeStyle = "#0f172a";
  }, [signatureType, mode]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function start(event: React.PointerEvent<HTMLCanvasElement>) { event.currentTarget.setPointerCapture(event.pointerId); drawing.current = true; const ctx=event.currentTarget.getContext("2d"); const p=point(event); ctx?.beginPath(); ctx?.moveTo(p.x,p.y); }
  function move(event: React.PointerEvent<HTMLCanvasElement>) { if(!drawing.current)return; const ctx=event.currentTarget.getContext("2d"); const p=point(event); ctx?.lineTo(p.x,p.y); ctx?.stroke(); setDrawn(event.currentTarget.toDataURL("image/png")); }
  function stop(){drawing.current=false;}
  function clear(){const canvas=canvasRef.current;if(!canvas)return;canvas.getContext("2d")?.clearRect(0,0,canvas.width,canvas.height);setDrawn("");}

  async function submitApprove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); const form=new FormData(event.currentTarget); const signature=signatureType==="typed"?typed:drawn;
    if(!signature){setError("Please provide your signature.");return;} setLoading(true);
    const response=await fetch(`/api/public/${kind}/${token}/approve`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:form.get("name"),email:form.get("email"),signatureType,signature,accepted:form.get("accepted")==="on"})});
    const payload=await response.json(); setLoading(false); if(!response.ok){setError(payload.error||"Approval could not be recorded.");return;} window.location.assign(`${window.location.pathname}?approved=1`);
  }
  async function submitDecline(event: React.FormEvent<HTMLFormElement>){event.preventDefault();setError("");setLoading(true);const form=new FormData(event.currentTarget);const response=await fetch(`/api/public/${kind}/${token}/reject`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reason:form.get("reason"),comments:form.get("comments")})});const payload=await response.json();setLoading(false);if(!response.ok){setError(payload.error||"Decline could not be recorded.");return;}setDeclined(true);}

  if(declined)return <section className="no-print mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center"><h2 className="text-xl font-bold">Response Recorded</h2><p className="mt-2 text-sm text-slate-600">The contractor has been notified that you declined this {kind==="estimate"?"estimate":"change order"}.</p></section>;
  if(expired||status==="expired")return <section className="no-print mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"><h2 className="text-xl font-bold text-amber-950">Estimate Expired</h2><p className="mt-2 text-sm text-amber-800">This estimate has expired. Please contact the contractor for an updated estimate.</p></section>;
  if(status==="approved"||status==="rejected")return null;
  if(mode==="none")return <div className="no-print sticky bottom-3 z-20 mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row"><Button className="h-12 w-full text-base sm:flex-1" onClick={()=>setMode("approve")}><CheckCircle2 className="h-5 w-5"/>Approve {kind==="estimate"?"Estimate":"Change Order"}</Button><Button className="h-12 sm:w-48" variant="secondary" onClick={()=>setMode("decline")}><X className="h-4 w-4"/>Decline</Button></div>;

  return <section ref={panelRef} className="no-print mt-8 scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-7">
    <div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">{mode==="approve"?"Approve and Sign":"Decline"}</h2><p className="mt-1 text-sm text-slate-500">{number} · {currency(total)}</p></div><button aria-label="Close" onClick={()=>{setMode("none");setError("");}} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>
    {mode==="approve"?<form onSubmit={submitApprove} className="mt-6 grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><Input name="name" label="Customer Full Name *" required maxLength={200}/><Input name="email" label="Email *" type="email" required maxLength={320}/></div><div><div className="mb-3 flex gap-2"><Button type="button" className="h-11 flex-1 whitespace-nowrap text-xs sm:text-sm" variant={signatureType==="drawn"?"primary":"secondary"} onClick={()=>setSignatureType("drawn")}><PenLine className="h-4 w-4"/>Draw Signature</Button><Button type="button" className="h-11 flex-1 whitespace-nowrap text-xs sm:text-sm" variant={signatureType==="typed"?"primary":"secondary"} onClick={()=>setSignatureType("typed")}>Type Signature</Button></div>{signatureType==="drawn"?<div><canvas ref={canvasRef} aria-label="Signature pad" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-slate-50"/><button type="button" onClick={clear} className="mt-2 flex items-center gap-1 text-sm font-semibold text-slate-600"><RotateCcw className="h-4 w-4"/>Clear signature</button></div>:<Input label="Type your full signature *" value={typed} onChange={e=>setTyped(e.target.value)} className="h-16 font-serif text-2xl italic"/>}</div><label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6"><input name="accepted" type="checkbox" required className="mt-1 h-5 w-5 shrink-0 accent-orange-500"/><span>I have reviewed this estimate and authorize the contractor to proceed with the scope of work described above, subject to any applicable contract requirements.</span></label><p className="text-xs leading-5 text-slate-500">This approval records acceptance of this estimate. Additional state or local contract documents may be required depending on the project.</p>{error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button loading={loading} className="h-12 text-base">Confirm Approval</Button></form>:
    <form onSubmit={submitDecline} className="mt-6 grid gap-4"><Select name="reason" label="Reason for Declining (optional)"><option value="">Select a reason</option><option>Price</option><option>Project Timing</option><option>Scope</option><option>Chose Another Contractor</option><option>Other</option></Select><Textarea name="comments" label="Customer Comments (optional)" maxLength={2000}/>{error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button loading={loading} variant="danger" className="h-12">Confirm Decline</Button></form>}
  </section>;
}
