"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { put } from "@vercel/blob";

type CheckType = "CHECKBOX" | "PHOTO" | "TEXT";

type CheckItem = {
  id: string;
  label: string;
  checkType: CheckType;
  description: string | null;
  sortOrder: number;
};

type ResultState = {
  passed?: boolean;
  photoUrl?: string;
  textValue?: string;
};

type Props = {
  planId: string;
  vehicle: { modelName: string | null; exteriorColor: string | null };
};

export default function DressUpQualityCheck({ planId, vehicle }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);
  const [results, setResults] = useState<Record<string, ResultState>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/work/${planId}/quality-check`)
      .then(r => r.json())
      .then(data => {
        if (!data.sessionId || data.checkItems.length === 0) {
          // チェック項目なし → 完了画面へスキップ
          router.replace(`/work/${planId}/complete?processType=DRESS_UP`);
          return;
        }
        setSessionId(data.sessionId);
        setCheckItems(data.checkItems);
        // 既存の回答をロード
        const initial: Record<string, ResultState> = {};
        for (const [id, val] of Object.entries(data.existingResults ?? {})) {
          const v = val as ResultState;
          initial[id] = {
            passed: v.passed ?? undefined,
            photoUrl: v.photoUrl ?? undefined,
            textValue: v.textValue ?? undefined,
          };
        }
        setResults(initial);
        setLoading(false);
      });
  }, [planId, router]);

  const setResult = (itemId: string, patch: Partial<ResultState>) => {
    setResults(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  };

  const isAnswered = (item: CheckItem): boolean => {
    const r = results[item.id] ?? {};
    if (item.checkType === "CHECKBOX") return r.passed !== undefined;
    if (item.checkType === "PHOTO") return !!r.photoUrl;
    if (item.checkType === "TEXT") return !!(r.textValue?.trim());
    return false;
  };

  const allAnswered = checkItems.length > 0 && checkItems.every(isAnswered);
  const answeredCount = checkItems.filter(isAnswered).length;

  const handlePhotoCapture = (itemId: string) => {
    pendingItemIdRef.current = itemId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const itemId = pendingItemIdRef.current;
    if (!file || !itemId) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const maxSize = 800;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async blob => {
          if (!blob) return;
          setUploadingId(itemId);
          try {
            const filename = `quality-check/${planId}/${itemId}-${Date.now()}.jpg`;
            const { url } = await put(filename, blob, { access: "public" });
            setResult(itemId, { photoUrl: url });
            // 途中保存
            if (sessionId) {
              await fetch(`/api/work/${planId}/quality-check`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, checkItemId: itemId, photoUrl: url }),
              });
            }
          } finally {
            setUploadingId(null);
            pendingItemIdRef.current = null;
          }
        }, "image/jpeg", 0.7);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleComplete = async () => {
    if (!sessionId || !allAnswered) return;
    setCompleting(true);

    const resultList = checkItems.map(item => ({
      checkItemId: item.id,
      passed: results[item.id]?.passed,
      photoUrl: results[item.id]?.photoUrl,
      textValue: results[item.id]?.textValue,
    }));

    const res = await fetch(`/api/work/${planId}/quality-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, results: resultList }),
    });

    if (res.ok) {
      router.push(`/work/${planId}/complete?processType=DRESS_UP`);
    } else {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-purple-700 text-white px-4 py-3">
        <p className="text-xs opacity-75">品質チェック</p>
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg">取付確認チェック</h1>
          <p className="text-sm opacity-90">{vehicle.modelName} / {vehicle.exteriorColor}</p>
        </div>
      </header>

      {/* 進捗バー */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${checkItems.length > 0 ? (answeredCount / checkItems.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-sm text-gray-600 shrink-0 font-medium">
          {answeredCount} / {checkItems.length} 完了
        </span>
      </div>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {checkItems.map(item => {
          const answered = isAnswered(item);
          const r = results[item.id] ?? {};
          const isUploading = uploadingId === item.id;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl p-4 shadow-sm border transition ${
                answered ? "border-purple-200" : "border-gray-100"
              }`}
            >
              <div className="flex items-start gap-2 mb-3">
                <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold mt-0.5 transition ${
                  answered ? "bg-purple-600 border-purple-600 text-white" : "border-gray-300"
                }`}>
                  {answered ? "✓" : ""}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{item.label}</p>
                  {item.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                  )}
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                  item.checkType === "CHECKBOX" ? "bg-blue-100 text-blue-700" :
                  item.checkType === "PHOTO" ? "bg-green-100 text-green-700" :
                  "bg-orange-100 text-orange-700"
                }`}>
                  {item.checkType === "CHECKBOX" ? "チェック" :
                   item.checkType === "PHOTO" ? "写真必須" : "入力必須"}
                </span>
              </div>

              {/* CHECKBOX */}
              {item.checkType === "CHECKBOX" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setResult(item.id, { passed: true })}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition ${
                      r.passed === true
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-500 hover:border-green-300"
                    }`}
                  >
                    ○ 問題なし
                  </button>
                  <button
                    onClick={() => setResult(item.id, { passed: false })}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition ${
                      r.passed === false
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-500 hover:border-red-300"
                    }`}
                  >
                    × 問題あり
                  </button>
                </div>
              )}

              {/* PHOTO */}
              {item.checkType === "PHOTO" && (
                <div>
                  {r.photoUrl ? (
                    <div className="flex gap-3 items-center">
                      <img
                        src={r.photoUrl}
                        alt="チェック写真"
                        className="w-20 h-20 object-cover rounded-lg border border-purple-200"
                      />
                      <button
                        onClick={() => handlePhotoCapture(item.id)}
                        className="text-sm text-purple-600 underline"
                      >
                        撮り直す
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePhotoCapture(item.id)}
                      disabled={isUploading}
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 flex items-center justify-center gap-2 hover:border-purple-400 hover:text-purple-600 transition disabled:opacity-40"
                    >
                      {isUploading ? (
                        <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>📷 写真を撮影</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* TEXT */}
              {item.checkType === "TEXT" && (
                <input
                  type="text"
                  value={r.textValue ?? ""}
                  onChange={e => setResult(item.id, { textValue: e.target.value })}
                  placeholder="値を入力してください"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              )}
            </div>
          );
        })}

        <div className="pb-6">
          <button
            onClick={handleComplete}
            disabled={!allAnswered || completing}
            className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-40 hover:bg-purple-700 transition"
          >
            {completing ? "保存中..." : "チェック完了"}
          </button>
          {!allAnswered && (
            <p className="text-center text-xs text-gray-400 mt-2">
              すべての項目に回答してください
            </p>
          )}
        </div>
      </main>

      {/* 隠しfileInput（カメラ） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
