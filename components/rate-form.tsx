"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Company, RateLibraryItem } from "@/lib/database.types";
import { ESTIMATE_UNITS } from "@/lib/estimate-options";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

const value = (data: FormData, name: string) => Math.max(0, Number(data.get(name)) || 0);

export function RateForm({ company, item }: { company: Company; item?: RateLibraryItem }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const buildPayload = (data: FormData, duplicate = false) => ({
    company_id: company.id,
    category: String(data.get("category")).trim(),
    service_name: `${String(data.get("service_name")).trim()}${duplicate ? " (Copy)" : ""}`,
    description: String(data.get("description") || "").trim() || null,
    unit: String(data.get("unit")),
    material_cost_per_unit: value(data, "material_cost_per_unit"),
    labor_hours_per_unit: value(data, "labor_hours_per_unit"),
    labor_rate: value(data, "labor_rate"),
    waste_percent: value(data, "waste_percent"),
    equipment_cost: value(data, "equipment_cost"),
    subcontractor_cost: value(data, "subcontractor_cost"),
    other_direct_cost: value(data, "other_direct_cost"),
    default_overhead: value(data, "default_overhead"),
    default_markup: value(data, "default_markup"),
    taxable: data.get("taxable") === "on",
    is_sample: false,
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true);
    const payload = buildPayload(new FormData(event.currentTarget));
    const supabase = createClient();
    const result = item ? await supabase.from("rate_library").update(payload).eq("id", item.id) : await supabase.from("rate_library").insert(payload);
    if (result.error) toast.error(result.error.message);
    else { toast.success(item ? "Service updated." : "Service added."); router.push("/rate-library"); router.refresh(); }
    setLoading(false);
  }

  async function duplicate(form: HTMLFormElement) {
    if (!item) return;
    setLoading(true);
    const { data, error } = await createClient().from("rate_library").insert(buildPayload(new FormData(form), true)).select("id").single();
    if (error || !data) toast.error(error?.message || "Could not duplicate service.");
    else { toast.success("Service duplicated."); router.push(`/rate-library/${data.id}`); router.refresh(); }
    setLoading(false);
  }

  async function remove() {
    if (!item || !confirm("Delete this service from the rate library? Estimates already using it will keep their copied values.")) return;
    setLoading(true);
    const { error } = await createClient().from("rate_library").delete().eq("id", item.id);
    if (error) toast.error(error.message);
    else { toast.success("Service deleted."); router.push("/rate-library"); router.refresh(); }
    setLoading(false);
  }

  return <form onSubmit={submit} className="space-y-6">
    {item?.is_sample && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">This started as sample data. Saving changes converts it into your company&apos;s custom rate.</div>}
    <Card className="p-5 sm:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Input name="category" label="Category *" placeholder="Painting" defaultValue={item?.category} required />
        <Input name="service_name" label="Service Name *" placeholder="Interior Wall Painting" defaultValue={item?.service_name} required />
        <Textarea name="description" label="Customer Description" defaultValue={item?.description ?? ""} className="md:col-span-2" placeholder="Professional description shown on the customer estimate." />
        <Select name="unit" label="Unit *" defaultValue={item?.unit ?? "each"}>{ESTIMATE_UNITS.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</Select>
        <Input name="material_cost_per_unit" label="Material Cost Per Unit" type="number" step="0.01" min="0" defaultValue={item?.material_cost_per_unit ?? 0} />
        <Input name="labor_hours_per_unit" label="Labor Hours Per Unit" type="number" step="0.001" min="0" defaultValue={item?.labor_hours_per_unit ?? 0} />
        <Input name="labor_rate" label="Labor Rate" type="number" step="0.01" min="0" defaultValue={item?.labor_rate ?? 0} />
        <Input name="waste_percent" label="Waste %" type="number" step="0.001" min="0" defaultValue={item?.waste_percent ?? 0} />
        <Input name="equipment_cost" label="Equipment Cost" type="number" step="0.01" min="0" defaultValue={item?.equipment_cost ?? 0} />
        <Input name="subcontractor_cost" label="Subcontractor Cost" type="number" step="0.01" min="0" defaultValue={item?.subcontractor_cost ?? 0} />
        <Input name="other_direct_cost" label="Other Direct Cost" type="number" step="0.01" min="0" defaultValue={item?.other_direct_cost ?? 0} />
        <Input name="default_overhead" label="Default Overhead %" type="number" step="0.001" min="0" defaultValue={item?.default_overhead ?? company.default_overhead} />
        <Input name="default_markup" label="Default Profit Markup %" type="number" step="0.001" min="0" defaultValue={item?.default_markup ?? company.default_profit_markup} />
        <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium"><input name="taxable" type="checkbox" className="h-4 w-4 accent-orange-500" defaultChecked={item?.taxable ?? true} />Taxable</label>
      </div>
    </Card>
    <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
      {item ? <div className="flex gap-2"><Button type="button" variant="danger" onClick={remove} loading={loading}><Trash2 className="h-4 w-4" />Delete</Button><Button type="button" variant="secondary" onClick={(event) => duplicate(event.currentTarget.form!)} loading={loading}><Copy className="h-4 w-4" />Duplicate</Button></div> : <span />}
      <div className="flex gap-3"><Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button><Button loading={loading}>Save Service</Button></div>
    </div>
  </form>;
}
