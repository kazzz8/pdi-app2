"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── 計画通りの許容誤差（分）。この値を小さくするほど厳しくなる ─────────
const TOLERANCE_MIN = 15;

// ─── 型 ──────────────────────────────────────────────────────────────────

type WorkLogItem = {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
};

type WorkPlanItem = {
  id: string;
  processType: string;
  processLabel: string;
  plannedStart: string;
  plannedEnd: string;
  vehicle: { barcode: string; modelName: string | null; exteriorColor: string | null };
  delayStatus: "on_time" | "delay" | "completed" | "paused" | "active" | "partial";
  pausedLogId: string | null;
  actualStart: string | null;
  actualEnd:   string | null;
  workLogs:    WorkLogItem[];
  completedItems?: string[];
};

type InterruptionLog = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  status: string;
};

type DashboardData = {
  plans: WorkPlanItem[];
  interruptionLogs: InterruptionLog[];
  activeInterruptionLogId: string | null;
  workDayStart: { hour: number; minute: number };
  workDayEnd:   { hour: number; minute: number };
};

// ─── ユーティリティ ────────────────────────────────────────────────────────

function toMin(h: number, m: number) { return h * 60 + m; }

function timeStr(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

function diffMin(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

/** 時刻 ISO → 作業日内の位置（%）*/
function posPercent(iso: string, dayStartMin: number, dayDurationMin: number): number {
  const d = new Date(iso);
  const m = toMin(d.getHours(), d.getMinutes());
  return Math.max(0, Math.min(100, ((m - dayStartMin) / dayDurationMin) * 100));
}

function widthPercent(startIso: string, endIso: string, dayDurationMin: number): number {
  const min = diffMin(startIso, endIso);
  return Math.max(1, (min / dayDurationMin) * 100);
}

// ─── 小コンポーネント ───────────────────────────────────────────────────────

/** サマリーバー */
function SummaryBar({ plans }: { plans: WorkPlanItem[] }) {
  const total     = plans.length;
  const completed = plans.filter(p => p.delayStatus === "completed").length;
  const delayed   = plans.filter(p => p.delayStatus === "delay").length;
  const active    = plans.filter(p => p.delayStatus === "active").length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl px-4 py-3 shadow-sm mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-3 text-xs">
          <span className="text-green-600 font-semibold">完了 {completed}件</span>
          {active > 0 && <span className="text-blue-600 font-semibold">作業中 {active}件</span>}
          {delayed > 0 && <span className="text-red-500 font-semibold">遅延 {delayed}件</span>}
          <span className="text-gray-400">計 {total}件</span>
        </div>
        <span className="text-sm font-bold text-gray-700">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** タイムラインバー1本 */
function TimeBar({
  startIso, endIso, nowIso,
  dayStartMin, dayDurationMin, color,
}: {
  startIso: string; endIso: string | null; nowIso: string;
  dayStartMin: number; dayDurationMin: number; color: string;
}) {
  const left  = posPercent(startIso, dayStartMin, dayDurationMin);
  const end   = endIso ?? nowIso;
  const width = widthPercent(startIso, end, dayDurationMin);
  return (
    <div className="relative w-full bg-gray-100 rounded-full h-3 overflow-hidden">
      <div
        className={`absolute h-full rounded-full ${color}`}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </div>
  );
}

/** 作業計画カード */
function PlanCard({
  plan, dayStartMin, dayDurationMin, nowIso,
  onStart, onResume,
}: {
  plan: WorkPlanItem;
  dayStartMin: number;
  dayDurationMin: number;
  nowIso: string;
  onStart: () => void;
  onResume: () => void;
}) {
  const { plannedStart, plannedEnd, actualStart, actualEnd, delayStatus, workLogs } = plan;

  // 開始遅延（分）
  const startDelay = actualStart ? diffMin(plannedStart, actualStart) : null;
  const isOnTime   = startDelay !== null && startDelay <= TOLERANCE_MIN;

  // 実績バーの色
  const actualColor =
    delayStatus === "active"    ? "bg-blue-400" :
    delayStatus === "completed" ? (isOnTime ? "bg-green-400" : "bg-orange-400") :
    delayStatus === "paused"    ? "bg-yellow-400" :
    delayStatus === "partial"   ? "bg-purple-300" :
    delayStatus === "delay"     ? "bg-red-300" : "bg-gray-200";

  // 判定ラベル
  const judgeLabel =
    delayStatus === "completed" && isOnTime   ? { text: "計画通り", cls: "text-green-600 bg-green-50 border-green-200" } :
    delayStatus === "completed" && !isOnTime  ? { text: `${startDelay}分遅れ`, cls: "text-orange-600 bg-orange-50 border-orange-200" } :
    delayStatus === "active"                  ? { text: "作業中", cls: "text-blue-600 bg-blue-50 border-blue-200" } :
    delayStatus === "paused"                  ? { text: "中断中", cls: "text-yellow-700 bg-yellow-50 border-yellow-200" } :
    delayStatus === "partial"                 ? { text: "引き継ぎ待ち", cls: "text-purple-700 bg-purple-50 border-purple-200" } :
    delayStatus === "delay"                   ? { text: "遅延", cls: "text-red-600 bg-red-50 border-red-200" } :
                                                { text: "未着手", cls: "text-gray-500 bg-gray-50 border-gray-200" };

  const pausedLogs = workLogs.filter(l => l.status === "PAUSED");

  // 実績時刻テキスト
  const actualTimeText = actualStart
    ? `${timeStr(actualStart)} 〜 ${actualEnd ? timeStr(actualEnd) : delayStatus === "active" ? "作業中" : "−"}`
    : "− 〜 −";

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* ヘッダー：1行に圧縮 */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-1.5 min-w-0">
        <span className="font-semibold text-gray-800 text-sm shrink-0">{plan.processLabel}</span>
        <span className={`text-xs px-1 py-0.5 rounded border font-medium shrink-0 ${judgeLabel.cls}`}>
          {judgeLabel.text}
        </span>
        <span className="text-xs text-gray-400 truncate flex-1 min-w-0">
          {plan.vehicle.barcode} / {plan.vehicle.modelName ?? "−"} / {plan.vehicle.exteriorColor ?? "−"}
        </span>
        {delayStatus === "paused" ? (
          <button onClick={onResume}
            className="shrink-0 bg-yellow-500 text-white text-xs px-2.5 py-1 rounded-lg font-medium">
            再開
          </button>
        ) : delayStatus === "active" ? (
          <span className="shrink-0 text-xs text-blue-500 font-medium">作業中</span>
        ) : delayStatus === "completed" ? (
          <span className="shrink-0 text-green-500 text-base leading-none">✓</span>
        ) : delayStatus === "partial" ? (
          <button onClick={onStart}
            className="shrink-0 bg-purple-600 text-white text-xs px-2.5 py-1 rounded-lg font-medium">
            継続
          </button>
        ) : (
          <button onClick={onStart}
            className="shrink-0 bg-blue-600 text-white text-xs px-2.5 py-1 rounded-lg font-medium">
            開始
          </button>
        )}
      </div>

      {/* バーエリア */}
      <div className="px-3 pb-2.5 space-y-1">

        {/* 計画バー */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 w-3 shrink-0">計</span>
          <div className="flex-1 min-w-0">
            <TimeBar
              startIso={plannedStart} endIso={plannedEnd} nowIso={nowIso}
              dayStartMin={dayStartMin} dayDurationMin={dayDurationMin}
              color="bg-gray-300"
            />
          </div>
          <span className="text-xs text-gray-400 shrink-0 tabular-nums">
            {timeStr(plannedStart)}-{timeStr(plannedEnd)}
          </span>
        </div>

        {/* 実績バー（常に表示） */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium w-3 shrink-0">実</span>
          <div className="flex-1 min-w-0">
            {actualStart ? (
              <TimeBar
                startIso={actualStart} endIso={actualEnd} nowIso={nowIso}
                dayStartMin={dayStartMin} dayDurationMin={dayDurationMin}
                color={actualColor}
              />
            ) : (
              <div className="w-full bg-gray-50 rounded-full h-3" />
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0 tabular-nums">
            {actualTimeText}
          </span>
        </div>

        {/* 中断ログ：バーの下に1行テキスト */}
        {pausedLogs.map((log) => (
          <div key={log.id} className="flex items-center gap-1 text-xs text-yellow-700 pl-4">
            <span>⏸</span>
            <span className="font-medium">{log.notes ?? "中断"}</span>
            <span className="text-gray-400">
              {timeStr(log.startedAt)}
              {log.endedAt ? `〜${timeStr(log.endedAt)}（${diffMin(log.startedAt, log.endedAt)}分）` : "〜"}
            </span>
          </div>
        ))}

        {/* 引き継ぎ待ち：チェックリスト進捗 */}
        {delayStatus === "partial" && plan.completedItems !== undefined && (
          <div className="flex items-center gap-1 text-xs text-purple-700 pl-4">
            <span>✓</span>
            <span className="font-medium">前作業者が {plan.completedItems.length} 項目完了済み</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** 中断・計画外作業カード */
function InterruptionCard({
  log, dayStartMin, dayDurationMin, nowIso,
}: {
  log: InterruptionLog;
  dayStartMin: number;
  dayDurationMin: number;
  nowIso: string;
}) {
  const duration = log.endedAt ? diffMin(log.startedAt, log.endedAt) : null;
  const timeText = `${timeStr(log.startedAt)}${log.endedAt ? `〜${timeStr(log.endedAt)}` : "〜作業中"}${duration !== null ? `（${duration}分）` : ""}`;
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-yellow-600 text-xs">⏸</span>
        <span className="text-xs font-medium text-yellow-800 flex-1 truncate">
          {log.notes ?? "中断・計画外作業"}
        </span>
        <span className="text-xs text-yellow-600 shrink-0 tabular-nums">{timeText}</span>
      </div>
      <TimeBar
        startIso={log.startedAt} endIso={log.endedAt} nowIso={nowIso}
        dayStartMin={dayStartMin} dayDurationMin={dayDurationMin}
        color="bg-yellow-400"
      />
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData]   = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    fetch("/api/dashboard/my-plans")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const nowIso = new Date().toISOString();

  const dayStartMin    = data ? toMin(data.workDayStart.hour, data.workDayStart.minute) : toMin(8, 15);
  const dayEndMin      = data ? toMin(data.workDayEnd.hour,   data.workDayEnd.minute)   : toMin(17, 0);
  const dayDurationMin = dayEndMin - dayStartMin;

  const plans               = data?.plans ?? [];
  const interruptionLogs    = data?.interruptionLogs ?? [];
  const activeInterruptionId = data?.activeInterruptionLogId ?? null;

  // 計画と中断ログを時刻順にマージ
  type TimelineItem =
    | { kind: "plan";          item: WorkPlanItem }
    | { kind: "interruption";  item: InterruptionLog };

  const timeline: TimelineItem[] = [
    ...plans.map(p => ({ kind: "plan" as const, item: p, t: p.plannedStart })),
    ...interruptionLogs.map(l => ({ kind: "interruption" as const, item: l, t: l.startedAt })),
  ]
    .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
    .map(({ kind, item }) =>
      kind === "plan"
        ? { kind: "plan" as const, item: item as WorkPlanItem }
        : { kind: "interruption" as const, item: item as InterruptionLog }
    );

  const handleStart = (planId: string) => router.push(`/work/${planId}`);

  const handleResume = async (planId: string, pausedLogId: string) => {
    const res = await fetch(`/api/work/${planId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interruptionLogId: activeInterruptionId }),
    });
    if (res.ok) {
      const d = await res.json();
      router.push(`/work/${planId}/active?logId=${d.logId}&interruptionLogId=${activeInterruptionId ?? ""}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs opacity-80">PDI作業管理</p>
          <p className="font-bold">{session?.user?.name} さん</p>
        </div>
        <div className="flex items-center gap-2">
          {(session?.user?.role === "MANAGER" || session?.user?.role === "TEAM_LEADER") && (
            <Link href="/analytics/overview"
              className="text-xs bg-blue-600 border border-blue-400 px-3 py-1.5 rounded-lg">
              管理画面
            </Link>
          )}
          <button onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs bg-blue-800 px-3 py-1.5 rounded-lg">
            ログアウト
          </button>
        </div>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto">
        <p className="text-sm text-gray-500 mb-3">
          {new Date().toLocaleDateString("ja-JP", {
            year: "numeric", month: "long", day: "numeric", weekday: "long",
          })}
          {data && (
            <span className="ml-2 text-gray-400">
              終業 {data.workDayEnd.hour}:{String(data.workDayEnd.minute).padStart(2,"0")}
            </span>
          )}
        </p>

        {/* 中断中バナー */}
        {activeInterruptionId && (
          <div className="mb-3 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-yellow-500 text-lg">⏸</span>
            <p className="text-sm text-yellow-800 font-medium flex-1">中断中の作業があります</p>
          </div>
        )}

        <button className="w-full mb-3 bg-white border-2 border-dashed border-gray-300 text-gray-500 rounded-xl py-3 text-sm font-medium hover:border-blue-400 hover:text-blue-500 transition">
          + 計画外作業を開始
        </button>

        {loading ? (
          <div className="text-center text-gray-400 py-12">読み込み中...</div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400">
            <p className="text-4xl mb-2">📋</p>
            <p className="text-sm">本日の作業計画はありません</p>
          </div>
        ) : (
          <>
            <SummaryBar plans={plans} />

            <h2 className="text-xs font-semibold text-gray-500 mb-2 mt-1">
              今日の作業タイムライン
              <span className="ml-1 font-normal text-gray-400">
                （{TOLERANCE_MIN}分以内の遅れは「計画通り」）
              </span>
            </h2>

            <div className="space-y-1.5 pb-6">
              {timeline.map((entry) =>
                entry.kind === "plan" ? (
                  <PlanCard
                    key={entry.item.id}
                    plan={entry.item}
                    dayStartMin={dayStartMin}
                    dayDurationMin={dayDurationMin}
                    nowIso={nowIso}
                    onStart={() => handleStart(entry.item.id)}
                    onResume={() => handleResume(entry.item.id, entry.item.pausedLogId!)}
                  />
                ) : (
                  <InterruptionCard
                    key={entry.item.id}
                    log={entry.item}
                    dayStartMin={dayStartMin}
                    dayDurationMin={dayDurationMin}
                    nowIso={nowIso}
                  />
                )
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
