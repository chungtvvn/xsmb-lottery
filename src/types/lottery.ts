export type LotteryMode = 'lo' | 'de';

export interface LotteryDraw {
  date: string;
  special: number;
  prize1: number;
  prize2_1: number;
  prize2_2: number;
  prize3_1: number;
  prize3_2: number;
  prize3_3: number;
  prize3_4: number;
  prize3_5: number;
  prize3_6: number;
  prize4_1: number;
  prize4_2: number;
  prize4_3: number;
  prize4_4: number;
  prize5_1: number;
  prize5_2: number;
  prize5_3: number;
  prize5_4: number;
  prize5_5: number;
  prize5_6: number;
  prize6_1: number;
  prize6_2: number;
  prize6_3: number;
  prize7_1: number;
  prize7_2: number;
  prize7_3: number;
  prize7_4: number;
}

export interface NumberStats {
  number: number;
  count: number;
  frequency: number;
  lastAppeared: string;
  daysSinceLastAppeared: number;
  avgInterval: number;
  maxStreak: number;
  maxAbsenceStreak: number;
  currentAbsence: number;
  positions: string[];
}

export interface PairStats {
  pair: string;
  count: number;
  frequency: number;
  lastDate: string;
}

export interface PredictionRecord {
  date: string;
  mode: LotteryMode;           // 'lo' | 'de'
  predictedNumbers: number[];  // stored in score order (tier1=0-5, tier2=6-11, tier3=12-17)
  method: string;
  topNumbers: { number: number; score: number }[];
  actualNumbers?: number[];    // actual result numbers
  hits?: number;
  miss?: number;
  createdAt: string;
}

export interface AnalysisResult {
  numberStats: NumberStats[];
  topFrequent: NumberStats[];
  topAbsent: NumberStats[];
  hotNumbers: number[];
  coldNumbers: number[];
  pairStats: PairStats[];
  totalDraws: number;
  dateRange: { from: string; to: string };
}
