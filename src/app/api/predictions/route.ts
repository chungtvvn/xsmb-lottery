import { NextRequest, NextResponse } from 'next/server';
import { loadPredictions, savePrediction, updatePredictionWithResult } from '@/lib/storage';
import { PredictionRecord, LotteryDraw } from '@/types/lottery';
import { DATA_URL, getAllNumbers } from '@/lib/lottery-analyzer';

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

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const mode = req.nextUrl.searchParams.get('mode') || 'lo';
  const all = loadPredictions();
  // Filter by mode; legacy records without mode field treated as 'lo'
  const filtered = all.filter(p => (p.mode ?? 'lo') === mode);
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const record: PredictionRecord = {
    mode: 'lo',  // default
    ...body,
    createdAt: new Date().toISOString(),
  };
  savePrediction(record);
  return NextResponse.json({ success: true, record });
}

export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { date, actualNumbers, mode, autoUpdateFromCache } = await req.json();

  if (autoUpdateFromCache) {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch lottery data');
      const rawData: LotteryDraw[] = await res.json();
      const draw = rawData.find((d) => d.date.startsWith(date));
      if (draw) {
        // Update both Lô and Đề
        updatePredictionWithResult(date, getAllNumbers(draw), 'lo');
        updatePredictionWithResult(date, [draw.special], 'de');
        return NextResponse.json({ success: true, message: 'Updated both modes from cache' });
      }
      return NextResponse.json({ error: 'Draw not found in cache for date' }, { status: 404 });
    } catch (err) {
      console.error(err);
      return NextResponse.json({ error: 'Failed to auto-update from cache' }, { status: 500 });
    }
  }

  updatePredictionWithResult(date, actualNumbers, mode ?? 'lo');
  return NextResponse.json({ success: true });
}
