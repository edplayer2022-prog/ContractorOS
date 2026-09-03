import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Button({ className, variant = "primary", size = "md", loading, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; loading?: boolean }) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:pointer-events-none disabled:opacity-50", size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4 text-sm", variant === "primary" && "bg-orange-500 text-white shadow-sm hover:bg-orange-600", variant === "secondary" && "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50", variant === "ghost" && "text-slate-600 hover:bg-slate-100", variant === "danger" && "bg-red-50 text-red-700 hover:bg-red-100", className)} disabled={loading || props.disabled} {...props}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>;
}

export function Input({ label, error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label && <span>{label}</span>}<input className={cn("h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100", error && "border-red-400", className)} {...props}/>{error && <span className="text-xs font-normal text-red-600">{error}</span>}</label>;
}

export function Textarea({ label, error, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label && <span>{label}</span>}<textarea className={cn("min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100", error && "border-red-400", className)} {...props}/>{error && <span className="text-xs font-normal text-red-600">{error}</span>}</label>;
}

export function Select({ label, children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label && <span>{label}</span>}<select className={cn("h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100", className)} {...props}>{children}</select></label>;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)} {...props}/>;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>{action}</div>;
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "orange" | "blue" | "green" | "red" }) {
  const styles = { slate: "bg-slate-100 text-slate-700", orange: "bg-orange-50 text-orange-700", blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700" };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize", styles[tone])}>{children}</span>;
}

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-col items-center px-6 py-14 text-center"><div className="mb-4 rounded-xl bg-slate-100 p-3 text-slate-500">{icon}</div><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
