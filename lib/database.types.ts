export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type EstimateStatus = "draft" | "sent" | "viewed" | "approved" | "rejected" | "expired";
export type ChangeOrderStatus = "draft" | "sent" | "viewed" | "approved" | "rejected";
export type ProjectStatus = "upcoming" | "in_progress" | "on_hold" | "completed" | "cancelled";
export type InvoiceStatus = "draft" | "sent" | "viewed" | "partial" | "paid" | "overdue" | "void";
export type InvoiceType = "deposit" | "progress" | "final" | "custom";
export type PaymentMethod = "cash" | "check" | "credit_card" | "ach" | "zelle" | "venmo" | "wire_transfer" | "other";
export type ProjectCostCategory = "materials" | "labor" | "equipment" | "subcontractor" | "permit" | "disposal" | "fuel" | "other";
export type MemberRole = "owner"|"admin"|"estimator"|"project_manager"|"employee";
export type MembershipStatus = "invited"|"active"|"deactivated";

export interface Company extends Record<string, unknown> {
  id: string; owner_id: string; name: string; owner_name: string; logo_url: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  phone: string | null; email: string | null; website: string | null; contractor_license: string | null;
  timezone: string;
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
  equipment_cost: number; subcontractor_cost: number; other_direct_cost: number; default_overhead: number; default_markup: number;
  taxable: boolean; is_sample: boolean; created_at: string; updated_at: string;
}
export interface Estimate extends Record<string, unknown> {
  id: string; company_id: string; customer_id: string; job_site_id: string | null; estimate_number: string;
  estimate_date: string; valid_until: string; status: EstimateStatus; project_name: string; scope_of_work: string | null;
  internal_notes: string | null; customer_notes: string | null; discount_type: "fixed" | "percent"; discount_value: number;
  sales_tax_percent: number; deposit_percent: number; estimated_start_date: string | null; estimated_completion_date: string | null;
  payment_terms: string | null; inclusions: string | null; exclusions: string | null; subtotal: number; discount_amount: number;
  sales_tax_amount: number; total: number; deposit_required: number; remaining_balance: number; public_token: string | null;
  public_token_revoked_at: string | null; sent_at: string | null; first_viewed_at: string | null; last_viewed_at: string | null;
  view_count: number; approved_at: string | null; approved_by_name: string | null; approved_by_email: string | null;
  rejected_at: string | null; rejection_reason: string | null; rejection_comments: string | null; created_at: string; updated_at: string;
}

export interface ChangeOrder extends Record<string, unknown> {
  id: string; company_id: string; estimate_id: string; change_order_number: string; change_date: string; description: string;
  status: ChangeOrderStatus; public_token: string | null; public_token_revoked_at: string | null; subtotal: number;
  sales_tax_percent: number; sales_tax_amount: number; total: number; original_contract_value: number;
  previous_changes_value: number; new_contract_value: number; sent_at: string | null; first_viewed_at: string | null;
  last_viewed_at: string | null; view_count: number; approved_at: string | null; approved_by_name: string | null;
  approved_by_email: string | null; rejected_at: string | null; rejection_reason: string | null;
  rejection_comments: string | null; created_at: string; updated_at: string;
}
export interface ChangeOrderItem extends Record<string, unknown> {
  id: string; change_order_id: string; company_id: string; sort_order: number; description: string; quantity: number;
  unit: string; unit_price: number; taxable: boolean; amount: number; created_at: string;
}
export interface EstimateEvent extends Record<string, unknown> {
  id: number; company_id: string; estimate_id: string; change_order_id: string | null; event_type: string;
  metadata: Json; created_at: string;user_id:string|null;user_name:string|null;entity_type:string|null;entity_id:string|null;
}
export interface EstimateItem extends Record<string, unknown> {
  id: string; estimate_id: string; company_id: string; rate_library_id: string | null; sort_order: number; category: string;
  phase: string | null; service_name: string; description: string; customer_description: string | null; internal_notes: string | null;
  unit: string; quantity: number; waste_percent: number; material_unit_cost: number; labor_hours_per_unit: number; labor_hours: number; labor_rate: number; equipment_cost: number; subcontractor_cost: number;
  other_direct_cost: number; taxable: boolean; overhead_percent: number; profit_markup_percent: number; adjusted_quantity: number;
  material_cost: number; labor_cost: number; direct_cost: number; overhead_amount: number; cost_after_overhead: number;
  profit_amount: number; selling_price: number; created_at: string;
}
export interface Project extends Record<string, unknown> { id:string;company_id:string;customer_id:string;job_site_id:string|null;estimate_id:string;project_number:string;project_name:string;status:ProjectStatus;original_contract_value:number;estimated_internal_cost:number;estimated_start_date:string|null;estimated_completion_date:string|null;actual_start_date:string|null;actual_completion_date:string|null;project_manager:string|null;notes:string|null;created_at:string;updated_at:string; }
export interface Invoice extends Record<string, unknown> { id:string;company_id:string;customer_id:string;job_site_id:string|null;project_id:string|null;estimate_id:string|null;invoice_number:string;invoice_type:InvoiceType;invoice_date:string;due_date:string;po_number:string|null;customer_notes:string|null;internal_notes:string|null;payment_terms:string|null;status:InvoiceStatus;subtotal:number;discount_amount:number;sales_tax_percent:number;sales_tax_amount:number;total:number;amount_paid:number;balance_due:number;overpayment_amount:number;public_token:string|null;public_token_revoked_at:string|null;sent_at:string|null;first_viewed_at:string|null;last_viewed_at:string|null;view_count:number;paid_at:string|null;created_at:string;updated_at:string; }
export interface InvoiceItem extends Record<string, unknown> { id:string;invoice_id:string;company_id:string;sort_order:number;description:string;quantity:number;unit:string;unit_price:number;taxable:boolean;amount:number;created_at:string; }
export interface Payment extends Record<string, unknown> { id:string;company_id:string;invoice_id:string;payment_date:string;amount:number;payment_method:PaymentMethod;reference_number:string|null;notes:string|null;overpayment_amount:number;voided_at:string|null;void_reason:string|null;created_at:string; }
export interface ProjectCost extends Record<string, unknown> { id:string;company_id:string;project_id:string;cost_date:string;category:ProjectCostCategory;description:string;vendor:string|null;amount:number;notes:string|null;created_at:string; }
export interface FinancialEvent extends Record<string, unknown> { id:number;company_id:string;project_id:string|null;invoice_id:string|null;payment_id:string|null;event_type:string;metadata:Json;created_at:string;user_id:string|null;user_name:string|null;entity_type:string|null;entity_id:string|null; }
export interface CompanyMember extends Record<string,unknown>{id:string;company_id:string;user_id:string;role:MemberRole;status:MembershipStatus;email:string;display_name:string|null;last_active_at:string|null;invited_by:string|null;invited_at:string|null;accepted_at:string|null;deactivated_at:string|null;created_at:string;updated_at:string}
export interface TeamInvitation extends Record<string,unknown>{id:string;company_id:string;email:string;role:MemberRole;first_name:string|null;last_name:string|null;invited_by:string;invited_at:string;expires_at:string;accepted_at:string|null;revoked_at:string|null;created_at:string}
export interface ProjectMember extends Record<string,unknown>{project_id:string;user_id:string;role_on_project:string;assigned_by:string|null;assigned_at:string}
export interface AuditEvent extends Record<string,unknown>{id:number;company_id:string;user_id:string|null;user_name:string|null;event_type:string;entity_type:string;entity_id:string|null;metadata:Json;created_at:string}

export interface Database {
  public: {
    Tables: {
      companies: { Row: Company; Insert: Partial<Company> & Pick<Company,"owner_id"|"name"|"owner_name">; Update: Partial<Company>; Relationships: [] };
      customers: { Row: Customer; Insert: Partial<Customer> & Pick<Customer,"company_id"|"name">; Update: Partial<Customer>; Relationships: [{ foreignKeyName:"customers_company_id_fkey"; columns:["company_id"]; isOneToOne:false; referencedRelation:"companies"; referencedColumns:["id"] }] };
      job_sites: { Row: JobSite; Insert: Partial<JobSite> & Pick<JobSite,"company_id"|"customer_id"|"job_name"|"address"|"city"|"state"|"zip">; Update: Partial<JobSite>; Relationships: [{ foreignKeyName:"job_sites_company_id_fkey"; columns:["company_id"]; isOneToOne:false; referencedRelation:"companies"; referencedColumns:["id"] },{ foreignKeyName:"job_sites_customer_id_fkey"; columns:["customer_id"]; isOneToOne:false; referencedRelation:"customers"; referencedColumns:["id"] }] };
      rate_library: { Row: RateLibraryItem; Insert: Partial<RateLibraryItem> & Pick<RateLibraryItem,"company_id"|"category"|"service_name"|"unit">; Update: Partial<RateLibraryItem>; Relationships: [{ foreignKeyName:"rate_library_company_id_fkey"; columns:["company_id"]; isOneToOne:false; referencedRelation:"companies"; referencedColumns:["id"] }] };
      estimates: { Row: Estimate; Insert: Partial<Estimate> & Pick<Estimate,"company_id"|"customer_id"|"estimate_number"|"estimate_date"|"valid_until"|"project_name">; Update: Partial<Estimate>; Relationships: [{ foreignKeyName:"estimates_company_id_fkey"; columns:["company_id"]; isOneToOne:false; referencedRelation:"companies"; referencedColumns:["id"] },{ foreignKeyName:"estimates_customer_id_fkey"; columns:["customer_id"]; isOneToOne:false; referencedRelation:"customers"; referencedColumns:["id"] },{ foreignKeyName:"estimates_job_site_id_fkey"; columns:["job_site_id"]; isOneToOne:false; referencedRelation:"job_sites"; referencedColumns:["id"] }] };
      estimate_items: { Row: EstimateItem; Insert: Partial<EstimateItem> & Pick<EstimateItem,"estimate_id"|"company_id"|"category"|"description"|"unit">; Update: Partial<EstimateItem>; Relationships: [{ foreignKeyName:"estimate_items_estimate_id_fkey"; columns:["estimate_id"]; isOneToOne:false; referencedRelation:"estimates"; referencedColumns:["id"] },{ foreignKeyName:"estimate_items_company_id_fkey"; columns:["company_id"]; isOneToOne:false; referencedRelation:"companies"; referencedColumns:["id"] },{ foreignKeyName:"estimate_items_rate_library_id_fkey"; columns:["rate_library_id"]; isOneToOne:false; referencedRelation:"rate_library"; referencedColumns:["id"] }] };
      change_orders: { Row: ChangeOrder; Insert: Partial<ChangeOrder> & Pick<ChangeOrder,"company_id"|"estimate_id"|"change_order_number"|"change_date"|"description">; Update: Partial<ChangeOrder>; Relationships: [] };
      change_order_items: { Row: ChangeOrderItem; Insert: Partial<ChangeOrderItem> & Pick<ChangeOrderItem,"change_order_id"|"company_id"|"description"|"unit">; Update: Partial<ChangeOrderItem>; Relationships: [] };
      estimate_events: { Row: EstimateEvent; Insert: Partial<EstimateEvent> & Pick<EstimateEvent,"company_id"|"estimate_id"|"event_type">; Update: Partial<EstimateEvent>; Relationships: [] };
      estimate_approvals: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      estimate_snapshots: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      change_order_approvals: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      change_order_snapshots: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      public_request_log: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      projects: { Row:Project;Insert:Partial<Project>&Pick<Project,"company_id"|"customer_id"|"estimate_id"|"project_number"|"project_name">;Update:Partial<Project>;Relationships:[] };
      invoices: { Row:Invoice;Insert:Partial<Invoice>&Pick<Invoice,"company_id"|"customer_id"|"invoice_number"|"invoice_date"|"due_date">;Update:Partial<Invoice>;Relationships:[] };
      invoice_items: { Row:InvoiceItem;Insert:Partial<InvoiceItem>&Pick<InvoiceItem,"invoice_id"|"company_id"|"description">;Update:Partial<InvoiceItem>;Relationships:[] };
      payments: { Row:Payment;Insert:Partial<Payment>&Pick<Payment,"company_id"|"invoice_id"|"payment_date"|"amount"|"payment_method">;Update:Partial<Payment>;Relationships:[] };
      project_costs: { Row:ProjectCost;Insert:Partial<ProjectCost>&Pick<ProjectCost,"company_id"|"project_id"|"cost_date"|"category"|"description"|"amount">;Update:Partial<ProjectCost>;Relationships:[] };
      financial_events: { Row:FinancialEvent;Insert:Partial<FinancialEvent>&Pick<FinancialEvent,"company_id"|"event_type">;Update:Partial<FinancialEvent>;Relationships:[] };
      company_members:{Row:CompanyMember;Insert:Partial<CompanyMember>&Pick<CompanyMember,"company_id"|"user_id"|"role"|"email">;Update:Partial<CompanyMember>;Relationships:[]};
      team_invitations:{Row:TeamInvitation;Insert:Partial<TeamInvitation>&Pick<TeamInvitation,"company_id"|"email"|"role"|"invited_by"|"expires_at">;Update:Partial<TeamInvitation>;Relationships:[]};
      project_members:{Row:ProjectMember;Insert:ProjectMember;Update:Partial<ProjectMember>;Relationships:[]};
      audit_events:{Row:AuditEvent;Insert:Partial<AuditEvent>&Pick<AuditEvent,"company_id"|"event_type"|"entity_type">;Update:Partial<AuditEvent>;Relationships:[]};
      users: { Row: { id: string; company_id: string | null; full_name: string | null;phone:string|null;avatar_url:string|null;last_active_at:string|null; created_at: string }; Insert: { id: string; company_id?: string | null; full_name?: string | null;phone?:string|null;avatar_url?:string|null;last_active_at?:string|null }; Update: { company_id?: string | null; full_name?: string | null;phone?:string|null;avatar_url?:string|null;last_active_at?:string|null }; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      get_subscription_access:{Args:Record<string,never>;Returns:Json};
      start_pro_trial:{Args:Record<string,never>;Returns:undefined};
      schedule_free_downgrade:{Args:Record<string,never>;Returns:undefined};
      resume_local_subscription:{Args:Record<string,never>;Returns:undefined};
      request_plan_downgrade:{Args:{target_plan:string};Returns:Json};
      has_company_plan_feature:{Args:{target_company:string;feature:string};Returns:boolean};
      role_has_company_permission:{Args:{target_company_id:string;permission_name:string};Returns:boolean};
      list_my_companies:{Args:Record<string,never>;Returns:Json};
      switch_company:{Args:{target_company:string};Returns:undefined};
      update_project_details:{Args:{target_project:string;start_date:string|null;completion_date:string|null;internal_notes:string|null;crew_notes:string|null};Returns:undefined};
      send_estimate: { Args: { target_estimate_id: string }; Returns: string };
      extend_estimate_expiration: { Args: { target_estimate_id: string; new_valid_until: string }; Returns: undefined };
      duplicate_estimate: { Args: { target_estimate_id: string }; Returns: string };
      get_public_estimate: { Args: { target_token: string; raw_ip?: string | null }; Returns: Json };
      approve_public_estimate: { Args: { target_token: string; signer_name: string; signer_email: string; signature_kind: "drawn"|"typed"; signature_value: string; accepted_terms: boolean; request_user_agent?: string | null; raw_ip?: string | null }; Returns: Json };
      reject_public_estimate: { Args: { target_token: string; reason?: string | null; comments?: string | null; raw_ip?: string | null }; Returns: undefined };
      send_change_order: { Args: { target_change_order_id: string }; Returns: string };
      get_public_change_order: { Args: { target_token: string; raw_ip?: string | null }; Returns: Json };
      approve_public_change_order: { Args: { target_token: string; signer_name: string; signer_email: string; signature_kind: "drawn"|"typed"; signature_value: string; accepted_terms: boolean; request_user_agent?: string | null; raw_ip?: string | null }; Returns: Json };
      reject_public_change_order: { Args: { target_token: string; reason?: string | null; comments?: string | null; raw_ip?: string | null }; Returns: undefined };
      create_project_from_estimate: { Args:{target_estimate_id:string};Returns:string };
      update_project_status: { Args:{target_project_id:string;new_status:ProjectStatus};Returns:undefined };
      create_invoice: { Args:{payload:Json;line_items:Json;allow_overbilling?:boolean};Returns:string };
      send_invoice: { Args:{target_invoice_id:string};Returns:string };
      revoke_invoice_link: { Args:{target_invoice_id:string};Returns:undefined };
      get_public_invoice: { Args:{target_token:string;raw_ip?:string|null};Returns:Json };
      record_payment: { Args:{target_invoice_id:string;payment_date:string;amount:number;method:PaymentMethod;reference_number?:string|null;notes?:string|null;allow_overpayment?:boolean};Returns:string };
      void_payment: { Args:{target_payment_id:string;reason:string};Returns:undefined };
      add_project_cost: { Args:{target_project_id:string;cost_date:string;category:ProjectCostCategory;description:string;vendor:string;amount:number;notes?:string|null};Returns:string };
      refresh_overdue_invoices: { Args:Record<string,never>;Returns:number };
      has_company_permission:{Args:{target_company_id:string;permission_name:string};Returns:boolean};
      create_team_invitation:{Args:{target_company:string;target_email:string;target_role:MemberRole;first_name?:string|null;last_name?:string|null};Returns:string};
      get_public_invitation:{Args:{raw_token:string};Returns:Json};
      accept_team_invitation:{Args:{raw_token:string};Returns:Json};
      revoke_team_invitation:{Args:{invitation_id:string};Returns:undefined};
      change_member_role:{Args:{member_id:string;new_role:MemberRole};Returns:undefined};
      set_member_status:{Args:{member_id:string;new_status:MembershipStatus};Returns:undefined};
      assign_project_member:{Args:{target_project:string;target_user:string;project_role?:string};Returns:undefined};
      touch_last_active:{Args:Record<string,never>;Returns:undefined};
      update_my_profile:{Args:{new_name:string;new_phone?:string|null;new_avatar_url?:string|null};Returns:undefined};
      get_assigned_projects:{Args:Record<string,never>;Returns:Json};
      get_my_company_context:{Args:Record<string,never>;Returns:Json};
    };
    Enums: { estimate_status: EstimateStatus; change_order_status: ChangeOrderStatus; discount_type: "fixed"|"percent"; signature_type: "drawn"|"typed";project_status:ProjectStatus;invoice_status:InvoiceStatus;invoice_type:InvoiceType;payment_method:PaymentMethod;project_cost_category:ProjectCostCategory;member_role:MemberRole;membership_status:MembershipStatus };
    CompositeTypes: Record<string, never>;
  };
}
