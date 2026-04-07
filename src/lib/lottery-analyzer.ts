import { LotteryDraw, LotteryMode, NumberStats, PairStats, AnalysisResult } from '@/types/lottery';
import { differenceInDays, parseISO, addDays } from 'date-fns';

export const DATA_URL = 'https://raw.githubusercontent.com/khiemdoan/vietnam-lottery-xsmb-analysis/refs/heads/main/data/xsmb-2-digits.json';

/** All 27 numbers from a draw (Lô mode) */
export function getAllNumbers(draw: LotteryDraw): number[] {
  return [
    draw.special, draw.prize1,
    draw.prize2_1, draw.prize2_2,
    draw.prize3_1, draw.prize3_2, draw.prize3_3, draw.prize3_4, draw.prize3_5, draw.prize3_6,
    draw.prize4_1, draw.prize4_2, draw.prize4_3, draw.prize4_4,
    draw.prize5_1, draw.prize5_2, draw.prize5_3, draw.prize5_4, draw.prize5_5, draw.prize5_6,
    draw.prize6_1, draw.prize6_2, draw.prize6_3,
    draw.prize7_1, draw.prize7_2, draw.prize7_3, draw.prize7_4,
  ];
}

/** Mode-aware numbers: Lô=all 27, Đề=special only */
export function getDrawNumbers(draw: LotteryDraw, mode: LotteryMode = 'lo'): number[] {
  if (mode === 'de') return [draw.special];
  return [...new Set(getAllNumbers(draw))];
}

export function getNumberPosition(draw: LotteryDraw, num: number): string[] {
  const positions: string[] = [];
  if (draw.special === num) positions.push('ĐB');
  if (draw.prize1 === num) positions.push('G1');
  if (draw.prize2_1 === num || draw.prize2_2 === num) positions.push('G2');
  if ([draw.prize3_1, draw.prize3_2, draw.prize3_3, draw.prize3_4, draw.prize3_5, draw.prize3_6].includes(num)) positions.push('G3');
  if ([draw.prize4_1, draw.prize4_2, draw.prize4_3, draw.prize4_4].includes(num)) positions.push('G4');
  if ([draw.prize5_1, draw.prize5_2, draw.prize5_3, draw.prize5_4, draw.prize5_5, draw.prize5_6].includes(num)) positions.push('G5');
  if ([draw.prize6_1, draw.prize6_2, draw.prize6_3].includes(num)) positions.push('G6');
  if ([draw.prize7_1, draw.prize7_2, draw.prize7_3, draw.prize7_4].includes(num)) positions.push('G7');
  return positions;
}

export function getNextDrawDate(draws: LotteryDraw[]): Date {
  if (draws.length === 0) return addDays(new Date(), 1);
  const sorted = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return addDays(parseISO(sorted[sorted.length - 1].date), 1);
}

// ── Analysis ──────────────────────────────────────────────────────────────

export function analyzeData(draws: LotteryDraw[], daysToAnalyze: number = 365, mode: LotteryMode = 'lo'): AnalysisResult {
  const allDraws = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let recentDraws = allDraws;
  if (daysToAnalyze > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToAnalyze);
    recentDraws = allDraws.filter(d => new Date(d.date) >= cutoff);
  }
  const totalDraws = recentDraws.length;
  if (totalDraws === 0) return emptyResult();

  const pairCounts: Record<string, number> = {};
  const pairLastDate: Record<string, string> = {};
  if (mode === 'lo') {
    recentDraws.forEach(draw => {
      const nums = [...new Set(getAllNumbers(draw))];
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const key = `${Math.min(nums[i], nums[j])}-${Math.max(nums[i], nums[j])}`;
          pairCounts[key] = (pairCounts[key] || 0) + 1;
          if (!pairLastDate[key] || draw.date > pairLastDate[key]) pairLastDate[key] = draw.date;
        }
      }
    });
  }

  const numberStats: NumberStats[] = [];

  for (let n = 0; n <= 99; n++) {
    const appearances: string[] = [];
    let maxConsecStreak = 0, curConsecStreak = 0;
    const positionsCounts: Record<string, number> = {};

    for (const draw of recentDraws) {
      const nums = getDrawNumbers(draw, mode);
      const appeared = nums.includes(n);
      if (appeared) {
        appearances.push(draw.date);
        curConsecStreak++;
        maxConsecStreak = Math.max(maxConsecStreak, curConsecStreak);
        if (mode === 'lo') {
          getNumberPosition(draw, n).forEach(p => { positionsCounts[p] = (positionsCounts[p] || 0) + 1; });
        } else {
          positionsCounts['ĐB'] = (positionsCounts['ĐB'] || 0) + 1;
        }
      } else {
        curConsecStreak = 0;
      }
    }

    const absenceIntervals: number[] = [];
    let lastIdx = -1, maxAbsenceStreak = 0, curAbsenceStreak = 0;
    for (let i = 0; i < allDraws.length; i++) {
      if (getDrawNumbers(allDraws[i], mode).includes(n)) {
        if (lastIdx >= 0) absenceIntervals.push(i - lastIdx - 1);
        maxAbsenceStreak = Math.max(maxAbsenceStreak, curAbsenceStreak);
        curAbsenceStreak = 0;
        lastIdx = i;
      } else {
        curAbsenceStreak++;
      }
    }
    maxAbsenceStreak = Math.max(maxAbsenceStreak, curAbsenceStreak);
    const avgAbsenceInterval = absenceIntervals.length > 0
      ? absenceIntervals.reduce((a, b) => a + b, 0) / absenceIntervals.length
      : allDraws.length;
    let currentAbsence = 0;
    for (let i = allDraws.length - 1; i >= 0; i--) {
      if (getDrawNumbers(allDraws[i], mode).includes(n)) break;
      currentAbsence++;
    }

    const count = appearances.length;
    const frequency = (count / totalDraws) * 100;
    const lastDate = appearances[appearances.length - 1] || '';

    numberStats.push({
      number: n, count, frequency,
      lastAppeared: lastDate,
      daysSinceLastAppeared: lastDate ? differenceInDays(new Date(), parseISO(lastDate)) : allDraws.length,
      avgInterval: Math.round(avgAbsenceInterval * 10) / 10,
      maxStreak: maxConsecStreak,
      maxAbsenceStreak, currentAbsence,
      positions: Object.entries(positionsCounts).sort((a, b) => b[1] - a[1]).map(([p]) => p),
    });
  }

  const pairStats: PairStats[] = Object.entries(pairCounts)
    .map(([pair, count]) => ({ pair, count, frequency: (count / totalDraws) * 100, lastDate: pairLastDate[pair] || '' }))
    .sort((a, b) => b.count - a.count).slice(0, 50);

  const sorted = [...numberStats].sort((a, b) => b.count - a.count);
  return {
    numberStats,
    topFrequent: sorted.slice(0, 20),
    topAbsent: [...numberStats].sort((a, b) => b.currentAbsence - a.currentAbsence).slice(0, 20),
    hotNumbers: sorted.slice(0, 10).map(n => n.number),
    coldNumbers: [...numberStats].sort((a, b) => b.currentAbsence - a.currentAbsence).slice(0, 10).map(n => n.number),
    pairStats, totalDraws,
    dateRange: { from: recentDraws[0]?.date || '', to: recentDraws[recentDraws.length - 1]?.date || '' },
  };
}

function emptyResult(): AnalysisResult {
  return { numberStats: [], topFrequent: [], topAbsent: [], hotNumbers: [], coldNumbers: [], pairStats: [], totalDraws: 0, dateRange: { from: '', to: '' } };
}

// ── Prediction engine ──────────────────────────────────────────────────────

export interface MethodScore {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  detail: string;
}

export interface PredictionScore {
  number: number;
  score: number;       // 0-100 normalized
  rawScore: number;    // sum of contributions before normalize
  grade: 'A+' | 'A' | 'B' | 'C';
  reasons: string[];
  explanation: string;
  methods: MethodScore[];
}

// ── Lô weights total = 1.00 ──
const LO_METHODS_META = {
  m1Weight: 0.18,  // Momentum 7kỳ
  m2Weight: 0.15,  // Tần suất 30kỳ
  m3Weight: 0.10,  // Tần suất 90kỳ
  m4Weight: 0.22,  // Áp lực vắng mặt
  m5Weight: 0.08,  // Ngày trong tuần
  m6Weight: 0.08,  // Markov
  m7Weight: 0.07,  // Xu hướng
  m8Weight: 0.04,  // Giải ĐB/G1
  m9Weight: 0.04,  // Đồng xuất hiện
  m10Weight: 0.03, // Bayes
  m11Weight: 0.05, // Trọng số thời gian
  m12Weight: 0.06, // Max vắng LS
};

// ── Đề weights: 12 core + 6 special = total 1.28 → normalize ──
const DE_METHODS_META = {
  m1Weight: 0.08,   // Momentum 7kỳ
  m2Weight: 0.10,   // Tần suất 30kỳ
  m3Weight: 0.06,   // Tần suất 90kỳ
  m4Weight: 0.22,   // Áp lực vắng mặt (most important)
  m5Weight: 0.07,   // Ngày trong tuần
  m6Weight: 0.07,   // Markov
  m7Weight: 0.05,   // Xu hướng
  m8Weight: 0.05,   // Giải ĐB bias (more relevant for Đề)
  m9Weight: 0.08,   // Phân tích chữ số (replaces pair in Đề)
  m10Weight: 0.03,  // Bayes
  m11Weight: 0.04,  // Trọng số thời gian
  m12Weight: 0.07,  // Max vắng LS
  m13Weight: 0.05,  // Số gương (mirror)
  m14Weight: 0.05,  // Nhóm thập phân (decade rotation)
  m15Weight: 0.05,  // Tổng chữ số (digit sum)
  m16Weight: 0.05,  // Số kề giải ĐB gần nhất (adjacency)
  m17Weight: 0.04,  // Chu kỳ chuẩn lệch (cycle std dev)
  m18Weight: 0.04,  // Cuối kỳ liên tiếp (same last-digit streak)
};

/**
 * 12-method Lô / 18-method Đề ensemble prediction.
 * Đề mode returns 40 numbers by default.
 */
export function generatePredictions(draws: LotteryDraw[], count: number = 27, mode: LotteryMode = 'lo'): PredictionScore[] {
  if (draws.length === 0) return [];

  const sorted = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextDrawDate = addDays(parseISO(sorted[sorted.length - 1].date), 1);
  const nextDow = nextDrawDate.getDay();
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  const last7 = sorted.slice(-7);
  const last14 = sorted.slice(-14);
  const last30 = sorted.slice(-30);
  const last60 = sorted.slice(-60);
  const last90 = sorted.slice(-90);
  const last365 = sorted.slice(-365);
  const allDraws = sorted;

  // Markov
  const markovHit = new Array(100).fill(0);
  const markovTotal = new Array(100).fill(0);
  for (let i = 1; i < allDraws.length; i++) {
    const prevNums = new Set(getDrawNumbers(allDraws[i - 1], mode));
    const currNums = new Set(getDrawNumbers(allDraws[i], mode));
    prevNums.forEach(pn => {
      markovTotal[pn]++;
      if (currNums.has(pn)) markovHit[pn]++;
    });
  }

  const hitCount = (pool: LotteryDraw[], n: number) =>
    pool.filter(d => getDrawNumbers(d, mode).includes(n)).length;
  const freq = (pool: LotteryDraw[], n: number) =>
    pool.length === 0 ? 0 : (hitCount(pool, n) / pool.length) * 100;

  // ── Đề-specific precomputed data ──────────────────────────────
  // Precompute last-digit frequencies in recent specials
  const lastDigitCount30: number[] = new Array(10).fill(0);
  const firstDigitCount30: number[] = new Array(10).fill(0);
  last30.forEach(d => {
    lastDigitCount30[d.special % 10]++;
    firstDigitCount30[Math.floor(d.special / 10)]++;
  });

  // Digit sum frequencies (0–18)
  const digitSumCount30: number[] = new Array(19).fill(0);
  last30.forEach(d => {
    const s = Math.floor(d.special / 10) + (d.special % 10);
    digitSumCount30[s]++;
  });

  // Decade frequencies (0–9 representing 00-09, 10-19, ..., 90-99)
  const decadeCount30: number[] = new Array(10).fill(0);
  last30.forEach(d => { decadeCount30[Math.floor(d.special / 10)]++; });

  // Recent special values (last 5)
  const recentSpecials = allDraws.slice(-5).map(d => d.special);
  const latestSpecial = recentSpecials[recentSpecials.length - 1];

  const scores: PredictionScore[] = [];
  const W = mode === 'de' ? DE_METHODS_META : LO_METHODS_META;
  const totalWeight = Object.values(W).reduce((a, b) => a + b, 0);

  for (let n = 0; n <= 99; n++) {
    const methods: MethodScore[] = [];

    // ── M1: Momentum 7 kỳ ──────────────────────────────────────
    const f7 = freq(last7, n);
    methods.push({ name: 'Momentum 7 kỳ', weight: W.m1Weight, score: f7, contribution: f7 * W.m1Weight, detail: `${hitCount(last7, n)}/${last7.length} kỳ gần nhất` });

    // ── M2: Tần suất 30 kỳ ─────────────────────────────────────
    const f30 = freq(last30, n);
    methods.push({ name: 'Tần suất 30 kỳ', weight: W.m2Weight, score: f30, contribution: f30 * W.m2Weight, detail: `${hitCount(last30, n)} lần / 30 kỳ` });

    // ── M3: Tần suất 90 kỳ ─────────────────────────────────────
    const f90 = freq(last90, n);
    methods.push({ name: 'Tần suất 90 kỳ', weight: W.m3Weight, score: f90, contribution: f90 * W.m3Weight, detail: `${hitCount(last90, n)} lần / 90 kỳ` });

    // ── M4: Áp lực vắng mặt ────────────────────────────────────
    const absIntervals: number[] = [];
    let lastIdx = -1, currentAbsence = 0;
    for (let i = 0; i < allDraws.length; i++) {
      if (getDrawNumbers(allDraws[i], mode).includes(n)) {
        if (lastIdx >= 0) absIntervals.push(i - lastIdx - 1);
        lastIdx = i; currentAbsence = 0;
      } else { currentAbsence++; }
    }
    const avgInterval = absIntervals.length > 0 ? absIntervals.reduce((a, b) => a + b, 0) / absIntervals.length
      : (mode === 'de' ? 100 : 30);
    const maxAbsence = absIntervals.length > 0 ? Math.max(...absIntervals) : currentAbsence;
    const dueRatio = currentAbsence / Math.max(avgInterval, 1);
    const m4score = Math.min(100, Math.pow(Math.max(0, dueRatio), 1.3) * 45);
    methods.push({
      name: 'Áp lực vắng mặt', weight: W.m4Weight, score: m4score, contribution: m4score * W.m4Weight,
      detail: currentAbsence === 0 ? 'Vừa xuất hiện kỳ trước' : `Vắng ${currentAbsence}k | TB=${avgInterval.toFixed(0)}k | Max=${maxAbsence}k | ${(dueRatio * 100).toFixed(0)}%`,
    });

    // ── M5: Ngày trong tuần ─────────────────────────────────────
    const dowDraws = allDraws.filter(d => new Date(d.date).getDay() === nextDow);
    const dowHits = dowDraws.filter(d => getDrawNumbers(d, mode).includes(n)).length;
    const dowRate = dowDraws.length > 0 ? (dowHits / dowDraws.length) * 100 : 0;
    methods.push({ name: 'Ngày trong tuần', weight: W.m5Weight, score: dowRate, contribution: dowRate * W.m5Weight, detail: `${days[nextDow]}: ${dowHits}/${dowDraws.length} = ${dowRate.toFixed(1)}%` });

    // ── M6: Markov ─────────────────────────────────────────────
    const latestNums = new Set(getDrawNumbers(allDraws[allDraws.length - 1], mode));
    const markovScore = markovTotal[n] > 0 ? (markovHit[n] / markovTotal[n]) * 100 : 30;
    const appearedLast = latestNums.has(n);
    const m6score = appearedLast ? markovScore : (100 - markovScore) * 0.5;
    methods.push({ name: 'Markov (kỳ trước)', weight: W.m6Weight, score: m6score, contribution: m6score * W.m6Weight, detail: appearedLast ? `Có kỳ trước, P(tái)=${markovScore.toFixed(1)}%` : `Vắng kỳ trước` });

    // ── M7: Xu hướng MA ─────────────────────────────────────────
    const f15 = freq(sorted.slice(-15), n);
    const f45 = freq(sorted.slice(-45), n);
    const trend = f15 - f45;
    const trendScore = Math.max(0, Math.min(100, 50 + trend * 2));
    methods.push({ name: 'Xu hướng MA15/45', weight: W.m7Weight, score: trendScore, contribution: trendScore * W.m7Weight, detail: trend > 3 ? `📈 +${trend.toFixed(1)}pp` : trend < -3 ? `📉 ${trend.toFixed(1)}pp` : `➡️ Ổn định` });

    // ── M8: Giải ĐB bias ────────────────────────────────────────
    const specialCount365 = last365.filter(d => d.special === n).length;
    const prize1Count365 = mode === 'lo' ? last365.filter(d => d.prize1 === n).length : 0;
    const m8score = Math.min(100, (specialCount365 * 4 + prize1Count365 * 2) / Math.max(last365.length, 1) * 400);
    methods.push({ name: mode === 'de' ? 'Tần suất 365 kỳ (ĐB)' : 'Giải ĐB/G1 bias', weight: W.m8Weight, score: m8score, contribution: m8score * W.m8Weight, detail: `ĐB: ${specialCount365} lần${mode === 'lo' ? ` | G1: ${prize1Count365}` : ''} / 365kỳ` });

    // ── M9: Đồng xuất hiện (Lô) / Phân tích chữ số (Đề) ────────
    let m9score: number;
    let m9detail: string;
    if (mode === 'lo') {
      let coScore = 0;
      latestNums.forEach(rn => {
        if (rn === n) return;
        coScore += last60.filter(d => { const ns = getAllNumbers(d); return ns.includes(n) && ns.includes(rn); }).length;
      });
      m9score = Math.min(100, coScore * 1.5);
      m9detail = `Đồng xuất ${Math.round(m9score / 1.5)} lần với kỳ trước (60kỳ)`;
    } else {
      // Đề: digit analysis — last digit hot + first digit hot
      const lastD = n % 10;
      const firstD = Math.floor(n / 10);
      const lastDRate = (lastDigitCount30[lastD] / last30.length) * 10 * 100; // × 10 since each digit ~ 1/10
      const firstDRate = (firstDigitCount30[firstD] / last30.length) * 10 * 100;
      m9score = Math.min(100, lastDRate * 0.6 + firstDRate * 0.4);
      m9detail = `Đuôi ${lastD}: ${lastDigitCount30[lastD]}/${last30.length}kỳ | Đầu ${firstD}: ${firstDigitCount30[firstD]}/${last30.length}kỳ`;
    }
    methods.push({ name: mode === 'lo' ? 'Đồng xuất hiện cặp' : 'Phân tích chữ số', weight: W.m9Weight, score: m9score, contribution: m9score * W.m9Weight, detail: m9detail });

    // ── M10: Bayes posterior ────────────────────────────────────
    const priorAlpha = mode === 'de' ? 1 : 27;
    const priorBeta = mode === 'de' ? 99 : 73;
    const obs14 = hitCount(last14, n);
    const bayesPost = (priorAlpha + obs14) / (priorAlpha + priorBeta + last14.length) * 100;
    methods.push({ name: 'Bayes posterior', weight: W.m10Weight, score: bayesPost, contribution: bayesPost * W.m10Weight, detail: `Prior ${mode === 'de' ? '1%' : '27%'} + ${obs14}/${last14.length} QS = ${bayesPost.toFixed(1)}%` });

    // ── M11: Trọng số thời gian (exp decay) ─────────────────────
    let rwf = 0;
    const decayBase = 0.93;
    for (let i = 0; i < last30.length; i++) {
      const w = Math.pow(decayBase, last30.length - 1 - i);
      if (getDrawNumbers(last30[i], mode).includes(n)) rwf += w;
    }
    const rwfMax = (1 - Math.pow(decayBase, last30.length)) / (1 - decayBase);
    const m11score = Math.min(100, (rwf / rwfMax) * 100);
    methods.push({ name: 'Trọng số thời gian', weight: W.m11Weight, score: m11score, contribution: m11score * W.m11Weight, detail: `Decay ${decayBase}` });

    // ── M12: So sánh max vắng LS ───────────────────────────────
    const maxEver = Math.max(...absIntervals, currentAbsence, 1);
    const extremeRatio = currentAbsence / maxEver;
    const m12score = Math.min(100, extremeRatio * 80);
    methods.push({ name: 'So sánh max vắng LS', weight: W.m12Weight, score: m12score, contribution: m12score * W.m12Weight, detail: `${currentAbsence}k / Max ${maxEver}k = ${(extremeRatio * 100).toFixed(0)}%` });

    // ── ĐỀ-SPECIFIC METHODS (M13–M18) ────────────────────────────
    if (mode === 'de') {
      const deW = W as typeof DE_METHODS_META;

      // ── M13: Số gương (mirror number) ─────────────────────────
      // Correlation: if mirror(n) appeared recently, n might follow
      const mirror = (n % 10) * 10 + Math.floor(n / 10); // e.g., 27→72
      const mirrorAbsIntervals: number[] = [];
      let mLastIdx = -1;
      for (let i = 0; i < allDraws.length; i++) {
        if (allDraws[i].special === mirror) {
          if (mLastIdx >= 0) mirrorAbsIntervals.push(i - mLastIdx - 1);
          mLastIdx = i;
        }
      }
      const mirrorLastIdx = allDraws.map(d => d.special).lastIndexOf(mirror);
      const mirrorGap = mirrorLastIdx >= 0 ? allDraws.length - 1 - mirrorLastIdx : 999;
      // If mirror appeared in last 5-15 draws, correlate strongly
      const m13score = mirrorGap <= 3 ? 70 : mirrorGap <= 8 ? 55 : mirrorGap <= 15 ? 40 : mirrorGap <= 30 ? 30 : 20;
      const isSelf = n === mirror; // palindromes like 00, 11, 22...
      methods.push({ name: 'Số gương (mirror)', weight: deW.m13Weight, score: isSelf ? 45 : m13score, contribution: (isSelf ? 45 : m13score) * deW.m13Weight, detail: isSelf ? `Số gương chính nó` : `Gương ${String(mirror).padStart(2, '0')}: vắng ${mirrorGap}k trước` });

      // ── M14: Nhóm thập phân (decade rotation) ─────────────────
      // Decades that haven't appeared in recent draws have higher pressure
      const myDecade = Math.floor(n / 10);
      const decadeAbsence = (() => {
        for (let i = allDraws.length - 1; i >= 0; i--) {
          if (Math.floor(allDraws[i].special / 10) === myDecade) return allDraws.length - 1 - i;
        }
        return allDraws.length;
      })();
      // Average decade absence = ~10 (each decade appears 1/10 of time)
      const decadeAvgAbsence = allDraws.length / 10;
      const decadeDueRatio = decadeAbsence / decadeAvgAbsence;
      const m14score = Math.min(100, Math.pow(Math.max(0, decadeDueRatio), 1.2) * 40);
      methods.push({ name: 'Áp lực nhóm thập phân', weight: deW.m14Weight, score: m14score, contribution: m14score * deW.m14Weight, detail: `Nhóm ${myDecade * 10}-${myDecade * 10 + 9}: vắng ${decadeAbsence}k | TB≈${decadeAvgAbsence.toFixed(0)}k` });

      // ── M15: Tổng chữ số (digit sum) ──────────────────────────
      // Numbers whose digit sum appeared frequently in recent draws
      const myDigitSum = Math.floor(n / 10) + (n % 10);
      const digitSumRate = (digitSumCount30[myDigitSum] / last30.length) * 100;
      // Expected rate for digit sum S: count of (a,b) pairs with a+b=S, divided by 100
      const digitSumExpected = (() => {
        let cnt = 0;
        for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) if (a + b === myDigitSum) cnt++;
        return cnt;
      })();
      const digitSumOdds = digitSumRate / (digitSumExpected); // relative to expected frequency
      const m15score = Math.min(100, digitSumOdds * 33);
      methods.push({ name: 'Tổng chữ số (digit sum)', weight: deW.m15Weight, score: m15score, contribution: m15score * deW.m15Weight, detail: `Tổng ${myDigitSum}: ${digitSumCount30[myDigitSum]}/${last30.length}kỳ | XS ${digitSumOdds.toFixed(2)}×TB` });

      // ── M16: Số kề giải ĐB gần nhất (adjacency) ───────────────
      // Numbers close (±1, ±2, ±10, ±11) to recent specials have higher correlation
      let adjacencyScore = 0;
      recentSpecials.forEach((sp, i) => {
        const weight = Math.pow(0.75, recentSpecials.length - 1 - i); // more recent = higher weight
        const dist = Math.min(Math.abs(n - sp), 100 - Math.abs(n - sp)); // circular distance
        if (dist === 0) adjacencyScore += 10 * weight; // same number
        else if (dist === 1) adjacencyScore += 40 * weight;
        else if (dist === 2) adjacencyScore += 25 * weight;
        else if (dist === 10) adjacencyScore += 30 * weight; // same last digit, next decade
        else if (dist === 11) adjacencyScore += 20 * weight;
        else if (n % 10 === sp % 10) adjacencyScore += 20 * weight; // same last digit
        else if (Math.floor(n / 10) === Math.floor(sp / 10)) adjacencyScore += 15 * weight; // same decade
      });
      const m16score = Math.min(100, adjacencyScore);
      methods.push({ name: 'Số kề giải ĐB gần nhất', weight: deW.m16Weight, score: m16score, contribution: m16score * deW.m16Weight, detail: `Khoảng cách với ${recentSpecials.slice(-3).map(s => String(s).padStart(2, '0')).join(', ')}` });

      // ── M17: Chu kỳ chuẩn lệch (cycle std dev pressure) ────────
      // If std dev of intervals is low (regular cycle) and current absence matches, boost
      if (absIntervals.length >= 3) {
        const meanInterval = absIntervals.reduce((a, b) => a + b, 0) / absIntervals.length;
        const stdDev = Math.sqrt(absIntervals.reduce((a, b) => a + Math.pow(b - meanInterval, 2), 0) / absIntervals.length);
        const cv = stdDev / Math.max(meanInterval, 1); // Coefficient of variation (lower = more regular)
        const expectedNow = currentAbsence >= meanInterval - 0.5 * stdDev && currentAbsence <= meanInterval + 1.5 * stdDev;
        const m17score = expectedNow ? (1 - cv) * 80 + 20 : 15;
        methods.push({ name: 'Chu kỳ chuẩn lệch', weight: deW.m17Weight, score: Math.min(100, m17score), contribution: Math.min(100, m17score) * deW.m17Weight, detail: `TB=${meanInterval.toFixed(0)}k ±${stdDev.toFixed(0)} (CV=${cv.toFixed(2)}) ${expectedNow ? '→ Đang trong cửa sổ' : '→ Ngoài cửa sổ'}` });
      } else {
        methods.push({ name: 'Chu kỳ chuẩn lệch', weight: deW.m17Weight, score: 30, contribution: 30 * deW.m17Weight, detail: 'Chưa đủ dữ liệu chu kỳ' });
      }

      // ── M18: Cùng đuôi với giải ĐB gần nhất ───────────────────
      // If last special had last digit X, numbers with same last digit have correlation
      const latestLastDigit = latestSpecial % 10;
      const myLastDigit = n % 10;
      const sameLastDigitRecent = last14.filter(d => d.special % 10 === myLastDigit).length;
      const latestFirstDigit = Math.floor(latestSpecial / 10);
      const myFirstDigit = Math.floor(n / 10);
      const sameFirstDigitRecent = last14.filter(d => Math.floor(d.special / 10) === myFirstDigit).length;
      const sameLastDig = myLastDigit === latestLastDigit;
      const sameFirstDig = myFirstDigit === latestFirstDigit;
      const m18score = (sameLastDig ? 60 : 0) + (sameFirstDig ? 30 : 0) + Math.min(30, sameLastDigitRecent * 8) + Math.min(20, sameFirstDigitRecent * 5);
      methods.push({ name: 'Đuôi/Đầu ĐB kỳ trước', weight: deW.m18Weight, score: Math.min(100, m18score), contribution: Math.min(100, m18score) * deW.m18Weight, detail: `ĐB trước=${String(latestSpecial).padStart(2, '0')} | Cùng đuôi ${latestLastDigit}:${sameLastDig ? '✓' : '✗'} | Cùng đầu ${latestFirstDigit}:${sameFirstDig ? '✓' : '✗'}` });
    }

    // ── Total score (normalize by total weight) ─────────────────
    const rawScore = methods.reduce((s, m) => s + m.contribution, 0);
    const normalizedScore = Math.min(100, Math.max(0, (rawScore / totalWeight)));

    const grade: PredictionScore['grade'] = normalizedScore >= 65 ? 'A+' : normalizedScore >= 50 ? 'A' : normalizedScore >= 35 ? 'B' : 'C';

    // Reasons
    const reasons: string[] = [];
    const f7val = freq(last7, n);
    if (f7val >= 40) reasons.push(`Nóng 7kỳ:${f7val.toFixed(0)}%`);
    if (dueRatio >= 0.8) reasons.push(`Vắng ${currentAbsence}k/${(dueRatio * 100).toFixed(0)}%TB`);
    if (trend > 4) reasons.push(`Trend+${trend.toFixed(1)}pp`);
    if (dowRate > 45) reasons.push(`${days[nextDow]}:${dowRate.toFixed(0)}%`);
    if (mode === 'de') {
      if (currentAbsence > 80) reasons.push(`Vắng lâu:${currentAbsence}kỳ`);
      const mirror = (n % 10) * 10 + Math.floor(n / 10);
      if (recentSpecials.slice(-3).includes(mirror)) reasons.push(`Gương ${String(mirror).padStart(2, '0')} vừa ra`);
      if (recentSpecials.slice(-2).includes(n + 1) || recentSpecials.slice(-2).includes(n - 1)) reasons.push('Kề ĐB gần');
    }

    const topMethod = [...methods].sort((a, b) => b.contribution - a.contribution)[0];
    const explanation = reasons.slice(0, 2).join(' • ') || `${topMethod.name}: ${topMethod.score.toFixed(0)}đ`;

    scores.push({ number: n, score: normalizedScore, rawScore, grade, reasons, explanation, methods });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, count);
}

export function formatNumber(n: number): string {
  return n.toString().padStart(2, '0');
}

// ── Đề-specific stats for display ─────────────────────────────────────────

export interface DeStats {
  lastDigitFreq: { digit: number; count: number; rate: number }[];
  firstDigitFreq: { digit: number; count: number; rate: number }[];
  decadeFreq: { decade: string; count: number; rate: number }[];
  digitSumFreq: { sum: number; count: number; rate: number }[];
  recentSpecials: number[];
}

export function getDeStats(draws: LotteryDraw[], recentN: number = 30): DeStats {
  const sorted = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pool = sorted.slice(-recentN);

  const lastDigitFreq = Array.from({ length: 10 }, (_, d) => ({
    digit: d, count: pool.filter(x => x.special % 10 === d).length,
    rate: pool.filter(x => x.special % 10 === d).length / pool.length * 100,
  }));
  const firstDigitFreq = Array.from({ length: 10 }, (_, d) => ({
    digit: d, count: pool.filter(x => Math.floor(x.special / 10) === d).length,
    rate: pool.filter(x => Math.floor(x.special / 10) === d).length / pool.length * 100,
  }));
  const decadeFreq = Array.from({ length: 10 }, (_, d) => ({
    decade: `${d * 10}-${d * 10 + 9}`, count: pool.filter(x => Math.floor(x.special / 10) === d).length,
    rate: pool.filter(x => Math.floor(x.special / 10) === d).length / pool.length * 100,
  }));
  const digitSumFreq = Array.from({ length: 19 }, (_, s) => ({
    sum: s, count: pool.filter(x => Math.floor(x.special / 10) + x.special % 10 === s).length,
    rate: pool.filter(x => Math.floor(x.special / 10) + x.special % 10 === s).length / pool.length * 100,
  }));
  const recentSpecials = sorted.slice(-10).map(d => d.special);

  return { lastDigitFreq, firstDigitFreq, decadeFreq, digitSumFreq, recentSpecials };
}
