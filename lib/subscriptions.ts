import "server-only";
import { getAuthContext } from "@/lib/data";
import type { SubscriptionAccess } from "@/lib/plans";
import { redirect } from "next/navigation";

export async function getSubscriptionContext(ownerOnly = false) {
  const context = await getAuthContext();
  if (ownerOnly && context.membership?.role !== "owner") redirect("/access-denied");
  const { data, error } = await context.supabase.rpc("get_subscription_access");
  if (error || !data) throw new Error("Unable to verify subscription access. Please try again.");
  return { ...context, subscription: data as unknown as SubscriptionAccess };
}
