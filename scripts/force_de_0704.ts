import fs from 'fs';
import path from 'path';
import { generatePredictions } from '../src/lib/lottery-analyzer';
import { savePrediction } from '../src/lib/storage';
import { LotteryDraw, PredictionRecord } from '../src/types/lottery';

const DATA_FILE = path.join(process.cwd(), 'data/xsmb-2-digits-cache.json');
const rawData: LotteryDraw[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const draws = rawData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

const nextDrawDate = '2026-04-07';

const scoresDe = generatePredictions(draws, 30, 'de');
const recordDe: PredictionRecord = {
  date: nextDrawDate,
  mode: 'de',
  predictedNumbers: scoresDe.map(s => s.number),
  method: 'Auto (Manual Trigger) • 18 phương pháp ensemble',
  topNumbers: scoresDe.map(s => ({ number: s.number, score: parseFloat(s.score.toFixed(2)) })),
  createdAt: new Date().toISOString(),
};

savePrediction(recordDe);
console.log('Saved DE prediction for 2026-04-07!');
