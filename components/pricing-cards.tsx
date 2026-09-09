import Link from "next/link";
import { Check, HardHat } from "lucide-react";
import { plans, planIds, type PlanId } from "@/lib/plans";
const highlights: Record<PlanId, string[]> = {
 free: ["1 user · 3 estimates per month", "Customers and basic Rate Library", "Basic estimate builder and PDF"],
 starter: ["1 user · unlimited estimates", "Professional PDFs and customer links", "Status tracking and typed approval"],
 pro: ["3 users · unlimited estimates", "Digital signatures and Change Orders", "Projects, invoices and manual payments", "Reports and project analytics"],
 business: ["10 users · everything in Pro", "Advanced roles and permissions", "Advanced audit access", "Future feature eligibility — no AI yet"],
};
export function PricingCards({ billing = false }: { billing?: boolean }) {
 return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{planIds.map(id => <section key={id} className={`relative flex flex-col rounded-2xl border bg-white p-6 ${id === "pro" ? "border-orange-500 ring-2 ring-orange-100" : "border-slate-200"}`}>{id === "pro" && <span className="absolute -top-3 left-5 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white">Most Popular</span>}<HardHat className="mb-5 h-6 w-6 text-orange-500"/><h2 className="text-xl font-bold">{plans[id].name}</h2><p className="mt-2 min-h-12 text-sm text-slate-500">{plans[id].description}</p><p className="my-6"><strong className="text-4xl tracking-tight">${plans[id].priceMonthly.toFixed(id === "free" ? 0 : 2)}</strong><span className="text-sm text-slate-500"> / month</span></p><ul className="mb-6 flex-1 space-y-3 text-sm">{highlights[id].map(text => <li className="flex gap-2" key={text}><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/>{text}</li>)}</ul><Link href={billing ? `/settings/billing?plan=${id}` : id === "free" ? "/sign-up" : "/sign-up?next=/settings/billing"} className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold ${id === "pro" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-900"}`}>{billing ? "Review plan" : id === "free" ? "Start Free" : id === "pro" ? "Try Pro for 14 days" : "View subscription options"}</Link></section>)}</div>;
}
