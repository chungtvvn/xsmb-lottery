'use client';

import { useState, useEffect, useCallback } from 'react';
import { LotteryDraw, LotteryMode } from '@/types/lottery';
import { formatNumber, getAllNumbers } from '@/lib/lottery-analyzer';
import StatisticsTab from '@/components/StatisticsTab';
import PredictionTab from '@/components/PredictionTab';
import { format, parseISO, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';

const CACHE_KEY = 'xsmb_data_cache';
const CACHE_TS_KEY = 'xsmb_data_cache_ts';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export default function Home() {
  const [activeTab, setActiveTab] = useState<'statistics' | 'prediction'>('statistics');
  const [mode, setMode] = useState<LotteryMode>('lo');
  const [draws, setDraws] = useState<LotteryDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<'cache' | 'network' | ''>('');

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      if (!forceRefresh && typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        const cachedTs = localStorage.getItem(CACHE_TS_KEY);
        if (cached && cachedTs && Date.now() - parseInt(cachedTs, 10) < CACHE_TTL_MS) {
          setDraws(JSON.parse(cached));
          setLastUpdated(new Date(parseInt(cachedTs, 10)).toLocaleTimeString('vi-VN'));
          setDataSource('cache');
          setError(null);
          setLoading(false);
          return;
        }
      }

      const res = await fetch(forceRefresh ? `/api/lottery-data?t=${Date.now()}` : '/api/lottery-data', { cache: 'no-store' });
      if (!res.ok) throw new Error('Không thể tải dữ liệu');
      const data: LotteryDraw[] = await res.json();
      const sorted = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(sorted));
          localStorage.setItem(CACHE_TS_KEY, Date.now().toString());
        } catch { /* quota exceeded, skip */ }
      }

      setDraws(sorted);
      setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
      setDataSource('network');
      setError(null);
    } catch (e) {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const ts = localStorage.getItem(CACHE_TS_KEY);
          setDraws(JSON.parse(cached));
          setLastUpdated(ts ? new Date(parseInt(ts, 10)).toLocaleTimeString('vi-VN') : '');
          setDataSource('cache');
          setError('Dùng dữ liệu cache (không có mạng)');
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }
      setError('Không thể tải dữ liệu. Vui lòng thử lại.');
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const latestDraw = draws.length > 0 ? draws[draws.length - 1] : null;
  const nextDrawLabel = latestDraw
    ? format(addDays(parseISO(latestDraw.date), 1), 'dd/MM/yyyy', { locale: vi })
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-slate-200 border-t-violet-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
          </div>
          <p className="text-slate-500 text-sm font-medium">Đang tải dữ liệu xổ số...</p>
        </div>
      </div>
    );
  }

  if (error && draws.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-600 mb-2">Lỗi tải dữ liệu</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button onClick={() => fetchData(true)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">

            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>🎯</div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold gradient-text leading-none">XSMB Analytics</h1>
                <p className="text-[11px] text-slate-400">Xổ số Miền Bắc</p>
              </div>
            </div>

            {/* ── MODE TOGGLE ── */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
              <button
                onClick={() => setMode('lo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'lo'
                  ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100'
                  : 'text-slate-400 hover:text-slate-600'}`}
              >
                🎰 Lô
              </button>
              <button
                onClick={() => setMode('de')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'de'
                  ? 'bg-white text-amber-700 shadow-sm border border-amber-100'
                  : 'text-slate-400 hover:text-slate-600'}`}
              >
                ♦️ Đề
              </button>
            </div>

            {/* Mode badge */}
            <div className="hidden md:flex items-center gap-2 flex-1 mx-1">
              {mode === 'de' ? (
                <span className="stat-badge badge-orange text-xs">♦️ Chế độ Đề — Chỉ Giải Đặc Biệt</span>
              ) : (
                <span className="stat-badge badge-purple text-xs">🎰 Chế độ Lô — Toàn bộ giải</span>
              )}
              {latestDraw && (
                <div className="text-xs text-slate-400">
                  <span className="text-slate-500">Kỳ mới:</span>{' '}
                  {format(parseISO(latestDraw.date), 'dd/MM', { locale: vi })}
                  {mode === 'de' && (
                    <span className="ml-1 font-bold text-amber-700">ĐB: {formatNumber(latestDraw.special)}</span>
                  )}
                  <span className="mx-1 text-slate-300">→</span>
                  <span className="text-indigo-600 font-semibold">Tiếp: {nextDrawLabel}</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {dataSource === 'cache' && <span className="hidden lg:flex stat-badge badge-gray text-[10px]">📦 Cache</span>}
              <div className="text-[10px] text-slate-400 hidden lg:block">{lastUpdated}</div>
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 disabled:opacity-50"
              >
                <span className={refreshing ? 'animate-spin inline-block' : 'inline-block'}>↻</span>
                <span className="hidden sm:inline">Làm mới</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('statistics')}
              className={`tab-btn ${activeTab === 'statistics' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            >
              📊 Thống kê {mode === 'de' ? '(Đề)' : '(Lô)'}
            </button>
            <button
              onClick={() => setActiveTab('prediction')}
              className={`tab-btn ${activeTab === 'prediction' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            >
              🔮 Dự đoán &amp; Lịch sử {mode === 'de' ? '(Đề)' : '(Lô)'}
            </button>
          </div>
        </div>
      </header>

      {/* Banner nếu dùng cache */}
      {error && draws.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-700 text-xs text-center py-2 px-4">
          ⚠️ {error}
        </div>
      )}

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-5">
        <div className="animate-fade-in">
          {activeTab === 'statistics' && <StatisticsTab draws={draws} mode={mode} />}
          {activeTab === 'prediction' && <PredictionTab draws={draws} mode={mode} />}
        </div>
      </main>

      <footer className="text-center py-5 text-xs text-slate-400 border-t border-slate-200 mt-8 bg-white">
        <p>XSMB Analytics • Cập nhật tự động 18:45 hàng ngày • Chỉ mang tính tham khảo</p>
      </footer>
    </div>
  );
}
