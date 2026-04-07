export const DRESS_UP_CHECKLIST_ITEMS = [
  "フロアマット取付",
  "ラゲッジマット取付",
  "ドアバイザー取付",
  "マッドガード取付",
  "スカッフプレート取付",
];

/** WorkLog.notes（DRESS_UP完了ログ）からチェック済み項目を集計する */
export function aggregateDressUpItems(
  logs: { status: string; processType: string; notes: string | null }[]
): string[] {
  const completed = new Set<string>();
  for (const log of logs) {
    if (log.status !== "COMPLETED" || log.processType !== "DRESS_UP" || !log.notes) continue;
    try {
      const parsed = JSON.parse(log.notes) as { dressUpItems?: string[] };
      if (Array.isArray(parsed.dressUpItems)) {
        parsed.dressUpItems.forEach((item) => completed.add(item));
      }
    } catch { /* ignore */ }
  }
  return Array.from(completed);
}

/** 全チェック項目が揃っているか */
export function isAllDressUpDone(completedItems: string[]): boolean {
  return DRESS_UP_CHECKLIST_ITEMS.every((item) => completedItems.includes(item));
}
