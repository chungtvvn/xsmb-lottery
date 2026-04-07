import { NextRequest, NextResponse } from 'next/server';
import { loadPredictions, savePrediction, updatePredictionWithResult } from '@/lib/storage';
import { PredictionRecord, LotteryDraw } from '@/types/lottery';
import { DATA_URL, generatePredictions, getDrawNumbers } from '@/lib/lottery-analyzer';

const VALID_USERS: Record<string, string> = {
  tkxslt: 'tkxslt',
};

function checkAuth(req: NextRequest): boolean {
  const auth = req.headers.get('x-auth-token');
  if (!auth) return false;
  try {
    const decoded = Buffer.from(auth, 'base64').toString('utf-8');
    const [user, pass] = decoded.split(':');
    return VALID_USERS[user] === pass;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { days = 15 } = await req.json().catch(() => ({}));

    // Fetch latest data directly
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch lottery data');
    const rawData: LotteryDraw[] = await res.json();
    const draws = rawData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const existing = loadPredictions();

    for (let i = Math.max(0, draws.length - days); i < draws.length; i++) {
        const historicalDraws = draws.slice(0, i);
        const targetDraw = draws[i];
        const targetDate = targetDraw.date.split('T')[0];

        for (const mode of ['lo', 'de'] as const) {
          const isDe = mode === 'de';
          
          const scores = generatePredictions(historicalDraws, isDe ? 30 : 18, mode);
          const record: PredictionRecord = {
            date: targetDate,
            mode: mode,
            predictedNumbers: scores.map(s => s.number),
            method: isDe ? 'Auto (Backfill) • 22 phương pháp ensemble' : 'Auto (Backfill) • 16 phương pháp ensemble',
            topNumbers: scores.map(s => ({ number: s.number, score: parseFloat(s.score.toFixed(2)) })),
            createdAt: new Date().toISOString(),
          };
          savePrediction(record);

          const actualNumbers = getDrawNumbers(targetDraw, mode);
          updatePredictionWithResult(targetDate, actualNumbers, mode);
        }
    }

    return NextResponse.json({ success: true, message: `Completed backfill for ${days} days.` });
  } catch (error) {
    console.error('Backfill API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
