import fs from 'fs';
import path from 'path';
import { PredictionRecord } from '@/types/lottery';

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
  const content = fs.readFileSync(PREDICTIONS_FILE, 'utf-8');
  return JSON.parse(content);
}

export function savePrediction(record: PredictionRecord) {
  ensureDataDir();
  const predictions = loadPredictions();
  const existing = predictions.findIndex(p => p.date === record.date);
  if (existing >= 0) {
    predictions[existing] = record;
  } else {
    predictions.unshift(record);
  }
  fs.writeFileSync(PREDICTIONS_FILE, JSON.stringify(predictions, null, 2));
}

export function updatePredictionWithResult(date: string, actualNumbers: number[]) {
  ensureDataDir();
  const predictions = loadPredictions();
  const idx = predictions.findIndex(p => p.date === date);
  if (idx >= 0) {
    const pred = predictions[idx];
    const predicted = new Set(pred.predictedNumbers);
    const actual = new Set(actualNumbers);
    let hits = 0;
    predicted.forEach(n => { if (actual.has(n)) hits++; });
    predictions[idx] = {
      ...pred,
      actualNumbers,
      hits,
      miss: pred.predictedNumbers.length - hits,
    };
    fs.writeFileSync(PREDICTIONS_FILE, JSON.stringify(predictions, null, 2));
  }
}
