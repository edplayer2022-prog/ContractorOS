export type PublicCompany = { logo_url: string | null; name: string; address: string | null; city: string | null; state: string | null; zip: string | null; phone: string | null; email: string | null; website: string | null; contractor_license: string | null };
export type PublicCustomer = { name: string; company_name: string | null; billing_address?: string | null };
export type PublicJobSite = { job_name: string; address: string; city: string; state: string; zip: string } | null;
export type PublicApproval = { approved_by: string; email: string; signature_type: "drawn" | "typed"; signature_data: string; approved_at: string; electronically_approved: boolean };

export type PublicEstimate = {
  kind: "estimate"; status: "sent" | "viewed" | "approved" | "rejected" | "expired"; expired: boolean;
  company: PublicCompany; customer: PublicCustomer; job_site: PublicJobSite;
  estimate: { estimate_number: string; estimate_date: string; valid_until: string; project_name: string; scope_of_work: string | null };
  items: { description: string; quantity: number; unit: string; amount: number }[];
  summary: { subtotal: number; discount: number; tax: number; total: number; deposit: number; remaining_balance: number };
  details: { estimated_start_date: string | null; estimated_completion_date: string | null; payment_terms: string | null; inclusions: string | null; exclusions: string | null; customer_notes: string | null };
  approval?: PublicApproval; view_count?: number;
};

export type PublicChangeOrder = {
  kind: "change_order"; status: "sent" | "viewed" | "approved" | "rejected";
  company: PublicCompany; customer: PublicCustomer; job_site: PublicJobSite;
  change_order: { number: string; date: string; description: string; original_estimate_number: string; project_name: string };
  items: { description: string; quantity: number; unit: string; unit_price: number; amount: number }[];
  summary: { subtotal: number; tax: number; total: number; original_contract_value: number; previous_changes_value: number; new_contract_value: number };
  approval?: PublicApproval; view_count?: number;
};

export type PublicDocumentData = PublicEstimate | PublicChangeOrder;

export type PublicInvoice = {
  kind:"invoice";status:"sent"|"viewed"|"partial"|"paid"|"overdue"|"void";company:PublicCompany;customer:PublicCustomer;job_site:PublicJobSite;
  invoice:{invoice_number:string;invoice_type:"deposit"|"progress"|"final"|"custom";invoice_date:string;due_date:string;po_number:string|null;payment_terms:string|null;customer_notes:string|null};
  project:{project_number:string;project_name:string}|null;estimate:{estimate_number:string}|null;
  items:{description:string;quantity:number;unit:string;unit_price:number;amount:number}[];
  payments:{payment_date:string;amount:number;payment_method:string;reference_number:string|null}[];
  summary:{subtotal:number;discount:number;tax:number;total:number;amount_paid:number;balance_due:number};
};

export const PUBLIC_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const FORBIDDEN_PUBLIC_FIELDS = [
  "material_unit_cost", "material_cost", "labor_hours", "labor_rate", "labor_cost", "equipment_cost",
  "subcontractor_cost", "other_direct_cost", "direct_cost", "overhead", "profit", "markup", "gross_margin",
  "internal_description", "internal_notes", "internal_cost", "estimated_internal_cost", "actual_cost", "projected_profit",
] as const;

export function containsForbiddenPublicField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenPublicField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => FORBIDDEN_PUBLIC_FIELDS.includes(key.toLowerCase() as typeof FORBIDDEN_PUBLIC_FIELDS[number]) || containsForbiddenPublicField(child));
}

