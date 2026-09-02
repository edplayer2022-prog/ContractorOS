export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type EstimateStatus = "draft" | "sent" | "approved";

export interface Company extends Record<string, unknown> {
  id: string; owner_id: string; name: string; owner_name: string; logo_url: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  phone: string | null; email: string | null; website: string | null; contractor_license: string | null;
  default_sales_tax: number; default_overhead: number; default_profit_markup: number; default_deposit: number;
  estimate_validity_days: number; created_at: string; updated_at: string;
}
export interface Customer extends Record<string, unknown> {
  id: string; company_id: string; name: string; company_name: string | null; phone: string | null;
  email: string | null; billing_address: string | null; notes: string | null; created_at: string; updated_at: string;
}
export interface JobSite extends Record<string, unknown> {
  id: string; company_id: string; customer_id: string; job_name: string; address: string; city: string;
  state: string; zip: string; notes: string | null; created_at: string;
}
export interface RateLibraryItem extends Record<string, unknown> {
  id: string; company_id: string; category: string; service_name: string; description: string | null; unit: string;
  material_cost_per_unit: number; labor_hours_per_unit: number; labor_rate: number; waste_percent: number;
  equipment_cost: number; default_overhead: number; default_markup: number; taxable: boolean; created_at: string; updated_at: string;
}
export interface Estimate extends Record<string, unknown> {
  id: string; company_id: string; customer_id: string; job_site_id: string | null; estimate_number: string;
  estimate_date: string; valid_until: string; status: EstimateStatus; project_name: string; scope_of_work: string | null;
  internal_notes: string | null; customer_notes: string | null; discount_type: "fixed" | "percent"; discount_value: number;
  sales_tax_percent: number; deposit_percent: number; estimated_start_date: string | null; estimated_completion_date: string | null;
  payment_terms: string | null; inclusions: string | null; exclusions: string | null; subtotal: number; discount_amount: number;
  sales_tax_amount: number; total: number; deposit_required: number; remaining_balance: number; created_at: string; updated_at: string;
}
export interface EstimateItem extends Record<string, unknown> {
  id: string; estimate_id: string; company_id: string; rate_library_id: string | null; sort_order: number; category: string;
  phase: string | null; description: string; customer_description: string | null; unit: string; quantity: number; waste_percent: number;
  material_unit_cost: number; labor_hours: number; labor_rate: number; equipment_cost: number; subcontractor_cost: number;
  other_direct_cost: number; taxable: boolean; overhead_percent: number; profit_markup_percent: number; adjusted_quantity: number;
  material_cost: number; labor_cost: number; direct_cost: number; overhead_amount: number; cost_after_overhead: number;
  profit_amount: number; selling_price: number; created_at: string;
}

export interface Database {
  public: {
    Tables: {
      companies: { Row: Company; Insert: Partial<Company> & Pick<Company,"owner_id"|"name"|"owner_name">; Update: Partial<Company>; Relationships: [] };
      customers: { Row: Customer; Insert: Partial<Customer> & Pick<Customer,"company_id"|"name">; Update: Partial<Customer>; Relationships: [{ foreignKeyName:"customers_company_id_fkey"; columns:["company_id"]; isOneToOne:false; referencedRelation:"companies"; referencedColumns:["id"] }] };
      job_sites: { Row: JobSite; Insert: Partial<JobSite> & Pick<JobSite,"company_id"|"customer_id"|"job_name"|"address"|"city"|"state"|"zip">; Update: Partial<JobSite>; Relationships: [{ foreignKeyName:"job_sites_company_id_fkey"; columns:["company_id"]; isOneToOne:false; referencedRelation:"companies"; referencedColumns:["id"] },{ foreignKeyName:"job_sites_customer_id_fkey"; columns:["customer_id"]; isOneToOne:false; referencedRelation:"customers"; referencedColumns:["id"] }] };
      rate_library: { Row: RateLibraryItem; Insert: Partial<RateLibraryItem> & Pick<RateLibraryItem,"company_id"|"category"|"service_name"|"unit">; Update: Partial<RateLibraryItem>; Relationships: [{ foreignKeyName:"rate_library_company_id_fkey"; columns:["company_id"]; isOneToOne:false; referencedRelation:"companies"; referencedColumns:["id"] }] };
      estimates: { Row: Estimate; Insert: Partial<Estimate> & Pick<Estimate,"company_id"|"customer_id"|"estimate_number"|"estimate_date"|"valid_until"|"project_name">; Update: Partial<Estimate>; Relationships: [{ foreignKeyName:"estimates_company_id_fkey"; columns:["company_id"]; isOneToOne:false; referencedRelation:"companies"; referencedColumns:["id"] },{ foreignKeyName:"estimates_customer_id_fkey"; columns:["customer_id"]; isOneToOne:false; referencedRelation:"customers"; referencedColumns:["id"] },{ foreignKeyName:"estimates_job_site_id_fkey"; columns:["job_site_id"]; isOneToOne:false; referencedRelation:"job_sites"; referencedColumns:["id"] }] };
      estimate_items: { Row: EstimateItem; Insert: Partial<EstimateItem> & Pick<EstimateItem,"estimate_id"|"company_id"|"category"|"description"|"unit">; Update: Partial<EstimateItem>; Relationships: [{ foreignKeyName:"estimate_items_estimate_id_fkey"; columns:["estimate_id"]; isOneToOne:false; referencedRelation:"estimates"; referencedColumns:["id"] },{ foreignKeyName:"estimate_items_company_id_fkey"; columns:["company_id"]; isOneToOne:false; referencedRelation:"companies"; referencedColumns:["id"] },{ foreignKeyName:"estimate_items_rate_library_id_fkey"; columns:["rate_library_id"]; isOneToOne:false; referencedRelation:"rate_library"; referencedColumns:["id"] }] };
      users: { Row: { id: string; company_id: string | null; full_name: string | null; created_at: string }; Insert: { id: string; company_id?: string | null; full_name?: string | null }; Update: { company_id?: string | null; full_name?: string | null }; Relationships: [] };
    };
    Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never>;
  };
}
