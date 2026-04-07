"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BarcodeScanner from "@/components/BarcodeScanner";

type PlanDetail = {
  id: string;
  processType: string;
  processLabel: string;
  plannedStart: string;
  plannedEnd: string;
  vehicle: {
    id: string;
    barcode: string;
    modelName: string | null;
    exteriorColor: string | null;
    inspectionType: string;
  };
};

export default function WorkStartPage() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<"match" | "mismatch" | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState("");

  useEffect(() => {
    fetch(`/api/work/${planId}`)
      .then((r) => r.json())
      .then((data) => {
        setPlan(data.plan);
        setLoading(false);
      });
  }, [planId]);

  const handleScan = (barcode: string) => {
    setScannedBarcode(barcode);
    setShowScanner(false);
    if (plan && barcode === plan.vehicle.barcode) {
      setScanResult("match");
    } else {
      setScanResult("mismatch");
    }
  };

  const handleStart = async () => {
    const res = await fetch(`/api/work/${planId}/start`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      router.push(`/work/${planId}/active?logId=${data.logId}`);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-400">読み込み中...</div>;
  }

  if (!plan) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-400">作業が見つかりません</div>;
  }

  const formatTime = (s: string) => {
    const d = new Date(s);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {/* ヘッダー */}
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white text-xl">←</button>
        <h1 className="font-bold">作業開始確認</h1>
      </header>

      <main className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {/* 作業内容カード */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">工程</p>
          <p className="text-xl font-bold text-gray-800 mb-3">{plan.processLabel}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-gray-400">計画開始</p>
              <p className="font-medium">{formatTime(plan.plannedStart)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">計画終了</p>
              <p className="font-medium">{formatTime(plan.plannedEnd)}</p>
            </div>
          </div>
        </div>

        {/* 車両情報カード */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">対象車両</p>
          <p className="text-lg font-bold text-gray-800">{plan.vehicle.modelName ?? "−"}</p>
          <p className="text-sm text-gray-500">整理番号: {plan.vehicle.barcode}</p>
          <p className="text-sm text-gray-500">外板色: {plan.vehicle.exteriorColor ?? "−"}</p>
          <p className="text-sm text-gray-500">点検区分: {plan.vehicle.inspectionType}点検</p>
        </div>

        {/* バーコードスキャン */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-700 mb-3">車両バーコード確認</p>

          {scanResult === null && (
            <button
              onClick={() => setShowScanner(true)}
              className="w-full border-2 border-dashed border-blue-300 text-blue-600 rounded-xl py-4 text-sm font-medium flex items-center justify-center gap-2"
            >
              <span className="text-2xl">📷</span>
              バーコードをスキャン
            </button>
          )}

          {scanResult === "match" && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-green-700 font-bold">✓ 車両一致</p>
              <p className="text-xs text-green-600 mt-1">{scannedBarcode}</p>
            </div>
          )}

          {scanResult === "mismatch" && (
            <div className="space-y-2">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-red-700 font-bold">✗ 車両不一致</p>
                <p className="text-xs text-red-500 mt-1">スキャン: {scannedBarcode}</p>
                <p className="text-xs text-red-500">計画: {plan.vehicle.barcode}</p>
              </div>
              <button
                onClick={() => { setScanResult(null); setShowScanner(true); }}
                className="w-full text-blue-600 text-sm underline"
              >
                再スキャン
              </button>
            </div>
          )}
        </div>

        {/* 開始ボタン */}
        <button
          onClick={handleStart}
          disabled={scanResult !== "match"}
          className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition"
        >
          作業開始
        </button>

        {scanResult !== "match" && (
          <p className="text-center text-xs text-gray-400">バーコードスキャンで車両を確認してから開始してください</p>
        )}
      </main>
    </div>
  );
}
