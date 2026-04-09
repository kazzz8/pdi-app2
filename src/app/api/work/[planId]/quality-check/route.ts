import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;

  // WorkPlan の完了済み WorkLog から取付済み部品名を取得
  const workLogs = await prisma.workLog.findMany({
    where: { workPlanId: planId, processType: "DRESS_UP", status: "COMPLETED" },
    select: { notes: true },
  });

  const completedItemNames = new Set<string>();
  for (const log of workLogs) {
    if (!log.notes) continue;
    try {
      const parsed = JSON.parse(log.notes) as { dressUpItems?: string[] };
      (parsed.dressUpItems ?? []).forEach(name => completedItemNames.add(name));
    } catch { /* ignore */ }
  }

  if (completedItemNames.size === 0) {
    return NextResponse.json({ sessionId: null, checkItems: [] });
  }

  // DressUpItem の name で照合して ID を取得
  const dressUpItems = await prisma.dressUpItem.findMany({
    where: { name: { in: Array.from(completedItemNames) } },
    select: { id: true, name: true },
  });

  if (dressUpItems.length === 0) {
    return NextResponse.json({ sessionId: null, checkItems: [] });
  }

  // チェック項目を集約・重複排除
  const links = await prisma.dressUpQualityCheckLink.findMany({
    where: { dressUpItemId: { in: dressUpItems.map(d => d.id) } },
    include: { qualityCheckItem: true },
    orderBy: { sortOrder: "asc" },
  });

  // Map で重複排除（同じ checkItemId は最初の1件のみ）
  const checkItemMap = new Map<string, typeof links[0]["qualityCheckItem"]>();
  for (const link of links) {
    if (!checkItemMap.has(link.qualityCheckItemId) && link.qualityCheckItem.isActive) {
      checkItemMap.set(link.qualityCheckItemId, link.qualityCheckItem);
    }
  }

  const checkItems = Array.from(checkItemMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

  if (checkItems.length === 0) {
    return NextResponse.json({ sessionId: null, checkItems: [] });
  }

  // 既存セッションを取得 or 新規作成
  let session_ = await prisma.dressUpQualityCheckSession.findFirst({
    where: { workPlanId: planId, workerId: session.user.id, completedAt: null },
    include: { results: true },
  });

  if (!session_) {
    session_ = await prisma.dressUpQualityCheckSession.create({
      data: { workPlanId: planId, workerId: session.user.id },
      include: { results: true },
    });
  }

  // 既存の回答をマージ
  const existingResults: Record<string, { passed?: boolean | null; photoUrl?: string | null; textValue?: string | null }> = {};
  for (const result of session_.results) {
    existingResults[result.checkItemId] = {
      passed: result.passed,
      photoUrl: result.photoUrl,
      textValue: result.textValue,
    };
  }

  return NextResponse.json({
    sessionId: session_.id,
    checkItems: checkItems.map(item => ({
      id: item.id,
      label: item.label,
      checkType: item.checkType,
      description: item.description,
      sortOrder: item.sortOrder,
    })),
    existingResults,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const { sessionId, results } = await req.json() as {
    sessionId: string;
    results: { checkItemId: string; passed?: boolean; photoUrl?: string; textValue?: string }[];
  };

  // 各回答を upsert
  for (const result of results) {
    await prisma.dressUpQualityCheckResult.upsert({
      where: { id: `${sessionId}-${result.checkItemId}` },
      create: {
        id: `${sessionId}-${result.checkItemId}`,
        sessionId,
        checkItemId: result.checkItemId,
        passed: result.passed ?? null,
        photoUrl: result.photoUrl ?? null,
        textValue: result.textValue ?? null,
      },
      update: {
        passed: result.passed ?? null,
        photoUrl: result.photoUrl ?? null,
        textValue: result.textValue ?? null,
      },
    });
  }

  // セッション完了
  await prisma.dressUpQualityCheckSession.update({
    where: { id: sessionId },
    data: { completedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  // 写真URLの保存（個別項目の途中保存）
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await params;
  const { sessionId, checkItemId, photoUrl } = await req.json() as {
    sessionId: string;
    checkItemId: string;
    photoUrl: string;
  };

  await prisma.dressUpQualityCheckResult.upsert({
    where: { id: `${sessionId}-${checkItemId}` },
    create: { id: `${sessionId}-${checkItemId}`, sessionId, checkItemId, photoUrl },
    update: { photoUrl },
  });

  return NextResponse.json({ success: true });
}
