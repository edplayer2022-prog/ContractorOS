"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPlanFeature, type PlanId, type PlanFeature } from "@/lib/plans";
export function HistoricalPlanNotice({ plan, owner }: { plan: PlanId; owner: boolean }) {
 const path = usePathname(); const feature = (["projects", "invoices", "payments", "change_orders"] as PlanFeature[]).find(key => path.startsWith("/" + key.replaceAll("_", "-")));
 if (!feature || hasPlanFeature(plan, feature)) return null;
 return <div className="mb-5 rounded-lg border border-slate-200 bg-slate-100 p-4 text-sm">Historical records are read-only on this plan. Your data has been preserved. <Link className="font-semibold text-orange-700 underline" href={owner ? "/settings/billing" : "/pricing"}>Upgrade to create or edit {feature.replaceAll("_", " ")}.</Link></div>;
}
