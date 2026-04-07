import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateDressUpItems, isAllDressUpDone } from "@/lib/dressup";

type DefectInput = {
  locationX: number;
  locationY: number;
  defectType: string;
  severity: "A" | "B" | "C";
  repairMinutes: number;
  photoUrl?: string;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const { logId, interruptionLogId, defects, notes, completedItems } = await req.json() as {
    logId: string;
    interruptionLogId?: string;
    defects?: DefectInput[];
    notes?: string;
    completedItems?: string[];
  };

  const plan = await prisma.workPlan.findUnique({ where: { id: planId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();

  // 中断ログが残っていれば完了にする
  if (interruptionLogId) {
    await prisma.workLog.update({
      where: { id: interruptionLogId },
      data: { endedAt: now, status: "COMPLETED" },
    });
  }

  // DRESS_UP: チェックリスト状態を notes に保存
  const isDressUp = plan.processType === "DRESS_UP";
  const workLogNotes = isDressUp && completedItems
    ? JSON.stringify({ dressUpItems: completedItems })
    : (notes ?? null);

  const currentLog = await prisma.workLog.findUnique({ where: { id: logId } });
  await prisma.workLog.update({
    where: { id: logId },
    data: { endedAt: now, status: "COMPLETED", notes: workLogNotes },
  });

  // DRESS_UP: 全完了チェック
  if (isDressUp) {
    // 今回分も含めて集計
    const existingLogs = await prisma.workLog.findMany({
      where: { workPlanId: planId, processType: "DRESS_UP", status: "COMPLETED" },
      select: { status: true, processType: true, notes: true },
    });
    const allCompleted = aggregateDressUpItems(existingLogs);
    const allDone = isAllDressUpDone(allCompleted);

    if (!allDone) {
      // 未完了: WorkPlan を未割当にして次の作業者が引き継げるようにする
      await prisma.workPlan.update({
        where: { id: planId },
        data: { assignedWorkerId: null },
      });
    }

    return NextResponse.json({ success: true, allDone });
  }

  // 点検工程のみ InspectionReport を作成
  const isInspection = plan.processType === "L_INSPECTION" || plan.processType === "S_INSPECTION";

  if (!isInspection) {
    return NextResponse.json({ success: true });
  }

  // この作業計画の最初のwork_logの開始時刻を取得
  const firstLog = await prisma.workLog.findFirst({
    where: { workPlanId: planId },
    orderBy: { startedAt: "asc" },
  });

  // 点検報告書を作成
  const inspectionType = plan.processType === "S_INSPECTION" ? "S" : "L";
  const report = await prisma.inspectionReport.create({
    data: {
      vehicleId: plan.vehicleId,
      workerId: session.user.id,
      inspectionType: inspectionType as "L" | "S",
      startedAt: firstLog?.startedAt ?? currentLog?.startedAt ?? now,
      endedAt: now,
    },
  });

  // 不具合を登録
  if (defects && defects.length > 0) {
    await prisma.defect.createMany({
      data: defects.map((d) => ({
        inspectionReportId: report.id,
        vehicleId: plan.vehicleId,
        location: "展開図",
        locationX: d.locationX,
        locationY: d.locationY,
        defectType: d.defectType,
        severity: d.severity,
        repairMinutes: d.repairMinutes,
        photoUrl: d.photoUrl ?? null,
        status: "OPEN",
      })),
    });
  }

  return NextResponse.json({ success: true, reportId: report.id });
}
