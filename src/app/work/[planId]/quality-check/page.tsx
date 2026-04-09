import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DressUpQualityCheck from "@/components/work/DressUpQualityCheck";

export default async function QualityCheckPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { planId } = await params;

  const plan = await prisma.workPlan.findUnique({
    where: { id: planId },
    select: {
      vehicle: { select: { modelName: true, exteriorColor: true } },
    },
  });

  if (!plan) redirect("/dashboard");

  return (
    <DressUpQualityCheck
      planId={planId}
      vehicle={plan.vehicle}
    />
  );
}
