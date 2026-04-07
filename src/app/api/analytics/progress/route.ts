import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PROCESS_LABELS: Record<string, string> = {
  WASH: "洗車", POLISH: "磨き", L_INSPECTION: "点検",
  REPAIR: "補修", RUST_PREVENTION: "防錆",
  DRESS_UP: "ドレスアップ", COATING: "コーティング",
  FINAL_INSPECTION: "完成検査",
};

// フロー上の工程順
const FLOW_PROCESSES = [
  "WASH", "POLISH", "L_INSPECTION",
  "REPAIR", "RUST_PREVENTION",
  "DRESS_UP", "COATING", "FINAL_INSPECTION",
] as const;

/**
 * オーダー率（分母 totalVehicles に対する各工程の処理割合）
 * 将来 案P（DB件数）に切り替える際はここを変更する
 */
const ORDER_RATES: Record<string, number> = {
  WASH:             1.00,
  POLISH:           0.95,
  L_INSPECTION:     0.90,
  REPAIR:           0.30,
  RUST_PREVENTION:  0.10,
  DRESS_UP:         0.80,
  COATING:          0.40,
  FINAL_INSPECTION: 1.00,
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
  const endOfToday   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  // ─── 今日の DailySchedule を取得 ─────────────────────────
  const todaySchedule = await prisma.dailySchedule.findFirst({
    where: {
      date: { gte: startOfToday, lt: endOfToday },
    },
  });

  const endHour     = todaySchedule?.endHour     ?? 17;
  const endMinute   = todaySchedule?.endMinute   ?? 0;
  const totalVehicles = todaySchedule?.totalVehicles ?? 300;

  // ─── 当日完成進捗（FINAL_INSPECTION ベース） ─────────────
  //
  //   【案Q・現行】totalPlanned = totalVehicles × ORDER_RATES["FINAL_INSPECTION"]
  //   【案P・将来】totalPlanned = prisma.workPlan.count({ where: FINAL_INSPECTION + today })
  //
  const totalPlanned = Math.round(totalVehicles * (ORDER_RATES["FINAL_INSPECTION"] ?? 1));

  const [expectedByNow, actualCompleted] = await Promise.all([
    prisma.workPlan.count({
      where: {
        processType: "FINAL_INSPECTION",
        plannedStart: { gte: startOfToday, lt: endOfToday },
        plannedEnd:   { lte: now },
      },
    }),
    prisma.workLog.count({
      where: {
        processType: "FINAL_INSPECTION",
        status:  "COMPLETED",
        endedAt: { gte: startOfToday, lt: endOfToday },
      },
    }),
  ]);

  // ─── 工程別 先行/遅延 ────────────────────────────────────
  const processDeviations = await Promise.all(
    FLOW_PROCESSES.map(async (processType) => {
      // 点検は L/S を合算
      const isInspection = processType === "L_INSPECTION";
      const ptIn = ["L_INSPECTION", "S_INSPECTION"] as ("L_INSPECTION" | "S_INSPECTION")[];

      const [expectedByNowP, actualCompletedP] = await Promise.all([
        prisma.workPlan.count({
          where: {
            processType: isInspection ? { in: ptIn } : (processType as "WASH"),
            plannedStart: { gte: startOfToday, lt: endOfToday },
            plannedEnd:   { lte: now },
          },
        }),
        prisma.workLog.count({
          where: {
            processType: isInspection ? { in: ptIn } : (processType as "WASH"),
            status:  "COMPLETED",
            endedAt: { gte: startOfToday, lt: endOfToday },
          },
        }),
      ]);

      // 【案Q・現行】計画台数 = totalVehicles × オーダー率
      // 【案P・将来】計画台数 = prisma.workPlan.count({ where: processType + today })
      const plannedCount = Math.round(totalVehicles * (ORDER_RATES[processType] ?? 1));

      return {
        processType,
        label:           PROCESS_LABELS[processType] ?? processType,
        plannedCount,           // 1日の計画台数（表示用）
        expectedByNow:   expectedByNowP,
        actualCompleted: actualCompletedP,
        deviation:       actualCompletedP - expectedByNowP,
        hasPlans:        plannedCount > 0,
      };
    })
  );

  return NextResponse.json({
    endTime: { hour: endHour, minute: endMinute },
    totalVehicles,
    completion: {
      totalPlanned,
      expectedByNow,
      actualCompleted,
      deviation: actualCompleted - expectedByNow,
    },
    processDeviations,
    generatedAt: now.toISOString(),
  });
  } catch (e) {
    console.error("[progress API]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
