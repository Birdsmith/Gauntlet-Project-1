import { PrismaAdapter } from '@auth/prisma-adapter';
import { NextAuthOptions, Session, DefaultSession } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import { AdapterUser } from '@auth/core/adapters';
import GoogleProvider from 'next-auth/providers/google';
import { db } from './db';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    } & DefaultSession["user"]
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ token, session }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name || null;
        session.user.email = token.email || null;
        session.user.image = token.picture as string || null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
