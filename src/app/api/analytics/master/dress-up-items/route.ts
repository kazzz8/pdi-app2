import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if (session.user.role !== "MANAGER" && session.user.role !== "TEAM_LEADER") return null;
  return session;
}

export async function GET() {
  if (!await checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await prisma.dressUpItem.findMany({
    orderBy: { name: "asc" },
    include: {
      qualityCheckLinks: {
        include: { qualityCheckItem: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, code } = await req.json() as { name: string; code: string };
  const item = await prisma.dressUpItem.create({ data: { name, code } });
  return NextResponse.json({ item });
}

export async function PATCH(req: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, name, code } = await req.json() as { id: string; name?: string; code?: string };
  const item = await prisma.dressUpItem.update({
    where: { id },
    data: { ...(name !== undefined && { name }), ...(code !== undefined && { code }) },
  });
  return NextResponse.json({ item });
}
