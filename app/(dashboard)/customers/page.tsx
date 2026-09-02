import Link from "next/link";
import { Mail, MapPin, Phone, Plus, Users } from "lucide-react";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { getAuthContext } from "@/lib/data";

export default async function CustomersPage() {
  const { supabase } = await getAuthContext();
  const { data: customers } = await supabase.from("customers").select("*, job_sites(count)").order("created_at", { ascending: false });
  return <>
    <PageHeader title="Customers" description="Manage customers and their job sites." action={<Link href="/customers/new"><Button><Plus className="h-4 w-4"/>New Customer</Button></Link>}/>
    <Card className="overflow-hidden">
      {!customers?.length ? <EmptyState icon={<Users className="h-6 w-6"/>} title="No customers yet" description="Add your first customer to start building an estimate." action={<Link href="/customers/new"><Button><Plus className="h-4 w-4"/>Add customer</Button></Link>}/> :
        <div className="divide-y divide-slate-100">{customers.map((customer) => <Link key={customer.id} href={`/customers/${customer.id}`} className="block p-4 transition hover:bg-slate-50 sm:p-5">
          <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-slate-900">{customer.name}</h3>{customer.company_name && <p className="text-sm text-slate-500">{customer.company_name}</p>}<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">{customer.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5"/>{customer.phone}</span>}{customer.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5"/>{customer.email}</span>}<span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5"/>{(customer.job_sites as unknown as {count:number}[])?.[0]?.count || 0} job sites</span></div></div><span className="text-slate-300">→</span></div>
        </Link>)}</div>}
    </Card>
  </>;
}
