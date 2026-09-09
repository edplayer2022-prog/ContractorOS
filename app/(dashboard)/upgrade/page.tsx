import { PlanLock } from "@/components/plan-lock";
import { getSubscriptionContext } from "@/lib/subscriptions";
import { plans, type PlanFeature } from "@/lib/plans";
export default async function UpgradePage({ searchParams }: { searchParams: Promise<{ feature?: string }> }) {
 const { subscription, membership } = await getSubscriptionContext();
 const query = await searchParams;
 const feature = plans.business.features.includes(query.feature as PlanFeature) ? query.feature as PlanFeature : "reports";
 return <PlanLock plan={subscription.effective_plan} feature={feature} owner={membership?.role === "owner"}/>;
}
