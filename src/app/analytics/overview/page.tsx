"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import Link from "next/link";

// ─── 型定義 ──────────────────────────────────────────────

type KpiData = {
  inStock: number;
  processedToday: number;
  delayed: number;
  openDefects: number;
};

type OverviewData = {
  kpi: KpiData;
  vehicleStatusCounts: { status: string; label: string; count: number }[];
  processActivity: { processType: string; label: string; planned: number; completed: number }[];
  defectsBySeverity: { severity: string; label: string; count: number }[];
  generatedAt: string;
};

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

// ─── 定数 ────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5 * 60 * 1000;

const STATUS_COLORS: Record<string, string> = {
  ARRIVED:    "#94a3b8",
  IN_STORAGE: "#60a5fa",
  IN_PROCESS: "#f59e0b",
  COMPLETED:  "#34d399",
  DISPATCHED: "#9ca3af",
};

const SEVERITY_COLORS: Record<string, string> = {
  A: "#ef4444",
  B: "#f97316",
  C: "#eab308",
};

function deviationColor(deviation: number, hasPlans: boolean): string {
  if (!hasPlans) return "#9ca3af";
  if (Math.abs(deviation) <= 1) return "#34d399";
  if (deviation > 1) return "#f97316";
  return "#ef4444";
}

// ─── コンポーネント ───────────────────────────────────────

function KpiCard({ label, value, unit, color, sub }: {
  label: string; value: number; unit: string;
  color: "blue" | "green" | "red" | "orange"; sub?: string;
}) {
  const styles = {
    blue:   "bg-blue-50 border-blue-200 text-blue-700",
    green:  "bg-green-50 border-green-200 text-green-700",
    red:    "bg-red-50 border-red-200 text-red-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
  }[color];
  return (
    <div className={`border rounded-2xl p-5 ${styles}`}>
      <p className="text-xs text-gray-500 mb-3">{label}</p>
      <p className="text-4xl font-bold">
        {value.toLocaleString()}<span className="text-lg font-normal ml-1">{unit}</span>
      </p>
      {sub && <p className="text-xs mt-2 opacity-60">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────

export default function OverviewPage() {
  const [overview, setOverview]   = useState<OverviewData | null>(null);
  const [progress, setProgress]   = useState<ProgressData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    Promise.all([
      fetch("/api/analytics/overview").then((r) => r.json()),
      fetch("/api/analytics/progress").then((r) => r.json()),
    ])
      .then(([ov, pr]) => {
        if (ov?.kpi)        setOverview(ov);
        else console.error("[overview] API error:", JSON.stringify(ov));
        if (pr?.completion) setProgress(pr);
        else console.error("[progress] API error:", JSON.stringify(pr));
      })
      .catch((e) => console.error("[overview] fetch error:", e))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">読み込み中...</div>;
  }
  if (!overview || !progress) return null;

  const { kpi, vehicleStatusCounts, processActivity, defectsBySeverity } = overview;
  const { completion, processDeviations } = progress;

  const updatedAt = new Date(overview.generatedAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const deviationLabel =
    completion.deviation === 0 ? { text: "計画通り", cls: "text-green-600" } :
    completion.deviation > 0   ? { text: `${completion.deviation}台 先行`, cls: "text-orange-500" } :
                                  { text: `${Math.abs(completion.deviation)}台 遅延`, cls: "text-red-500" };

  // 偏差グラフ用データ（0を中心に）
  const deviationChartData = processDeviations.map((d) => ({
    label: d.label,
    deviation: d.deviation,
    fill: deviationColor(d.deviation, d.hasPlans),
    hasPlans: d.hasPlans,
  }));

  return (
    <div className="p-8 max-w-6xl">

      {/* ヘッダー */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-sm text-gray-400 mb-1">
            {new Date().toLocaleDateString("ja-JP", {
              year: "numeric", month: "long", day: "numeric", weekday: "long",
            })}
          </p>
          <h1 className="text-2xl font-bold text-gray-800">工場概況ダッシュボード</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/monitor"
            className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            大型モニター表示
          </Link>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">
              {refreshing ? <span className="text-blue-400">更新中...</span> : <>最終更新 {updatedAt}</>}
            </p>
            <p className="text-xs text-gray-300 mb-1">5分おきに自動更新</p>
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg disabled:opacity-40"
            >
              今すぐ更新
            </button>
          </div>
        </div>
      </div>

      {/* ① 当日完成進捗 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-700">当日完成進捗</h2>
            <p className="text-xs text-gray-400 mt-0.5">完成検査の計画 vs 実績（現時点）</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">完成予定</p>
            <p className="text-3xl font-bold text-gray-800">
              {completion.totalPlanned}<span className="text-lg font-normal ml-1">台</span>
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500 w-28 shrink-0 text-right">現時点の計画</p>
            <div className="flex-1"><ProgressBar value={completion.expectedByNow} max={completion.totalPlanned} color="bg-gray-300" /></div>
            <p className="text-base font-semibold text-gray-600 w-16 text-right">{completion.expectedByNow}台</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-gray-700 w-28 shrink-0 text-right">実　　績</p>
            <div className="flex-1">
              <ProgressBar
                value={completion.actualCompleted}
                max={completion.totalPlanned}
                color={completion.deviation >= 0 ? "bg-orange-400" : "bg-red-500"}
              />
            </div>
            <p className="text-base font-bold text-gray-800 w-16 text-right">{completion.actualCompleted}台</p>
          </div>
        </div>
        <p className={`text-right text-2xl font-black mt-3 ${deviationLabel.cls}`}>{deviationLabel.text}</p>
      </div>

      {/* ② 工程別 先行/遅延（偏差グラフ） */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-gray-700 mb-1">工程別 先行 / 遅延</h2>
        <p className="text-xs text-gray-400 mb-1">現時点の計画に対する実績の差（＋先行 / −遅延）</p>
        <div className="flex gap-4 mb-4 text-xs">
          {[
            { color: "bg-green-400",  label: "正常（±1台）" },
            { color: "bg-orange-400", label: "先行（+2台以上）" },
            { color: "bg-red-400",    label: "遅延（-2台以上）" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
              <span className="text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            layout="vertical"
            data={deviationChartData}
            margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
          >
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" width={80} tick={{ fontSize: 11 }} />
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <ReferenceLine x={0} stroke="#6b7280" strokeWidth={2} />
            <Tooltip
              formatter={(v) => {
                const n = Number(v);
                return [`${n > 0 ? "+" : ""}${n} 台`, n > 0 ? "先行" : n < 0 ? "遅延" : "正常"];
              }}
            />
            <Bar dataKey="deviation" name="偏差" radius={[2, 2, 2, 2]} barSize={18}>
              {deviationChartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* KPI カード */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="在庫台数" value={kpi.inStock} unit="台" color="blue" sub="出庫済を除く" />
        <KpiCard label="本日完了" value={kpi.processedToday} unit="件" color="green" sub="完了した作業ログ" />
        <KpiCard label="遅延中" value={kpi.delayed} unit="件" color="red" sub="計画時刻超過・未着手" />
        <KpiCard label="未補修不具合" value={kpi.openDefects} unit="件" color="orange" sub="OPENステータス" />
      </div>

      {/* 車両ステータス + 工程別進捗 */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-1">車両ステータス分布</h2>
          <p className="text-xs text-gray-400 mb-4">入庫〜出庫の各工程にある台数</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={vehicleStatusCounts} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="count" nameKey="label" paddingAngle={2}>
                {vehicleStatusCounts.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#ccc"} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v} 台`, ""]} />
              <Legend iconType="circle" iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-1">今日の工程別進捗</h2>
          <p className="text-xs text-gray-400 mb-4">本日分の計画台数と完了台数</p>
          {processActivity.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">データなし</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart layout="vertical" data={processActivity} margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={76} tick={{ fontSize: 11 }} />
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <Tooltip />
                <Bar dataKey="planned"   name="計画" fill="#bfdbfe" barSize={10} />
                <Bar dataKey="completed" name="完了" fill="#34d399" radius={[0, 3, 3, 0]} barSize={10} />
                <Legend iconType="square" iconSize={10} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 不具合 + プレースホルダー */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-700 mb-1">未補修不具合（重症度別）</h2>
          <p className="text-xs text-gray-400 mb-4">OPENステータスの不具合件数</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={defectsBySeverity} margin={{ top: 4, right: 24, bottom: 4 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <Tooltip formatter={(v) => [`${v} 件`, "件数"]} />
              <Bar dataKey="count" name="件数" radius={[4, 4, 0, 0]} barSize={48}>
                {defectsBySeverity.map((entry) => (
                  <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity] ?? "#ccc"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-dashed border-gray-200 flex flex-col justify-center">
          <p className="text-base font-semibold text-gray-400 mb-2">工程間のつながり（実装予定）</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            前工程の遅れ・早まりが次工程の仕掛量に与える影響を可視化します。<br />
            全体最適の意識を現場に持たせるための指標として活用します。
          </p>
        </div>
      </div>
    </div>
  );
}
