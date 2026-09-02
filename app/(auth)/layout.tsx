import { HardHat } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-950 px-4 py-10 sm:py-16"><div className="mx-auto w-full max-w-md"><div className="mb-8 flex items-center justify-center gap-3 text-white"><span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500"><HardHat className="h-6 w-6"/></span><span className="text-2xl font-bold tracking-tight">ContractorOS</span></div>{children}<p className="mt-8 text-center text-xs text-slate-500">Professional estimates. Built for contractors.</p></div></main>;
}
