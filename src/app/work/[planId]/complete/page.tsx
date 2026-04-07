"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ReportDetail = {
  id: string;
  inspectionType: string;
  startedAt: string;
  endedAt: string;
  vehicle: { barcode: string; modelName: string | null; exteriorColor: string | null };
  worker: { name: string };
  defects: {
    id: string;
    location: string;
    defectType: string;
    severity: string;
    description: string | null;
  }[];
};

const PROCESS_LABEL: Record<string, string> = {
  DRESS_UP: "ドレスアップ",
  WASH: "洗車",
  POLISH: "磨き",
  REPAIR: "補修",
  RUST_PREVENTION: "防錆",
  COATING: "コーティング",
  FINAL_INSPECTION: "完成検査",
};

export default function CompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("reportId");
  const processType = searchParams.get("processType") ?? "";
  const [report, setReport] = useState<ReportDetail | null>(null);

  useEffect(() => {
    if (!reportId) return;
    fetch(`/api/inspection-reports/${reportId}`)
      .then((r) => r.json())
      .then((data) => setReport(data.report));
  }, [reportId]);

  const formatTime = (s: string) => {
    const d = new Date(s);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const durationMin = report
    ? Math.round((new Date(report.endedAt).getTime() - new Date(report.startedAt).getTime()) / 60000)
    : 0;

  const isInspection = !!reportId;
  const pageTitle = isInspection ? "点検完了" : "作業完了";
  const processLabel = isInspection ? "点検" : (PROCESS_LABEL[processType] ?? "作業");

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-700 text-white px-4 py-3">
        <h1 className="font-bold">{pageTitle}</h1>
      </header>

      <main className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {/* 完了メッセージ */}
        <div className="bg-white rounded-xl p-5 shadow-sm text-center">
          <p className="text-4xl mb-2">✅</p>
          <h2 className="text-xl font-bold text-gray-800">{processLabel}記録を保存しました</h2>
          {report && (
            <p className="text-sm text-gray-500 mt-1">
              {formatTime(report.startedAt)} 〜 {formatTime(report.endedAt)}（{durationMin}分）
            </p>
          )}
        </div>

        {/* 点検報告書（点検工程のみ） */}
        {report && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3">点検報告書</h3>

            <div className="text-sm text-gray-600 space-y-1 mb-4">
              <p><span className="text-gray-400">車両：</span>{report.vehicle.modelName ?? "−"} / {report.vehicle.exteriorColor ?? "−"}</p>
              <p><span className="text-gray-400">整理番号：</span>{report.vehicle.barcode}</p>
              <p><span className="text-gray-400">検査員：</span>{report.worker.name}</p>
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">不具合</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  report.defects.length === 0
                    ? "bg-green-100 text-green-700"
                    : "bg-orange-100 text-orange-700"
                }`}>
                  {report.defects.length === 0 ? "異常なし" : `${report.defects.length}件`}
                </span>
              </div>

              {report.defects.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">不具合は見つかりませんでした</p>
              ) : (
                <div className="space-y-2">
                  {report.defects.map((d) => (
                    <div key={d.id} className="flex items-start gap-2 bg-gray-50 rounded-lg p-2">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        d.severity === "A" ? "bg-yellow-100 text-yellow-700" :
                        d.severity === "B" ? "bg-orange-100 text-orange-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {d.severity}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{d.location} / {d.defectType}</p>
                        {d.description && <p className="text-xs text-gray-500">{d.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => router.push("/dashboard")}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition"
        >
          ダッシュボードに戻る
        </button>
      </main>
    </div>
  );
}
