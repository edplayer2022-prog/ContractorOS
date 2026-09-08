"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Library, Search } from "lucide-react";
import type { RateLibraryItem } from "@/lib/database.types";
import { unitLabel } from "@/lib/estimate-options";
import { currency } from "@/lib/utils";
import { Badge, Card, EmptyState, Input, Select } from "@/components/ui";

export function RateLibraryList({ items,canManage=true }: { items: RateLibraryItem[];canManage?:boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const categories = useMemo(() => [...new Set(items.map((item) => item.category))].sort(), [items]);
  const visible = useMemo(() => items.filter((item) => {
    const matchesCategory = category === "all" || item.category === category;
    const haystack = `${item.category} ${item.service_name} ${item.description ?? ""}`.toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  }), [category, items, query]);

  return <div className="space-y-4">
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Sample rates are provided for demonstration only.</strong> Contractors should enter their own local costs and pricing.</div>
    <Card className="p-4"><div className="grid gap-3 sm:grid-cols-[1fr_240px]">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input aria-label="Search services" placeholder="Search services or descriptions" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" /></div>
      <Select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((name) => <option key={name}>{name}</option>)}</Select>
    </div></Card>
    <Card className="overflow-hidden">{!visible.length ? <EmptyState icon={<Library className="h-6 w-6" />} title="No matching services" description="Adjust your search or add a custom service." /> : <>
      <div className="hidden grid-cols-[1.3fr_130px_130px_170px_100px] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid"><span>Service</span><span>Unit</span><span>Material</span><span>Labor</span><span>Taxable</span></div>
      <div className="divide-y divide-slate-100">{visible.map((item) => <Link href={canManage?`/rate-library/${item.id}`:"#"} onClick={e=>{if(!canManage)e.preventDefault();}} key={item.id} className="grid gap-3 p-4 transition hover:bg-slate-50 md:grid-cols-[1.3fr_130px_130px_170px_100px] md:items-center md:gap-4 md:px-5">
        <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{item.service_name}</p>{item.is_sample && <Badge tone="orange">Sample</Badge>}</div><p className="line-clamp-1 text-xs text-slate-500">{item.category}{item.description ? ` · ${item.description}` : ""}</p></div>
        <span className="text-sm text-slate-600"><span className="mr-2 text-xs text-slate-400 md:hidden">Unit</span>{unitLabel(item.unit)}</span>
        <span className="text-sm text-slate-600"><span className="mr-2 text-xs text-slate-400 md:hidden">Material</span>{currency(item.material_cost_per_unit)}</span>
        <span className="text-sm text-slate-600"><span className="mr-2 text-xs text-slate-400 md:hidden">Labor</span>{item.labor_hours_per_unit}h/unit @ {currency(item.labor_rate)}</span>
        <span><Badge tone={item.taxable ? "green" : "slate"}>{item.taxable ? "Yes" : "No"}</Badge></span>
      </Link>)}</div>
    </>}</Card>
  </div>;
}
