import { LotteryDraw, NumberStats, PairStats, AnalysisResult } from '@/types/lottery';
import { differenceInDays, parseISO, addDays } from 'date-fns';

export const DATA_URL = 'https://raw.githubusercontent.com/khiemdoan/vietnam-lottery-xsmb-analysis/refs/heads/main/data/xsmb-2-digits.json';

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

export function analyzeData(draws: LotteryDraw[], daysToAnalyze: number = 365): AnalysisResult {
  const allDraws = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let recentDraws = allDraws;
  if (daysToAnalyze > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToAnalyze);
    recentDraws = allDraws.filter(d => new Date(d.date) >= cutoff);
  }
  const totalDraws = recentDraws.length;
  if (totalDraws === 0) return emptyResult();

  const numberStats: NumberStats[] = [];
  const pairCounts: Record<string, number> = {};
  const pairLastDate: Record<string, string> = {};

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

  for (let n = 0; n <= 99; n++) {
    const appearances: string[] = [];
    let maxConsecStreak = 0, curConsecStreak = 0;
    const positionsCounts: Record<string, number> = {};

    for (const draw of recentDraws) {
      const appeared = getAllNumbers(draw).includes(n);
      if (appeared) {
        appearances.push(draw.date);
        curConsecStreak++;
        maxConsecStreak = Math.max(maxConsecStreak, curConsecStreak);
        getNumberPosition(draw, n).forEach(p => { positionsCounts[p] = (positionsCounts[p] || 0) + 1; });
      } else {
        curConsecStreak = 0;
      }
    }

    // Full history absence intervals
    const absenceIntervals: number[] = [];
    let lastIdx = -1, maxAbsenceStreak = 0, curAbsenceStreak = 0;
    for (let i = 0; i < allDraws.length; i++) {
      if (getAllNumbers(allDraws[i]).includes(n)) {
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
      if (getAllNumbers(allDraws[i]).includes(n)) break;
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
      maxAbsenceStreak,
      currentAbsence,
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

// ─── Prediction engine ─────────────────────────────────────────────────────

export interface MethodScore {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  detail: string;
}

export interface PredictionScore {
  number: number;
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C';
  reasons: string[];          // short reasons
  explanation: string;        // one-line summary
  methods: MethodScore[];     // detailed per-method breakdown
}

/**
 * 12-method ensemble prediction engine.
 * All computed relative to the LATEST draw in data (not today's date).
 */
export function generatePredictions(draws: LotteryDraw[], count: number = 27): PredictionScore[] {
  if (draws.length === 0) return [];

  const sorted = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextDrawDate = addDays(parseISO(sorted[sorted.length - 1].date), 1);
  const nextDow = nextDrawDate.getDay();

  const last7 = sorted.slice(-7);
  const last14 = sorted.slice(-14);
  const last30 = sorted.slice(-30);
  const last60 = sorted.slice(-60);
  const last90 = sorted.slice(-90);
  const last365 = sorted.slice(-365);
  const allDraws = sorted;

  const totalAll = allDraws.length;

  // Precompute Markov: P(n | n appeared in previous draw)
  const markovHit: number[] = new Array(100).fill(0);
  const markovTotal: number[] = new Array(100).fill(0);
  for (let i = 1; i < allDraws.length; i++) {
    const prevNums = new Set(getAllNumbers(allDraws[i - 1]));
    const currNums = new Set(getAllNumbers(allDraws[i]));
    prevNums.forEach(pn => {
      markovTotal[pn]++;
      if (currNums.has(pn)) markovHit[pn]++;
    });
  }

  const scores: PredictionScore[] = [];

  for (let n = 0; n <= 99; n++) {
    const methods: MethodScore[] = [];

    // Helper: frequency ratio scaled to 0-100
    const freq = (pool: LotteryDraw[]) =>
      pool.length === 0 ? 0 : (pool.filter(d => getAllNumbers(d).includes(n)).length / pool.length) * 100;

    // ── M1: Short-term momentum (7 kỳ) ─────────────────────────
    const f7 = freq(last7);
    const m1: MethodScore = {
      name: 'Momentum 7 kỳ', weight: 0.18, score: f7,
      contribution: f7 * 0.18,
      detail: `Xuất hiện ${last7.filter(d => getAllNumbers(d).includes(n)).length}/${last7.length} kỳ gần nhất`,
    };
    methods.push(m1);

    // ── M2: Mid-term frequency (30 kỳ) ─────────────────────────
    const f30 = freq(last30);
    const m2: MethodScore = {
      name: 'Tần suất 30 kỳ', weight: 0.15, score: f30,
      contribution: f30 * 0.15,
      detail: `${last30.filter(d => getAllNumbers(d).includes(n)).length} lần / 30 kỳ`,
    };
    methods.push(m2);

    // ── M3: Long-term frequency (90 kỳ) ────────────────────────
    const f90 = freq(last90);
    const m3: MethodScore = {
      name: 'Tần suất 90 kỳ', weight: 0.10, score: f90,
      contribution: f90 * 0.10,
      detail: `${last90.filter(d => getAllNumbers(d).includes(n)).length} lần / 90 kỳ`,
    };
    methods.push(m3);

    // ── M4: Absence due pressure ────────────────────────────────
    const absIntervals: number[] = [];
    let lastIdx = -1, currentAbsence = 0;
    for (let i = 0; i < allDraws.length; i++) {
      if (getAllNumbers(allDraws[i]).includes(n)) {
        if (lastIdx >= 0) absIntervals.push(i - lastIdx - 1);
        lastIdx = i; currentAbsence = 0;
      } else { currentAbsence++; }
    }
    const avgInterval = absIntervals.length > 0 ? absIntervals.reduce((a, b) => a + b, 0) / absIntervals.length : 30;
    const maxAbsence = absIntervals.length > 0 ? Math.max(...absIntervals) : currentAbsence;
    const dueRatio = currentAbsence / Math.max(avgInterval, 1);
    const m4score = Math.min(100, Math.pow(Math.max(0, dueRatio), 1.3) * 45);
    const m4: MethodScore = {
      name: 'Áp lực vắng mặt', weight: 0.22, score: m4score,
      contribution: m4score * 0.22,
      detail: currentAbsence === 0
        ? 'Vừa xuất hiện kỳ trước'
        : `Vắng ${currentAbsence}kỳ | TB=${avgInterval.toFixed(0)}k | Max=${maxAbsence}k | Tỉ lệ=${(dueRatio * 100).toFixed(0)}%`,
    };
    methods.push(m4);

    // ── M5: Day-of-week pattern ──────────────────────────────────
    const dowDraws = allDraws.filter(d => new Date(d.date).getDay() === nextDow);
    const dowHits = dowDraws.filter(d => getAllNumbers(d).includes(n)).length;
    const dowRate = dowDraws.length > 0 ? (dowHits / dowDraws.length) * 100 : 0;
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const m5: MethodScore = {
      name: 'Ngày trong tuần', weight: 0.08, score: dowRate,
      contribution: dowRate * 0.08,
      detail: `${days[nextDow]}: ${dowHits}/${dowDraws.length} kỳ = ${dowRate.toFixed(1)}%`,
    };
    methods.push(m5);

    // ── M6: Markov chain (previous draw dependency) ─────────────
    const latestNums = new Set(getAllNumbers(allDraws[allDraws.length - 1]));
    const markovScore = markovTotal[n] > 0 ? (markovHit[n] / markovTotal[n]) * 100 : 30;
    const appearedLast = latestNums.has(n);
    const m6: MethodScore = {
      name: 'Markov (kỳ trước)', weight: 0.08, score: appearedLast ? markovScore : (100 - markovScore) * 0.5,
      contribution: (appearedLast ? markovScore : (100 - markovScore) * 0.5) * 0.08,
      detail: appearedLast
        ? `Có mặt kỳ trước, P(tái xuất)=${markovScore.toFixed(1)}%`
        : `Vắng kỳ trước, xác suất đổi=${(100 - markovScore).toFixed(1)}%`,
    };
    methods.push(m6);

    // ── M7: Moving average trend (15 vs 45 kỳ) ─────────────────
    const f15 = freq(sorted.slice(-15));
    const f45 = freq(sorted.slice(-45));
    const trend = f15 - f45; // positive = rising
    const trendScore = Math.max(0, Math.min(100, 50 + trend * 2));
    const m7: MethodScore = {
      name: 'Xu hướng tăng/giảm', weight: 0.07, score: trendScore,
      contribution: trendScore * 0.07,
      detail: trend > 3 ? `📈 Tăng mạnh (+${trend.toFixed(1)}pp)` : trend < -3 ? `📉 Giảm (${trend.toFixed(1)}pp)` : `➡️ Ổn định (${trend.toFixed(1)}pp)`,
    };
    methods.push(m7);

    // ── M8: Special/Prize1 historical bias ─────────────────────
    const specialCount = last365.filter(d => d.special === n).length;
    const prize1Count = last365.filter(d => d.prize1 === n).length;
    const highPrizeScore = Math.min(100, (specialCount * 4 + prize1Count * 2) / Math.max(last365.length, 1) * 400);
    const m8: MethodScore = {
      name: 'Giải đặc biệt/nhất', weight: 0.04, score: highPrizeScore,
      contribution: highPrizeScore * 0.04,
      detail: `ĐB: ${specialCount} lần | G1: ${prize1Count} lần (365 kỳ)`,
    };
    methods.push(m8);

    // ── M9: Pair co-occurrence with recent numbers ──────────────
    const recentUniq = new Set(getAllNumbers(allDraws[allDraws.length - 1]));
    let coScore = 0;
    recentUniq.forEach(rn => {
      if (rn === n) return;
      const coCount = last60.filter(d => {
        const nums = getAllNumbers(d);
        return nums.includes(n) && nums.includes(rn);
      }).length;
      coScore += coCount;
    });
    const coScoreNorm = Math.min(100, coScore * 1.5);
    const m9: MethodScore = {
      name: 'Đồng xuất hiện cặp', weight: 0.04, score: coScoreNorm,
      contribution: coScoreNorm * 0.04,
      detail: `Tổng lần đồng xuất hiện với kỳ trước: ${coScore} (60 kỳ)`,
    };
    methods.push(m9);

    // ── M10: Bayesian posterior ─────────────────────────────────
    const priorAlpha = 27; const priorBeta = 73; // ~27% base rate
    const observed14 = last14.filter(d => getAllNumbers(d).includes(n)).length;
    const bayesPost = (priorAlpha + observed14) / (priorAlpha + priorBeta + last14.length) * 100;
    const m10: MethodScore = {
      name: 'Bayes posterior', weight: 0.03, score: bayesPost,
      contribution: bayesPost * 0.03,
      detail: `Prior 27% + ${observed14}/${last14.length} quan sát = ${bayesPost.toFixed(1)}%`,
    };
    methods.push(m10);

    // ── M11: Recency-weighted frequency ────────────────────────
    let rwf = 0;
    const decayBase = 0.93; // exponential decay
    for (let i = 0; i < last30.length; i++) {
      const weight = Math.pow(decayBase, last30.length - 1 - i);
      if (getAllNumbers(last30[i]).includes(n)) rwf += weight;
    }
    const rwfMax = (1 - Math.pow(decayBase, last30.length)) / (1 - decayBase);
    const rwfScore = Math.min(100, (rwf / rwfMax) * 100);
    const m11: MethodScore = {
      name: 'Hàm trọng số thời gian', weight: 0.05, score: rwfScore,
      contribution: rwfScore * 0.05,
      detail: `Kỳ càng gần, trọng số càng cao (hệ số giảm: ${decayBase})`,
    };
    methods.push(m11);

    // ── M12: Absence vs max-absence ratio ──────────────────────
    // If current absence is close to the max-ever absence, it's extreme
    const maxEver = Math.max(...absIntervals, currentAbsence, 1);
    const extremeRatio = currentAbsence / maxEver;
    // We want score high if currently near max absence (due for return)
    const m12score = Math.min(100, extremeRatio * 80);
    const m12: MethodScore = {
      name: 'So sánh vắng max lịch sử', weight: 0.06, score: m12score,
      contribution: m12score * 0.06,
      detail: `Hiện vắng ${currentAbsence}kỳ / Max lịch sử ${maxEver}kỳ = ${(extremeRatio * 100).toFixed(0)}%`,
    };
    methods.push(m12);

    // ── Total weighted score ────────────────────────────────────
    const totalScore = Math.min(100, Math.max(0, methods.reduce((s, m) => s + m.contribution, 0)));

    // ── Grade ────────────────────────────────────────────────────
    const grade: PredictionScore['grade'] = totalScore >= 65 ? 'A+' : totalScore >= 50 ? 'A' : totalScore >= 35 ? 'B' : 'C';

    // ── Reasons ─────────────────────────────────────────────────
    const reasons: string[] = [];
    if (f7 >= 40) reasons.push(`Nóng 7kỳ: ${f7.toFixed(0)}%`);
    if (dueRatio >= 0.8) reasons.push(`Vắng ${currentAbsence}kỳ≥${(dueRatio * 100).toFixed(0)}%TB`);
    if (trend > 4) reasons.push(`Xu hướng tăng +${trend.toFixed(1)}pp`);
    if (dowRate > 45) reasons.push(`${days[nextDow]}: ${dowRate.toFixed(0)}%`);
    if (appearedLast && markovScore > 35) reasons.push(`Có kỳ trước, Markov ${markovScore.toFixed(0)}%`);
    if (specialCount >= 3) reasons.push(`ĐB ${specialCount}×/năm`);
    if (extremeRatio > 0.7) reasons.push(`Gần max vắng ${(extremeRatio * 100).toFixed(0)}%`);

    // Explanation
    const topMethod = [...methods].sort((a, b) => b.contribution - a.contribution)[0];
    const explanation = reasons.length > 0
      ? reasons.slice(0, 2).join(' • ')
      : `${topMethod.name}: ${topMethod.score.toFixed(1)}đ`;

    scores.push({ number: n, score: totalScore, grade, reasons, explanation, methods });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, count);
}

export function formatNumber(n: number): string {
  return n.toString().padStart(2, '0');
}

export function getDrawNumbers(draw: LotteryDraw): number[] {
  return [...new Set(getAllNumbers(draw))];
}
