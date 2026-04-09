"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { DRESS_UP_CHECKLIST_ITEMS } from "@/lib/dressup";

type Props = {
  planId: string;
  logId: string;
  interruptionLogId?: string;
  plan: {
    processType: string;
    vehicle: { barcode: string; modelName: string | null; exteriorColor: string | null };
    completedItems?: string[];
  };
};

type PhotoItem = {
  id: string;
  url: string;
  caption: string | null;
  checklistItem: string | null;
  takenAt: string;
};

const STANDARD_MINUTES = 60;
const STORAGE_KEY = (planId: string) => `pdi-dressup-${planId}`;

export default function DressUpWork({ planId, logId, interruptionLogId, plan }: Props) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const [accumulatedSec, setAccumulatedSec] = useState(0);
  const startTimeRef = useRef(Date.now());
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [showPauseForm, setShowPauseForm] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // 写真関連
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null); // アップロード中の項目名
  const [captionTarget, setCaptionTarget] = useState<PhotoItem | null>(null);
  // 各項目のfileInputRefをまとめて管理
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingItemRef = useRef<string | null>(null);

  // 累積時間を取得
  useEffect(() => {
    fetch(`/api/work/${planId}/elapsed`)
      .then((r) => r.json())
      .then((data) => setAccumulatedSec(data.accumulatedSeconds ?? 0));
  }, [planId]);

  // 写真一覧を取得
  useEffect(() => {
    fetch(`/api/work/${planId}/photos`)
      .then((r) => r.json())
      .then((data) => setPhotos(data.photos ?? []));
  }, [planId]);

  // 初期チェック状態
  useEffect(() => {
    if (initialized) return;
    const serverItems = plan.completedItems ?? [];
    const stored = localStorage.getItem(STORAGE_KEY(planId));
    let localItems: string[] = [];
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        localItems = parsed.checkedItems ?? [];
        setNotes(parsed.notes ?? "");
      } catch { /* ignore */ }
    }
    setCheckedItems(new Set([...serverItems, ...localItems]));
    setInitialized(true);
  }, [planId, plan.completedItems, initialized]);

  // タイマー
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

  const isOverTime = elapsed > STANDARD_MINUTES * 60;
  const prevWorkerItems = new Set(plan.completedItems ?? []);

  const saveToStorage = (items: Set<string>, currentNotes: string) => {
    localStorage.setItem(
      STORAGE_KEY(planId),
      JSON.stringify({ checkedItems: Array.from(items), notes: currentNotes })
    );
  };

  const handleToggle = (item: string) => {
    if (prevWorkerItems.has(item)) return;
    const next = new Set(checkedItems);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setCheckedItems(next);
    saveToStorage(next, notes);
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    saveToStorage(checkedItems, value);
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
    const res = await fetch(`/api/work/${planId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logId,
        interruptionLogId,
        completedItems: Array.from(checkedItems),
        notes: notes || undefined,
      }),
    });
    if (res.ok) {
      localStorage.removeItem(STORAGE_KEY(planId));
      router.push(`/work/${planId}/complete?processType=DRESS_UP`);
    } else {
      setCompleting(false);
    }
  };

  // 写真撮影→リサイズ→アップロード
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const itemName = pendingItemRef.current;
    if (!file || !itemName) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const maxSize = 800;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
          if (!blob) return;
          setUploadingItem(itemName);
          try {
            const formData = new FormData();
            formData.append("file", blob, `work-photo-${Date.now()}.jpg`);
            formData.append("checklistItem", itemName);
            const res = await fetch(`/api/work/${planId}/photos`, {
              method: "POST",
              body: formData,
            });
            if (res.ok) {
              const data = await res.json();
              setPhotos((prev) => [...prev, data.photo]);
            }
          } finally {
            setUploadingItem(null);
            pendingItemRef.current = null;
          }
        }, "image/jpeg", 0.7);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const triggerCamera = (itemName: string) => {
    pendingItemRef.current = itemName;
    photoInputRefs.current[itemName]?.click();
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm("この写真を削除しますか？")) return;
    const res = await fetch(`/api/work/${planId}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
  };

  const handleSaveCaption = async (photoId: string, caption: string) => {
    const res = await fetch(`/api/work/${planId}/photos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId, caption }),
    });
    if (res.ok) {
      const data = await res.json();
      setPhotos((prev) => prev.map((p) => (p.id === photoId ? data.photo : p)));
    }
    setCaptionTarget(null);
  };

  // 項目ごとの写真
  const photosByItem = (itemName: string) =>
    photos.filter((p) => p.checklistItem === itemName);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-purple-700 text-white px-4 py-3">
        <p className="text-xs opacity-75">作業中</p>
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg">ドレスアップ</h1>
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
            <p className="text-sm text-gray-600">{STANDARD_MINUTES}分</p>
            {isOverTime && <p className="text-xs text-red-500 font-medium mt-0.5">超過中</p>}
          </div>
        </div>

        {/* チェックリスト（各項目に写真機能を統合） */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 text-sm">作業チェックリスト</h2>
            <span className="text-xs text-gray-400">{checkedItems.size} / {DRESS_UP_CHECKLIST_ITEMS.length}</span>
          </div>
          <div className="space-y-3">
            {DRESS_UP_CHECKLIST_ITEMS.map((item) => {
              const checked = checkedItems.has(item);
              const byPrevWorker = prevWorkerItems.has(item);
              const itemPhotos = photosByItem(item);
              const isUploading = uploadingItem === item;

              return (
                <div key={item} className={`rounded-xl border transition ${
                  byPrevWorker ? "border-gray-100 opacity-60" :
                  checked ? "border-purple-200 bg-purple-50" :
                  "border-gray-100 bg-gray-50"
                }`}>
                  {/* チェック行 */}
                  <div className="flex items-center gap-3 px-3 py-3">
                    <button
                      onClick={() => handleToggle(item)}
                      disabled={byPrevWorker}
                      className="shrink-0"
                    >
                      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition ${
                        checked
                          ? "bg-purple-600 border-purple-600 text-white"
                          : "border-gray-300 text-transparent"
                      }`}>✓</span>
                    </button>

                    <span
                      onClick={() => handleToggle(item)}
                      className={`flex-1 text-sm font-medium cursor-pointer select-none ${
                        checked ? "text-purple-800 line-through" : "text-gray-700"
                      } ${byPrevWorker ? "cursor-default" : ""}`}
                    >
                      {item}
                    </span>

                    {byPrevWorker && (
                      <span className="text-xs text-gray-400 shrink-0">前作業者済</span>
                    )}

                    {/* カメラボタン */}
                    <button
                      onClick={() => triggerCamera(item)}
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

                    {/* 各項目用の隠しinput（1つ共有） */}
                    <input
                      ref={(el) => { photoInputRefs.current[item] = el; }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </div>

                  {/* 項目ごとのサムネイル */}
                  {itemPhotos.length > 0 && (
                    <div className="px-3 pb-3 space-y-2">
                      {itemPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative w-full flex gap-3 items-start bg-white rounded-xl border border-purple-100 p-2"
                        >
                          <button
                            onClick={() => setCaptionTarget(photo)}
                            className="flex gap-3 items-start flex-1 text-left active:bg-purple-50 transition rounded-lg"
                          >
                            <img
                              src={photo.url}
                              alt={photo.caption ?? item}
                              className="w-16 h-16 object-cover rounded-lg border border-purple-200 shrink-0"
                            />
                            <div className="flex-1 min-w-0 py-0.5">
                              {photo.caption ? (
                                <p className="text-sm text-gray-700 font-medium">{photo.caption}</p>
                              ) : (
                                <p className="text-sm text-gray-400 italic">タップしてメモを追加...</p>
                              )}
                              <p className="text-xs text-gray-300 mt-1">
                                {new Date(photo.takenAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 撮影
                              </p>
                            </div>
                          </button>
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500 transition text-xs font-bold"
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
          </div>
        </div>

        {/* メモ */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-800 text-sm mb-2">メモ（任意）</h2>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="特記事項があれば入力"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
          />
        </div>

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
            className="flex-1 bg-purple-600 text-white py-4 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-40 transition"
          >
            {completing ? "保存中..." : "作業完了"}
          </button>
        </div>
      </main>

      {/* 一時中断フォーム */}
      {showPauseForm && (
        <PauseForm onPause={handlePause} onClose={() => setShowPauseForm(false)} />
      )}

      {/* キャプション編集モーダル */}
      {captionTarget && (
        <CaptionModal
          photo={captionTarget}
          onSave={(caption) => handleSaveCaption(captionTarget.id, caption)}
          onClose={() => setCaptionTarget(null)}
        />
      )}
    </div>
  );
}

// ---- キャプション編集モーダル ----
function CaptionModal({
  photo,
  onSave,
  onClose,
}: {
  photo: PhotoItem;
  onSave: (caption: string) => void;
  onClose: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">写真メモ</h3>
            {photo.checklistItem && (
              <p className="text-xs text-purple-600 mt-0.5">{photo.checklistItem}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>
        <img
          src={photo.url}
          alt="作業写真"
          className="w-full h-48 object-cover rounded-xl mb-4"
        />
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="例: 接続確認済み、左右均等に固定"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400"
          autoFocus
        />
        <button
          onClick={() => onSave(caption)}
          className="w-full bg-purple-600 text-white py-3 rounded-xl font-medium transition hover:bg-purple-700"
        >
          保存
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
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`text-sm py-1.5 px-3 rounded-full border transition ${
                reason === r ? "border-yellow-500 bg-yellow-50 text-yellow-700 font-medium" : "border-gray-200 text-gray-600"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="その他の理由を入力"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
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
