import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// この作業計画のこれまでの累積作業時間（秒）を返す
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;

  const logs = await prisma.workLog.findMany({
    where: {
      workPlanId: planId,
      status: { in: ["PAUSED", "COMPLETED"] },
      endedAt: { not: null },
    },
  });

  const accumulatedSeconds = logs.reduce((sum, log) => {
    if (!log.endedAt) return sum;
    return sum + Math.floor((log.endedAt.getTime() - log.startedAt.getTime()) / 1000);
  }, 0);

  return NextResponse.json({ accumulatedSeconds });
}
