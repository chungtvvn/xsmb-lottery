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

    // Check if prediction already exists for this date
    const existing = loadPredictions();
    const alreadyExists = existing.find(p => p.date === targetDate);
    if (alreadyExists) {
      return NextResponse.json({ 
        message: 'Prediction already exists for this date', 
        date: targetDate,
        skipped: true 
      });
    }

    // Generate predictions
    const scores = generatePredictions(draws, 27);
    const top18 = scores.slice(0, 18);

    const record: PredictionRecord = {
      date: targetDate,
      predictedNumbers: top18.map(s => s.number),
      method: 'Auto (GitHub Actions) • 8 phương pháp ensemble',
      topNumbers: top18.map(s => ({ number: s.number, score: parseFloat(s.score.toFixed(2)) })),
      createdAt: new Date().toISOString(),
    };

    savePrediction(record);

    return NextResponse.json({ 
      success: true, 
      date: targetDate,
      numbersCount: top18.length,
      topNumbers: top18.slice(0, 6).map(s => s.number),
    });
  } catch (error) {
    console.error('Auto-save error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
