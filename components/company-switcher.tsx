"use client";
import {useState} from "react";
import {createClient} from "@/lib/supabase/client";
export type CompanyOption={id:string;name:string;role:string};
export function CompanySwitcher({companies,current}:{companies:CompanyOption[];current:string}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 if(companies.length<2)return null;
 async function change(id:string){setBusy(true);const {error}=await createClient().rpc("switch_company",{target_company:id});if(error){setError(error.message);setBusy(false);}else window.location.assign("/dashboard");}
 return <div className="mb-5"><label className="text-xs font-bold text-slate-500" htmlFor="company-context">Current company</label><select id="company-context" value={current} disabled={busy} onChange={e=>change(e.target.value)} className="mt-1 block h-11 w-full max-w-sm rounded-lg border bg-white px-3">{companies.map(c=><option value={c.id} key={c.id}>{c.name} · {c.role.replaceAll("_"," ")}</option>)}</select>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}</div>;
}
