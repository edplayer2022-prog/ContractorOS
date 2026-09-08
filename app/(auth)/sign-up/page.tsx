import { AuthForm } from "@/components/auth-form";
import { signUp } from "../actions";
export default async function SignUpPage({searchParams}:{searchParams:Promise<{next?:string}>}) { const{next}=await searchParams;return <AuthForm mode="signup" action={signUp} next={next}/>; }
