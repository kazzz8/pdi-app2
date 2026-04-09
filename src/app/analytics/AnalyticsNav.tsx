"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type NavUser = {
  name: string;
  role: string;
  teamName: string | null;
};

const NAV_ITEMS = [
  { href: "/analytics/overview", label: "工場概況",     icon: "📊", ready: true },
  { href: "/monitor",            label: "大型モニター", icon: "🖥️", ready: true },
  { href: "/analytics/master",   label: "マスタ管理",  icon: "⚙️", ready: true },
  { href: "/analytics/process",  label: "工程進捗",     icon: "🔄", ready: false },
  { href: "/analytics/team",     label: "班別実績",    icon: "👥", ready: false },
  { href: "/analytics/defects",  label: "不具合分析",  icon: "🔍", ready: false },
  { href: "/analytics/transport",label: "輸送連携",    icon: "🚚", ready: false },
];

const ROLE_LABELS: Record<string, string> = {
  MANAGER: "管理者",
  TEAM_LEADER: "班長",
  GENERAL: "作業者",
};

export default function AnalyticsNav({ user }: { user: NavUser }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-[#1a3a6b] text-white flex flex-col shrink-0">
      {/* ロゴ */}
      <div className="px-5 py-5 border-b border-white/10">
        <p className="text-xs text-white/50 mb-1">車両物流本部</p>
        <p className="font-bold text-sm leading-tight">PDI 管理ダッシュボード</p>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;

          if (!item.ready) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/30 cursor-not-allowed text-sm"
              >
                <span>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">準備中</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-white/20 text-white font-semibold"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ユーザー情報 + ログアウト */}
      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-xs text-white/50 mb-0.5">{ROLE_LABELS[user.role] ?? user.role}</p>
        <p className="text-sm font-medium text-white mb-3 truncate">{user.name}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-xs bg-white/10 hover:bg-white/20 text-white/80 px-3 py-2 rounded-lg transition-colors"
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}
