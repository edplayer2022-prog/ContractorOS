import Link from "next/link";
import { Card, PageHeader, Badge } from "@/components/ui";
import { getAuthContext } from "@/lib/data";
export async function BasicDashboard() {
 const { supabase } = await getAuthContext();
 const [{ data: rows }, { count }] = await Promise.all([supabase.from("estimates").select("id,estimate_number,project_name,status").order("created_at", { ascending: false }), supabase.from("customers").select("id", { count: "exact", head: true })]);
 return <><PageHeader title="Dashboard" description="Your customers and estimates, all in one place." action={<Link className="rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white" href="/estimates/new">New Estimate</Link>}/><div className="grid gap-4 sm:grid-cols-3">{[["Customers", count || 0], ["Total Estimates", rows?.length || 0], ["Draft Estimates", rows?.filter(row => row.status === "draft").length || 0]].map(([label, value]) => <Card className="p-6" key={label}><p className="text-3xl font-bold">{value}</p><p className="mt-1 text-sm text-slate-500">{label}</p></Card>)}</div><Card className="mt-6 overflow-hidden"><h2 className="border-b p-5 font-bold">Recent estimates</h2>{rows?.slice(0, 10).map(row => <Link className="flex flex-wrap justify-between gap-3 border-b p-5" href={`/estimates/${row.id}`} key={row.id}><span><strong>{row.estimate_number}</strong><span className="ml-3 text-slate-500">{row.project_name}</span></span><Badge>{row.status}</Badge></Link>)}{!rows?.length && <p className="p-6 text-slate-500">Create your first estimate to get started.</p>}</Card></>;
}
