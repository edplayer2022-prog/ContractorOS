"use client";
import Link from "next/link";
import {hasPlanFeature,type PlanId} from "@/lib/plans";
import {PermissionProvider} from "@/components/permission-context";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, Building2, Calculator, FileText, FolderKanban, Gauge, HardHat, Library, LogOut, Menu, Settings, ShieldCheck, UserCircle, Users, X } from "lucide-react";
import type{MemberRole}from"@/lib/database.types";import type{Permission}from"@/lib/permissions";
import { logout } from "@/app/(auth)/actions";
import { cn, initials } from "@/lib/utils";

const links:{href:string;label:string;icon:typeof Gauge;permission:Permission}[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge,permission:"dashboard.view" },
  { href: "/customers", label: "Customers", icon: Users,permission:"customers.view" },
  { href: "/estimates", label: "Estimates", icon: Calculator,permission:"estimates.view" },
  { href: "/projects", label: "Projects", icon: FolderKanban,permission:"projects.view" },
  { href: "/my-projects", label: "My Projects", icon: FolderKanban,permission:"assigned_projects.view" },
  { href: "/invoices", label: "Invoices", icon: FileText,permission:"invoices.view" },
  { href: "/reports", label: "Reports", icon: BarChart3,permission:"reports.view" },
  { href: "/rate-library", label: "Rate Library", icon: Library,permission:"rate_library.view" },
  { href: "/team", label: "Team", icon: ShieldCheck,permission:"team.view" },
  { href: "/settings", label: "Settings", icon: Settings,permission:"settings.company" },
  { href: "/profile", label: "My Profile", icon: UserCircle,permission:"dashboard.view" },
];

export function AppShell({ companyName, ownerName,role,permissions, plan, children }: { companyName: string; ownerName: string;role:MemberRole;plan:PlanId;permissions:readonly Permission[]; children: React.ReactNode }) {
  const path = usePathname(); const [open,setOpen]=useState(false);
  const sidebar = <><div className="flex h-16 items-center gap-3 border-b border-white/10 px-5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500"><HardHat className="h-5 w-5"/></span><span className="text-lg font-bold">ContractorOS</span></div><nav className="flex-1 space-y-1 overflow-y-auto p-3">{links.filter(link=>permissions.includes(link.permission)||link.permission==="reports.view"&&["owner","admin"].includes(role)).map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>setOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition", path===href || (href!=="/dashboard"&&path.startsWith(href)) ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white")}><Icon className="h-5 w-5"/>{label}{href==="/reports"&&!hasPlanFeature(plan,"reports")&&<span className="ml-auto text-xs">Locked</span>}</Link>)}{role==="owner"&&<Link href="/settings/billing" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300"><Building2 className="h-5 w-5"/>Plan & Billing</Link>}</nav><div className="border-t border-white/10 p-3"><div className="mb-2 flex items-center gap-3 rounded-lg px-2 py-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-300">{initials(companyName)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{companyName}</p><p className="truncate text-xs text-slate-400">{ownerName} · {role.replaceAll("_"," ")}</p></div></div><form action={logout}><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4"/>Log out</button></form></div></>;
  return <PermissionProvider permissions={permissions}><div className="min-h-screen"><aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-slate-950 text-white lg:flex">{sidebar}</aside>{open&&<div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close menu" className="absolute inset-0 bg-slate-950/60" onClick={()=>setOpen(false)}/><aside className="relative flex h-full w-72 flex-col bg-slate-950 text-white">{sidebar}<button className="absolute right-3 top-3 rounded-lg p-2 text-slate-300" onClick={()=>setOpen(false)}><X className="h-5 w-5"/></button></aside></div>}<header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden"><button className="rounded-lg border border-slate-200 p-2" onClick={()=>setOpen(true)}><Menu className="h-5 w-5"/></button><div className="flex items-center gap-2 font-bold"><HardHat className="h-5 w-5 text-orange-500"/>ContractorOS</div><Building2 className="h-5 w-5 text-slate-400"/></header><main className="min-h-screen lg:pl-64"><div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</div></main></div></PermissionProvider>;
}
