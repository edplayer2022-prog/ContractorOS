import { AuthForm } from "@/components/auth-form";
import { forgotPassword } from "../actions";
export default function ForgotPasswordPage() { return <AuthForm mode="forgot" action={forgotPassword}/>; }
