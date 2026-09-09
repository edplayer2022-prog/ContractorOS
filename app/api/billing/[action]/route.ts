import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { billingAdmin, stripeConfigured, stripeRequest, priceForPlan } from "@/lib/stripe-billing";
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
 const { action } = await params;
 if (!["checkout", "portal"].includes(action)) return NextResponse.json({ error: "Unknown billing action" }, { status: 404 });
 const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
 if (request.headers.get("origin") !== origin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
 const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
 if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
 const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
 const { data: member } = await supabase.from("company_members").select("role,status").eq("company_id", profile?.company_id || "00000000-0000-0000-0000-000000000000").eq("user_id", user.id).single();
 if (member?.role !== "owner" || member.status !== "active") return NextResponse.json({ error: "Only an active Owner can manage billing" }, { status: 403 });
 if (!stripeConfigured()) return NextResponse.json({ error: "Stripe billing is not connected. No payment was processed." }, { status: 503 });
 try {
  const payload = await request.json();
  if (!payload || typeof payload !== "object" || Object.keys(payload).some(key => key !== "plan") || (action === "portal" && Object.keys(payload).length)) throw new Error("Invalid billing request");
  const price = action === "checkout" ? priceForPlan(payload.plan) : null;
  const admin = billingAdmin(); const { data: subscription, error } = await admin.from("company_subscriptions").select("stripe_customer_id,stripe_subscription_id").eq("company_id", profile!.company_id).single();
  if (error || !subscription) throw new Error("Subscription not found");
  let customerId = subscription.stripe_customer_id;
  if (action === "portal" && !customerId) throw new Error("No billing customer exists yet");
  if (!customerId) {
   const customer = await stripeRequest("customers", new URLSearchParams({ email: user.email || "", "metadata[company_id]": profile!.company_id! }), `company-customer-${profile!.company_id}`);
   if (typeof customer.id !== "string") throw new Error("Invalid provider customer");
   const { data, error: claimError } = await admin.rpc("claim_subscription_customer", { target_company: profile!.company_id, customer: customer.id });
   if (claimError) throw new Error(claimError.message); customerId = data;
  }
  if (action === "portal" || subscription.stripe_subscription_id) {
   const session = await stripeRequest("billing_portal/sessions", new URLSearchParams({ customer: customerId, return_url: `${origin}/settings/billing` }));
   return NextResponse.json({ url: session.url });
  }
  const session = await stripeRequest("checkout/sessions", new URLSearchParams({ mode: "subscription", customer: customerId, "line_items[0][price]": price!, "line_items[0][quantity]": "1", client_reference_id: profile!.company_id!, "subscription_data[metadata][company_id]": profile!.company_id!, success_url: `${origin}/settings/billing?checkout=returned`, cancel_url: `${origin}/settings/billing` }), `checkout-${profile!.company_id}-${price}-${Math.floor(Date.now()/1800000)}`);
  return NextResponse.json({ url: session.url });
 } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to open billing" }, { status: 400 }); }
}
