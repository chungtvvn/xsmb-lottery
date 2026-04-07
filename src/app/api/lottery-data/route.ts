import { NextResponse } from 'next/server';
import { DATA_URL } from '@/lib/lottery-analyzer';

export const runtime = 'nodejs';
export const revalidate = 3600; // 1 hour cache

export async function GET() {
  try {
    const response = await fetch(DATA_URL, {
      next: { revalidate: 3600 },
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
    if (!response.ok) throw new Error('Failed to fetch data');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching lottery data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
