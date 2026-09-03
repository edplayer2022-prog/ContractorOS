import Link from "next/link";
import { Plus } from "lucide-react";
import { RateLibraryList } from "@/components/rate-library-list";
import { Button, PageHeader } from "@/components/ui";
import { getAuthContext } from "@/lib/data";

export default async function RateLibraryPage() {
  const { supabase } = await getAuthContext();
  const { data: items } = await supabase.from("rate_library").select("*").order("category").order("service_name");
  return <>
    <PageHeader title="Rate Library" description="Reusable services and company-specific costs for faster estimating." action={<Link href="/rate-library/new"><Button><Plus className="h-4 w-4" />Add Service</Button></Link>} />
    <RateLibraryList items={items || []} />
  </>;
}
