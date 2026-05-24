"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from "recharts";

// ─── スキルレベル ────────────────────────────────────────────

const PERIODS = ["2023/上", "2023/下", "2024/上", "2024/下", "2025/上", "2025/下"];

type Level = "×" | "△" | "○" | "◎";

const LEVEL_STYLE: Record<Level, { cell: string; text: string }> = {
  "×": { cell: "bg-gray-100",   text: "text-gray-400" },
  "△": { cell: "bg-yellow-50",  text: "text-yellow-500 font-bold" },
  "○": { cell: "bg-blue-50",    text: "text-blue-500 font-bold" },
  "◎": { cell: "bg-green-50",   text: "text-green-600 font-bold" },
};

const SKILLS: { name: string; levels: Level[] }[] = [
  { name: "ドレスアップ",       levels: ["×", "△", "△", "○", "○", "◎"] },
  { name: "点検",               levels: ["×", "×", "△", "△", "○", "○"] },
  { name: "ボディコーティング", levels: ["×", "×", "×", "△", "△", "○"] },
  { name: "防錆",               levels: ["×", "△", "○", "○", "◎", "◎"] },
];

// ─── 月次効率データ（ダミー）─────────────────────────────────
// 2023/06 〜 2026/05 の36ヶ月（決定論的に成長曲線を生成）

const MONTHLY_DATA = (() => {
  const data = [];
  for (let i = 0; i < 36; i++) {
    const year = 2023 + Math.floor((5 + i) / 12);
    const month = ((5 + i) % 12) + 1;
    const t = i / 35;

    const completion = 62 + t * 34 + Math.sin(i * 0.7) * 3;
    const efficiency  = 70 + t * 47 + Math.cos(i * 0.5) * 4;

    data.push({
      month: `${year}/${String(month).padStart(2, "0")}`,
      label: month === 1 || i === 0 ? `${year}` : "",
      completion: Math.round(Math.min(100, Math.max(52, completion))),
      efficiency:  Math.round(Math.min(128, Math.max(62, efficiency))),
    });
  }
  return data;
})();

// ─── ページ本体 ──────────────────────────────────────────────

export default function MyRecordsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading" || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm px-5 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-800">個人実績</h1>
        <span className="ml-auto text-sm text-gray-500">{session.user?.name}</span>
      </header>

      <main className="flex-1 flex flex-col gap-6 p-4">

        {/* ── 機能1: スキルレベル推移 ── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <h2 className="text-sm font-bold text-gray-700">スキルレベル推移</h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">管理者判定（半年ごと）</p>

          {/* 凡例 */}
          <div className="flex gap-3 mb-3 text-xs">
            {(["◎", "○", "△", "×"] as Level[]).map((lv) => (
              <span key={lv} className={`${LEVEL_STYLE[lv].text}`}>
                {lv}
              </span>
            ))}
            <span className="text-gray-400 ml-1">◎優秀 ○良好 △要努力 ×未経験</span>
          </div>

          {/* テーブル（横スクロール） */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-center" style={{ minWidth: 420 }}>
              <thead>
                <tr>
                  <th className="text-left text-xs text-gray-500 font-medium pb-2 pr-2 w-28">工程</th>
                  {PERIODS.map((p) => (
                    <th key={p} className="text-xs text-gray-500 font-medium pb-2 px-1">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {SKILLS.map((skill) => (
                  <tr key={skill.name}>
                    <td className="text-xs text-gray-700 text-left py-2 pr-2 font-medium">{skill.name}</td>
                    {skill.levels.map((lv, i) => (
                      <td key={i} className="py-1.5 px-1">
                        <span className={`inline-block w-8 h-8 rounded-lg text-sm leading-8 ${LEVEL_STYLE[lv].cell} ${LEVEL_STYLE[lv].text}`}>
                          {lv}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 機能2: ドレスアップ作業効率推移 ── */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <h2 className="text-sm font-bold text-gray-700">計画遵守率・作業効率推移</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">過去3年間・月別（2023/06〜2026/05）</p>

          <div className="overflow-x-auto -mx-1">
            <LineChart
              width={680}
              height={220}
              data={MONTHLY_DATA}
              margin={{ top: 4, right: 16, left: -8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10 }}
                interval={5}
                tickLine={false}
              />
              <YAxis
                domain={[50, 130]}
                tick={{ fontSize: 10 }}
                tickLine={false}
                unit="%"
              />
              <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="4 2" label={{ value: "100%", fontSize: 9, fill: "#9ca3af", position: "insideRight" }} />
              <Tooltip
                formatter={(value, name) => [
                  `${value}%`,
                  name === "completion" ? "計画遵守率" : "時間効率",
                ]}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend
                formatter={(value) => value === "completion" ? "計画遵守率" : "時間効率（100%超=標準より速い）"}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="completion"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="completion"
              />
              <Line
                type="monotone"
                dataKey="efficiency"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="efficiency"
              />
            </LineChart>
          </div>

          <p className="text-xs text-gray-400 mt-2">※ 時間効率100%超 = 標準時間より速く完了</p>
        </section>

      </main>
    </div>
  );
}
