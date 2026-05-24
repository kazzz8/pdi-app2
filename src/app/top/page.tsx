"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const DUMMY_NOTICES = [
  { id: 1, date: "5/24", body: "本日の作業終了は17:00を予定しています。安全作業でお願いします。" },
  { id: 2, date: "5/23", body: "エリアBの洗車ラインが午後から通常稼働に戻りました。" },
];

const NAV_ITEMS = [
  {
    label: "作業計画",
    description: "今日の作業",
    href: "/dashboard" as string | null,
    iconBg: "bg-blue-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "健康状態",
    description: "体調の記録",
    href: "/health" as string | null,
    iconBg: "bg-green-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    label: "個人実績",
    description: "スキル・効率",
    href: "/my-records" as string | null,
    iconBg: "bg-purple-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: "勤怠入力",
    description: "出勤・退勤",
    href: null,
    iconBg: "bg-indigo-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function TopPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading" || !session) return null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const cardClass = "flex flex-col items-center justify-center bg-white rounded-2xl shadow-sm gap-3 py-6 active:scale-95 transition-transform";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm px-5 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">PDI作業管理</h1>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-700">{session.user?.name}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-4 p-4 max-w-sm mx-auto w-full">

        {/* お知らせ */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            <h2 className="text-sm font-bold text-gray-600">お知らせ</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
            {DUMMY_NOTICES.map((n) => (
              <div key={n.id} className="flex gap-3 px-4 py-3 items-start">
                <span className="text-xs text-gray-400 pt-0.5 shrink-0">{n.date}</span>
                <p className="text-sm text-gray-700 leading-snug">{n.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* メニュー 2×2 グリッド */}
        <div className="grid grid-cols-2 gap-4">
          {NAV_ITEMS.map((item) =>
            item.href ? (
              <Link key={item.label} href={item.href} className={cardClass}>
                <div className={`w-14 h-14 ${item.iconBg} rounded-2xl flex items-center justify-center shadow`}>
                  {item.icon}
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.description}</p>
                </div>
              </Link>
            ) : (
              <button key={item.label} onClick={() => showToast(`${item.label}機能は準備中です`)} className={cardClass}>
                <div className={`w-14 h-14 ${item.iconBg} rounded-xl flex items-center justify-center shadow`}>
                  {item.icon}
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.description}</p>
                </div>
              </button>
            )
          )}
        </div>

        {/* 管理者呼び出し（全幅） */}
        <button
          onClick={() => showToast("管理者呼び出し機能は準備中です")}
          className="w-full bg-white rounded-2xl shadow-sm px-5 py-4 flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <div className="w-14 h-14 bg-red-500 rounded-2xl flex items-center justify-center shadow">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800">管理者を呼ぶ</p>
            <p className="text-xs text-gray-400">トラブル・緊急時に使用</p>
          </div>
        </button>

      </main>

      {/* トースト */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-5 py-3 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
