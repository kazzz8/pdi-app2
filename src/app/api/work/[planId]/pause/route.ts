import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const { logId, interruptionReason } = await req.json() as {
    logId: string;
    interruptionReason: string;
  };

  const now = new Date();

  // 現在の作業ログをPAUSED状態で終了
  const plan = await prisma.workPlan.findUnique({ where: { id: planId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.workLog.update({
    where: { id: logId },
    data: { endedAt: now, status: "PAUSED" },
  });

  // 中断作業のログを作成（processType=OTHER）
  const interruptionLog = await prisma.workLog.create({
    data: {
      vehicleId: plan.vehicleId,
      workerId: session.user.id,
      processType: "OTHER",
      startedAt: now,
      status: "ACTIVE",
      notes: interruptionReason,
      isPlanned: false,
    },
  });

  return NextResponse.json({ interruptionLogId: interruptionLog.id });
}
