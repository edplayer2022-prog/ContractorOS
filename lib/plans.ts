import type { MemberRole } from "./database.types";
import { hasPermission, type Permission } from "./permission-policy.ts";

export const planIds = ["free", "starter", "pro", "business"] as const;
export type PlanId = typeof planIds[number];
export type PlanFeature = "estimates.unlimited" | "customer_links" | "digital_approval" | "digital_signatures" | "change_orders" | "projects" | "invoices" | "payments" | "reports" | "financial_reports" | "team_members" | "advanced_permissions" | "audit_log" | "advanced_analytics";
const starter: PlanFeature[] = ["estimates.unlimited", "customer_links", "digital_approval"];
const pro: PlanFeature[] = [...starter, "digital_signatures", "change_orders", "projects", "invoices", "payments", "reports", "financial_reports", "team_members", "audit_log", "advanced_analytics"];
export const plans: Record<PlanId, { id: PlanId; name: string; priceMonthly: number; priceAnnual: number | null; maxUsers: number; maxEstimatesPerMonth: number | null; description: string; features: readonly PlanFeature[] }> = {
  free: { id: "free", name: "Free", priceMonthly: 0, priceAnnual: null, maxUsers: 1, maxEstimatesPerMonth: 3, description: "Get started and create your first estimates.", features: [] },
  starter: { id: "starter", name: "Starter", priceMonthly: 9.99, priceAnnual: null, maxUsers: 1, maxEstimatesPerMonth: null, description: "For solo contractors who estimate every day.", features: starter },
  pro: { id: "pro", name: "Pro", priceMonthly: 19.99, priceAnnual: null, maxUsers: 3, maxEstimatesPerMonth: null, description: "For contractors managing jobs, invoices and payments.", features: pro },
  business: { id: "business", name: "Business", priceMonthly: 39.99, priceAnnual: null, maxUsers: 10, maxEstimatesPerMonth: null, description: "For growing contractor teams.", features: [...pro, "advanced_permissions"] },
};
export interface SubscriptionState {
  plan: PlanId; status: "free" | "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  trial_started_at: string | null; trial_ends_at: string | null; current_period_start: string | null; current_period_end: string | null;
  cancel_at_period_end: boolean; grace_ends_at: string | null; legacy_access: boolean;
  pending_plan: PlanId | null; pending_effective_at: string | null;
}
export interface SubscriptionAccess extends SubscriptionState {
  effective_plan: PlanId; estimates_created: number | null; active_team_members: number | null; pending_invites: number | null;
  period_start: string; period_end: string; server_now: string;
}
export function effectivePlan(s: SubscriptionState, now = new Date()): PlanId {
  if (s.legacy_access) return "business";
  if (s.status === "trialing") return s.trial_ends_at && Date.parse(s.trial_ends_at) > +now ? "pro" : "free";
  if (s.status === "past_due") return s.grace_ends_at && Date.parse(s.grace_ends_at) > +now ? s.plan : "free";
  if (s.status === "active" || s.status === "canceled") return s.current_period_end && Date.parse(s.current_period_end) > +now ? s.plan : "free";
  return "free";
}
export function hasPlanFeature(plan: PlanId, feature: PlanFeature) { return plans[plan].features.includes(feature); }
export function getPlanLimit(plan: PlanId, limit: "maxUsers" | "maxEstimatesPerMonth") { return plans[plan][limit]; }
export function featureForPermission(permission: Permission): PlanFeature | null {
  if (permission === "reports.view") return "reports";
  if (permission === "reports.financial") return "financial_reports";
  if (permission === "team.manage") return "team_members";
  if (permission === "estimates.send") return "customer_links";
  if (/\.(create|edit|send|delete|record)$/.test(permission)) {
    if (permission.startsWith("project_costs.")) return "projects";
    for (const prefix of ["projects", "invoices", "payments", "change_orders"] as const) if (permission.startsWith(prefix + ".")) return prefix;
  }
  return null; // Historical reads continue to require their original role permission.
}
export function canUseFeature(role: MemberRole, plan: PlanId, permission: Permission) {
  const feature = featureForPermission(permission);
  return hasPermission(role, permission) && (!feature || hasPlanFeature(plan, feature));
}
export function requiredPlan(feature: PlanFeature): PlanId { return planIds.find(id => hasPlanFeature(id, feature)) || "business"; }
export function monthlyPeriod(now: Date) {
  return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}
