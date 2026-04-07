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

/** 
 * Compute next draw date = date of latest draw entry + 1 day 
 */
export function getNextDrawDate(draws: LotteryDraw[]): Date {
  if (draws.length === 0) return addDays(new Date(), 1);
  const sorted = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return addDays(parseISO(sorted[sorted.length - 1].date), 1);
}

/**
 * analyzeData: always uses FULL history for absence/streak stats,
 * but can filter to recent period for frequency analysis.
 */
export function analyzeData(draws: LotteryDraw[], daysToAnalyze: number = 365): AnalysisResult {
  const allDraws = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Period filter for frequency
  let recentDraws = allDraws;
  if (daysToAnalyze > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToAnalyze);
    recentDraws = allDraws.filter(d => new Date(d.date) >= cutoffDate);
  }

  const totalDraws = recentDraws.length;
  if (totalDraws === 0) return emptyResult();

  const numberStats: NumberStats[] = [];
  const pairCounts: Record<string, number> = {};
  const pairLastDate: Record<string, string> = {};

  // Compute pairs from period draws (avoid nested loop duplication)
  recentDraws.forEach(draw => {
    const nums = [...new Set(getAllNumbers(draw))];
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const key = `${Math.min(nums[i], nums[j])}-${Math.max(nums[i], nums[j])}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
        if (!pairLastDate[key] || draw.date > pairLastDate[key]) {
          pairLastDate[key] = draw.date;
        }
      }
    }
  });

  for (let n = 0; n <= 99; n++) {
    // --- Frequency stats on recentDraws ---
    const appearances: string[] = [];
    let maxConsecStreak = 0;  // max consecutive kỳ appeared
    let curConsecStreak = 0;
    const intervals: number[] = [];
    let lastAppearedDate: Date | null = null;
    const positionsCounts: Record<string, number> = {};

    for (const draw of recentDraws) {
      const nums = getAllNumbers(draw);
      const appeared = nums.includes(n);
      if (appeared) {
        appearances.push(draw.date);
        if (lastAppearedDate) {
          const interval = differenceInDays(parseISO(draw.date), lastAppearedDate);
          intervals.push(interval);
        }
        lastAppearedDate = parseISO(draw.date);
        curConsecStreak++;
        maxConsecStreak = Math.max(maxConsecStreak, curConsecStreak);
        getNumberPosition(draw, n).forEach(p => { positionsCounts[p] = (positionsCounts[p] || 0) + 1; });
      } else {
        curConsecStreak = 0;
      }
    }

    const count = appearances.length;
    const frequency = totalDraws > 0 ? (count / totalDraws) * 100 : 0;
    const lastDate = appearances.length > 0 ? appearances[appearances.length - 1] : '';

    // Avg interval (in draws, not days) using index-based on all history
    const absenceIntervals: number[] = [];
    let lastIdx = -1;
    let maxAbsenceStreak = 0;  // longest absence (kỳ không xuất hiện) in ALL history
    let curAbsenceStreak = 0;
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

    // avgAbsenceInterval = average number of draws between appearances
    const avgAbsenceInterval = absenceIntervals.length > 0
      ? absenceIntervals.reduce((a, b) => a + b, 0) / absenceIntervals.length
      : allDraws.length;

    // Current absence (from full history tail)
    let currentAbsence = 0;
    for (let i = allDraws.length - 1; i >= 0; i--) {
      if (getAllNumbers(allDraws[i]).includes(n)) break;
      currentAbsence++;
    }

    const topPositions = Object.entries(positionsCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);

    numberStats.push({
      number: n,
      count,
      frequency,
      lastAppeared: lastDate,
      daysSinceLastAppeared: lastDate ? differenceInDays(new Date(), parseISO(lastDate)) : allDraws.length,
      avgInterval: Math.round(avgAbsenceInterval * 10) / 10,
      maxStreak: maxConsecStreak,
      maxAbsenceStreak,   // longest kỳ không xuất hiện liên tiếp (toàn lịch sử)
      currentAbsence,
      positions: topPositions,
    });
  }

  const pairStats: PairStats[] = Object.entries(pairCounts)
    .map(([pair, count]) => ({
      pair,
      count,
      frequency: (count / totalDraws) * 100,
      lastDate: pairLastDate[pair] || '',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  const sorted = [...numberStats].sort((a, b) => b.count - a.count);
  const topFrequent = sorted.slice(0, 20);
  const topAbsent = [...numberStats].sort((a, b) => b.currentAbsence - a.currentAbsence).slice(0, 20);

  return {
    numberStats,
    topFrequent,
    topAbsent,
    hotNumbers: topFrequent.slice(0, 10).map(n => n.number),
    coldNumbers: topAbsent.slice(0, 10).map(n => n.number),
    pairStats,
    totalDraws,
    dateRange: {
      from: recentDraws[0]?.date || '',
      to: recentDraws[recentDraws.length - 1]?.date || '',
    },
  };
}

function emptyResult(): AnalysisResult {
  return {
    numberStats: [],
    topFrequent: [],
    topAbsent: [],
    hotNumbers: [],
    coldNumbers: [],
    pairStats: [],
    totalDraws: 0,
    dateRange: { from: '', to: '' },
  };
}

// ─── Advanced prediction engine ───────────────────────────────────────────────

export interface PredictionScore {
  number: number;
  score: number;
  reasons: string[];
  methods: Record<string, number>;
}

/**
 * generatePredictions - multi-method ensemble scoring
 * Uses the NEXT draw date derived from the latest entry in draws[] (not today).
 */
export function generatePredictions(draws: LotteryDraw[], count: number = 27): PredictionScore[] {
  if (draws.length === 0) return [];

  const sorted = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Compute next draw date from latest data entry
  const nextDrawDate = addDays(parseISO(sorted[sorted.length - 1].date), 1);
  const nextDow = nextDrawDate.getDay(); // day-of-week for next draw

  const recent7 = sorted.slice(-7);
  const recent14 = sorted.slice(-14);
  const recent30 = sorted.slice(-30);
  const recent90 = sorted.slice(-90);
  const recent365 = sorted.slice(-365);

  const scores: PredictionScore[] = [];

  for (let n = 0; n <= 99; n++) {
    const methods: Record<string, number> = {};
    let score = 0;
    const reasons: string[] = [];

    // ── Method 1: Short-term frequency (30d) ─────────────────
    const f30 = recent30.filter(d => getAllNumbers(d).includes(n)).length;
    const m1 = (f30 / Math.max(recent30.length, 1)) * 100;
    methods['Tần suất 30 kỳ'] = parseFloat(m1.toFixed(1));
    score += m1 * 0.20;
    if (f30 >= 9) reasons.push(`Nóng 30 kỳ: ${f30} lần`);

    // ── Method 2: Medium-term frequency (90d) ─────────────────
    const f90 = recent90.filter(d => getAllNumbers(d).includes(n)).length;
    const m2 = (f90 / Math.max(recent90.length, 1)) * 100;
    methods['Tần suất 90 kỳ'] = parseFloat(m2.toFixed(1));
    score += m2 * 0.15;

    // ── Method 3: Absence due pressure ───────────────────────
    // Compute current absence & avg interval from full history
    const absIntervals: number[] = [];
    let lastIdx = -1;
    let currentAbsence = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (getAllNumbers(sorted[i]).includes(n)) {
        if (lastIdx >= 0) absIntervals.push(i - lastIdx - 1);
        lastIdx = i;
        currentAbsence = 0;
      } else {
        currentAbsence++;
      }
    }
    const avgInterval = absIntervals.length > 0
      ? absIntervals.reduce((a, b) => a + b, 0) / absIntervals.length
      : 30;

    const dueRatio = currentAbsence / Math.max(avgInterval, 1);
    // Sigmoid-like boost when overdue
    const m3 = Math.min(80, Math.pow(dueRatio, 1.4) * 40);
    methods['Áp lực vắng mặt'] = parseFloat(m3.toFixed(1));
    score += m3 * 0.30;
    if (currentAbsence >= Math.max(1, avgInterval * 0.8)) {
      reasons.push(`Vắng ${currentAbsence}k (TB: ${avgInterval.toFixed(0)}k)`);
    }

    // ── Method 4: Recency momentum (7d) ─────────────────────
    const f7 = recent7.filter(d => getAllNumbers(d).includes(n)).length;
    const m4 = (f7 / Math.max(recent7.length, 1)) * 100;
    methods['Động lượng 7 kỳ'] = parseFloat(m4.toFixed(1));
    score += m4 * 0.15;
    if (f7 >= 3) reasons.push(`Momentum: ${f7}/${recent7.length}kỳ`);

    // ── Method 5: Day-of-week pattern (for next draw's weekday) ──
    const sameDayDraws = sorted.filter(d => new Date(d.date).getDay() === nextDow);
    const sameDayHits = sameDayDraws.filter(d => getAllNumbers(d).includes(n)).length;
    const m5 = sameDayDraws.length > 0 ? (sameDayHits / sameDayDraws.length) * 100 : 0;
    methods['Ngày trong tuần'] = parseFloat(m5.toFixed(1));
    score += m5 * 0.08;
    if (sameDayDraws.length >= 10 && m5 > 45) {
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      reasons.push(`Hay về ngày ${days[nextDow]} (${m5.toFixed(0)}%)`);
    }

    // ── Method 6: Special/Prize1 historical bias ─────────────
    const specialCount = recent365.filter(d => d.special === n).length;
    const prize1Count = recent365.filter(d => d.prize1 === n).length;
    const m6 = ((specialCount * 3 + prize1Count * 2) / Math.max(recent365.length, 1)) * 100;
    methods['Giải cao lịch sử'] = parseFloat(m6.toFixed(1));
    score += m6 * 0.05;
    if (specialCount >= 4) reasons.push(`ĐB ${specialCount} lần/năm`);

    // ── Method 7: Pair co-occurrence boost ───────────────────
    // If number appeared with the latest draw's numbers, boost
    if (sorted.length >= 2) {
      const latestNums = new Set(getAllNumbers(sorted[sorted.length - 1]));
      const prevNums = new Set(getAllNumbers(sorted[sorted.length - 2]));
      // Check if n appeared alongside any numbers from latest draw often
      const recent60 = sorted.slice(-60);
      let coOccurrence = 0;
      for (const dn of latestNums) {
        if (dn === n) continue;
        coOccurrence += recent60.filter(d => {
          const nums = getAllNumbers(d);
          return nums.includes(n) && nums.includes(dn);
        }).length;
      }
      const m7 = Math.min(30, coOccurrence * 0.5);
      methods['Đồng xuất hiện'] = parseFloat(m7.toFixed(1));
      score += m7 * 0.05;
    }

    // ── Method 8: Bayesian probability update ────────────────
    // P(appear) = prior + likelihood update based on recent
    const prior = 27 / 100; // base rate: ~27 unique numbers per draw out of 100
    const likelihood14 = recent14.filter(d => getAllNumbers(d).includes(n)).length / Math.max(recent14.length, 1);
    const bayesianProb = (prior * 0.4 + likelihood14 * 0.6) * 100;
    const m8 = Math.min(50, bayesianProb);
    methods['Bayes'] = parseFloat(m8.toFixed(1));
    score += m8 * 0.02;

    score = Math.min(100, Math.max(0, score));
    scores.push({ number: n, score, reasons, methods });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, count);
}

export function formatNumber(n: number): string {
  return n.toString().padStart(2, '0');
}

export function getDrawNumbers(draw: LotteryDraw): number[] {
  return [...new Set(getAllNumbers(draw))];
}
