import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AnalyticsNav from "./AnalyticsNav";

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  const { role } = session.user;
  if (role !== "MANAGER" && role !== "TEAM_LEADER") redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AnalyticsNav user={session.user} />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
