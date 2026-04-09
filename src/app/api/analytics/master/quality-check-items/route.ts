import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QualityCheckType } from "@/generated/prisma/client";

async function checkAuth() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  if (session.user.role !== "MANAGER" && session.user.role !== "TEAM_LEADER") return null;
  return session;
}

export async function GET() {
  if (!await checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await prisma.dressUpQualityCheckItem.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { label, checkType, description, sortOrder } = await req.json() as {
    label: string;
    checkType: QualityCheckType;
    description?: string;
    sortOrder?: number;
  };

  const item = await prisma.dressUpQualityCheckItem.create({
    data: { label, checkType, description: description ?? null, sortOrder: sortOrder ?? 0 },
  });

  return NextResponse.json({ item });
}

export async function PATCH(req: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, label, checkType, description, sortOrder, isActive } = await req.json() as {
    id: string;
    label?: string;
    checkType?: QualityCheckType;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  };

  const item = await prisma.dressUpQualityCheckItem.update({
    where: { id },
    data: {
      ...(label !== undefined && { label }),
      ...(checkType !== undefined && { checkType }),
      ...(description !== undefined && { description }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json({ item });
}
