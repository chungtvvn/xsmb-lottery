import fs from 'fs';
import path from 'path';
import { generatePredictions, getDrawNumbers } from '../src/lib/lottery-analyzer';
import { loadPredictions, savePrediction, updatePredictionWithResult } from '../src/lib/storage';
import { LotteryDraw, PredictionRecord } from '../src/types/lottery';

const DATA_FILE = path.join(process.cwd(), 'data/xsmb-2-digits-cache.json');

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.log('Downloading data...');
    const res = await fetch('https://raw.githubusercontent.com/khiemdoan/vietnam-lottery-xsmb-analysis/refs/heads/main/data/xsmb-2-digits.json');
    const json = await res.json();
    fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(json, null, 2));
  }

  const rawData: LotteryDraw[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const draws = rawData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Backfill last 15 days
  const BACKFILL_DAYS = 15;
  const existing = loadPredictions();

  for (let i = draws.length - BACKFILL_DAYS; i < draws.length; i++) {
    const historicalDraws = draws.slice(0, i);
    const targetDraw = draws[i];
    const targetDate = targetDraw.date.split('T')[0];

    console.log(`\nProcessing date ${targetDate}...`);

    for (const mode of ['lo', 'de'] as const) {
      const isDe = mode === 'de';
      const existingRecord = existing.find(p => p.date === targetDate && (p.mode ?? 'lo') === mode);
      
      let record: PredictionRecord;

      if (!existingRecord) {
        console.log(`Generating past prediction for ${mode}...`);
        const scores = generatePredictions(historicalDraws, isDe ? 30 : 18, mode);
        record = {
          date: targetDate,
          mode: mode,
          predictedNumbers: scores.map(s => s.number),
          method: isDe ? 'Auto (Backfill) • 18 phương pháp ensemble' : 'Auto (Backfill) • 12 phương pháp ensemble',
          topNumbers: scores.map(s => ({ number: s.number, score: parseFloat(s.score.toFixed(2)) })),
          createdAt: new Date().toISOString(),
        };
        savePrediction(record);
      } else {
        record = existingRecord;
      }

      // Automatically update with actual outcome
      const actualNumbers = getDrawNumbers(targetDraw, mode);
      updatePredictionWithResult(targetDate, actualNumbers, mode);
    }
  }

  console.log('\nBackfill completed!');
}

main().catch(console.error);
