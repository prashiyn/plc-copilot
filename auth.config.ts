import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js config (no DB/bcrypt imports) — shared by middleware and
 * the Node route handler. The Credentials provider is added in auth.ts.
 */

// Feature areas that require authentication (the app/(features) route group).
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/ai-copilot',
  '/ai-application-generator',
  '/ai-code-optimizer',
  '/ai-library-manager',
  '/engineer-chat',
  '/plc-selector',
  '/hmi-generator',
  '/projects',
  '/solutions',
  '/billing',
  '/subscription',
  '/settings',
  '/support',
  '/resources',
  '/sap',
];

export const authConfig = {
  trustHost: true,
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  providers: [], // Credentials provider is injected in auth.ts (Node runtime).
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = PROTECTED_PREFIXES.some(
        (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(`${p}/`),
      );
      if (isProtected && !isLoggedIn) return false; // redirect to signIn page
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = (token.role as string | null | undefined) ?? null;
        session.user.organizationId =
          (token.organizationId as string | null | undefined) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
