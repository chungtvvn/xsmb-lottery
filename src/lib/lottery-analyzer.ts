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

/** Mode-aware numbers: Lô=all 27, Đề=special prize only */
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

  // Pairs only make sense in Lô mode
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

    // Full history stats
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
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C';
  reasons: string[];
  explanation: string;
  methods: MethodScore[];
}

/**
 * 12-method ensemble prediction.
 * mode='lo' → predict from all-prize pool (top 18)
 * mode='de' → predict special prize only (top 5)
 */
export function generatePredictions(draws: LotteryDraw[], count: number = 27, mode: LotteryMode = 'lo'): PredictionScore[] {
  if (draws.length === 0) return [];

  const sorted = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextDrawDate = addDays(parseISO(sorted[sorted.length - 1].date), 1);
  const nextDow = nextDrawDate.getDay();

  const nums = (pool: LotteryDraw[]) => (n: number) =>
    pool.filter(d => getDrawNumbers(d, mode).includes(n)).length;

  const last7 = sorted.slice(-7);
  const last14 = sorted.slice(-14);
  const last30 = sorted.slice(-30);
  const last60 = sorted.slice(-60);
  const last90 = sorted.slice(-90);
  const last365 = sorted.slice(-365);
  const allDraws = sorted;

  // Markov: P(n | n appeared prev draw)
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

  const freq = (pool: LotteryDraw[], n: number) =>
    pool.length === 0 ? 0 : (nums(pool)(n) / pool.length) * 100;

  const scores: PredictionScore[] = [];

  for (let n = 0; n <= 99; n++) {
    const methods: MethodScore[] = [];

    // ── M1: Momentum 7 kỳ ──────────────────────────────────────
    const f7 = freq(last7, n);
    methods.push({
      name: 'Momentum 7 kỳ', weight: 0.18, score: f7,
      contribution: f7 * 0.18,
      detail: `${nums(last7)(n)}/${last7.length} kỳ gần nhất`,
    });

    // ── M2: Tần suất 30 kỳ ─────────────────────────────────────
    const f30 = freq(last30, n);
    methods.push({
      name: 'Tần suất 30 kỳ', weight: 0.15, score: f30,
      contribution: f30 * 0.15,
      detail: `${nums(last30)(n)} lần / 30 kỳ`,
    });

    // ── M3: Tần suất 90 kỳ ─────────────────────────────────────
    const f90 = freq(last90, n);
    methods.push({
      name: 'Tần suất 90 kỳ', weight: 0.10, score: f90,
      contribution: f90 * 0.10,
      detail: `${nums(last90)(n)} lần / 90 kỳ`,
    });

    // ── M4: Áp lực vắng mặt ────────────────────────────────────
    const absIntervals: number[] = [];
    let lastIdx = -1, currentAbsence = 0;
    for (let i = 0; i < allDraws.length; i++) {
      if (getDrawNumbers(allDraws[i], mode).includes(n)) {
        if (lastIdx >= 0) absIntervals.push(i - lastIdx - 1);
        lastIdx = i; currentAbsence = 0;
      } else { currentAbsence++; }
    }
    const avgInterval = absIntervals.length > 0 ? absIntervals.reduce((a, b) => a + b, 0) / absIntervals.length : 30;
    const maxAbsence = absIntervals.length > 0 ? Math.max(...absIntervals) : currentAbsence;
    const dueRatio = currentAbsence / Math.max(avgInterval, 1);
    const m4score = Math.min(100, Math.pow(Math.max(0, dueRatio), 1.3) * 45);
    methods.push({
      name: 'Áp lực vắng mặt', weight: 0.22, score: m4score,
      contribution: m4score * 0.22,
      detail: currentAbsence === 0 ? 'Vừa xuất hiện kỳ trước'
        : `Vắng ${currentAbsence}k | TB=${avgInterval.toFixed(0)}k | Max=${maxAbsence}k | ${(dueRatio * 100).toFixed(0)}%`,
    });

    // ── M5: Ngày trong tuần ─────────────────────────────────────
    const dowDraws = allDraws.filter(d => new Date(d.date).getDay() === nextDow);
    const dowHits = dowDraws.filter(d => getDrawNumbers(d, mode).includes(n)).length;
    const dowRate = dowDraws.length > 0 ? (dowHits / dowDraws.length) * 100 : 0;
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    methods.push({
      name: 'Ngày trong tuần', weight: 0.08, score: dowRate,
      contribution: dowRate * 0.08,
      detail: `${days[nextDow]}: ${dowHits}/${dowDraws.length} = ${dowRate.toFixed(1)}%`,
    });

    // ── M6: Markov ─────────────────────────────────────────────
    const latestNums = new Set(getDrawNumbers(allDraws[allDraws.length - 1], mode));
    const markovScore = markovTotal[n] > 0 ? (markovHit[n] / markovTotal[n]) * 100 : 30;
    const appearedLast = latestNums.has(n);
    methods.push({
      name: 'Markov (kỳ trước)', weight: 0.08,
      score: appearedLast ? markovScore : (100 - markovScore) * 0.5,
      contribution: (appearedLast ? markovScore : (100 - markovScore) * 0.5) * 0.08,
      detail: appearedLast ? `Có kỳ trước, P(tái xuất)=${markovScore.toFixed(1)}%`
        : `Vắng kỳ trước, P(đổi)=${(100 - markovScore).toFixed(1)}%`,
    });

    // ── M7: Xu hướng MA15 vs MA45 ──────────────────────────────
    const f15 = freq(sorted.slice(-15), n);
    const f45 = freq(sorted.slice(-45), n);
    const trend = f15 - f45;
    const trendScore = Math.max(0, Math.min(100, 50 + trend * 2));
    methods.push({
      name: 'Xu hướng tăng/giảm', weight: 0.07, score: trendScore,
      contribution: trendScore * 0.07,
      detail: trend > 3 ? `📈 Tăng (+${trend.toFixed(1)}pp)` : trend < -3 ? `📉 Giảm (${trend.toFixed(1)}pp)` : `➡️ Ổn định`,
    });

    // ── M8: Giải đặc biệt bias ─────────────────────────────────
    const specialCount = last365.filter(d => d.special === n).length;
    const prize1Count = mode === 'lo' ? last365.filter(d => d.prize1 === n).length : 0;
    const highPrizeScore = Math.min(100, (specialCount * 4 + prize1Count * 2) / Math.max(last365.length, 1) * 400);
    methods.push({
      name: mode === 'de' ? 'Giải ĐB lịch sử' : 'Giải đặc biệt/nhất', weight: 0.04, score: highPrizeScore,
      contribution: highPrizeScore * 0.04,
      detail: `ĐB: ${specialCount} lần${mode === 'lo' ? ` | G1: ${prize1Count} lần` : ''} (365 kỳ)`,
    });

    // ── M9: Đồng xuất hiện cặp (Lô only) ──────────────────────
    let coScoreNorm = 30;
    if (mode === 'lo') {
      let coScore = 0;
      latestNums.forEach(rn => {
        if (rn === n) return;
        coScore += last60.filter(d => { const ns = getAllNumbers(d); return ns.includes(n) && ns.includes(rn); }).length;
      });
      coScoreNorm = Math.min(100, coScore * 1.5);
    }
    methods.push({
      name: mode === 'lo' ? 'Đồng xuất hiện cặp' : 'Điều chỉnh Đề', weight: 0.04, score: coScoreNorm,
      contribution: coScoreNorm * 0.04,
      detail: mode === 'lo' ? `Đồng xuất ${Math.round(coScoreNorm / 1.5)} lần với kỳ trước` : 'Hệ số điều chỉnh chế độ Đề',
    });

    // ── M10: Bayes posterior ────────────────────────────────────
    const priorAlpha = mode === 'de' ? 1 : 27;
    const priorBeta = mode === 'de' ? 99 : 73;
    const obs14 = nums(last14)(n);
    const bayesPost = (priorAlpha + obs14) / (priorAlpha + priorBeta + last14.length) * 100;
    methods.push({
      name: 'Bayes posterior', weight: 0.03, score: bayesPost,
      contribution: bayesPost * 0.03,
      detail: `Prior ${mode === 'de' ? '1' : '27'}% + ${obs14}/${last14.length} QS = ${bayesPost.toFixed(1)}%`,
    });

    // ── M11: Trọng số thời gian (exponential decay) ─────────────
    let rwf = 0;
    const decayBase = 0.93;
    for (let i = 0; i < last30.length; i++) {
      const w = Math.pow(decayBase, last30.length - 1 - i);
      if (getDrawNumbers(last30[i], mode).includes(n)) rwf += w;
    }
    const rwfMax = (1 - Math.pow(decayBase, last30.length)) / (1 - decayBase);
    const rwfScore = Math.min(100, (rwf / rwfMax) * 100);
    methods.push({
      name: 'Hàm trọng số thời gian', weight: 0.05, score: rwfScore,
      contribution: rwfScore * 0.05,
      detail: `Decay ${decayBase} → điểm gần cao hơn`,
    });

    // ── M12: So sánh với max vắng lịch sử ──────────────────────
    const maxEver = Math.max(...absIntervals, currentAbsence, 1);
    const extremeRatio = currentAbsence / maxEver;
    const m12score = Math.min(100, extremeRatio * 80);
    methods.push({
      name: 'So sánh max vắng LS', weight: 0.06, score: m12score,
      contribution: m12score * 0.06,
      detail: `${currentAbsence}kỳ / Max ${maxEver}kỳ = ${(extremeRatio * 100).toFixed(0)}%`,
    });

    // ── Total ───────────────────────────────────────────────────
    const totalScore = Math.min(100, Math.max(0, methods.reduce((s, m) => s + m.contribution, 0)));
    const grade: PredictionScore['grade'] = totalScore >= 65 ? 'A+' : totalScore >= 50 ? 'A' : totalScore >= 35 ? 'B' : 'C';

    const reasons: string[] = [];
    if (f7 >= 40) reasons.push(`Nóng 7kỳ: ${f7.toFixed(0)}%`);
    if (dueRatio >= 0.8) reasons.push(`Vắng ${currentAbsence}k/${(dueRatio * 100).toFixed(0)}%TB`);
    if (trend > 4) reasons.push(`Trend +${trend.toFixed(1)}pp`);
    if (dowRate > 45) reasons.push(`${days[nextDow]}: ${dowRate.toFixed(0)}%`);
    if (appearedLast && markovScore > 35) reasons.push(`Markov ${markovScore.toFixed(0)}%`);
    if (specialCount >= 3) reasons.push(`ĐB ${specialCount}×/năm`);
    if (extremeRatio > 0.7) reasons.push(`Gần max vắng ${(extremeRatio * 100).toFixed(0)}%`);

    const topMethod = [...methods].sort((a, b) => b.contribution - a.contribution)[0];
    const explanation = reasons.length > 0 ? reasons.slice(0, 2).join(' • ')
      : `${topMethod.name}: ${topMethod.score.toFixed(1)}`;

    scores.push({ number: n, score: totalScore, grade, reasons, explanation, methods });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, count);
}

export function formatNumber(n: number): string {
  return n.toString().padStart(2, '0');
}
