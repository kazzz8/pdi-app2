import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const plan = await prisma.workPlan.findUnique({ where: { id: planId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const log = await prisma.workLog.create({
    data: {
      workPlanId: planId,
      vehicleId: plan.vehicleId,
      workerId: session.user.id,
      processType: plan.processType,
      startedAt: new Date(),
      status: "ACTIVE",
      isPlanned: true,
    },
  });

  // 未割当の部分完了プラン（DRESS_UP引き継ぎ）を自分に割り当てる
  if (plan.assignedWorkerId === null) {
    await prisma.workPlan.update({
      where: { id: planId },
      data: { assignedWorkerId: session.user.id },
    });
  }

  return NextResponse.json({ logId: log.id });
}
