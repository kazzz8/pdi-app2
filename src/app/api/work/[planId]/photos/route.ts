import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;

  const photos = await prisma.workPhoto.findMany({
    where: { workPlanId: planId },
    orderBy: { takenAt: "asc" },
    select: { id: true, url: true, caption: true, checklistItem: true, takenAt: true },
  });

  return NextResponse.json({ photos });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const checklistItem = formData.get("checklistItem") as string | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const filename = `work-photos/${planId}/${Date.now()}-${file.name}`;
  const blob = await put(filename, file, { access: "public" });

  const photo = await prisma.workPhoto.create({
    data: {
      workPlanId: planId,
      workerId: session.user.id,
      url: blob.url,
      checklistItem: checklistItem ?? null,
    },
    select: { id: true, url: true, caption: true, checklistItem: true, takenAt: true },
  });

  return NextResponse.json({ photo });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const { photoId, caption } = await req.json() as { photoId: string; caption: string };

  const photo = await prisma.workPhoto.update({
    where: { id: photoId, workPlanId: planId },
    data: { caption },
    select: { id: true, url: true, caption: true, checklistItem: true, takenAt: true },
  });

  return NextResponse.json({ photo });
}
