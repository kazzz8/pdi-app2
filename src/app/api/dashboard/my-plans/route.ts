import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateDressUpItems, isAllDressUpDone } from "@/lib/dressup";

const PROCESS_LABELS: Record<string, string> = {
  LOADING: "積み込み・降ろし", STORAGE: "保管", RETRIEVAL: "回送",
  WASH: "洗車", POLISH: "磨き", L_INSPECTION: "L点検", S_INSPECTION: "S点検",
  REPAIR: "補修", RUST_PREVENTION: "防錆", PARTS_ISSUE: "部品払い出し",
  DRESS_UP: "ドレスアップ", COATING: "コーティング",
  FINAL_INSPECTION: "完成検査", OTHER: "その他（中断）",
};

const TOLERANCE_MIN = 15;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const now = new Date();

  // 今日の DailySchedule（終業時刻取得）
  const schedule = await prisma.dailySchedule.findFirst({
    where: { date: { gte: startOfDay, lt: endOfDay } },
  });
  const endHour   = schedule?.endHour   ?? 17;
  const endMinute = schedule?.endMinute ?? 0;

  const queries: [
    ReturnType<typeof prisma.workPlan.findMany>,
    ReturnType<typeof prisma.workLog.findMany>,
    ReturnType<typeof prisma.workLog.findMany>,
    ReturnType<typeof prisma.workPlan.findMany> | Promise<never[]>,
  ] = [
    // 今日の作業計画（自分に割り当て済み、WorkLog全件含む）
    prisma.workPlan.findMany({
      where: {
        assignedWorkerId: session.user.id,
        plannedStart: { gte: startOfDay, lt: endOfDay },
      },
      include: {
        vehicle: { select: { barcode: true, modelName: true, exteriorColor: true } },
        workLogs: {
          where: { workerId: session.user.id },
          orderBy: { startedAt: "asc" },
        },
      },
      orderBy: { plannedStart: "asc" },
    }),

    // 今日の中断・計画外ログ（processType=OTHER）
    prisma.workLog.findMany({
      where: {
        workerId:    session.user.id,
        processType: "OTHER",
        startedAt:   { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { startedAt: "asc" },
    }),

    // 現在 ACTIVE な中断ログ（ダッシュボードの中断バナー用）
    prisma.workLog.findMany({
      where: {
        workerId:    session.user.id,
        status:      "ACTIVE",
        processType: "OTHER",
        startedAt:   { gte: startOfDay },
      },
      orderBy: { startedAt: "desc" },
      take: 1,
    }),

    // 未割当の DRESS_UP 部分完了プラン（同チームの引き継ぎ用）
    session.user.teamId
      ? prisma.workPlan.findMany({
          where: {
            assignedWorkerId: null,
            processType: "DRESS_UP",
            plannedStart: { gte: startOfDay, lt: endOfDay },
            teamId: session.user.teamId,
          },
          include: {
            vehicle: { select: { barcode: true, modelName: true, exteriorColor: true } },
            workLogs: {
              where: { processType: "DRESS_UP", status: "COMPLETED" },
              select: { id: true, status: true, processType: true, notes: true, startedAt: true, endedAt: true },
            },
          },
          orderBy: { plannedStart: "asc" },
        })
      : Promise.resolve([]),
  ];

  const [plans, interruptionLogs, pausedLogs, partialDressUpPlans] = await Promise.all(queries);

  const activeInterruptionLog = pausedLogs[0] ?? null;

  type DelayStatus = "on_time" | "delay" | "completed" | "paused" | "active" | "partial";

  const result = (plans as Awaited<typeof queries[0]>).map((plan) => {
    const logs       = plan.workLogs;
    const firstLog   = logs[0];
    const lastCompleted = [...logs].reverse().find((l) => l.status === "COMPLETED");
    const isPaused   = logs.some((l) => l.status === "PAUSED") &&
                       !logs.some((l) => l.status === "COMPLETED");
    const isCompleted = logs.some((l) => l.status === "COMPLETED");
    const isActive   = logs.some((l) => l.status === "ACTIVE");

    let delayStatus: DelayStatus = "on_time";
    if (isCompleted) delayStatus = "completed";
    else if (isPaused) delayStatus = "paused";
    else if (isActive) delayStatus = "active";
    else if (now > plan.plannedEnd) delayStatus = "delay";

    const pausedLogId = isPaused
      ? logs.find((l) => l.status === "PAUSED")?.id ?? null
      : null;

    const actualStart = firstLog?.startedAt?.toISOString() ?? null;
    const actualEnd   = lastCompleted?.endedAt?.toISOString() ?? null;
    const startDelay  = actualStart
      ? Math.round((new Date(actualStart).getTime() - new Date(plan.plannedStart).getTime()) / 60000)
      : null;
    const isOnTime = startDelay !== null && startDelay <= TOLERANCE_MIN;

    return {
      id:           plan.id,
      processType:  plan.processType,
      processLabel: PROCESS_LABELS[plan.processType] ?? plan.processType,
      plannedStart: plan.plannedStart.toISOString(),
      plannedEnd:   plan.plannedEnd.toISOString(),
      vehicle:      plan.vehicle,
      delayStatus,
      pausedLogId,
      actualStart,
      actualEnd,
      isOnTime,
      startDelay,
      workLogs: logs.map((l) => ({
        id:        l.id,
        status:    l.status,
        startedAt: l.startedAt.toISOString(),
        endedAt:   l.endedAt?.toISOString() ?? null,
        notes:     l.notes ?? null,
      })),
    };
  });

  // 引き継ぎ可能な DRESS_UP 部分完了プランを追加
  const partialResults = (partialDressUpPlans as Awaited<typeof queries[3]>)
    .map((plan) => {
      const logsForAgg = plan.workLogs as { status: string; processType: string; notes: string | null }[];
      const completedItems = aggregateDressUpItems(logsForAgg);
      if (isAllDressUpDone(completedItems)) return null; // 全完了済みは除外

      return {
        id:           plan.id,
        processType:  plan.processType,
        processLabel: PROCESS_LABELS[plan.processType] ?? plan.processType,
        plannedStart: plan.plannedStart.toISOString(),
        plannedEnd:   plan.plannedEnd.toISOString(),
        vehicle:      plan.vehicle,
        delayStatus:  "partial" as DelayStatus,
        pausedLogId:  null,
        actualStart:  null,
        actualEnd:    null,
        isOnTime:     false,
        startDelay:   null,
        workLogs:     [],
        completedItems,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    plans: [...result, ...partialResults],
    interruptionLogs: interruptionLogs.map((l) => ({
      id:        l.id,
      startedAt: l.startedAt.toISOString(),
      endedAt:   l.endedAt?.toISOString() ?? null,
      notes:     l.notes ?? null,
      status:    l.status,
    })),
    activeInterruptionLogId: activeInterruptionLog?.id ?? null,
    workDayStart: { hour: 8, minute: 15 },
    workDayEnd:   { hour: endHour, minute: endMinute },
  });
}
