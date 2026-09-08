"use client";
import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import type { AuthState } from "@/app/(auth)/actions";

export function AuthForm({ mode, action,next }: { mode: "login" | "signup" | "forgot"; action: (state: AuthState, data: FormData) => Promise<AuthState>;next?:string }) {
  const [state, formAction, pending] = useActionState(action, null);
  const content = {
    login: { title: "Welcome back", subtitle: "Sign in to manage your estimates.", button: "Sign in" },
    signup: { title: "Create your account", subtitle: "Start building professional estimates today.", button: "Create account" },
    forgot: { title: "Reset your password", subtitle: "We’ll email you a secure reset link.", button: "Send reset link" },
  }[mode];
  const suffix=next?`?next=${encodeURIComponent(next)}`:"";return <Card className="p-6 sm:p-8"><h1 className="text-2xl font-bold text-slate-900">{content.title}</h1><p className="mt-1 text-sm text-slate-500">{content.subtitle}</p><form action={formAction} className="mt-7 grid gap-4">{next&&<input type="hidden" name="next" value={next}/>} {mode === "signup" && <Input name="fullName" label="Full name" placeholder="John Smith" autoComplete="name" required/>}<Input name="email" label="Email" type="email" placeholder="you@company.com" autoComplete="email" required/>{mode !== "forgot" && <Input name="password" label="Password" type="password" placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required/>}{state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}{state?.success && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{state.success}</p>}<Button type="submit" loading={pending} className="mt-1 w-full">{content.button}<ArrowRight className="h-4 w-4"/></Button></form><div className="mt-6 text-center text-sm text-slate-500">{mode === "login" && <><Link className="font-semibold text-orange-600 hover:text-orange-700" href="/forgot-password">Forgot password?</Link><p className="mt-4">New to ContractorOS? <Link className="font-semibold text-orange-600" href={`/sign-up${suffix}`}>Create account</Link></p></>}{mode === "signup" && <>Already have an account? <Link className="font-semibold text-orange-600" href={`/login${suffix}`}>Sign in</Link></>}{mode === "forgot" && <Link className="font-semibold text-orange-600" href="/login">Back to sign in</Link>}</div></Card>;
}
