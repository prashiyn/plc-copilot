import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Edge middleware uses the DB-free config; the `authorized` callback decides
// which routes require a session and redirects unauthenticated users to /login.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except API routes, Next internals, and static files.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
