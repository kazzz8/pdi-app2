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

export async function POST(req: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { dressUpItemId, qualityCheckItemId, sortOrder } = await req.json() as {
    dressUpItemId: string;
    qualityCheckItemId: string;
    sortOrder?: number;
  };

  const link = await prisma.dressUpQualityCheckLink.create({
    data: { dressUpItemId, qualityCheckItemId, sortOrder: sortOrder ?? 0 },
  });

  return NextResponse.json({ link });
}

export async function DELETE(req: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { dressUpItemId, qualityCheckItemId } = await req.json() as {
    dressUpItemId: string;
    qualityCheckItemId: string;
  };

  await prisma.dressUpQualityCheckLink.delete({
    where: { dressUpItemId_qualityCheckItemId: { dressUpItemId, qualityCheckItemId } },
  });

  return NextResponse.json({ success: true });
}
