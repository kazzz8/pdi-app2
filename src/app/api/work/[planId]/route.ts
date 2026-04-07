import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateDressUpItems } from "@/lib/dressup";

const PROCESS_LABELS: Record<string, string> = {
  LOADING: "積み込み・降ろし", STORAGE: "保管", RETRIEVAL: "回送",
  WASH: "洗車", POLISH: "磨き", L_INSPECTION: "L点検", S_INSPECTION: "S点検",
  REPAIR: "補修", RUST_PREVENTION: "防錆", PARTS_ISSUE: "部品払い出し",
  DRESS_UP: "ドレスアップ", COATING: "コーティング",
  FINAL_INSPECTION: "完成検査", OTHER: "その他",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const plan = await prisma.workPlan.findUnique({
    where: { id: planId },
    include: {
      vehicle: {
        select: {
          id: true, barcode: true, modelName: true,
          exteriorColor: true, inspectionType: true,
        },
      },
      workLogs: {
        where: { processType: "DRESS_UP", status: "COMPLETED" },
        select: { status: true, processType: true, notes: true },
      },
    },
  });

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const completedItems =
    plan.processType === "DRESS_UP"
      ? aggregateDressUpItems(plan.workLogs)
      : undefined;

  return NextResponse.json({
    plan: {
      id: plan.id,
      processType: plan.processType,
      processLabel: PROCESS_LABELS[plan.processType] ?? plan.processType,
      plannedStart: plan.plannedStart.toISOString(),
      plannedEnd: plan.plannedEnd.toISOString(),
      vehicle: plan.vehicle,
      ...(completedItems !== undefined ? { completedItems } : {}),
    },
  });
}
