"use client";
import { Download } from "lucide-react";import { Button } from "@/components/ui";export function PrintButton(){return <Button className="no-print" onClick={()=>window.print()}><Download className="h-4 w-4"/>Generate PDF</Button>}
