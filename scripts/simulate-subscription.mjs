// Explicit local development only. Never accepts a hosted Supabase destination.
import {createClient} from "@supabase/supabase-js";
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||"http://invalid");
if(process.env.NODE_ENV!=="development"||process.env.ALLOW_BILLING_SIMULATION!=="true"||!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new Error("Simulation requires development, explicit opt-in, and a local Supabase database");
const [company,plan,status="active"]=process.argv.slice(2);
if(!/^[a-f0-9-]{36}$/i.test(company||"")||!["free","starter","pro","business"].includes(plan)||!["free","active","trialing","past_due","canceled","incomplete"].includes(status))throw new Error("Usage: simulate-subscription.mjs COMPANY_UUID free|starter|pro|business [status]");
if(!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error("Local service key required");
const s=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),now=new Date(),end=new Date(+now+30*86400000).toISOString();
const {error}=await s.from("company_subscriptions").update({plan,status:plan==="free"?"free":status,legacy_access:false,current_period_start:now.toISOString(),current_period_end:end,trial_started_at:status==="trialing"?now.toISOString():null,trial_ends_at:status==="trialing"?new Date(+now+14*86400000).toISOString():null,grace_ends_at:status==="past_due"?new Date(+now+7*86400000).toISOString():null,stripe_subscription_id:null,stripe_customer_id:null}).eq("company_id",company);
if(error)throw error;
console.log("Local subscription simulation updated. No payment processed.");
