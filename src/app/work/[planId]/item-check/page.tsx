"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// ─── 用品チェックリスト定義（将来は複数用品に対応） ───────────────

const ITEM_CHECKS = [
  {
    itemName: "ドアバイザー取付け",
    checks: [
      { id: "scratch",  label: "傷が無いか" },
      { id: "position", label: "位置ズレが発生していないか" },
      { id: "gap",      label: "浮き/隙がないか（雨が漏れます）" },
    ],
  },
];

type PhotoEntry = {
  id: string;
  url: string;
  checklistItem: string;
};

const STORAGE_KEY = (planId: string) => `pdi-dressup-${planId}`;

export default function ItemCheckPage() {
  const { planId } = useParams<{ planId: string }>();
  const searchParams  = useSearchParams();
  const router        = useRouter();

  const logId              = searchParams.get("logId") ?? "";
  const interruptionLogId  = searchParams.get("interruptionLogId") ?? undefined;

  // 現在は1用品のみ
  const currentItem = ITEM_CHECKS[0];

  const [checked,   setChecked]   = useState<Set<string>>(new Set());
  const [photos,    setPhotos]    = useState<PhotoEntry[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const pendingCheckId = useRef<string | null>(null);

  // 既存写真を取得
  useEffect(() => {
    fetch(`/api/work/${planId}/photos`)
      .then((r) => r.json())
      .then((data) => {
        const checkIds = new Set(currentItem.checks.map((c) => c.id));
        setPhotos(
          (data.photos ?? []).filter((p: PhotoEntry) => checkIds.has(p.checklistItem))
        );
      });
  }, [planId]);

  const allChecked = currentItem.checks.every((c) => checked.has(c.id));

  const handleToggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ─── 写真撮影 ───────────────────────────────────────────────────
  const triggerCamera = (checkId: string) => {
    pendingCheckId.current = checkId;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file   = e.target.files?.[0];
    const checkId = pendingCheckId.current;
    if (!file || !checkId) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas  = document.createElement("canvas");
        const maxSize = 800;
        const ratio   = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width  = img.width  * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
          if (!blob) return;
          setUploading(checkId);
          try {
            const formData = new FormData();
            formData.append("file", blob, `item-check-${Date.now()}.jpg`);
            formData.append("checklistItem", checkId);
            const res = await fetch(`/api/work/${planId}/photos`, {
              method: "POST",
              body: formData,
            });
            if (res.ok) {
              const data = await res.json();
              setPhotos((prev) => [...prev, data.photo]);
            }
          } finally {
            setUploading(null);
            pendingCheckId.current = null;
          }
        }, "image/jpeg", 0.7);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm("この写真を削除しますか？")) return;
    const res = await fetch(`/api/work/${planId}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });
    if (res.ok) setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  // ─── 作業完了 ───────────────────────────────────────────────────
  const handleComplete = async () => {
    if (!allChecked || completing) return;
    setCompleting(true);

    // localStorageからドレスアップオーダーの作業内容を取得
    let completedItems: string[] = [];
    let notes: string | undefined;
    try {
      const stored = localStorage.getItem(STORAGE_KEY(planId));
      if (stored) {
        const parsed = JSON.parse(stored);
        completedItems = parsed.checkedItems ?? [];
        notes = parsed.notes || undefined;
      }
    } catch { /* ignore */ }

    const res = await fetch(`/api/work/${planId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logId,
        interruptionLogId: interruptionLogId || undefined,
        completedItems,
        notes,
      }),
    });

    if (res.ok) {
      localStorage.removeItem(STORAGE_KEY(planId));
      router.push(`/work/${planId}/complete?processType=DRESS_UP`);
    } else {
      setCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-purple-700 text-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="opacity-80 hover:opacity-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-xs opacity-75">取付確認チェック</p>
            <h1 className="font-bold text-lg">{currentItem.itemName}</h1>
          </div>
        </div>
      </header>

      {/* 進捗バー */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${(checked.size / currentItem.checks.length) * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-600 shrink-0 font-medium">
          {checked.size} / {currentItem.checks.length} 完了
        </span>
      </div>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-3">

        {/* チェック項目 */}
        {currentItem.checks.map((check) => {
          const isChecked   = checked.has(check.id);
          const isUploading = uploading === check.id;
          const itemPhotos  = photos.filter((p) => p.checklistItem === check.id);

          return (
            <div
              key={check.id}
              className={`bg-white rounded-xl border transition ${
                isChecked ? "border-purple-200 bg-purple-50" : "border-gray-100"
              }`}
            >
              {/* チェック行 */}
              <div className="flex items-center gap-3 px-4 py-4">
                <button onClick={() => handleToggle(check.id)} className="shrink-0">
                  <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold transition ${
                    isChecked
                      ? "bg-purple-600 border-purple-600 text-white"
                      : "border-gray-300 text-transparent"
                  }`}>✓</span>
                </button>

                <span
                  onClick={() => handleToggle(check.id)}
                  className={`flex-1 text-sm font-medium cursor-pointer select-none ${
                    isChecked ? "text-purple-800" : "text-gray-700"
                  }`}
                >
                  {check.label}
                </span>

                {/* カメラボタン */}
                <button
                  onClick={() => triggerCamera(check.id)}
                  disabled={isUploading}
                  className={`shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                    itemPhotos.length > 0
                      ? "border-purple-300 bg-purple-100 text-purple-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-purple-300 hover:text-purple-600"
                  } disabled:opacity-40`}
                >
                  {isUploading ? (
                    <span className="w-3.5 h-3.5 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>📷</span>
                  )}
                  {itemPhotos.length > 0 && (
                    <span className="font-medium">{itemPhotos.length}</span>
                  )}
                </button>
              </div>

              {/* サムネイル */}
              {itemPhotos.length > 0 && (
                <div className="px-4 pb-3 flex gap-2 flex-wrap">
                  {itemPhotos.map((photo) => (
                    <div key={photo.id} className="relative">
                      <img
                        src={photo.url}
                        alt={check.label}
                        className="w-20 h-20 object-cover rounded-lg border border-purple-200"
                      />
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-gray-600 text-white text-xs font-bold hover:bg-red-500 transition"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* 作業完了ボタン */}
        <div className="pb-8 pt-2">
          <button
            onClick={handleComplete}
            disabled={!allChecked || completing}
            className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold text-base hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {completing ? "保存中..." : "作業完了"}
          </button>
          {!allChecked && (
            <p className="text-center text-xs text-gray-400 mt-2">
              すべての項目を確認してください
            </p>
          )}
        </div>

      </main>

      {/* 隠し file input */}
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
