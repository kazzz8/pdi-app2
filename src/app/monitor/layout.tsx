import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function MonitorLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role } = session.user;
  if (role !== "MANAGER" && role !== "TEAM_LEADER") redirect("/dashboard");

  return <>{children}</>;
}
