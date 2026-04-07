import { NextRequest, NextResponse } from 'next/server';
import { loadPredictions, savePrediction } from '@/lib/storage';
import { DATA_URL, generatePredictions, getAllNumbers } from '@/lib/lottery-analyzer';
import { LotteryDraw, PredictionRecord } from '@/types/lottery';

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

/**
 * POST /api/predictions/auto-save
 * Called by GitHub Actions after data update.
 * Fetches latest lottery data, generates predictions, and saves for next draw date.
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    
    // Fetch latest lottery data
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch lottery data');
    const rawData: LotteryDraw[] = await res.json();
    const draws = rawData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (draws.length === 0) {
      return NextResponse.json({ error: 'No lottery data available' }, { status: 500 });
    }

    const latestDraw = draws[draws.length - 1];
    
    // Next draw date = latest draw date + 1 day
    const latestDate = new Date(latestDraw.date);
    latestDate.setDate(latestDate.getDate() + 1);
    const nextDrawDate = latestDate.toISOString().split('T')[0];

    // Use targetDate from body if provided, otherwise compute
    const targetDate = body.targetDate || nextDrawDate;

    // Check existing predictions
    const existing = loadPredictions();
    const existingLo = existing.find(p => p.date === targetDate && (p.mode === 'lo' || p.mode === undefined));
    const existingDe = existing.find(p => p.date === targetDate && p.mode === 'de');
    
    const results = [];

    // Generate and save LO prediction if needed
    if (!existingLo) {
      const scoresLo = generatePredictions(draws, 18, 'lo');
      const recordLo: PredictionRecord = {
        date: targetDate,
        mode: 'lo',
        predictedNumbers: scoresLo.map(s => s.number),
        method: 'Auto (GitHub Actions) • 16 phương pháp ensemble',
        topNumbers: scoresLo.map(s => ({ number: s.number, score: parseFloat(s.score.toFixed(2)) })),
        createdAt: new Date().toISOString(),
      };
      savePrediction(recordLo);
      results.push('lo');
    }

    // Generate and save DE prediction if needed
    if (!existingDe) {
      const scoresDe = generatePredictions(draws, 30, 'de');
      const recordDe: PredictionRecord = {
        date: targetDate,
        mode: 'de',
        predictedNumbers: scoresDe.map(s => s.number),
        method: 'Auto (GitHub Actions) • 22 phương pháp ensemble',
        topNumbers: scoresDe.map(s => ({ number: s.number, score: parseFloat(s.score.toFixed(2)) })),
        createdAt: new Date().toISOString(),
      };
      savePrediction(recordDe);
      results.push('de');
    }

    if (results.length === 0) {
      return NextResponse.json({ message: 'Predictions already exist for this date', date: targetDate, skipped: true });
    }

    return NextResponse.json({ 
      success: true, 
      date: targetDate,
      savedModes: results
    });
  } catch (error) {
    console.error('Auto-save error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
