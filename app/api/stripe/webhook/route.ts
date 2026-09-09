import { NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/stripe-signature";
import { billingAdmin, stripeConfigured, stripeRequest, planForPrice } from "@/lib/stripe-billing";
export const runtime = "nodejs";
type ObjectRecord = Record<string, unknown>;
const record = (value: unknown): ObjectRecord => value && typeof value === "object" ? value as ObjectRecord : {};
const id = (value: unknown) => typeof value === "string" ? value : typeof record(value).id === "string" ? String(record(value).id) : null;
export async function POST(request: Request) {
 const raw = await request.text();
 if (raw.length > 1048576) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
 if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET || "")) return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
 if (!stripeConfigured()) return NextResponse.json({ error: "Billing integration is not enabled" }, { status: 503 });
 try {
  const event = JSON.parse(raw), object = record(event.data?.object);
  const supported = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_succeeded", "invoice.payment_failed"];
  if (!supported.includes(event.type)) return NextResponse.json({ received: true, ignored: true });
  const subscriptionId = event.type.startsWith("customer.subscription.") ? id(object) : id(object.subscription) || id(record(record(object.parent).subscription_details).subscription);
  if (!subscriptionId || !/^sub_[a-zA-Z0-9]+$/.test(subscriptionId)) return NextResponse.json({ received: true, ignored: true });
  // Fetch canonical provider state instead of trusting possibly stale event snapshots.
  const subscription = await stripeRequest(`subscriptions/${subscriptionId}`);
  const items = record(subscription.items).data;
  if (!Array.isArray(items) || items.length !== 1) throw new Error("Unexpected subscription items");
  const item = record(items[0]), price = id(item.price), plan = price ? planForPrice(price) : null;
  if (!plan) throw new Error("Unrecognized subscription price");
  const customerId = id(subscription.customer), admin = billingAdmin();
  const { data: existing, error } = await admin.from("company_subscriptions").select("company_id").eq("stripe_customer_id", customerId).single();
  if (error || !existing) throw new Error("Unknown billing customer");
  const end = Number(item.current_period_end || subscription.current_period_end), start = Number(item.current_period_start || subscription.current_period_start);
  if (!Number.isFinite(end) || !Number.isFinite(start)) throw new Error("Missing billing period");
  const status = ["active", "past_due", "canceled", "trialing"].includes(String(subscription.status)) ? String(subscription.status) : "incomplete";
  const { error: applyError } = await admin.rpc("apply_subscription_provider_event", { target_company: existing.company_id, provider_event: String(event.id), provider_created: Number(event.created), provider_type: String(event.type), customer: customerId, subscription_id: subscriptionId, next_plan: plan, next_status: status, period_start: new Date(start * 1000).toISOString(), period_end: new Date(end * 1000).toISOString(), cancel_at_end: subscription.cancel_at_period_end === true, provider_trial_end: subscription.trial_end ? new Date(Number(subscription.trial_end)*1000).toISOString() : null });
  if (applyError) throw new Error(applyError.message);
  return NextResponse.json({ received: true });
 } catch { return NextResponse.json({ error: "Unable to synchronize billing; retry required" }, { status: 500 }); }
}
