"use client";
import { Download } from "lucide-react";import { Button } from "@/components/ui";export function PrintButton({label="Download PDF"}:{label?:string}){return <Button className="no-print" onClick={()=>window.print()}><Download className="h-4 w-4"/>{label}</Button>}
