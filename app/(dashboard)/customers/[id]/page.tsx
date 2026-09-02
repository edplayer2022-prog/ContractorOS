import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customer-form";
import { PageHeader } from "@/components/ui";
import { getAuthContext } from "@/lib/data";
export default async function EditCustomerPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const {supabase,company}=await getAuthContext();const [{data:customer},{data:sites}]=await Promise.all([supabase.from("customers").select("*").eq("id",id).single(),supabase.from("job_sites").select("*").eq("customer_id",id).order("created_at")]);if(!customer)notFound();return <><PageHeader title="Edit Customer" description="Update customer and job site information."/><CustomerForm companyId={company!.id} customer={customer} sites={sites||[]}/></>}
