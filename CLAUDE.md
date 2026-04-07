# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # 開発サーバー起動 (localhost:3000)
npm run build        # prisma generate → next build
npm run lint         # ESLint
npx tsx prisma/seed.ts          # シードデータ投入（架空データ300台）
npx prisma migrate dev --name <name>  # スキーマ変更後のマイグレーション
npx prisma generate              # Prismaクライアント再生成（マイグレーション後に必要）
```

**スキーマ変更時の必須手順：** `migrate dev` → `prisma generate` → **dev サーバー再起動**（シングルトンキャッシュのため HMR では反映されない）

## Architecture Overview

マツダロジスティクス向け新車PDI（Pre-Delivery Inspection）作業管理アプリ。スマホブラウザで現場作業者が使うPWA。

### 認証・アクセス制御

- **NextAuth.js**（JWT戦略）。社員番号＋パスワードでログイン。
- `src/proxy.ts` がミドルウェアとして動作し、未認証は `/login` へリダイレクト。`/analytics` と `/monitor` は `MANAGER` / `TEAM_LEADER` のみアクセス可。
- セッションは `session.user.role`（`GENERAL` / `TEAM_LEADER` / `MANAGER`）と `teamId` を含む。

### 画面構成（2系統）

**① 現場作業者向け（スマホ）**
- `/dashboard` — 今日の作業一覧。WorkPlan を表示し、開始・再開ボタン
- `/work/[planId]` — バーコードスキャンで車両確認してから作業開始
- `/work/[planId]/active` — 作業中画面。工程タイプで表示コンポーネントを切り替え（現状 L/S 点検は `LInspectionWork`、他工程も同コンポーネント使用）
- `/work/[planId]/complete` — 完了サマリー

**② 管理者・班長向け（PC）**
- `/analytics/overview` — 工場概況ダッシュボード（KPI・グラフ群）
- `/monitor` — 大型モニター用フルスクリーン表示
- `src/app/analytics/layout.tsx` でサイドナビ（`AnalyticsNav`）を注入。役割チェックもここで実施。

### データモデルの核

```
Vehicle → WorkPlan → WorkLog
                  ↘ InspectionReport → Defect
```

- **WorkPlan**：計画システムからインポートする1件の作業計画（車両×工程×担当者×計画時刻）
- **WorkLog**：pdi-app2 アプリで記録する実績（開始・終了・ステータス）
- **DailySchedule**：1日1レコード。`endHour`/`endMinute`（15分刻み）と `totalVehicles`（当日処理台数の分母）を保持。管理者が3ヶ月先まで登録し、将来は計画システムから自動連携予定。

### Prisma の設定

- クライアントは `src/generated/prisma/` に出力（`@/generated/prisma/client`）
- シングルトンは `src/lib/prisma.ts`（`globalThis` キャッシュ）
- DB: PostgreSQL。`prisma.config.ts` で接続設定。

### 分析API の設計

`/api/analytics/progress` が大型モニターと overview ページ両方で使われる。

- **案Q（現行）**：`totalVehicles × ORDER_RATES[processType]` で各工程の計画台数を算出
- **案P（将来）**：WorkPlan の DB 件数をそのまま使う

切り替えは `route.ts` の `plannedCount` 算出箇所1行のみ。`ORDER_RATES` は以下：
`WASH:100%, POLISH:95%, L_INSPECTION:90%, REPAIR:30%, RUST_PREVENTION:10%, DRESS_UP:80%, COATING:40%, FINAL_INSPECTION:100%`

### 作業フロー（状態遷移）

```
WorkLog.status: ACTIVE → PAUSED → ACTIVE（再開）→ COMPLETED
```

一時中断時は中断理由を `WorkLog.notes` に記録。再開時は新しい WorkLog を作成し `interruptionLogId` をクエリパラメータで引き回す。タイマーは `/api/work/[planId]/elapsed` で累積秒数を取得。

### 参考資料

`参考資料/既存社内システムデータ/` に社内計画システムのサンプルCSV（Shift-JIS）あり。スキーマ理解の参照用。読む際は `iconv-lite`（node_modules に存在）でデコードする。
