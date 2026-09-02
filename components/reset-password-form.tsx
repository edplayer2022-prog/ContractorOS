"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input } from "@/components/ui";
export function ResetPasswordForm() {
  const [loading,setLoading]=useState(false); const router=useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setLoading(true); const data=new FormData(e.currentTarget); const password=String(data.get("password")); const confirm=String(data.get("confirm")); if(password.length<8 || password!==confirm){toast.error(password.length<8?"Use at least 8 characters.":"Passwords do not match.");setLoading(false);return;} const {error}=await createClient().auth.updateUser({password}); if(error) toast.error(error.message); else {toast.success("Password updated.");router.push("/dashboard");router.refresh();} setLoading(false); }
  return <Card className="p-6 sm:p-8"><h1 className="text-2xl font-bold">Choose a new password</h1><p className="mt-1 text-sm text-slate-500">Use at least 8 characters.</p><form onSubmit={submit} className="mt-6 grid gap-4"><Input name="password" label="New password" type="password" minLength={8} required/><Input name="confirm" label="Confirm password" type="password" minLength={8} required/><Button loading={loading}>Update password</Button></form></Card>;
}
