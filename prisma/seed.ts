import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────────────────

/** 作業開始時刻（8:15） */
const WORK_START_H = 8;
const WORK_START_M = 15;

/** オーダー率（分母 totalVehicles に対する各工程の処理割合） */
const ORDER_RATES: Record<string, number> = {
  WASH:             1.00,
  POLISH:           0.95,
  L_INSPECTION:     0.90,
  REPAIR:           0.30,
  RUST_PREVENTION:  0.10,
  DRESS_UP:         0.80,
  COATING:          0.40,
  FINAL_INSPECTION: 1.00,
};

/** 工程ごとの標準作業時間（分）— 作業指示CSVの平均値を参考にした架空値 */
const STD_MINUTES: Record<string, number> = {
  WASH:             15,
  POLISH:           35,
  L_INSPECTION:     25,
  REPAIR:           70,
  RUST_PREVENTION:  45,
  DRESS_UP:         60,
  COATING:         110,
  FINAL_INSPECTION: 20,
};

/**
 * ダッシュボードで見せたい偏差
 *   負 = 遅延（実績 < 現時点期待）
 *   正 = 先行（実績 > 現時点期待）
 */
const TARGET_DEVIATION: Record<string, number> = {
  WASH:            -4,
  POLISH:           0,
  L_INSPECTION:    -2,
  REPAIR:           0,
  RUST_PREVENTION:  0,
  DRESS_UP:        +1,
  COATING:         -3,
  FINAL_INSPECTION:-8,
};

/**
 * 架空の車種・色データ（CSVのロット情報から抜粋）
 */
const MODELS = [
  { name: "MAZDA2",  code: "DJLFS" },
  { name: "CX-30",   code: "DM8R"  },
  { name: "MAZDA3",  code: "BP8R"  },
  { name: "CX-5",    code: "KF2P"  },
  { name: "CX-60",   code: "KH3P"  },
  { name: "CX-80",   code: "KL3P"  },
  { name: "ロードスター", code: "ND5R" },
  { name: "フレアW", code: "MS92"  },
];
const COLORS = ["46G","45J","52C","41W","25D","51K","45P","46V","26E","47B",
                "47S","42M","52D","48T","48S","50P","46P","47C","53L","48W"];
const DEF_TYPES  = ["線傷","塗装剥がれ","凹み","汚れ","割れ"];
const LOCATIONS  = [
  "ボンネット","ルーフ","フロントドア左","フロントドア右",
  "リアドア左","リアドア右","バンパー前","バンパー後","フェンダー左",
];

// ─────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────

function dateAt(base: Date, h: number, m = 0, s = 0): Date {
  const d = new Date(base);
  d.setHours(h, m, s, 0);
  return d;
}

function todayAt(h: number, m = 0, s = 0): Date {
  return dateAt(new Date(), h, m, s);
}

function addMin(date: Date, min: number): Date {
  return new Date(date.getTime() + min * 60_000);
}

function daysAgo(n: number, h = 9, m = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d;
}

/** 日付文字列 (YYYY-MM-DD) → その日の 00:00:00 JST */
function startOfDay(offsetDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 各工程のスロットを生成
 * nWorkers 名が workStart から workEnd まで stdMin 分ずつ処理する
 */
function buildSlots(
  nWorkers: number,
  stdMin: number,
  totalVehicles: number,
  workStart: Date,
  workEnd: Date
): { workerIdx: number; start: Date; end: Date }[] {
  const nextFree = Array.from({ length: nWorkers }, () => new Date(workStart));
  const slots: { workerIdx: number; start: Date; end: Date }[] = [];

  for (let i = 0; i < totalVehicles; i++) {
    const w     = i % nWorkers;
    const start = new Date(nextFree[w]);
    const end   = addMin(start, stdMin);
    if (end > workEnd) break;
    slots.push({ workerIdx: w, start, end });
    nextFree[w] = end;
  }
  return slots;
}

// ─────────────────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────────────────

async function main() {
  console.log("シードデータ作成開始\n");
  const NOW = new Date();

  // ── パスワード ──────────────────────────────────────────
  const pw = await bcrypt.hash("password123", 10);
  const upsert = (eid: string, name: string, role: string, teamId?: string) =>
    prisma.user.upsert({
      where:  { employeeId: eid },
      update: {},
      create: {
        employeeId: eid, name, password: pw,
        role: role as "MANAGER" | "TEAM_LEADER" | "GENERAL",
        teamId: teamId ?? null,
      },
    });

  // ── チーム ──────────────────────────────────────────────
  const [tWash, tPolish, tInspect, tRust, tDressup, tCoat, tFinal] = await Promise.all([
    prisma.team.upsert({ where: { name: "洗車班"         }, update: {}, create: { name: "洗車班" } }),
    prisma.team.upsert({ where: { name: "磨き班"         }, update: {}, create: { name: "磨き班" } }),
    prisma.team.upsert({ where: { name: "点検・補修班"   }, update: {}, create: { name: "点検・補修班" } }),
    prisma.team.upsert({ where: { name: "防錆班"         }, update: {}, create: { name: "防錆班" } }),
    prisma.team.upsert({ where: { name: "ドレスアップ班" }, update: {}, create: { name: "ドレスアップ班" } }),
    prisma.team.upsert({ where: { name: "コーティング班" }, update: {}, create: { name: "コーティング班" } }),
    prisma.team.upsert({ where: { name: "完成検査班"     }, update: {}, create: { name: "完成検査班" } }),
  ]);

  // ── ユーザー ────────────────────────────────────────────
  const admin = await upsert("ADMIN001", "管理太郎",             "MANAGER");
  const tl1   = await upsert("TL001",    "班長 田中（完成検査）","TEAM_LEADER", tFinal.id);
  const tl2   = await upsert("TL002",    "班長 鈴木（磨き）",    "TEAM_LEADER", tPolish.id);
  const tl3   = await upsert("TL003",    "班長 佐藤（点検）",    "TEAM_LEADER", tInspect.id);
  const [w1,w2,w3]         = await Promise.all([
    upsert("W001","洗車 山田","GENERAL",tWash.id),
    upsert("W002","洗車 中村","GENERAL",tWash.id),
    upsert("W003","洗車 小林","GENERAL",tWash.id),
  ]);
  const [p1,p2,p3,p4,p5,p6] = await Promise.all([
    upsert("P001","磨き 伊藤", "GENERAL",tPolish.id),
    upsert("P002","磨き 渡辺", "GENERAL",tPolish.id),
    upsert("P003","磨き 山本", "GENERAL",tPolish.id),
    upsert("P004","磨き 中島", "GENERAL",tPolish.id),
    upsert("P005","磨き 小川", "GENERAL",tPolish.id),
    upsert("P006","磨き 松本", "GENERAL",tPolish.id),
  ]);
  const [i1,i2,i3,i4,i5] = await Promise.all([
    upsert("I001","点検 加藤",   "GENERAL",tInspect.id),
    upsert("I002","点検 吉田",   "GENERAL",tInspect.id),
    upsert("I003","点検 佐々木", "GENERAL",tInspect.id),
    upsert("I004","点検 山口",   "GENERAL",tInspect.id),
    upsert("I005","点検 松田",   "GENERAL",tInspect.id),
  ]);
  const [r1,r2,r3] = await Promise.all([
    upsert("RE001","補修 井上","GENERAL",tInspect.id),
    upsert("RE002","補修 木村","GENERAL",tInspect.id),
    upsert("RE003","補修 林",  "GENERAL",tInspect.id),
  ]);
  const [rs1,rs2,rs3,rs4] = await Promise.all([
    upsert("RS001","防錆 清水","GENERAL",tRust.id),
    upsert("RS002","防錆 斎藤","GENERAL",tRust.id),
    upsert("RS003","防錆 坂本","GENERAL",tRust.id),
    upsert("RS004","防錆 原",  "GENERAL",tRust.id),
  ]);
  const [d1,d2,d3] = await Promise.all([
    upsert("D001","ドレスアップ 藤田","GENERAL",tDressup.id),
    upsert("D002","ドレスアップ 岡田","GENERAL",tDressup.id),
    upsert("D003","ドレスアップ 村田","GENERAL",tDressup.id),
  ]);
  const [c1,c2] = await Promise.all([
    upsert("C001","コーティング 高橋","GENERAL",tCoat.id),
    upsert("C002","コーティング 石田","GENERAL",tCoat.id),
  ]);
  const [f1,f2] = await Promise.all([
    upsert("F001","完成検査 橋本","GENERAL",tFinal.id),
    upsert("F002","完成検査 石川","GENERAL",tFinal.id),
  ]);

  // ── 開発用ショートカットユーザー（本番では使用しないこと）──
  const devPw = await bcrypt.hash("2222", 10);
  const devPw2 = await bcrypt.hash("1111", 10);
  await prisma.user.upsert({
    where:  { employeeId: "bbbb" },
    update: { password: devPw },
    create: { employeeId: "bbbb", name: "開発管理者", password: devPw, role: "MANAGER", teamId: null },
  });
  const devWorker = await prisma.user.upsert({
    where:  { employeeId: "aaaa" },
    update: { password: devPw2, teamId: tDressup.id },
    create: { employeeId: "aaaa", name: "開発作業者", password: devPw2, role: "GENERAL", teamId: tDressup.id },
  });

  // 工程 → 担当ワーカー・チーム
  const WORKERS: Record<string, { id: string }[]> = {
    WASH:            [w1,w2,w3],
    POLISH:          [p1,p2,p3,p4,p5,p6],
    L_INSPECTION:    [i1,i2,i3,i4,i5],
    REPAIR:          [r1,r2,r3],
    RUST_PREVENTION: [rs1,rs2,rs3,rs4],
    DRESS_UP:        [d1,d2,d3],
    COATING:         [c1,c2],
    FINAL_INSPECTION:[tl1,f1,f2],
  };
  const TEAM: Record<string, string> = {
    WASH: tWash.id, POLISH: tPolish.id,
    L_INSPECTION: tInspect.id, REPAIR: tInspect.id,
    RUST_PREVENTION: tRust.id,
    DRESS_UP: tDressup.id, COATING: tCoat.id,
    FINAL_INSPECTION: tFinal.id,
  };

  console.log("✓ ユーザー作成完了（管理者1名、班長3名、作業者25名）");

  // ── 既存データ削除 ──────────────────────────────────────
  await prisma.dailySchedule.deleteMany({});
  for (const t of [
    prisma.repairLogDefect, prisma.repairLog, prisma.defect,
    prisma.inspectionReport, prisma.checkResult, prisma.photo,
    prisma.workLog, prisma.workPlan, prisma.vehicleDressUpOrder, prisma.vehicle,
  ]) await (t as { deleteMany: (a?: object) => Promise<unknown> }).deleteMany({});
  console.log("✓ 既存データ削除完了");

  // ── DailySchedule: 今日を含む前後 90 日分 ───────────────
  //   閑散期（10月〜3月）17:00〜18:00
  //   繁忙期（4月〜9月）  18:30〜22:00
  //   週末は終業が早め
  const schedules: {
    date: Date; endHour: number; endMinute: number; totalVehicles: number;
  }[] = [];

  for (let offset = -30; offset <= 90; offset++) {
    const d = startOfDay(offset);
    const month = d.getMonth() + 1; // 1-12
    const dow   = d.getDay();       // 0=日, 6=土
    const isBusy = month >= 4 && month <= 9;
    const isWeekend = dow === 0 || dow === 6;

    let endH: number, endM: number, total: number;
    if (isWeekend) {
      endH = 17; endM = 0; total = 160;
    } else if (isBusy) {
      // 繁忙期：平日は 18:30〜22:00 をランダムに（15分単位）
      const steps = [18*4+2, 18*4+4, 19*4, 19*4+2, 19*4+4, 20*4, 20*4+4, 21*4, 22*4];
      const s = steps[(offset + 90) % steps.length];
      endH = Math.floor(s / 4); endM = (s % 4) * 15; total = 300 + ((offset % 3) * 10);
    } else {
      // 閑散期：平日は 17:00〜18:00
      const steps = [17*4, 17*4+2, 17*4+4, 18*4];
      const s = steps[(offset + 30) % steps.length];
      endH = Math.floor(s / 4); endM = (s % 4) * 15; total = 200 + ((offset % 4) * 15);
    }

    schedules.push({ date: d, endHour: endH, endMinute: endM, totalVehicles: total });
  }

  await prisma.dailySchedule.createMany({ data: schedules });
  console.log(`✓ DailySchedule ${schedules.length} 日分作成`);

  // 今日の設定を取得（終業時刻・分母）
  const todaySchedule = schedules.find((s) => {
    const diff = s.date.getTime() - startOfDay(0).getTime();
    return Math.abs(diff) < 1000;
  });
  const END_H    = todaySchedule?.endHour    ?? 17;
  const END_M    = todaySchedule?.endMinute  ?? 0;
  const TOTAL_V  = todaySchedule?.totalVehicles ?? 300;
  const WORK_END = todayAt(END_H, END_M);
  const WORK_START = todayAt(WORK_START_H, WORK_START_M);

  console.log(`  今日の終業: ${END_H}:${String(END_M).padStart(2,"0")}  処理予定: ${TOTAL_V}台`);

  // ── 車両作成（架空、ただしモデル名・色は実データ参照）───
  const statusDist = [
    ...Array(25).fill("ARRIVED"),
    ...Array(55).fill("IN_STORAGE"),
    ...Array(120).fill("IN_PROCESS"),
    ...Array(60).fill("COMPLETED"),
    ...Array(40).fill("DISPATCHED"),
  ];

  await prisma.vehicle.createMany({
    data: Array.from({ length: 300 }, (_, i) => {
      const model = MODELS[i % MODELS.length];
      const yr = "2026";
      const mo = String(((i % 3) + 2)).padStart(2, "0"); // 02〜04月
      const seq = String(i + 1).padStart(5, "0");
      return {
        serialYear: yr, serialMonth: mo, serialSequence: seq,
        barcode: `${yr}-${mo}-${seq}`,
        modelName: model.name, modelCode: model.code,
        exteriorColor: COLORS[i % COLORS.length],
        inspectionType: (i % 8 === 0 ? "S" : "L") as "L" | "S",
        hasPolish:  i % 20 >= 1,   // 95%
        hasDressUp: i % 5 === 0,   // 20% → DRESS_UP 80%対応は工程計画で制御
        status: (statusDist[i] ?? "IN_STORAGE") as
          "ARRIVED" | "IN_STORAGE" | "IN_PROCESS" | "COMPLETED" | "DISPATCHED",
      };
    }),
  });
  const vehicles = await prisma.vehicle.findMany({ orderBy: { barcode: "asc" } });
  console.log(`✓ 車両 ${vehicles.length} 台作成`);

  // ── 今日の作業計画・ログ生成 ─────────────────────────────

  type Counter = { plans: number; expected: number; completed: number };
  const counters: Record<string, Counter> = {};

  let planSeq = 0; // ワーカーへの車両振り分け用シーケンス

  const PROCESS_ORDER = [
    "WASH","POLISH","L_INSPECTION","REPAIR",
    "RUST_PREVENTION","DRESS_UP","COATING","FINAL_INSPECTION",
  ] as const;

  console.log("\n【今日の工程別実績】");

  for (const processType of PROCESS_ORDER) {
    const rate      = ORDER_RATES[processType] ?? 1;
    const stdMin    = STD_MINUTES[processType] ?? 20;
    const nVehicles = Math.round(TOTAL_V * rate);
    const workers   = WORKERS[processType] ?? [f1];
    const teamId    = TEAM[processType]    ?? tFinal.id;
    const bias      = TARGET_DEVIATION[processType] ?? 0;

    const slots = buildSlots(workers.length, stdMin, nVehicles, WORK_START, WORK_END);

    const counter: Counter = { plans: 0, expected: 0, completed: 0 };
    counters[processType] = counter;

    for (let i = 0; i < slots.length; i++) {
      const slot    = slots[i];
      const vehicle = vehicles[(planSeq + i) % vehicles.length];
      const worker  = workers[slot.workerIdx];

      const plan = await prisma.workPlan.create({
        data: {
          vehicleId:        vehicle.id,
          processType:      processType as Parameters<typeof prisma.workPlan.create>[0]["data"]["processType"],
          teamId,
          assignedWorkerId: worker.id,
          plannedStart:     slot.start,
          plannedEnd:       slot.end,
          standardMinutes:  stdMin,
        },
      });
      counter.plans++;

      const isPast   = slot.end   <= NOW;
      const isActive = slot.start <= NOW && slot.end > NOW;

      if (isPast) {
        counter.expected++;
        // completed < expected + bias を保つ
        if (counter.completed < counter.expected + bias) {
          await prisma.workLog.create({
            data: {
              workPlanId:  plan.id,
              vehicleId:   vehicle.id,
              workerId:    worker.id,
              processType: processType as Parameters<typeof prisma.workLog.create>[0]["data"]["processType"],
              startedAt:   slot.start,
              endedAt:     addMin(slot.end, -((i % 5))),
              status:      "COMPLETED",
              isPlanned:   true,
            },
          });
          counter.completed++;
        }
      } else if (isActive) {
        if (bias > 0 && counter.completed < counter.expected + bias) {
          // 先行：進行中スロットも完了扱い
          await prisma.workLog.create({
            data: {
              workPlanId:  plan.id,
              vehicleId:   vehicle.id,
              workerId:    worker.id,
              processType: processType as Parameters<typeof prisma.workLog.create>[0]["data"]["processType"],
              startedAt:   slot.start,
              endedAt:     addMin(slot.start, (i % 5) + 1),
              status:      "COMPLETED",
              isPlanned:   true,
            },
          });
          counter.completed++;
        } else if (counter.plans <= workers.length * 2) {
          await prisma.workLog.create({
            data: {
              workPlanId:  plan.id,
              vehicleId:   vehicle.id,
              workerId:    worker.id,
              processType: processType as Parameters<typeof prisma.workLog.create>[0]["data"]["processType"],
              startedAt:   slot.start,
              status:      "ACTIVE",
              isPlanned:   true,
            },
          });
        }
      }
    }

    planSeq += slots.length;

    const dev  = counter.completed - counter.expected;
    const mark = Math.abs(dev) <= 1 ? "🟢正常" : dev > 0 ? "🟠先行" : "🔴遅延";
    console.log(
      `  ${processType.padEnd(18)} 計画:${String(counter.plans).padStart(3)}件` +
      `  期待:${String(counter.expected).padStart(3)}台` +
      `  完了:${String(counter.completed).padStart(3)}台` +
      `  偏差:${dev >= 0 ? "+" : ""}${dev}台  ${mark}`
    );
  }

  // ── 過去14日間の実績ログ ────────────────────────────────
  const histWorkers = [w1,w2,p1,p2,p3,i1,i2,rs1,rs2,f1];
  const histTypes   = ["WASH","POLISH","L_INSPECTION","RUST_PREVENTION","FINAL_INSPECTION"] as const;
  let histCount = 0;
  for (let day = 1; day <= 14; day++) {
    for (let k = 0; k < 20; k++) {
      const s = daysAgo(day, 8 + Math.floor((k * 525) / 20 / 60), (Math.floor((k * 525) / 20) % 60) + 15);
      await prisma.workLog.create({
        data: {
          vehicleId:   vehicles[k % vehicles.length].id,
          workerId:    histWorkers[k % histWorkers.length].id,
          processType: histTypes[k % histTypes.length],
          startedAt:   s,
          endedAt:     addMin(s, 20 + (k % 4) * 10),
          status:      "COMPLETED",
          isPlanned:   true,
        },
      });
      histCount++;
    }
  }
  console.log(`\n✓ 過去14日実績ログ ${histCount} 件`);

  // ── 不具合データ ──────────────────────────────────────
  let defCount = 0;
  for (let k = 0; k < 35; k++) {
    const v = vehicles[60 + (k % 50)];
    const report = await prisma.inspectionReport.create({
      data: {
        vehicleId: v.id, workerId: i1.id,
        inspectionType: "L",
        startedAt: todayAt(9), endedAt: todayAt(9, 25),
      },
    });
    const n = (k % 3) + 1;
    for (let d = 0; d < n; d++) {
      const sev = k < 12 ? "A" : k < 26 ? "B" : "C";
      await prisma.defect.create({
        data: {
          inspectionReportId: report.id, vehicleId: v.id,
          location:   LOCATIONS[(k + d) % LOCATIONS.length],
          locationX:  20 + ((k * 7 + d * 13) % 60),
          locationY:  15 + ((k * 11 + d * 7) % 65),
          defectType: DEF_TYPES[(k + d) % DEF_TYPES.length],
          severity:   sev as "A" | "B" | "C",
          repairMinutes: sev === "A" ? 120 : sev === "B" ? 60 : 30,
          status: sev !== "A" && d === 0 && k % 3 === 0 ? "REPAIRED" : "OPEN",
        },
      });
      defCount++;
    }
  }
  console.log(`✓ 不具合 ${defCount} 件`);

  // ── 開発用ユーザー「aaaa」の作業計画（ドレスアップ、1台60分） ──────
  const DEV_STD_MIN = 60;
  const devSlots = buildSlots(1, DEV_STD_MIN, 99, WORK_START, WORK_END);
  const pastDevSlots = devSlots.filter(s => s.end <= NOW);
  const totalPast    = pastDevSlots.length;
  let devPlanCount   = 0;

  for (let i = 0; i < devSlots.length; i++) {
    const slot    = devSlots[i];
    const vehicle = vehicles[(200 + i) % vehicles.length];
    const isPast   = slot.end   <= NOW;
    const isActive = slot.start <= NOW && slot.end > NOW;

    const plan = await prisma.workPlan.create({
      data: {
        vehicleId:        vehicle.id,
        processType:      "DRESS_UP",
        teamId:           tDressup.id,
        assignedWorkerId: devWorker.id,
        plannedStart:     slot.start,
        plannedEnd:       slot.end,
        standardMinutes:  DEV_STD_MIN,
      },
    });
    devPlanCount++;

    if (isPast && i < totalPast - 2) {
      // ──────────────────────────────────────────────
      // 完了ずみスロット
      // i=1: 10分遅れ開始（遅延判定になる）
      // i=2: 中断あり（PAUSED → 再開 → COMPLETED）
      // それ以外: ほぼ計画通り（0〜5分遅れ）
      // ──────────────────────────────────────────────
      if (i === 1) {
        // 10分遅れ開始 → 計画終了より少し遅く完了
        const late = addMin(slot.start, 10);
        await prisma.workLog.create({
          data: {
            workPlanId: plan.id, vehicleId: vehicle.id, workerId: devWorker.id,
            processType: "DRESS_UP",
            startedAt: late, endedAt: addMin(slot.end, 8),
            status: "COMPLETED", isPlanned: true,
          },
        });
      } else if (i === 2) {
        // 途中で中断（20分後に中断→15分後に再開→完了）
        const startedAt    = addMin(slot.start, 3);
        const pausedAt     = addMin(startedAt, 20);
        const resumedAt    = addMin(pausedAt, 15);
        const completedAt  = addMin(resumedAt, 40);
        // 前半ログ: PAUSED
        await prisma.workLog.create({
          data: {
            workPlanId: plan.id, vehicleId: vehicle.id, workerId: devWorker.id,
            processType: "DRESS_UP",
            startedAt, endedAt: pausedAt,
            status: "PAUSED", isPlanned: true, notes: null,
          },
        });
        // 中断ログ: OTHER
        await prisma.workLog.create({
          data: {
            vehicleId: vehicle.id, workerId: devWorker.id,
            processType: "OTHER",
            startedAt: pausedAt, endedAt: resumedAt,
            status: "COMPLETED", isPlanned: false, notes: "部品待ち",
          },
        });
        // 後半ログ: COMPLETED
        await prisma.workLog.create({
          data: {
            workPlanId: plan.id, vehicleId: vehicle.id, workerId: devWorker.id,
            processType: "DRESS_UP",
            startedAt: resumedAt, endedAt: completedAt,
            status: "COMPLETED", isPlanned: true,
          },
        });
      } else {
        // 計画通り（0〜5分遅れ）
        const delay = i % 3 === 0 ? 0 : i % 3 === 1 ? 3 : 5;
        await prisma.workLog.create({
          data: {
            workPlanId: plan.id, vehicleId: vehicle.id, workerId: devWorker.id,
            processType: "DRESS_UP",
            startedAt: addMin(slot.start, delay),
            endedAt:   addMin(slot.end, delay - (i % 4)),
            status: "COMPLETED", isPlanned: true,
          },
        });
      }
    } else if (isActive) {
      // 現在進行中
      await prisma.workLog.create({
        data: {
          workPlanId: plan.id, vehicleId: vehicle.id, workerId: devWorker.id,
          processType: "DRESS_UP",
          startedAt: addMin(slot.start, 2),
          status: "ACTIVE", isPlanned: true,
        },
      });
    }
    // 直近2未着手 + 未来スロット: ログなし
  }
  console.log(`✓ 開発用ユーザー「aaaa」の作業計画 ${devPlanCount} 件`);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 シードデータ作成完了
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ログイン情報（パスワード共通: password123）
   管理者          : ADMIN001
   班長（完成検査）: TL001
   作業者（洗車）  : W001
   作業者（磨き）  : P001
   作業者（点検）  : I001

 開発用ショートカット
   管理者 : bbbb / 2222
   作業者 : aaaa / 1111  （ドレスアップ工程）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
