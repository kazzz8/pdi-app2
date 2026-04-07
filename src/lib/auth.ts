import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        employeeId: { label: "社員番号", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.employeeId || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { employeeId: credentials.employeeId },
          include: { team: true },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          employeeId: user.employeeId,
          name: user.name,
          role: user.role,
          teamId: user.teamId,
          teamName: user.team?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.employeeId = (user as any).employeeId;
        token.role = (user as any).role;
        token.teamId = (user as any).teamId;
        token.teamName = (user as any).teamName;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.employeeId = token.employeeId as string;
      session.user.role = token.role as string;
      session.user.teamId = token.teamId as string | null;
      session.user.teamName = token.teamName as string | null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
};
