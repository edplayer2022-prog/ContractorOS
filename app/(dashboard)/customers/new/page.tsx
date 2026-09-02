import { CustomerForm } from "@/components/customer-form";
import { PageHeader } from "@/components/ui";
import { getAuthContext } from "@/lib/data";
export default async function NewCustomerPage(){const {company}=await getAuthContext();return <><PageHeader title="New Customer" description="Add customer details and job sites."/><CustomerForm companyId={company!.id}/></>}
