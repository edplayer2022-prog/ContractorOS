import { notFound } from "next/navigation";
import { PublicDocument } from "@/components/public-document";
import { getPublicChangeOrder } from "@/lib/public-documents";
export const dynamic="force-dynamic";
export default async function PublicChangeOrderPage({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{approved?:string}>}){const{token}=await params;const query=await searchParams;const data=await getPublicChangeOrder(token);if(!data)notFound();return <PublicDocument data={data} token={token} justApproved={query.approved==="1"}/>;}
