import Link from "next/link";
import type { SubscriptionAccess } from "@/lib/plans";
export function SubscriptionBanner({ subscription: s, owner }: { subscription: SubscriptionAccess; owner: boolean }) {
  const days = Math.max(0, Math.ceil((Date.parse(s.trial_ends_at || s.server_now) - Date.parse(s.server_now)) / 86400000));
  const message = s.legacy_access ? "Legacy access — your existing features are preserved. No subscription charge." : s.status === "past_due" ? "Your subscription payment needs attention." : s.status === "trialing" && days > 0 ? `Pro trial — ${days} days remaining${days <= 3 ? ". Choose a plan to keep Pro features." : ""}` : s.cancel_at_period_end ? `Your plan ends on ${new Date(s.current_period_end || s.trial_ends_at || s.server_now).toLocaleDateString("en-US", { timeZone: "UTC" })}.` : s.effective_plan === "free" && s.estimates_created !== null ? `${s.estimates_created} of 3 Free estimates used this month.` : null;
  if (!message) return null;
  return <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950"><span>{message}</span>{owner && <Link className="font-semibold underline underline-offset-4" href="/settings/billing">Plan & billing</Link>}</div>;
}
