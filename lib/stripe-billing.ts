import "server-only";
import { createClient } from "@supabase/supabase-js";
import { planIds, type PlanId } from "@/lib/plans";
const required = ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STARTER_MONTHLY", "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_BUSINESS_MONTHLY", "SUPABASE_SERVICE_ROLE_KEY"];
export function stripeConfigured() { return required.every(key => !!process.env[key]) && process.env.STRIPE_BILLING_ENABLED === "true"; }
export function billingAdmin() {
 if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Billing backend is not configured");
 return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function priceForPlan(plan: string) {
 if (!planIds.includes(plan as PlanId) || plan === "free") throw new Error("Invalid paid plan");
 const price = process.env[`STRIPE_PRICE_${plan.toUpperCase()}_MONTHLY`];
 if (!price?.startsWith("price_")) throw new Error("Plan price is not configured");
 return price;
}
export function planForPrice(price: string): PlanId | null {
 return (["starter", "pro", "business"] as const).find(plan => process.env[`STRIPE_PRICE_${plan.toUpperCase()}_MONTHLY`] === price) || null;
}
export async function stripeRequest(path: string, body?: URLSearchParams, idempotencyKey?: string): Promise<Record<string, unknown>> {
 if (!stripeConfigured()) throw new Error("Stripe billing is not connected");
 const response = await fetch(`https://api.stripe.com/v1/${path}`, { method: body ? "POST" : "GET", cache: "no-store", headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) }, body });
 if (!response.ok) throw new Error("The billing provider could not complete this request. Please try again.");
 return response.json();
}
