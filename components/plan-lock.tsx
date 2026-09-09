import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Card } from "@/components/ui";
import { plans, requiredPlan, type PlanId, type PlanFeature } from "@/lib/plans";
export function PlanLock({ plan, feature, owner = false }: { plan: PlanId; feature: PlanFeature; owner?: boolean }) {
  const required = plans[requiredPlan(feature)];
  return <Card className="mx-auto max-w-2xl p-6 sm:p-10"><LockKeyhole className="mb-5 h-10 w-10 text-orange-500"/><h1 className="text-2xl font-bold">Available with {required.name}</h1><p className="mt-3 text-slate-600">{feature.replaceAll("_", " ")} requires the {required.name} plan. Your current plan is {plans[plan].name}. Existing records are preserved.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-orange-500 px-5 font-semibold text-white" href={owner ? "/settings/billing" : "/pricing"}>{owner ? "Upgrade Plan" : "View Plans"}</Link>{!owner && <p className="mt-3 text-sm text-slate-500">Contact your company Owner to change the subscription.</p>}</Card>;
}
