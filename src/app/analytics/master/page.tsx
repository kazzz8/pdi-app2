"use client";

import { useEffect, useState } from "react";

type QualityCheckType = "CHECKBOX" | "PHOTO" | "TEXT";

type QualityCheckItem = {
  id: string;
  label: string;
  checkType: QualityCheckType;
  description: string | null;
  sortOrder: number;
};

type DressUpItem = {
  id: string;
  name: string;
  code: string;
  qualityCheckLinks: {
    qualityCheckItemId: string;
    sortOrder: number;
    qualityCheckItem: QualityCheckItem;
  }[];
};

const CHECK_TYPE_LABELS: Record<QualityCheckType, string> = {
  CHECKBOX: "チェック",
  PHOTO: "写真必須",
  TEXT: "入力必須",
};

const CHECK_TYPE_COLORS: Record<QualityCheckType, string> = {
  CHECKBOX: "bg-blue-100 text-blue-700",
  PHOTO: "bg-green-100 text-green-700",
  TEXT: "bg-orange-100 text-orange-700",
};

export default function MasterPage() {
  const [dressUpItems, setDressUpItems] = useState<DressUpItem[]>([]);
  const [allCheckItems, setAllCheckItems] = useState<QualityCheckItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 新規部品フォーム
  const [newItemName, setNewItemName] = useState("");
  const [newItemCode, setNewItemCode] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // 新規チェック項目フォーム
  const [showCheckForm, setShowCheckForm] = useState(false);
  const [newCheckLabel, setNewCheckLabel] = useState("");
  const [newCheckType, setNewCheckType] = useState<QualityCheckType>("CHECKBOX");
  const [newCheckDesc, setNewCheckDesc] = useState("");
  const [savingCheck, setSavingCheck] = useState(false);

  const fetchAll = async () => {
    const [itemsRes, checkRes] = await Promise.all([
      fetch("/api/analytics/master/dress-up-items"),
      fetch("/api/analytics/master/quality-check-items"),
    ]);
    const [itemsData, checkData] = await Promise.all([itemsRes.json(), checkRes.json()]);
    setDressUpItems(itemsData.items ?? []);
    setAllCheckItems(checkData.items ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAddItem = async () => {
    if (!newItemName.trim() || !newItemCode.trim()) return;
    setAddingItem(true);
    await fetch("/api/analytics/master/dress-up-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newItemName.trim(), code: newItemCode.trim() }),
    });
    setNewItemName("");
    setNewItemCode("");
    setAddingItem(false);
    await fetchAll();
  };

  const handleAddCheckItem = async () => {
    if (!newCheckLabel.trim()) return;
    setSavingCheck(true);
    await fetch("/api/analytics/master/quality-check-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newCheckLabel.trim(), checkType: newCheckType, description: newCheckDesc.trim() || undefined }),
    });
    setNewCheckLabel("");
    setNewCheckType("CHECKBOX");
    setNewCheckDesc("");
    setShowCheckForm(false);
    setSavingCheck(false);
    await fetchAll();
  };

  const handleLink = async (qualityCheckItemId: string) => {
    if (!selectedItemId) return;
    const selected = dressUpItems.find(i => i.id === selectedItemId);
    const alreadyLinked = selected?.qualityCheckLinks.some(l => l.qualityCheckItemId === qualityCheckItemId);
    if (alreadyLinked) return;
    await fetch("/api/analytics/master/quality-check-items/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dressUpItemId: selectedItemId, qualityCheckItemId }),
    });
    await fetchAll();
  };

  const handleUnlink = async (qualityCheckItemId: string) => {
    if (!selectedItemId) return;
    await fetch("/api/analytics/master/quality-check-items/link", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dressUpItemId: selectedItemId, qualityCheckItemId }),
    });
    await fetchAll();
  };

  const selectedItem = dressUpItems.find(i => i.id === selectedItemId);
  const linkedIds = new Set(selectedItem?.qualityCheckLinks.map(l => l.qualityCheckItemId) ?? []);

  if (loading) return <div className="p-8 text-gray-500">読み込み中...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ドレスアップ マスタ管理</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左ペイン: 部品一覧 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 mb-3">ドレスアップ部品</h2>
            <div className="flex gap-2">
              <input
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder="部品名（例: ETC取付）"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <input
                value={newItemCode}
                onChange={e => setNewItemCode(e.target.value)}
                placeholder="コード（例: ETC）"
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <button
                onClick={handleAddItem}
                disabled={addingItem || !newItemName.trim() || !newItemCode.trim()}
                className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-purple-700 transition"
              >
                追加
              </button>
            </div>
          </div>
          <ul className="divide-y divide-gray-50">
            {dressUpItems.map(item => (
              <li
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={`px-4 py-3 cursor-pointer flex items-center justify-between transition ${
                  selectedItemId === item.id ? "bg-purple-50 border-l-4 border-purple-500" : "hover:bg-gray-50"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.code}</p>
                </div>
                <span className="text-xs text-gray-400">{item.qualityCheckLinks.length}項目</span>
              </li>
            ))}
            {dressUpItems.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-400">部品がありません</li>
            )}
          </ul>
        </div>

        {/* 右ペイン: チェック項目 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">
              {selectedItem ? `「${selectedItem.name}」のチェック項目` : "部品を選択してください"}
            </h2>
          </div>

          {selectedItem && (
            <>
              {/* 紐付き済みチェック項目 */}
              <div className="p-4 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-2 font-medium">紐付き済み</p>
                {selectedItem.qualityCheckLinks.length === 0 ? (
                  <p className="text-sm text-gray-400">チェック項目がありません</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedItem.qualityCheckLinks.map(link => (
                      <li key={link.qualityCheckItemId} className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHECK_TYPE_COLORS[link.qualityCheckItem.checkType]}`}>
                            {CHECK_TYPE_LABELS[link.qualityCheckItem.checkType]}
                          </span>
                          <span className="text-sm text-gray-700">{link.qualityCheckItem.label}</span>
                        </div>
                        <button
                          onClick={() => handleUnlink(link.qualityCheckItemId)}
                          className="text-xs text-red-400 hover:text-red-600 transition"
                        >
                          解除
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 全チェック項目バンク */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium">チェック項目バンク（クリックで紐付け）</p>
                  <button
                    onClick={() => setShowCheckForm(!showCheckForm)}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                  >
                    + 新規作成
                  </button>
                </div>

                {showCheckForm && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                    <input
                      value={newCheckLabel}
                      onChange={e => setNewCheckLabel(e.target.value)}
                      placeholder="チェック項目名"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <div className="flex gap-2">
                      {(["CHECKBOX", "PHOTO", "TEXT"] as QualityCheckType[]).map(t => (
                        <button
                          key={t}
                          onClick={() => setNewCheckType(t)}
                          className={`flex-1 text-xs py-1.5 rounded-lg border transition font-medium ${
                            newCheckType === t ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500"
                          }`}
                        >
                          {CHECK_TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                    <input
                      value={newCheckDesc}
                      onChange={e => setNewCheckDesc(e.target.value)}
                      placeholder="補足説明（任意）"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowCheckForm(false)} className="flex-1 text-sm py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition">キャンセル</button>
                      <button
                        onClick={handleAddCheckItem}
                        disabled={savingCheck || !newCheckLabel.trim()}
                        className="flex-1 text-sm py-2 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-40 hover:bg-purple-700 transition"
                      >
                        作成して紐付け
                      </button>
                    </div>
                  </div>
                )}

                <ul className="space-y-1.5">
                  {allCheckItems.map(item => {
                    const linked = linkedIds.has(item.id);
                    return (
                      <li
                        key={item.id}
                        onClick={() => !linked && handleLink(item.id)}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 transition ${
                          linked ? "bg-gray-100 cursor-default opacity-50" : "bg-white border border-gray-200 cursor-pointer hover:border-purple-300 hover:bg-purple-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHECK_TYPE_COLORS[item.checkType]}`}>
                            {CHECK_TYPE_LABELS[item.checkType]}
                          </span>
                          <span className="text-sm text-gray-700">{item.label}</span>
                        </div>
                        {linked ? (
                          <span className="text-xs text-gray-400">紐付済</span>
                        ) : (
                          <span className="text-xs text-purple-500">+ 紐付け</span>
                        )}
                      </li>
                    );
                  })}
                  {allCheckItems.length === 0 && (
                    <li className="text-sm text-gray-400 text-center py-3">チェック項目がありません</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
