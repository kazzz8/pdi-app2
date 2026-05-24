"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

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

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading" || !session) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">マツダロジスティクス</p>
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

      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="grid grid-cols-2 gap-5 w-full max-w-xs">
          {MENUS.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="flex flex-col items-center justify-center bg-white rounded-2xl shadow-md p-6 gap-4 active:scale-95 transition-transform"
            >
              <div className={`w-16 h-16 ${menu.color} rounded-2xl flex items-center justify-center shadow`}>
                {menu.icon}
              </div>
              <span className="text-sm font-semibold text-gray-700">{menu.label}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
