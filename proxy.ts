import { NextResponse, type NextRequest } from 'next/server';

// Passes the current path to server components (used by the language switch to return to the same page).
export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set('x-pathname', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ['/((?!_next|api|icon|manifest|sw.js|offline.html).*)'] };
