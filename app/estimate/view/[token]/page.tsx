import { notFound } from "next/navigation";
import { PublicDocument } from "@/components/public-document";
import { getPublicEstimate } from "@/lib/public-documents";
export const dynamic="force-dynamic";
export default async function PublicEstimatePage({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{approved?:string}>}){const{token}=await params;const query=await searchParams;const data=await getPublicEstimate(token);if(!data)notFound();return <PublicDocument data={data} token={token} justApproved={query.approved==="1"}/>;}
