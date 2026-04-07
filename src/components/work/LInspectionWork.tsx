"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import VehicleDiagram from "@/components/VehicleDiagram";

type Props = {
  planId: string;
  logId: string;
  interruptionLogId?: string;
  plan: {
    processType: string;
    vehicle: { barcode: string; modelName: string | null; exteriorColor: string | null };
  };
};

type Defect = {
  id: string;
  locationX: number;
  locationY: number;
  defectType: string;
  severity: "A" | "B" | "C";
  repairMinutes: number;
  photoDataUrl?: string;
  photoUrl?: string;
};

const DEFECT_TYPES = ["線傷", "面傷", "塗装", "へこみ", "欠け", "汚れ", "その他"];
const REPAIR_MINUTES_PRESETS = [10, 30, 60, 90, 120];
const PROCESS_LABEL: Record<string, string> = {
  L_INSPECTION: "L点検",
  S_INSPECTION: "S点検",
};
const STORAGE_KEY = (planId: string) => `pdi-defects-${planId}`;

export default function LInspectionWork({ planId, logId, interruptionLogId, plan }: Props) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [accumulatedSec, setAccumulatedSec] = useState(0);
  const startTimeRef = useRef(Date.now());
  const [defects, setDefects] = useState<Defect[]>([]);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [showDefectForm, setShowDefectForm] = useState(false);
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null);
  const [showPauseForm, setShowPauseForm] = useState(false);
  const [completing, setCompleting] = useState(false);

  // 累積時間を取得
  useEffect(() => {
    fetch(`/api/work/${planId}/elapsed`)
      .then((r) => r.json())
      .then((data) => setAccumulatedSec(data.accumulatedSeconds ?? 0));
  }, [planId]);

  // localStorageから不具合を復元
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY(planId));
    if (stored) {
      try { setDefects(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [planId]);

  // タイマー（累積時間 + 今回の経過時間）
  useEffect(() => {
    const interval = setInterval(() => {
      const nowElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(accumulatedSec + nowElapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [accumulatedSec]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const isOverTime = elapsed > 20 * 60;

  const saveDefects = useCallback((newDefects: Defect[]) => {
    setDefects(newDefects);
    localStorage.setItem(STORAGE_KEY(planId), JSON.stringify(newDefects));
  }, [planId]);

  const handleDiagramTap = (x: number, y: number) => {
    setPendingPin({ x, y });
    setShowDefectForm(true);
  };

  const handleDefectPinTap = (id: string) => {
    setSelectedDefectId(id);
  };

  const handleAddDefect = (partial: Omit<Defect, "id" | "locationX" | "locationY">) => {
    if (!pendingPin) return;
    const newDefects = [
      ...defects,
      { ...partial, id: crypto.randomUUID(), locationX: pendingPin.x, locationY: pendingPin.y },
    ];
    saveDefects(newDefects);
    setShowDefectForm(false);
    setPendingPin(null);
  };

  const handleCancelDefectForm = () => {
    setShowDefectForm(false);
    setPendingPin(null);
  };

  const handleRemoveDefect = (id: string) => {
    saveDefects(defects.filter((d) => d.id !== id));
    setSelectedDefectId(null);
  };

  const handlePause = async (reason: string) => {
    const res = await fetch(`/api/work/${planId}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId, interruptionReason: reason }),
    });
    if (res.ok) router.push("/dashboard");
  };

  const handleComplete = async () => {
    setCompleting(true);

    // 写真をアップロードしてURLに変換
    const defectsWithUrls = await Promise.all(
      defects.map(async (d) => {
        if (!d.photoDataUrl) return d;
        try {
          const blob = dataUrlToBlob(d.photoDataUrl);
          const formData = new FormData();
          formData.append("file", blob, `defect-${d.id}.jpg`);
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          if (res.ok) {
            const { url } = await res.json();
            return { ...d, photoUrl: url, photoDataUrl: undefined };
          }
        } catch { /* ignore */ }
        return { ...d, photoDataUrl: undefined };
      })
    );

    const res = await fetch(`/api/work/${planId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId, interruptionLogId, defects: defectsWithUrls }),
    });

    if (res.ok) {
      localStorage.removeItem(STORAGE_KEY(planId));
      const data = await res.json();
      router.push(`/work/${planId}/complete?reportId=${data.reportId}`);
    } else {
      setCompleting(false);
    }
  };

  const selectedDefect = defects.find((d) => d.id === selectedDefectId) ?? null;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-green-700 text-white px-4 py-3">
        <p className="text-xs opacity-75">作業中</p>
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg">{PROCESS_LABEL[plan.processType] ?? "点検"}</h1>
          <p className="text-sm opacity-90">{plan.vehicle.modelName} / {plan.vehicle.exteriorColor}</p>
        </div>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* タイマー */}
        <div className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">経過時間（累計）</p>
            <p className={`text-3xl font-mono font-bold ${isOverTime ? "text-red-600" : "text-gray-800"}`}>
              {formatElapsed(elapsed)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">標準時間</p>
            <p className="text-sm text-gray-600">20分</p>
            {isOverTime && <p className="text-xs text-red-500 font-medium mt-0.5">超過中</p>}
          </div>
        </div>

        {/* 展開図 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-800 text-sm">車両展開図</h2>
            {defects.length > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                不具合 {defects.length}件
              </span>
            )}
          </div>
          <VehicleDiagram
            defects={defects.map((d, i) => ({
              id: d.id,
              x: d.locationX,
              y: d.locationY,
              severity: d.severity,
              index: i + 1,
            }))}
            pendingPin={pendingPin ?? undefined}
            onLocationClick={handleDiagramTap}
            onDefectClick={handleDefectPinTap}
          />
        </div>

        {/* 不具合一覧 */}
        {defects.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-800 text-sm mb-2">不具合一覧</h2>
            <div className="space-y-2">
              {defects.map((d, i) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 border border-gray-100 rounded-lg p-2 cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedDefectId(d.id)}
                >
                  <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full text-white shrink-0 ${
                    d.severity === "A" ? "bg-yellow-500" :
                    d.severity === "B" ? "bg-orange-500" : "bg-red-500"
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{d.defectType}</p>
                    <p className="text-xs text-gray-500">程度{d.severity} / 補修 {d.repairMinutes}分</p>
                  </div>
                  {d.photoDataUrl && (
                    <img src={d.photoDataUrl} alt="写真" className="w-10 h-10 object-cover rounded shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 操作ボタン */}
        <div className="flex gap-3 pb-6">
          <button
            onClick={() => setShowPauseForm(true)}
            className="flex-1 bg-white border-2 border-yellow-400 text-yellow-600 py-4 rounded-xl font-bold hover:bg-yellow-50 transition"
          >
            一時中断
          </button>
          <button
            onClick={handleComplete}
            disabled={completing}
            className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {completing ? "保存中..." : "点検完了"}
          </button>
        </div>
      </main>

      {/* 不具合入力フォーム */}
      {showDefectForm && pendingPin && (
        <DefectForm
          onSave={handleAddDefect}
          onClose={handleCancelDefectForm}
        />
      )}

      {/* 不具合詳細モーダル */}
      {selectedDefect && (
        <DefectDetail
          defect={selectedDefect}
          index={defects.findIndex((d) => d.id === selectedDefect.id) + 1}
          onDelete={() => handleRemoveDefect(selectedDefect.id)}
          onClose={() => setSelectedDefectId(null)}
        />
      )}

      {/* 一時中断フォーム */}
      {showPauseForm && (
        <PauseForm onPause={handlePause} onClose={() => setShowPauseForm(false)} />
      )}
    </div>
  );
}

// ---- 不具合入力フォーム（タップ後） ----
function DefectForm({
  onSave,
  onClose,
}: {
  onSave: (d: Omit<Defect, "id" | "locationX" | "locationY">) => void;
  onClose: () => void;
}) {
  const [defectType, setDefectType] = useState("");
  const [severity, setSeverity] = useState<"A" | "B" | "C">("B");
  const [repairMinutes, setRepairMinutes] = useState(30);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 800;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!defectType) return;
    onSave({ defectType, severity, repairMinutes, photoDataUrl });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="font-bold text-gray-800 text-lg">不具合を記録</h3>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* 種類 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              不具合種類 <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {DEFECT_TYPES.map((type) => (
                <button key={type} type="button" onClick={() => setDefectType(type)}
                  className={`text-sm py-2 px-4 rounded-full border transition ${
                    defectType === type
                      ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                      : "border-gray-200 text-gray-600"
                  }`}>{type}</button>
              ))}
            </div>
          </div>

          {/* 程度 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">不具合程度</p>
            <div className="flex gap-2">
              {(["A", "B", "C"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSeverity(s)}
                  className={`flex-1 py-3 rounded-lg border font-bold transition ${
                    severity === s
                      ? s === "A" ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                        : s === "B" ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-200 text-gray-500"
                  }`}>{s}</button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">A: 軽微　B: 中程度　C: 重大</p>
          </div>

          {/* 補修見込み時間 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">補修見込み時間</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {REPAIR_MINUTES_PRESETS.map((m) => (
                <button key={m} type="button" onClick={() => setRepairMinutes(m)}
                  className={`text-sm py-2 px-4 rounded-full border transition ${
                    repairMinutes === m
                      ? "border-green-500 bg-green-50 text-green-700 font-medium"
                      : "border-gray-200 text-gray-600"
                  }`}>{m}分</button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRepairMinutes(Math.max(0, repairMinutes - 5))}
                className="w-10 h-10 rounded-full border border-gray-300 text-lg font-bold text-gray-600 hover:bg-gray-50"
              >−</button>
              <span className="text-2xl font-bold text-gray-800 w-20 text-center">{repairMinutes}分</span>
              <button
                type="button"
                onClick={() => setRepairMinutes(repairMinutes + 5)}
                className="w-10 h-10 rounded-full border border-gray-300 text-lg font-bold text-gray-600 hover:bg-gray-50"
              >＋</button>
            </div>
          </div>

          {/* 写真撮影 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">写真（任意）</p>
            {photoDataUrl ? (
              <div className="relative">
                <img src={photoDataUrl} alt="不具合写真" className="w-full h-40 object-cover rounded-xl" />
                <button
                  onClick={() => setPhotoDataUrl(undefined)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
                >×</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-5 flex flex-col items-center gap-1 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition"
              >
                <span className="text-3xl">📷</span>
                <span className="text-sm">カメラで撮影</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!defectType}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-medium disabled:opacity-40 transition text-base"
          >
            展開図に登録
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- 不具合詳細モーダル ----
function DefectDetail({
  defect,
  index,
  onDelete,
  onClose,
}: {
  defect: Defect;
  index: number;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full text-white ${
              defect.severity === "A" ? "bg-yellow-500" :
              defect.severity === "B" ? "bg-orange-500" : "bg-red-500"
            }`}>{index}</span>
            <h3 className="font-bold text-gray-800 text-lg">{defect.defectType}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        <div className="space-y-2 mb-5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">程度</span>
            <span className="font-medium">
              {defect.severity === "A" ? "A（軽微）" : defect.severity === "B" ? "B（中程度）" : "C（重大）"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">補修見込み</span>
            <span className="font-medium">{defect.repairMinutes}分</span>
          </div>
        </div>

        {defect.photoDataUrl && (
          <img src={defect.photoDataUrl} alt="不具合写真" className="w-full h-48 object-cover rounded-xl mb-4" />
        )}

        <button
          onClick={onDelete}
          className="w-full border border-red-300 text-red-500 py-3 rounded-xl font-medium hover:bg-red-50 transition"
        >
          この不具合を削除
        </button>
      </div>
    </div>
  );
}

// ---- 一時中断フォーム ----
function PauseForm({ onPause, onClose }: { onPause: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const QUICK_REASONS = ["班長対応", "緊急補修", "部品待ち", "休憩", "その他"];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg">一時中断</h3>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-3">中断理由を選択または入力してください</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)}
              className={`text-sm py-1.5 px-3 rounded-full border transition ${
                reason === r ? "border-yellow-500 bg-yellow-50 text-yellow-700 font-medium" : "border-gray-200 text-gray-600"
              }`}>{r}</button>
          ))}
        </div>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="その他の理由を入力"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
        <button
          onClick={() => { if (reason.trim()) onPause(reason.trim()); }}
          disabled={!reason.trim()}
          className="w-full bg-yellow-500 text-white py-3 rounded-xl font-medium disabled:opacity-40 transition"
        >
          中断してダッシュボードに戻る
        </button>
      </div>
    </div>
  );
}

// ---- ユーティリティ ----
function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}
