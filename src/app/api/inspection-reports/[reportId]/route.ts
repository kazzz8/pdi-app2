import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId } = await params;

  const report = await prisma.inspectionReport.findUnique({
    where: { id: reportId },
    include: {
      vehicle: { select: { barcode: true, modelName: true, exteriorColor: true } },
      worker: { select: { name: true } },
      defects: {
        select: {
          id: true, location: true, defectType: true,
          severity: true, description: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    report: {
      id: report.id,
      inspectionType: report.inspectionType,
      startedAt: report.startedAt.toISOString(),
      endedAt: report.endedAt?.toISOString() ?? report.startedAt.toISOString(),
      vehicle: report.vehicle,
      worker: report.worker,
      defects: report.defects,
    },
  });
}
