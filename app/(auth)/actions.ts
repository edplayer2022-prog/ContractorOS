"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; success?: string } | null;

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: String(formData.get("email")), password: String(formData.get("password")) });
  if (error) return { error: "Email or password is incorrect." };
  redirect("/dashboard");
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const fullName = String(formData.get("fullName"));
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback` } });
  if (error) return { error: error.message };
  if (data.session) redirect("/setup");
  return { success: "Check your inbox to confirm your email, then log in." };
}

export async function forgotPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(String(formData.get("email")), { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback?next=/reset-password` });
  if (error) return { error: error.message };
  return { success: "If an account exists, a reset link is on its way." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
