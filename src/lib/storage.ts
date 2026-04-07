import fs from 'fs';
import path from 'path';
import { LotteryMode, PredictionRecord } from '@/types/lottery';

const DATA_DIR = path.join(process.cwd(), 'data');
const PREDICTIONS_FILE = path.join(DATA_DIR, 'predictions.json');

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadPredictions(): PredictionRecord[] {
  ensureDataDir();
  if (!fs.existsSync(PREDICTIONS_FILE)) return [];
  try {
    const content = fs.readFileSync(PREDICTIONS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export function savePrediction(record: PredictionRecord) {
  ensureDataDir();
  const predictions = loadPredictions();
  // Match by date + mode to allow both modes on same date
  const existing = predictions.findIndex(p => p.date === record.date && (p.mode ?? 'lo') === (record.mode ?? 'lo'));
  if (existing >= 0) {
    predictions[existing] = record;
  } else {
    predictions.unshift(record);
  }
  fs.writeFileSync(PREDICTIONS_FILE, JSON.stringify(predictions, null, 2));
}

export function updatePredictionWithResult(date: string, actualNumbers: number[], mode: LotteryMode = 'lo') {
  ensureDataDir();
  const predictions = loadPredictions();
  const idx = predictions.findIndex(p => p.date === date && (p.mode ?? 'lo') === mode);
  if (idx >= 0) {
    const pred = predictions[idx];
    const predicted = new Set(pred.predictedNumbers);
    
    let hits = 0;
    let uniqueHits = 0;
    
    predicted.forEach(n => {
      let count = 0;
      actualNumbers.forEach(a => { if (a === n) count++; });
      hits += count;
      if (count > 0) uniqueHits++;
    });

    predictions[idx] = {
      ...pred,
      actualNumbers,
      hits,
      miss: pred.predictedNumbers.length - uniqueHits,
    };
    fs.writeFileSync(PREDICTIONS_FILE, JSON.stringify(predictions, null, 2));
  }
}
