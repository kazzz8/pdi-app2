"use client";

import { useEffect, useState, useCallback } from "react";

const POLL_INTERVAL_MS = 5 * 60 * 1000;

type ProcessDeviation = {
  processType: string;
  label: string;
  plannedCount: number;
  expectedByNow: number;
  actualCompleted: number;
  deviation: number;
  hasPlans: boolean;
};

type ProgressData = {
  endTime: { hour: number; minute: number };
  totalVehicles: number;
  completion: {
    totalPlanned: number;
    expectedByNow: number;
    actualCompleted: number;
    deviation: number;
  };
  processDeviations: ProcessDeviation[];
  generatedAt: string;
};

// 偏差の状態
function deviationStatus(deviation: number, hasPlans: boolean) {
  if (!hasPlans) return "none";
  if (Math.abs(deviation) <= 1) return "ok";
  if (deviation > 1)  return "ahead";
  return "behind";
}

const STATUS_STYLES = {
  ok:     { bg: "bg-green-800",  border: "border-green-500",  text: "text-green-300",  badge: "bg-green-700",  label: "正常" },
  ahead:  { bg: "bg-orange-800", border: "border-orange-400", text: "text-orange-200", badge: "bg-orange-700", label: "先行" },
  behind: { bg: "bg-red-900",    border: "border-red-400",    text: "text-red-200",    badge: "bg-red-800",    label: "遅延" },
  none:   { bg: "bg-slate-700",  border: "border-slate-500",  text: "text-slate-400",  badge: "bg-slate-600",  label: "計画なし" },
};

// 工程ノード
function ProcessNode({ item }: { item: ProcessDeviation }) {
  const status = deviationStatus(item.deviation, item.hasPlans);
  const s = STATUS_STYLES[status];
  const devText =
    item.deviation === 0 ? "±0" :
    item.deviation > 0   ? `+${item.deviation}` :
    `${item.deviation}`;

  return (
    <div className={`${s.bg} border-2 ${s.border} rounded-2xl px-4 py-3 text-center min-w-[120px] flex-shrink-0`}>
      {/* 工程名 */}
      <p className="text-white font-bold text-base leading-tight mb-2">{item.label}</p>

      {item.hasPlans ? (
        <>
          {/* 偏差（メイン表示） */}
          <p className={`text-4xl font-black ${s.text}`}>{devText}</p>
          <p className={`text-sm mt-1 ${s.text} font-semibold`}>{s.label}</p>

          {/* 計画台数 / 実績台数（補足） */}
          <div className={`mt-3 pt-2 border-t border-white/10 text-xs space-y-0.5`}>
            <p className="text-slate-400">
              計画 <span className="text-slate-300 font-medium">{item.plannedCount}</span>台
            </p>
            <p className="text-slate-400">
              実績 <span className="text-slate-300 font-medium">{item.actualCompleted}</span>台
            </p>
          </div>
        </>
      ) : (
        <p className="text-slate-400 text-sm mt-2">−</p>
      )}
    </div>
  );
}

// 時刻表示
function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("ja-JP", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{time}</span>;
}

// 進捗バー
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function MonitorPage() {
  const [data, setData]         = useState<ProgressData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((silent = false) => {
    if (silent) setRefreshing(true);
    fetch("/api/analytics/progress")
      .then((r) => r.json())
      .then((json) => {
        if (json?.completion) setData(json);
        else console.error("[monitor] API error:", JSON.stringify(json));
      })
      .catch((e) => console.error("[monitor] fetch error:", e))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const { completion, processDeviations, endTime, totalVehicles } = data ?? {
    completion: { totalPlanned: 0, expectedByNow: 0, actualCompleted: 0, deviation: 0 },
    processDeviations: [],
    endTime: { hour: 17, minute: 0 },
    totalVehicles: 300,
  };

  const endTimeStr = endTime
    ? `${endTime.hour}:${String(endTime.minute).padStart(2, "0")}`
    : "−";

  const deviationAbs = Math.abs(completion.deviation);
  const deviationLabel =
    completion.deviation === 0 ? { text: "計画通り",                    cls: "text-green-400" } :
    completion.deviation > 0   ? { text: `${completion.deviation}台 先行`, cls: "text-orange-400" } :
                                  { text: `${deviationAbs}台 遅延`,         cls: "text-red-400" };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col p-6 gap-5">

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-lg">{today}</p>
          <h1 className="text-3xl font-bold">PDI 工場概況</h1>
        </div>
        <div className="text-right flex items-end gap-8">
          {/* 終業時間 */}
          <div>
            <p className="text-slate-500 text-sm mb-1">本日終業</p>
            <p className="text-3xl font-bold text-slate-200">{endTimeStr}</p>
            <p className="text-slate-500 text-sm mt-1">
              処理予定 {totalVehicles}台
            </p>
          </div>
          {/* 現在時刻 */}
          <div>
            <p className="text-5xl font-mono font-bold text-slate-200"><Clock /></p>
            <p className="text-slate-500 text-sm mt-1 text-right">
              {refreshing ? "更新中..." : "5分おきに自動更新"}
            </p>
          </div>
        </div>
      </div>

      {/* 当日完成進捗 */}
      <div className="bg-slate-800 rounded-3xl p-6 flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold">当日完成進捗</h2>
          <div className="text-right">
            <p className="text-slate-400 text-sm">完成予定</p>
            <p className="text-4xl font-black">
              {completion.totalPlanned}
              <span className="text-2xl font-normal ml-1">台</span>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <p className="text-slate-400 text-lg w-36 shrink-0 text-right">現時点の計画</p>
            <div className="flex-1">
              <ProgressBar
                value={completion.expectedByNow}
                max={completion.totalPlanned}
                color="bg-slate-500"
              />
            </div>
            <p className="text-2xl font-bold w-20 text-right">
              {completion.expectedByNow}
              <span className="text-lg font-normal">台</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-white text-lg font-semibold w-36 shrink-0 text-right">実　　績</p>
            <div className="flex-1">
              <ProgressBar
                value={completion.actualCompleted}
                max={completion.totalPlanned}
                color={completion.deviation >= 0 ? "bg-orange-500" : "bg-red-500"}
              />
            </div>
            <p className="text-2xl font-bold w-20 text-right">
              {completion.actualCompleted}
              <span className="text-lg font-normal">台</span>
            </p>
          </div>
        </div>

        <div className="mt-5 text-center">
          <p className={`text-6xl font-black ${deviationLabel.cls}`}>{deviationLabel.text}</p>
        </div>
      </div>

      {/* 工程フロー × 先行/遅延 */}
      <div className="bg-slate-800 rounded-3xl p-6 flex-1">
        <h2 className="text-2xl font-bold mb-5">工程フロー</h2>
        <div className="flex items-start justify-between gap-2 overflow-x-auto pb-2">
          {processDeviations.map((item, i) => (
            <div key={item.processType} className="flex items-center gap-2">
              <ProcessNode item={item} />
              {i < processDeviations.length - 1 && (
                <span className="text-slate-500 text-2xl font-bold shrink-0">→</span>
              )}
            </div>
          ))}
        </div>

        {/* 凡例 */}
        <div className="flex gap-6 mt-5 justify-end">
          {[
            { color: "bg-green-500",  label: "正常（±1台以内）" },
            { color: "bg-orange-500", label: "先行（+2台以上）" },
            { color: "bg-red-500",    label: "遅延（-2台以上）" },
            { color: "bg-slate-500",  label: "計画なし" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <span className="text-slate-400 text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
