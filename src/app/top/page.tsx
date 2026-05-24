"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const DUMMY_NOTICES = [
  { id: 1, date: "5/24", body: "本日の作業終了は17:00を予定しています。安全作業でお願いします。" },
  { id: 2, date: "5/23", body: "エリアBの洗車ラインが午後から通常稼働に戻りました。" },
];

const MENUS = [
  {
    label: "作業計画",
    href: "/dashboard",
    color: "bg-blue-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "健康状態",
    href: "/health",
    color: "bg-green-500",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">PDI作業管理</h1>
        </div>
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

        {/* 勤怠入力 */}
        <button
          onClick={() => showToast("勤怠入力機能は準備中です")}
          className="w-full bg-white rounded-2xl shadow-sm px-5 py-4 flex items-center gap-4 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800">勤怠入力</p>
            <p className="text-xs text-gray-400">出勤・退勤の記録</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-300 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* メニュー */}
        <div className="grid grid-cols-2 gap-4">
          {MENUS.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="flex flex-col items-center justify-center bg-white rounded-2xl shadow-sm p-6 gap-4 active:scale-95 transition-transform"
            >
              <div className={`w-16 h-16 ${menu.color} rounded-2xl flex items-center justify-center shadow`}>
                {menu.icon}
              </div>
              <span className="text-sm font-semibold text-gray-700">{menu.label}</span>
            </Link>
          ))}
        </div>

        {/* 管理者呼び出し */}
        <button
          onClick={() => showToast("管理者呼び出し機能は準備中です")}
          className="w-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all rounded-2xl shadow px-5 py-4 flex items-center justify-center gap-3"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-white font-bold text-base">管理者を呼ぶ</span>
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
