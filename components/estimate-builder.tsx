"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Eye, Library, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Company, Customer, Estimate, EstimateItem, EstimateStatus, JobSite, RateLibraryItem } from "@/lib/database.types";
import { calculateInternalSummary, calculateLine, calculateTotals, safeNumber } from "@/lib/estimate-calculations";
import { ESTIMATE_STATUSES, ESTIMATE_UNITS, unitLabel } from "@/lib/estimate-options";
import { currency } from "@/lib/utils";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";

type ItemDraft = {
  key: string; id?: string; rateLibraryId?: string; category: string; phase: string; serviceName: string;
  description: string; customerDescription: string; internalNotes: string; unit: string; quantity: number;
  wastePercent: number; materialUnitCost: number; laborHoursPerUnit: number; laborRate: number;
  equipmentCost: number; subcontractorCost: number; otherDirectCost: number; taxable: boolean;
  overheadPercent: number; profitMarkupPercent: number; open: boolean;
};

const numberValue = (value: string, maximum?: number) => safeNumber(Number(value), maximum);
const dateToday = () => new Date().toISOString().slice(0, 10);

export function EstimateBuilder({ company, customers, sites, rates, estimate, existingItems = [], suggestedNumber }: {
  company: Company; customers: Customer[]; sites: JobSite[]; rates: RateLibraryItem[]; estimate?: Estimate;
  existingItems?: EstimateItem[]; suggestedNumber: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [customerId, setCustomerId] = useState(estimate?.customer_id || customers[0]?.id || "");
  const [status, setStatus] = useState<EstimateStatus>(estimate?.status || "draft");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">(estimate?.discount_type || "fixed");
  const [discountValue, setDiscountValue] = useState(estimate?.discount_value || 0);
  const [tax, setTax] = useState(estimate?.sales_tax_percent ?? company.default_sales_tax);
  const [deposit, setDeposit] = useState(estimate?.deposit_percent ?? company.default_deposit);

  const blank = (): ItemDraft => ({
    key: crypto.randomUUID(), category: "General", phase: "", serviceName: "", description: "",
    customerDescription: "", internalNotes: "", unit: "each", quantity: 1, wastePercent: 0,
    materialUnitCost: 0, laborHoursPerUnit: 0, laborRate: 0, equipmentCost: 0, subcontractorCost: 0,
    otherDirectCost: 0, taxable: true, overheadPercent: company.default_overhead,
    profitMarkupPercent: company.default_profit_markup, open: true,
  });

  const [items, setItems] = useState<ItemDraft[]>(existingItems.length ? existingItems.map((item) => ({
    key: item.id, id: item.id, rateLibraryId: item.rate_library_id || undefined, category: item.category,
    phase: item.phase || "", serviceName: item.service_name || item.description, description: item.description,
    customerDescription: item.customer_description || "", internalNotes: item.internal_notes || "", unit: item.unit,
    quantity: item.quantity, wastePercent: item.waste_percent, materialUnitCost: item.material_unit_cost,
    laborHoursPerUnit: item.labor_hours_per_unit ?? (item.quantity > 0 ? item.labor_hours / item.quantity : 0),
    laborRate: item.labor_rate, equipmentCost: item.equipment_cost, subcontractorCost: item.subcontractor_cost,
    otherDirectCost: item.other_direct_cost, taxable: item.taxable, overheadPercent: item.overhead_percent,
    profitMarkupPercent: item.profit_markup_percent, open: false,
  })) : [blank()]);

  const update = (key: string, field: keyof ItemDraft, value: string | number | boolean) =>
    setItems((rows) => rows.map((row) => row.key === key ? { ...row, [field]: value } : row));
  const calculations = useMemo(() => items.map(calculateLine), [items]);
  const totals = useMemo(() => calculateTotals(items.map((item, index) => ({ ...item, sellingPrice: calculations[index].sellingPrice })), discountType, discountValue, tax, deposit), [items, calculations, discountType, discountValue, tax, deposit]);
  const internal = useMemo(() => calculateInternalSummary(calculations), [calculations]);
  const equipmentTotal = useMemo(() => items.reduce((sum, item) => sum + safeNumber(item.equipmentCost), 0), [items]);
  const subcontractorTotal = useMemo(() => items.reduce((sum, item) => sum + safeNumber(item.subcontractorCost), 0), [items]);
  const otherDirectTotal = useMemo(() => items.reduce((sum, item) => sum + safeNumber(item.otherDirectCost), 0), [items]);
  const customerSites = sites.filter((site) => site.customer_id === customerId);

  function addRate(rate: RateLibraryItem) {
    setItems((rows) => [...rows.filter((row) => row.serviceName || row.description || rows.length > 1), {
      ...blank(), rateLibraryId: rate.id, category: rate.category, serviceName: rate.service_name,
      description: rate.service_name, customerDescription: rate.description || rate.service_name, unit: rate.unit,
      materialUnitCost: rate.material_cost_per_unit, laborHoursPerUnit: rate.labor_hours_per_unit,
      laborRate: rate.labor_rate, wastePercent: rate.waste_percent, equipmentCost: rate.equipment_cost,
      subcontractorCost: rate.subcontractor_cost, otherDirectCost: rate.other_direct_cost,
      overheadPercent: rate.default_overhead, profitMarkupPercent: rate.default_markup, taxable: rate.taxable,
    }]);
    setLibraryOpen(false);
    toast.success(`${rate.service_name} added. You can edit every value.`);
  }

  function duplicateItem(item: ItemDraft) {
    setItems((rows) => {
      const index = rows.findIndex((row) => row.key === item.key);
      const copy = { ...item, key: crypto.randomUUID(), id: undefined, open: true };
      return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
    });
  }

  function removeItem(item: ItemDraft) {
    if (!confirm(`Delete line item “${item.serviceName || "Untitled service"}”?`)) return;
    setItems((rows) => rows.filter((row) => row.key !== item.key));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((rows) => { const next = [...rows]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

  function buildHeader(data: FormData, nextStatus = status) {
    return {
      company_id: company.id, customer_id: customerId, job_site_id: String(data.get("job_site_id") || "") || null,
      estimate_number: String(data.get("estimate_number")).trim(), estimate_date: String(data.get("estimate_date")),
      valid_until: String(data.get("valid_until")), status: nextStatus, project_name: String(data.get("project_name")).trim(),
      scope_of_work: String(data.get("scope_of_work") || "").trim() || null,
      internal_notes: String(data.get("internal_notes") || "").trim() || null,
      customer_notes: String(data.get("customer_notes") || "").trim() || null,
      discount_type: discountType, discount_value: discountValue, sales_tax_percent: tax, deposit_percent: deposit,
      estimated_start_date: String(data.get("estimated_start_date") || "") || null,
      estimated_completion_date: String(data.get("estimated_completion_date") || "") || null,
      payment_terms: String(data.get("payment_terms") || "").trim() || null,
      inclusions: String(data.get("inclusions") || "").trim() || null, exclusions: String(data.get("exclusions") || "").trim() || null,
      subtotal: totals.subtotal, discount_amount: totals.discountAmount, sales_tax_amount: totals.salesTaxAmount,
      total: totals.total, deposit_required: totals.depositRequired, remaining_balance: totals.remainingBalance,
    };
  }

  const itemPayloads = (estimateId: string) => items.map((item, index) => ({
    estimate_id: estimateId, company_id: company.id, rate_library_id: item.rateLibraryId || null, sort_order: index,
    category: item.category.trim(), phase: item.phase.trim() || null, service_name: item.serviceName.trim(),
    description: item.description.trim(), customer_description: item.customerDescription.trim() || null,
    internal_notes: item.internalNotes.trim() || null, unit: item.unit, quantity: item.quantity,
    waste_percent: item.wastePercent, material_unit_cost: item.materialUnitCost,
    labor_hours_per_unit: item.laborHoursPerUnit, labor_hours: calculateLine(item).totalLaborHours,
    labor_rate: item.laborRate, equipment_cost: item.equipmentCost, subcontractor_cost: item.subcontractorCost,
    other_direct_cost: item.otherDirectCost, taxable: item.taxable, overhead_percent: item.overheadPercent,
    profit_markup_percent: item.profitMarkupPercent,
  }));

  function validate() {
    if (!customerId) { toast.error("Select a customer."); return false; }
    if (!items.length) { toast.error("Add at least one line item."); return false; }
    if (items.some((item) => !item.serviceName.trim() || !item.description.trim())) { toast.error("Every item needs a service and internal description."); return false; }
    return true;
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!validate()) return; setLoading(true);
    const supabase = createClient(); const header = buildHeader(new FormData(event.currentTarget)); let estimateId = estimate?.id;
    if (estimateId) {
      const { error } = await supabase.from("estimates").update(header).eq("id", estimateId);
      if (error) { toast.error(error.message); setLoading(false); return; }
      const { error: deleteError } = await supabase.from("estimate_items").delete().eq("estimate_id", estimateId);
      if (deleteError) { toast.error(deleteError.message); setLoading(false); return; }
    } else {
      const { data, error } = await supabase.from("estimates").insert(header).select("id").single();
      if (error || !data) { toast.error(error?.message || "Could not save estimate."); setLoading(false); return; }
      estimateId = data.id;
    }
    const { error: itemError } = await supabase.from("estimate_items").insert(itemPayloads(estimateId));
    if (itemError) toast.error(itemError.message);
    else { toast.success(status === "draft" ? "Draft saved." : "Estimate saved."); router.push(`/estimates/${estimateId}`); router.refresh(); }
    setLoading(false);
  }

  async function duplicateEstimate() {
    if (!estimate || !formRef.current || !validate()) return;
    setLoading(true); const supabase = createClient(); const data = new FormData(formRef.current);
    const number = `${estimate.estimate_number}-COPY-${Date.now().toString().slice(-6)}`;
    const { data: copy, error } = await supabase.from("estimates").insert({ ...buildHeader(data, "draft"), estimate_number: number }).select("id").single();
    if (error || !copy) { toast.error(error?.message || "Could not duplicate estimate."); setLoading(false); return; }
    const { error: itemError } = await supabase.from("estimate_items").insert(itemPayloads(copy.id));
    if (itemError) toast.error(itemError.message);
    else { toast.success(`Estimate duplicated as ${number}.`); router.push(`/estimates/${copy.id}`); router.refresh(); }
    setLoading(false);
  }

  async function removeEstimate() {
    if (!estimate || !confirm("Delete this estimate permanently?")) return;
    setLoading(true); const { error } = await createClient().from("estimates").delete().eq("id", estimate.id);
    if (error) toast.error(error.message); else { toast.success("Estimate deleted."); router.push("/estimates"); router.refresh(); }
    setLoading(false);
  }

  return <>
    <form ref={formRef} onSubmit={save} className="grid gap-6">
      <Card className="p-5 sm:p-6"><div className="grid gap-4 md:grid-cols-3">
        <Input name="estimate_number" label="Estimate Number *" defaultValue={estimate?.estimate_number || suggestedNumber} required />
        <Input name="estimate_date" label="Date *" type="date" defaultValue={estimate?.estimate_date || dateToday()} required />
        <Input name="valid_until" label="Valid Until *" type="date" defaultValue={estimate?.valid_until || new Date(Date.now() + company.estimate_validity_days * 86400000).toISOString().slice(0, 10)} required />
        <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value as EstimateStatus)}>{ESTIMATE_STATUSES.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</Select>
        <Select label="Customer *" value={customerId} onChange={(event) => setCustomerId(event.target.value)} required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.company_name ? ` — ${customer.company_name}` : ""}</option>)}</Select>
        <Select label="Job Site" name="job_site_id" defaultValue={estimate?.job_site_id || ""}><option value="">No job site</option>{customerSites.map((site) => <option key={site.id} value={site.id}>{site.job_name}</option>)}</Select>
        <Input name="project_name" label="Project Name *" defaultValue={estimate?.project_name} className="md:col-span-3" required />
        <Textarea name="scope_of_work" label="Scope of Work" defaultValue={estimate?.scope_of_work ?? ""} className="md:col-span-3" />
        <Textarea name="internal_notes" label="Estimate Internal Notes (private)" defaultValue={estimate?.internal_notes ?? ""} />
        <Textarea name="customer_notes" label="Customer Notes" defaultValue={estimate?.customer_notes ?? ""} />
      </div></Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Line Items</h2><p className="text-sm text-slate-500">Costs and technical details are private.</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => setLibraryOpen(true)}><Library className="h-4 w-4" />Add From Rate Library</Button><Button type="button" size="sm" onClick={() => setItems((rows) => [...rows, blank()])}><Plus className="h-4 w-4" />Add Line Item</Button></div></div>
        <div className="divide-y divide-slate-100">{items.map((item, index) => { const calc = calculations[index]; return <div key={item.key} className="p-4 sm:p-5">
          <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3 md:grid-cols-[42px_1fr_120px_130px_auto]">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{index + 1}</span>
            <button type="button" className="min-w-0 text-left" onClick={() => update(item.key, "open", !item.open)}><p className="truncate font-semibold">{item.serviceName || "New line item"}</p><p className="text-xs text-slate-500">{item.category} · {item.quantity} {unitLabel(item.unit)}</p></button>
            <div className="col-start-2 row-start-2 md:col-auto md:row-auto"><p className="text-xs text-slate-400">Direct Cost</p><p className="text-sm font-medium">{currency(calc.directCost)}</p></div>
            <div className="col-start-3 row-start-2 md:col-auto md:row-auto"><p className="text-xs text-slate-400">Selling Price</p><p className="font-bold">{currency(calc.sellingPrice)}</p></div>
            <div className="col-start-3 row-start-1 flex items-center gap-1 md:col-auto md:row-auto"><button type="button" aria-label="Move item up" disabled={index === 0} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={() => moveItem(index, -1)}><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label="Move item down" disabled={index === items.length - 1} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={() => moveItem(index, 1)}><ArrowDown className="h-4 w-4" /></button></div>
          </div>
          {item.open && <div className="mt-5 border-t border-slate-100 pt-5">
            <div className="grid gap-4 md:grid-cols-3"><Input label="Category *" value={item.category} onChange={(event) => update(item.key, "category", event.target.value)} required /><Input label="Phase" value={item.phase} onChange={(event) => update(item.key, "phase", event.target.value)} /><Input label="Service *" value={item.serviceName} onChange={(event) => update(item.key, "serviceName", event.target.value)} required /><Textarea label="Internal Description *" value={item.description} onChange={(event) => update(item.key, "description", event.target.value)} required /><Textarea label="Customer Description" value={item.customerDescription} onChange={(event) => update(item.key, "customerDescription", event.target.value)} /><Textarea label="Internal Notes" value={item.internalNotes} onChange={(event) => update(item.key, "internalNotes", event.target.value)} /><Select label="Unit *" value={item.unit} onChange={(event) => update(item.key, "unit", event.target.value)}>{ESTIMATE_UNITS.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</Select></div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Internal costing — never shown to customer</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="Quantity" type="number" step="0.001" min="0" value={item.quantity} onChange={(event) => update(item.key, "quantity", numberValue(event.target.value))} />
              <Input label="Waste %" type="number" step="0.001" min="0" value={item.wastePercent} onChange={(event) => update(item.key, "wastePercent", numberValue(event.target.value, 1000))} />
              <Input label="Material Unit Cost" type="number" step="0.01" min="0" value={item.materialUnitCost} onChange={(event) => update(item.key, "materialUnitCost", numberValue(event.target.value))} />
              <Input label="Labor Hours Per Unit" type="number" step="0.001" min="0" value={item.laborHoursPerUnit} onChange={(event) => update(item.key, "laborHoursPerUnit", numberValue(event.target.value))} />
              <Input label="Total Labor Hours" type="number" value={calc.totalLaborHours} readOnly className="bg-slate-100" />
              <Input label="Labor Rate" type="number" step="0.01" min="0" value={item.laborRate} onChange={(event) => update(item.key, "laborRate", numberValue(event.target.value))} />
              <Input label="Equipment Cost" type="number" step="0.01" min="0" value={item.equipmentCost} onChange={(event) => update(item.key, "equipmentCost", numberValue(event.target.value))} />
              <Input label="Subcontractor Cost" type="number" step="0.01" min="0" value={item.subcontractorCost} onChange={(event) => update(item.key, "subcontractorCost", numberValue(event.target.value))} />
              <Input label="Other Direct Cost" type="number" step="0.01" min="0" value={item.otherDirectCost} onChange={(event) => update(item.key, "otherDirectCost", numberValue(event.target.value))} />
              <Input label="Overhead %" type="number" step="0.001" min="0" value={item.overheadPercent} onChange={(event) => update(item.key, "overheadPercent", numberValue(event.target.value, 1000))} />
              <Input label="Profit Markup %" type="number" step="0.001" min="0" value={item.profitMarkupPercent} onChange={(event) => update(item.key, "profitMarkupPercent", numberValue(event.target.value, 1000))} />
              <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium"><input type="checkbox" checked={item.taxable} onChange={(event) => update(item.key, "taxable", event.target.checked)} className="accent-orange-500" />Taxable</label>
            </div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-xs sm:grid-cols-4 lg:grid-cols-9">{[["Adjusted Qty", calc.adjustedQuantity.toFixed(3)], ["Material", currency(calc.materialCost)], ["Labor Hours", calc.totalLaborHours.toFixed(3)], ["Labor", currency(calc.laborCost)], ["Direct", currency(calc.directCost)], ["Overhead", currency(calc.overhead)], ["After OH", currency(calc.costAfterOverhead)], ["Profit", currency(calc.profit)], ["Sell", currency(calc.sellingPrice)]].map(([label, value]) => <div key={label}><p className="text-slate-400">{label}</p><p className="font-semibold text-slate-700">{value}</p></div>)}</div></div>
            <div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => duplicateItem(item)}><Copy className="h-4 w-4" />Duplicate Item</Button><Button type="button" size="sm" variant="danger" onClick={() => removeItem(item)}><Trash2 className="h-4 w-4" />Delete Item</Button></div>
          </div>}
        </div>; })}</div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="p-5 sm:p-6"><h2 className="mb-5 font-semibold">Customer-facing Details</h2><div className="grid gap-4 md:grid-cols-2"><Input name="estimated_start_date" label="Estimated Start Date" type="date" defaultValue={estimate?.estimated_start_date ?? ""} /><Input name="estimated_completion_date" label="Estimated Completion Date" type="date" defaultValue={estimate?.estimated_completion_date ?? ""} /><Textarea name="payment_terms" label="Payment Terms" defaultValue={estimate?.payment_terms ?? ""} /><Textarea name="inclusions" label="Inclusions" defaultValue={estimate?.inclusions ?? ""} /><Textarea name="exclusions" label="Exclusions" defaultValue={estimate?.exclusions ?? ""} /></div></Card>
        <Card className="h-fit p-5 xl:sticky xl:top-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Internal Estimate Summary</h2><p className="text-xs text-slate-500">Never shown to the customer</p></div><Badge tone="orange">Private</Badge></div>
          <div className="mb-4 grid grid-cols-2 gap-3"><Select label="Discount" value={discountType} onChange={(event) => setDiscountType(event.target.value as "fixed" | "percent")}><option value="fixed">Fixed $</option><option value="percent">Percent %</option></Select><Input label="Value" type="number" min="0" step="0.01" value={discountValue} onChange={(event) => setDiscountValue(numberValue(event.target.value))} /><Input label="Sales Tax %" type="number" min="0" max="100" step="0.001" value={tax} onChange={(event) => setTax(numberValue(event.target.value, 100))} /><Input label="Deposit %" type="number" min="0" max="100" step="0.001" value={deposit} onChange={(event) => setDeposit(numberValue(event.target.value, 100))} /></div>
          <div className="space-y-2 border-t border-slate-200 pt-4 text-sm"><MoneyRow label="Material Cost" value={internal.materialCost} /><MoneyRow label="Labor Cost" value={internal.laborCost} /><MoneyRow label="Equipment Cost" value={equipmentTotal} /><MoneyRow label="Subcontractor Cost" value={subcontractorTotal} /><MoneyRow label="Other Direct Cost" value={otherDirectTotal} /><MoneyRow label="Direct Cost" value={internal.directCost} strong /><MoneyRow label="Overhead" value={internal.overhead} /><MoneyRow label="Estimated Gross Profit" value={internal.profit} /><MoneyRow label="Gross Margin" value={`${internal.grossMarginPercent.toFixed(2)}%`} /><MoneyRow label="Subtotal Selling Price" value={totals.subtotal} strong /><MoneyRow label="Discount" value={`-${currency(totals.discountAmount)}`} /><MoneyRow label="Tax" value={totals.salesTaxAmount} /><div className="flex justify-between border-t-2 border-slate-900 pt-3 text-lg font-bold"><span>FINAL ESTIMATE TOTAL</span><span>{currency(totals.total)}</span></div><MoneyRow label="Deposit Required" value={totals.depositRequired} accent /><MoneyRow label="Remaining Balance" value={totals.remainingBalance} /></div>
        </Card>
      </div>

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"><div className="flex flex-wrap gap-2">{estimate && <><Button type="button" variant="danger" onClick={removeEstimate} loading={loading}><Trash2 className="h-4 w-4" /><span className="hidden sm:inline">Delete</span></Button><Button type="button" variant="secondary" onClick={duplicateEstimate} loading={loading}><Copy className="h-4 w-4" /><span className="hidden sm:inline">Duplicate Estimate</span></Button><Link href={`/estimates/${estimate.id}/customer`}><Button type="button" variant="secondary"><Eye className="h-4 w-4" /><span className="hidden sm:inline">Preview Customer Estimate</span></Button></Link></>}</div><Button loading={loading}><Save className="h-4 w-4" />{status === "draft" ? "Save Draft" : "Save Estimate"}</Button></div>
    </form>
    {libraryOpen && <RateLibraryModal rates={rates} onClose={() => setLibraryOpen(false)} onSelect={addRate} />}
  </>;
}

function MoneyRow({ label, value, strong, accent }: { label: string; value: number | string; strong?: boolean; accent?: boolean }) {
  return <div className={`flex justify-between ${strong ? "border-t border-slate-200 pt-2 font-semibold" : ""} ${accent ? "rounded-md bg-orange-50 px-3 py-2 font-semibold text-orange-800" : ""}`}><span className={strong || accent ? "" : "text-slate-500"}>{label}</span><span>{typeof value === "number" ? currency(value) : value}</span></div>;
}

function RateLibraryModal({ rates, onClose, onSelect }: { rates: RateLibraryItem[]; onClose: () => void; onSelect: (rate: RateLibraryItem) => void }) {
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("all");
  const categories = [...new Set(rates.map((rate) => rate.category))].sort();
  const visible = rates.filter((rate) => (category === "all" || rate.category === category) && `${rate.category} ${rate.service_name} ${rate.description ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Add Service from Rate Library"><div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
    <div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-bold">Add Service from Rate Library</h2><p className="text-sm text-slate-500">Values are copied and remain editable in this estimate.</p></div><button type="button" aria-label="Close library" className="rounded-lg p-2 hover:bg-slate-100" onClick={onClose}><X className="h-5 w-5" /></button></div>
    <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_220px]"><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input aria-label="Search rate library" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services" className="pl-9" autoFocus /></div><Select aria-label="Filter services by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((name) => <option key={name}>{name}</option>)}</Select></div>
    <div className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto">{visible.length ? visible.map((rate) => <button type="button" key={rate.id} onClick={() => onSelect(rate)} className="grid w-full gap-2 p-4 text-left hover:bg-orange-50 sm:grid-cols-[1fr_150px_120px] sm:items-center"><div><div className="flex items-center gap-2"><p className="font-semibold">{rate.service_name}</p>{rate.is_sample && <Badge tone="orange">Sample</Badge>}</div><p className="text-xs text-slate-500">{rate.category} · {rate.description}</p></div><span className="text-sm text-slate-600">{unitLabel(rate.unit)}</span><span className="text-right text-sm font-semibold">Select</span></button>) : <p className="p-10 text-center text-sm text-slate-500">No matching services.</p>}</div>
    <p className="border-t bg-amber-50 px-4 py-3 text-xs text-amber-900">Sample rates are for demonstration only. Enter your own local costs and pricing.</p>
  </div></div>;
}
