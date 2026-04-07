import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PROCESS_LABELS: Record<string, string> = {
  LOADING: "積み降ろし", STORAGE: "保管", RETRIEVAL: "回送",
  WASH: "洗車", POLISH: "磨き", L_INSPECTION: "L点検", S_INSPECTION: "S点検",
  REPAIR: "補修", RUST_PREVENTION: "防錆", PARTS_ISSUE: "部品払出",
  DRESS_UP: "ドレスアップ", COATING: "コーティング",
  FINAL_INSPECTION: "完成検査", OTHER: "その他",
};

const VEHICLE_STATUS_LABELS: Record<string, string> = {
  ARRIVED: "入庫",
  IN_STORAGE: "保管中",
  IN_PROCESS: "作業中",
  COMPLETED: "完検完了",
  DISPATCHED: "出庫済",
};

export async function GET() {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role } = session.user;
  if (role !== "MANAGER" && role !== "TEAM_LEADER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  // KPI: 在庫台数（出庫済以外）
  const inStock = await prisma.vehicle.count({
    where: { status: { not: "DISPATCHED" } },
  });

  // KPI: 本日完了作業数
  const processedToday = await prisma.workLog.count({
    where: {
      status: "COMPLETED",
      endedAt: { gte: startOfToday },
    },
  });

  // KPI: 遅延中（計画終了時刻を過ぎたのに完了ログがない計画）
  const todayPlans = await prisma.workPlan.findMany({
    where: { plannedStart: { gte: startOfToday, lt: endOfToday } },
    include: {
      workLogs: { where: { status: "COMPLETED" } },
    },
  });
  const delayed = todayPlans.filter(
    (p) => p.plannedEnd < now && p.workLogs.length === 0
  ).length;

  // KPI: 未補修不具合
  const openDefects = await prisma.defect.count({
    where: { status: "OPEN" },
  });

  // 車両ステータス分布
  const statusGroups = await prisma.vehicle.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const STATUS_ORDER = ["ARRIVED", "IN_STORAGE", "IN_PROCESS", "COMPLETED", "DISPATCHED"];
  const vehicleStatusCounts = STATUS_ORDER.map((status) => {
    const found = statusGroups.find((g) => g.status === status);
    return {
      status,
      label: VEHICLE_STATUS_LABELS[status] ?? status,
      count: found?._count._all ?? 0,
    };
  }).filter((s) => s.count > 0);

  // 今日の工程別 計画 / 完了数
  const plansByProcess: Record<string, { planned: number; completed: number }> = {};
  for (const plan of todayPlans) {
    if (!plansByProcess[plan.processType]) {
      plansByProcess[plan.processType] = { planned: 0, completed: 0 };
    }
    plansByProcess[plan.processType].planned++;
    if (plan.workLogs.length > 0) {
      plansByProcess[plan.processType].completed++;
    }
  }
  const processActivity = Object.entries(plansByProcess)
    .map(([processType, data]) => ({
      processType,
      label: PROCESS_LABELS[processType] ?? processType,
      ...data,
    }))
    .sort((a, b) => b.planned - a.planned);

  // 不具合 重症度別（OPENのみ）
  const defectGroups = await prisma.defect.groupBy({
    by: ["severity"],
    _count: { _all: true },
    where: { status: "OPEN" },
  });
  const defectsBySeverity = ["A", "B", "C"].map((severity) => {
    const found = defectGroups.find((g) => g.severity === severity);
    return {
      severity,
      label: `重症度 ${severity}`,
      count: found?._count._all ?? 0,
    };
  });

  return NextResponse.json({
    kpi: { inStock, processedToday, delayed, openDefects },
    vehicleStatusCounts,
    processActivity,
    defectsBySeverity,
    generatedAt: now.toISOString(),
  });
  } catch (e) {
    console.error("[overview API]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
