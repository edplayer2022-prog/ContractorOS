"use server";
import { revalidatePath } from "next/cache";
import { getSubscriptionContext } from "@/lib/subscriptions";
export async function updateLocalBilling(action: "trial" | "cancel" | "resume") {
 const { supabase } = await getSubscriptionContext(true);
 const rpc = { trial: "start_pro_trial", cancel: "schedule_free_downgrade", resume: "resume_local_subscription" } as const;
 if (!(action in rpc)) return { error: "Invalid billing action." };
 const { error } = await supabase.rpc(rpc[action]);
 if (error) return { error: error.message };
 revalidatePath("/", "layout"); return { success: true };
}
export async function requestDowngrade(plan: string) {
 const { supabase } = await getSubscriptionContext(true);
 if (!["free","starter","pro"].includes(plan)) return { error: "Invalid downgrade plan." };
 const { data, error } = await supabase.rpc("request_plan_downgrade", { target_plan: plan });
 if (error) return { error: error.message };
 revalidatePath("/settings/billing");
 return { data };
}
