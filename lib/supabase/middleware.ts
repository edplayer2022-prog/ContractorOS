import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuth = path.startsWith("/login") || path.startsWith("/sign-up") || path.startsWith("/forgot-password") || path.startsWith("/reset-password") || path.startsWith("/auth/");
  const isPublicDocument = path.startsWith("/estimate/view/") || path.startsWith("/change-order/view/") || path.startsWith("/invoice/view/") || path.startsWith("/api/public/");
  if (!user && !isAuth && !isPublicDocument) return NextResponse.redirect(new URL("/login", request.url));
  if (user && isAuth) return NextResponse.redirect(new URL("/dashboard", request.url));
  return response;
}

