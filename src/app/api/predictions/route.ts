import { NextRequest, NextResponse } from 'next/server';
import { loadPredictions, savePrediction, updatePredictionWithResult } from '@/lib/storage';
import { PredictionRecord } from '@/types/lottery';

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
  const { date, actualNumbers, mode } = await req.json();
  updatePredictionWithResult(date, actualNumbers, mode ?? 'lo');
  return NextResponse.json({ success: true });
}
