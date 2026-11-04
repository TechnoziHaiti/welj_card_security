import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Si Supabase n'est pas encore configuré (mode développement initial)
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const isAccessingAdmin = request.nextUrl.pathname.startsWith('/admin');
  const isAccessingUsers = request.nextUrl.pathname.startsWith('/admin/users');
  const isAccessingNewMember = request.nextUrl.pathname.startsWith('/admin/members/new');
  const isAccessingLogin = request.nextUrl.pathname === '/login';

  // Redirection automatique de courtoisie /signin -> /login
  if (request.nextUrl.pathname === '/signin') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Protection des routes d'administration
  if (isAccessingAdmin) {
    if (!user) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    const role = user.app_metadata?.role || user.user_metadata?.role || 'agent';

    // Sécurité stricte RBAC :
    // 1. Les comptes agents n'ont AUCUN accès à la gestion des utilisateurs (/admin/users)
    if (role === 'agent' && isAccessingUsers) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    // 2. Les comptes agents n'ont AUCUN accès au formulaire de création de membre (/admin/members/new)
    if (role === 'agent' && isAccessingNewMember) {
      return NextResponse.redirect(new URL('/admin/members', request.url));
    }
  }

  // Redirection si déjà connecté et tente d'aller sur /login
  if (isAccessingLogin && user) {
    const role = user.app_metadata?.role || user.user_metadata?.role || 'agent';
    if (role === 'agent') {
      return NextResponse.redirect(new URL('/verify', request.url));
    }
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/login',
    '/signin',
  ],
};
