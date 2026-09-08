import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { Button, Card } from "@/components/ui";
export default function InactiveMembership() {
 return <main className="grid min-h-screen place-items-center p-4"><Card className="max-w-lg p-8"><h1 className="text-2xl font-bold">Company access is inactive</h1><p className="mt-3 text-slate-600">Ask a company Owner to reactivate your membership. Your work and history are preserved.</p><Link href="/dashboard" className="mt-5 block text-orange-700">Check access again</Link><form action={logout} className="mt-4"><Button>Log out</Button></form></Card></main>;
}
