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
  const { interruptionLogId } = await req.json() as { interruptionLogId: string };

  const now = new Date();
  const plan = await prisma.workPlan.findUnique({ where: { id: planId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 中断ログを完了
  if (interruptionLogId) {
    await prisma.workLog.update({
      where: { id: interruptionLogId },
      data: { endedAt: now, status: "COMPLETED" },
    });
  }

  // 作業を再開（新しいwork_logを作成）
  const newLog = await prisma.workLog.create({
    data: {
      workPlanId: planId,
      vehicleId: plan.vehicleId,
      workerId: session.user.id,
      processType: plan.processType,
      startedAt: now,
      status: "ACTIVE",
      isPlanned: true,
    },
  });

  return NextResponse.json({ logId: newLog.id });
}
