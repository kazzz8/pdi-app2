"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import LInspectionWork from "@/components/work/LInspectionWork";
import DressUpWork from "@/components/work/DressUpWork";

type PlanInfo = {
  processType: string;
  vehicle: {
    barcode: string;
    modelName: string | null;
    exteriorColor: string | null;
  };
  completedItems?: string[];
};

export default function ActiveWorkPage() {
  const { planId } = useParams<{ planId: string }>();
  const searchParams = useSearchParams();
  const logId = searchParams.get("logId") ?? "";
  const interruptionLogId = searchParams.get("interruptionLogId") ?? "";
  const [plan, setPlan] = useState<PlanInfo | null>(null);

  useEffect(() => {
    fetch(`/api/work/${planId}`)
      .then((r) => r.json())
      .then((data) => setPlan(data.plan));
  }, [planId]);

  if (!plan) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-400">読み込み中...</div>;
  }

  switch (plan.processType) {
    case "L_INSPECTION":
    case "S_INSPECTION":
      return <LInspectionWork planId={planId} logId={logId} interruptionLogId={interruptionLogId} plan={plan} />;
    case "DRESS_UP":
      return <DressUpWork planId={planId} logId={logId} interruptionLogId={interruptionLogId} plan={plan} />;
    default:
      return <LInspectionWork planId={planId} logId={logId} interruptionLogId={interruptionLogId} plan={plan} />;
  }
}
