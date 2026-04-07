'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { LotteryDraw, LotteryMode, PredictionRecord } from '@/types/lottery';
import { generatePredictions, PredictionScore, formatNumber, getDrawNumbers, getDeStats } from '@/lib/lottery-analyzer';
import { format, parseISO, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Props { draws: LotteryDraw[]; mode: LotteryMode; }

function makeAuthToken(u: string, p: string) { return btoa(`${u}:${p}`); }

// ── Fixed Ball — always inline-flex centered ─────────────────────────────
function Ball({ n, cls, size = 'md', title }: { n: number; cls?: string; size?: 'xs' | 'sm' | 'md'; title?: string }) {
  const sz = { xs: 'w-7 h-7 text-[11px]', sm: 'w-9 h-9 text-sm', md: 'w-10 h-10 text-sm' }[size];
  return (
    <span className={`${sz} rounded-full inline-flex items-center justify-center font-bold shrink-0 ${cls ?? ''}`} title={title}>
      {formatNumber(n)}
    </span>
  );
}

// ── Tier configs ─────────────────────────────────────────────────────────
interface TierConfig { label: string; short: string; range: [number, number]; ballCls: string; border: string; text: string; bar: string; }

const LO_TIERS: TierConfig[] = [
  { label: 'Cực kỳ tự tin', short: '⭐⭐', range: [0, 5],   ballCls: 'number-predicted', border: 'border-emerald-200 bg-emerald-50/40', text: 'text-emerald-700', bar: 'linear-gradient(90deg,#10b981,#059669)' },
  { label: 'Tự tin cao',    short: '⭐',   range: [6, 11],  ballCls: 'number-cold',      border: 'border-blue-200 bg-blue-50/30',    text: 'text-blue-700',    bar: 'linear-gradient(90deg,#3b82f6,#6366f1)' },
  { label: 'Khả năng',      short: '💡',   range: [12, 17], ballCls: 'number-hot',       border: 'border-orange-200 bg-orange-50/30', text: 'text-orange-700',  bar: 'linear-gradient(90deg,#f97316,#ef4444)' },
];

const DE_TIERS: TierConfig[] = [
  { label: 'Rất tự tin',  short: '🔥',   range: [0, 9],   ballCls: 'number-predicted', border: 'border-emerald-200 bg-emerald-50/40', text: 'text-emerald-700', bar: 'linear-gradient(90deg,#10b981,#059669)' },
  { label: 'Tự tin',      short: '⭐⭐', range: [10, 19], ballCls: 'number-cold',      border: 'border-blue-200 bg-blue-50/30',    text: 'text-blue-700',    bar: 'linear-gradient(90deg,#3b82f6,#6366f1)' },
  { label: 'Có thể',       short: '⭐',   range: [20, 29], ballCls: 'number-hot',       border: 'border-orange-200 bg-orange-50/30', text: 'text-orange-700',  bar: 'linear-gradient(90deg,#f97316,#ef4444)' },
  { label: 'Mở rộng',     short: '💡',   range: [30, 39], ballCls: 'number-neutral',   border: 'border-slate-200 bg-slate-50',     text: 'text-slate-600',   bar: 'linear-gradient(90deg,#94a3b8,#64748b)' },
];

function getTier(idx: number, mode: LotteryMode): TierConfig {
  const cfg = mode === 'de' ? DE_TIERS : LO_TIERS;
  return cfg.find(t => idx >= t.range[0] && idx <= t.range[1]) ?? cfg[cfg.length - 1];
}

// ── Expandable detail card ───────────────────────────────────────────────
function NumberDetail({ s, rank, mode }: { s: PredictionScore; rank: number; mode: LotteryMode }) {
  const [open, setOpen] = useState(false);
  const tier = getTier(rank - 1, mode);
  const gradeCls: Record<string, string> = { 'A+': 'bg-emerald-500 text-white', A: 'bg-blue-500 text-white', B: 'bg-orange-400 text-white', C: 'bg-slate-400 text-white' };
  return (
    <div className={`card border ${tier.border} transition-all`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/60 rounded-xl" onClick={() => setOpen(o => !o)}>
        <span className="text-xs text-slate-400 w-5 text-center font-bold">#{rank}</span>
        <Ball n={s.number} cls={tier.ballCls} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${gradeCls[s.grade]} px-1.5 py-0.5 rounded`}>{s.grade}</span>
            <span className={`text-sm font-bold ${tier.text}`}>{s.score.toFixed(1)}</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{s.explanation}</p>
        </div>
        <div className="w-20 progress-bar hidden sm:block">
          <div className="progress-fill" style={{ width: `${s.score}%`, background: tier.bar }} />
        </div>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="px-3 pb-3 border-t border-slate-100 animate-fade-in">
          <p className="text-[11px] text-slate-500 mt-2 mb-2 font-medium">Chi tiết {s.methods.length} phương pháp:</p>
          <div className="space-y-1.5">
            {s.methods.map(m => (
              <div key={m.name} className="grid grid-cols-[1fr_auto_auto] gap-2 items-start text-[11px]">
                <div className="min-w-0">
                  <span className="font-semibold text-slate-700">{m.name}</span>
                  <span className="text-slate-400 ml-1 text-[10px]">— {m.detail}</span>
                </div>
                <div className="w-16 progress-bar mt-1.5">
                  <div className="progress-fill" style={{ width: `${m.score}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
                </div>
                <span className="text-right font-bold text-slate-700 w-10">{m.contribution.toFixed(1)}</span>
              </div>
            ))}
          </div>
          {s.reasons.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
              {s.reasons.map((r, i) => <span key={i} className="stat-badge badge-purple">{r}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── History card with tiered ball display ───────────────────────────────
function HistoryCard({ pred, mode }: { pred: PredictionRecord; mode: LotteryMode }) {
  const hasResult = !!pred.actualNumbers?.length;
  const actualSet = new Set(pred.actualNumbers ?? []);
  const predictedSet = new Set(pred.predictedNumbers);
  const hits = pred.hits ?? 0;
  const total = pred.predictedNumbers.length;
  const hitRate = total > 0 ? (hits / total) * 100 : 0;
  const tiers = mode === 'de' ? DE_TIERS : LO_TIERS;

  const getNumbersForTier = (tier: TierConfig) =>
    pred.predictedNumbers.slice(tier.range[0], tier.range[1] + 1);

  const getBallCls = (n: number) => {
    if (!hasResult) return undefined; // will use tier cls in parent
    return actualSet.has(n) ? 'number-hit' : 'number-miss';
  };

  return (
    <div className={`card p-4 border ${hasResult && hits > 0 ? 'border-emerald-300' : hasResult ? 'border-slate-200' : 'border-indigo-200 bg-indigo-50/20'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-semibold text-slate-800 capitalize text-sm">
            {format(parseISO(pred.date), "EEEE dd/MM/yyyy", { locale: vi })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{pred.method}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`stat-badge ${mode === 'de' ? 'badge-orange' : 'badge-purple'}`}>{mode === 'de' ? '♦️ Đề' : '🎰 Lô'}</span>
          {hasResult ? (
            <>
              <span className="stat-badge badge-green">✓ {hits} trúng</span>
              {(pred.miss ?? 0) > 0 && <span className="stat-badge badge-red">✗ {pred.miss}</span>}
              <span className="stat-badge badge-blue">{hitRate.toFixed(0)}%</span>
            </>
          ) : <span className="stat-badge badge-purple">⏳ Chờ KQ</span>}
        </div>
      </div>

      {/* Tier rows */}
      {tiers.map(tier => {
        const nums = getNumbersForTier(tier);
        if (nums.length === 0) return null;
        const tierHits = nums.filter(n => actualSet.has(n)).length;
        return (
          <div key={tier.label} className="mb-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`text-[10px] font-bold ${tier.text}`}>{tier.short} {tier.label}</span>
              {hasResult && <span className="text-[9px] text-slate-400 ml-auto">{tierHits}/{nums.length} trúng</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {nums.map(n => {
                const ballCls = getBallCls(n) ?? tier.ballCls;
                return (
                  <div key={n} className="flex flex-col items-center gap-0.5">
                    <Ball n={n} cls={ballCls} size="xs"
                      title={hasResult ? (actualSet.has(n) ? '✓ Trúng' : '✗ Trượt') : undefined} />
                    {hasResult && (
                      <span className={`text-[8px] leading-none font-bold ${actualSet.has(n) ? 'text-amber-600' : 'text-slate-300'}`}>
                        {actualSet.has(n) ? '✓' : '·'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Actual result */}
      {hasResult && pred.actualNumbers && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 font-medium mb-1.5">Kết quả thực:</p>
          <div className="flex flex-wrap gap-1.5">
            {pred.actualNumbers.map(n => (
              <Ball key={n} n={n} cls={predictedSet.has(n) ? 'number-hit' : 'number-neutral'} size="xs"
                title={predictedSet.has(n) ? '✓ Đã dự đoán' : undefined} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────
export default function PredictionTab({ draws, mode }: Props) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [authChecking, setAuthChecking] = useState(false);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingPreds, setLoadingPreds] = useState(false);
  const [savedForNextDraw, setSavedForNextDraw] = useState(false);
  const [activeView, setActiveView] = useState<'predict' | 'history'>('predict');
  const [showAll, setShowAll] = useState(false);
  const [deCount, setDeCount] = useState<20 | 30 | 40>(30); // Đề mode number count
  const [backfillDays, setBackfillDays] = useState(15);
  const [backfillRunning, setBackfillRunning] = useState(false);

  const sorted = useMemo(() => [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [draws]);
  const latestDraw = sorted[sorted.length - 1];
  const nextDrawDate = latestDraw ? addDays(parseISO(latestDraw.date), 1) : addDays(new Date(), 1);
  const nextDrawStr = format(nextDrawDate, 'yyyy-MM-dd');
  const nextDrawLabel = format(nextDrawDate, "EEEE, dd/MM/yyyy", { locale: vi });

  // Count config
  const saveCount = mode === 'de' ? deCount : 18;
  const genCount = mode === 'de' ? 40 : (showAll ? 27 : 18);

  const predictionScores: PredictionScore[] = useMemo(() => generatePredictions(draws, 40, mode), [draws, mode]);

  const displayedScores = predictionScores.slice(0, mode === 'de' ? deCount : (showAll ? 27 : 18));

  const deStats = useMemo(() => mode === 'de' ? getDeStats(draws, 30) : null, [draws, mode]);

  // Tier summary
  const tiers = mode === 'de' ? DE_TIERS : LO_TIERS;
  const gradeCount = { 'A+': predictionScores.slice(0, saveCount).filter(s => s.grade === 'A+').length, 'A': predictionScores.slice(0, saveCount).filter(s => s.grade === 'A').length };

  // Auth
  useEffect(() => {
    const saved = sessionStorage.getItem('xsmb_auth');
    if (saved) { try { const { token, user } = JSON.parse(saved); setAuthToken(token); setUsername(user); setIsAuthed(true); } catch { /* ignore */ } }
  }, []);

  const loadPredictions = useCallback(async (token: string) => {
    setLoadingPreds(true);
    try {
      const res = await fetch(`/api/predictions?mode=${mode}`, { headers: { 'x-auth-token': token } });
      if (res.ok) {
        const data: PredictionRecord[] = await res.json();
        data.sort((a, b) => b.date.localeCompare(a.date));
        setPredictions(data);
        setSavedForNextDraw(data.some(p => p.date === nextDrawStr));
      }
    } finally { setLoadingPreds(false); }
  }, [nextDrawStr, mode]);

  useEffect(() => { if (isAuthed && authToken) loadPredictions(authToken); }, [isAuthed, authToken, loadPredictions]);
  useEffect(() => { setSavedForNextDraw(predictions.some(p => p.date === nextDrawStr && (p.mode ?? 'lo') === mode)); }, [mode, predictions, nextDrawStr]);

  const handleLogin = async () => {
    if (!username || !password) { setAuthError('Vui lòng nhập đầy đủ'); return; }
    setAuthChecking(true); setAuthError('');
    const token = makeAuthToken(username, password);
    try {
      const res = await fetch(`/api/predictions?mode=${mode}`, { headers: { 'x-auth-token': token } });
      if (res.status === 401) { setAuthError('Sai tên đăng nhập hoặc mật khẩu'); return; }
      const data: PredictionRecord[] = await res.json();
      data.sort((a, b) => b.date.localeCompare(a.date));
      setAuthToken(token); setIsAuthed(true);
      sessionStorage.setItem('xsmb_auth', JSON.stringify({ token, user: username }));
      setPredictions(data);
      setSavedForNextDraw(data.some(p => p.date === nextDrawStr));
    } catch { setAuthError('Lỗi kết nối server'); }
    finally { setAuthChecking(false); }
  };

  const handleBackfill = async () => {
    if (!authToken || !confirm(`Chạy mô phỏng (backfill) ${backfillDays} ngày? \n(Sẽ tính toán lại lịch sử)`)) return;
    setBackfillRunning(true);
    try {
      const res = await fetch('/api/predictions/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': authToken },
        body: JSON.stringify({ days: backfillDays })
      });
      if (res.ok) {
        await loadPredictions(authToken);
        alert('Backfill hoàn tất!');
      } else {
        alert('Lỗi khi backfill');
      }
    } catch { alert('Lỗi mạng'); } finally { setBackfillRunning(false); }
  };

  const profitStats = useMemo(() => {
    const wr = predictions.filter(p => p.hits !== undefined && (p.mode || 'lo') === mode);
    if (wr.length === 0) return null;

    let totalCost = 0;
    let totalRevenue = 0;
    let totalHits = 0;

    wr.forEach(p => {
      const ph = p.hits || 0;
      const count = p.predictedNumbers.length;
      totalHits += ph;
      if (mode === 'de') {
        totalCost += count * 1;
        totalRevenue += ph * 70;
      } else {
        totalCost += count * 23;
        totalRevenue += ph * 80;
      }
    });

    const isProfit = totalRevenue >= totalCost;
    return { totalHits, totalCost, totalRevenue, profit: totalRevenue - totalCost, isProfit, days: wr.length };
  }, [predictions, mode]);

  const handleSave = async () => {
    if (!isAuthed || !authToken) return;
    setSaving(true);
    try {
      const topN = predictionScores.slice(0, saveCount);
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': authToken },
        body: JSON.stringify({
          date: nextDrawStr, mode,
          predictedNumbers: topN.map(s => s.number),
          method: `Ensemble ${mode === 'de' ? '18' : '12'} phương pháp (${mode === 'de' ? '♦️ Đề' : '🎰 Lô'}) — ${saveCount} số`,
          topNumbers: topN.map(s => ({ number: s.number, score: parseFloat(s.score.toFixed(2)) })),
        }),
      });
      if (res.ok) { setSavedForNextDraw(true); await loadPredictions(authToken); }
    } finally { setSaving(false); }
  };

  const handleLogout = () => {
    setIsAuthed(false); setAuthToken(''); setUsername(''); setPassword(''); setPredictions([]); setSavedForNextDraw(false);
    sessionStorage.removeItem('xsmb_auth');
  };

  // ── LOGIN ────────────────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="max-w-sm mx-auto pt-8 animate-fade-in">
        <div className="card p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl shadow-md" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>🔮</div>
            <h2 className="text-2xl font-bold text-slate-800">Dự đoán &amp; Lịch sử</h2>
            <p className="text-slate-500 text-sm mt-2">Đăng nhập để xem và lưu dự đoán</p>
          </div>
          <div className="space-y-4">
            <div><label className="text-sm text-slate-600 mb-1.5 block font-medium">Tên đăng nhập</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="username" className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" /></div>
            <div><label className="text-sm text-slate-600 mb-1.5 block font-medium">Mật khẩu</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="current-password" className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" /></div>
            {authError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">⚠️ {authError}</div>}
            <button onClick={handleLogin} disabled={authChecking} className="w-full py-3 rounded-xl font-semibold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              {authChecking ? '⏳ Đang xác thực...' : 'Đăng nhập'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Dự đoán &amp; Lịch sử — <span className={mode === 'de' ? 'text-amber-700' : 'text-indigo-700'}>{mode === 'de' ? '♦️ Đề (Giải ĐB)' : '🎰 Lô (Toàn bộ)'}</span></h2>
          <p className="text-xs text-slate-400">Người dùng: <span className="font-semibold text-indigo-600">{username}</span></p>
        </div>
        <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 hover:border-red-200">Đăng xuất</button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveView('predict')} className={`tab-btn ${activeView === 'predict' ? 'tab-btn-active' : 'tab-btn-inactive'}`}>🎯 Dự đoán kỳ tiếp</button>
        <button onClick={() => setActiveView('history')} className={`tab-btn ${activeView === 'history' ? 'tab-btn-active' : 'tab-btn-inactive'}`}>📋 Lịch sử ({predictions.length})</button>
      </div>

      {/* ── PREDICTION ─────────────────────────────────────────────────── */}
      {activeView === 'predict' && (
        <div className="space-y-4">
          {/* Banner */}
          <div className={`card p-5 border-l-4 ${mode === 'de' ? 'border-l-amber-500 bg-amber-50 border-amber-200' : 'border-l-indigo-500 bg-indigo-50 border-indigo-200'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={`text-xs uppercase font-bold tracking-wider ${mode === 'de' ? 'text-amber-600' : 'text-indigo-600'}`}>{mode === 'de' ? '♦️ Đề — Giải Đặc Biệt' : '🎰 Lô — Toàn bộ giải'}</p>
                <h3 className="text-xl font-bold text-slate-900 mt-1 capitalize">{nextDrawLabel}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kết quả mới nhất: {latestDraw ? format(parseISO(latestDraw.date), 'dd/MM/yyyy') : ''}
                  {mode === 'de' && latestDraw && <span className="ml-2 font-bold text-amber-700">ĐB: {formatNumber(latestDraw.special)}</span>}
                  {' '}• {draws.length} kỳ • {mode === 'de' ? '18' : '12'} phương pháp
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {savedForNextDraw && <span className="stat-badge badge-green px-3 py-1.5">✓ Đã lưu</span>}
                <div className="flex gap-1.5 text-xs">
                  <span className="stat-badge badge-green">A+:{gradeCount['A+']}</span>
                  <span className="stat-badge badge-blue">A:{gradeCount['A']}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── ĐỀ MODE: digit analysis panel ───────────────────────── */}
          {mode === 'de' && deStats && (
            <div className="card p-5 border border-amber-200 bg-amber-50/30">
              <h3 className="font-bold text-amber-800 text-sm mb-3">📊 Phân tích Đề — {deStats.recentSpecials.length} kỳ gần nhất</h3>

              {/* Recent specials */}
              <div className="mb-4">
                <p className="text-[11px] text-slate-500 font-medium mb-2">Giải ĐB gần nhất:</p>
                <div className="flex flex-wrap gap-2">
                  {deStats.recentSpecials.map((n, i) => (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <Ball n={n} cls={i === deStats.recentSpecials.length - 1 ? 'number-predicted' : 'number-neutral'} size="sm" />
                      <span className="text-[9px] text-slate-400">{i === deStats.recentSpecials.length - 1 ? 'Mới nhất' : `-${deStats.recentSpecials.length - 1 - i}kỳ`}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Last digit freq */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-600 mb-2">🔢 Tần suất chữ số cuối (30 kỳ)</p>
                  <div className="space-y-1">
                    {[...deStats.lastDigitFreq].sort((a, b) => b.count - a.count).slice(0, 6).map(d => (
                      <div key={d.digit} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 w-8">…{d.digit}</span>
                        <div className="flex-1 progress-bar">
                          <div className="progress-fill" style={{ width: `${Math.min(100, d.rate * 5)}%`, background: d.count >= 5 ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
                        </div>
                        <span className="text-xs text-slate-700 w-12 text-right">{d.count}kỳ ({d.rate.toFixed(0)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* First digit freq */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-600 mb-2">🔢 Tần suất chữ số đầu (30 kỳ)</p>
                  <div className="space-y-1">
                    {[...deStats.firstDigitFreq].sort((a, b) => b.count - a.count).slice(0, 6).map(d => (
                      <div key={d.digit} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 w-8">{d.digit}…</span>
                        <div className="flex-1 progress-bar">
                          <div className="progress-fill" style={{ width: `${Math.min(100, d.rate * 5)}%`, background: d.count >= 5 ? 'linear-gradient(90deg,#f97316,#ef4444)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
                        </div>
                        <span className="text-xs text-slate-700 w-12 text-right">{d.count}kỳ ({d.rate.toFixed(0)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Decade distribution */}
              <div className="mt-3">
                <p className="text-[11px] font-semibold text-slate-600 mb-2">📦 Phân bổ nhóm thập phân (30 kỳ)</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {deStats.decadeFreq.map(d => (
                    <div key={d.decade} className={`rounded-lg p-2 text-center border ${d.count === 0 ? 'border-red-200 bg-red-50' : d.count >= 5 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="text-[10px] text-slate-500">{d.decade}</div>
                      <div className={`text-sm font-bold ${d.count >= 5 ? 'text-emerald-700' : d.count === 0 ? 'text-red-600' : 'text-slate-700'}`}>{d.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Đề count selector ─────────────────────────────────── */}
          {mode === 'de' && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-slate-600">Số lượng dự đoán:</span>
              {([20, 30, 40] as const).map(c => (
                <button key={c} onClick={() => setDeCount(c)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${deCount === c ? 'bg-amber-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:border-amber-300'}`}>
                  {c} số
                </button>
              ))}
              <span className="text-[11px] text-slate-400">• XS trúng đề ≈ 1% mỗi số</span>
            </div>
          )}

          {/* ── Tier display ─────────────────────────────────────── */}
          {tiers.slice(0, mode === 'de' ? 4 : 3).map((tier, tIdx) => {
            const tierNums = predictionScores.slice(tier.range[0], Math.min(tier.range[1] + 1, mode === 'de' ? deCount : 18));
            if (tierNums.length === 0) return null;
            return (
              <div key={tier.label} className={`card p-5 border ${tIdx === 0 ? 'border-2' : ''} ${tier.border}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-bold text-sm ${tier.text}`}>
                    {tier.short} {tier.label} — #{tier.range[0] + 1}–#{Math.min(tier.range[1] + 1, mode === 'de' ? deCount : 18)}
                  </h3>
                  <span className="text-xs text-slate-400">{tierNums.length} số</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-2">
                  {tierNums.map((s, idx) => (
                    <div key={s.number} className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] text-slate-400">#{tier.range[0] + idx + 1}</span>
                      <Ball n={s.number} cls={tier.ballCls} size={tIdx === 0 ? 'md' : 'sm'} />
                      <span className={`text-[10px] font-bold ${tier.text}`}>{s.score.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* ── Expandable detail table ──────────────────────────── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Phân tích chi tiết từng số</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Click để xem {mode === 'de' ? '18' : '12'} phương pháp</p>
              </div>
              {mode === 'lo' && (
                <button onClick={() => setShowAll(v => !v)} className="text-xs text-indigo-600 hover:underline font-medium">
                  {showAll ? '▲ Ẩn bớt' : '▼ Xem Top 27'}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {displayedScores.map((s, idx) => <NumberDetail key={s.number} s={s} rank={idx + 1} mode={mode} />)}
            </div>
          </div>

          {/* ── Method legend ────────────────────────────────────── */}
          <div className="card p-5 bg-slate-50">
            <h3 className="font-bold text-slate-700 text-sm mb-3">📖 {mode === 'de' ? '18' : '12'} phương pháp phân tích</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              {(mode === 'de' ? [
                { n: 'M1–M3 Momentum & tần suất', w: '24%', d: '7 / 30 / 90 kỳ gần nhất' },
                { n: 'M4 Áp lực vắng mặt', w: '22%', d: 'Vắng/TB → sigmoid pressure' },
                { n: 'M5 Ngày trong tuần', w: '7%', d: 'Pattern theo thứ của kỳ tiếp' },
                { n: 'M6 Markov', w: '7%', d: 'Xác suất tái xuất/đổi từ kỳ trước' },
                { n: 'M7 Xu hướng MA15/45', w: '5%', d: 'Trend ngắn hạn vs trung hạn' },
                { n: 'M8 Tần suất ĐB 365kỳ', w: '5%', d: 'Bias số hay về giải ĐB' },
                { n: 'M9 Phân tích chữ số (Đề)', w: '8%', d: 'Đầu/đuôi hot trong 30 kỳ' },
                { n: 'M10 Bayes posterior', w: '3%', d: 'Prior 1% cập nhật 14 kỳ QS' },
                { n: 'M11 Trọng số thời gian', w: '4%', d: 'Decay 0.93 — kỳ gần trọng số cao' },
                { n: 'M12 So max vắng LS', w: '7%', d: 'Vắng hiện tại / kỷ lục vắng' },
                { n: 'M13 Số gương (mirror)', w: '5%', d: '27→72: tương quan giữa số gương' },
                { n: 'M14 Áp lực nhóm thập phân', w: '5%', d: 'Nhóm XX-XX+9 chưa về lâu' },
                { n: 'M15 Tổng chữ số', w: '5%', d: 'Nhóm tổng (0-18) đang hot' },
                { n: 'M16 Số kề giải ĐB gần nhất', w: '5%', d: '±1, ±2, ±10 từ ĐB gần đây' },
                { n: 'M17 Chu kỳ chuẩn lệch', w: '4%', d: 'Cửa sổ xuất hiện theo chu kỳ TB±SD' },
                { n: 'M18 Đuôi/Đầu ĐB kỳ trước', w: '4%', d: 'Cùng chữ số đầu/đuôi với ĐB vừa ra' },
              ] : [
                { n: 'M1 Momentum 7kỳ', w: '18%', d: 'Tần suất trong 7 kỳ gần nhất' },
                { n: 'M2 Tần suất 30kỳ', w: '15%', d: 'Tần suất trung hạn' },
                { n: 'M3 Tần suất 90kỳ', w: '10%', d: 'Tần suất dài hạn' },
                { n: 'M4 Áp lực vắng mặt', w: '22%', d: 'Vắng/TB → sigmoid pressure' },
                { n: 'M5 Ngày trong tuần', w: '8%', d: 'Pattern theo thứ kỳ tiếp' },
                { n: 'M6 Markov', w: '8%', d: 'Xác suất tái xuất/đổi từ kỳ trước' },
                { n: 'M7 Xu hướng MA', w: '7%', d: 'MA15 vs MA45 — trend' },
                { n: 'M8 Giải ĐB/G1 bias', w: '4%', d: 'Số hay vào giải cao' },
                { n: 'M9 Đồng xuất hiện cặp', w: '4%', d: 'Cặp xuất hiện cùng kỳ trước' },
                { n: 'M10 Bayes', w: '3%', d: 'Prior 27% + 14 kỳ QS' },
                { n: 'M11 Trọng số thời gian', w: '5%', d: 'Exponential decay 0.93' },
                { n: 'M12 So max vắng LS', w: '6%', d: 'Vắng hiện tại / kỷ lục vắng' },
              ]).map((m, i) => (
                <div key={i} className="flex gap-2">
                  <span className="font-bold text-indigo-700 shrink-0 w-8">{m.w}</span>
                  <div><span className="font-semibold text-slate-700">{m.n}</span><span className="text-slate-400"> — {m.d}</span></div>
                </div>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-center">
            <button onClick={handleSave} disabled={saving || savedForNextDraw}
              className="px-8 py-3 rounded-xl font-semibold shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: savedForNextDraw ? '#d1fae5' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: savedForNextDraw ? '#065f46' : 'white' }}>
              {saving ? '⏳ Đang lưu...' : savedForNextDraw
                ? `✓ Đã lưu ${mode === 'de' ? `${saveCount} số Đề` : 'Lô'} kỳ ${format(nextDrawDate, 'dd/MM')}`
                : `💾 Lưu ${saveCount} số ${mode === 'de' ? '♦️ Đề' : '🎰 Lô'} kỳ ${format(nextDrawDate, 'dd/MM')}`}
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORY ──────────────────────────────────────────────────── */}
      {activeView === 'history' && (
        <div className="space-y-4">
          {loadingPreds ? (
            <div className="text-center py-8 text-slate-400">Đang tải lịch sử...</div>
          ) : predictions.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-slate-600 font-medium">Chưa có lịch sử dự đoán {mode === 'de' ? 'Đề' : 'Lô'}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-bold text-slate-800">Lịch sử {mode === 'de' ? '♦️ Đề' : '🎰 Lô'} ({predictions.length} kỳ)</h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200">
                    {tiers.map(t => (
                      <span key={t.label} className="flex items-center gap-1">
                        <span className={`w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${t.ballCls}`}>{t.range[0]+1}</span>
                        <span>{t.short}</span>
                      </span>
                    ))}
                    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] number-hit">✓</span>Trúng</span>
                    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] number-miss">✗</span>Trượt</span>
                  </div>
                  <button onClick={() => loadPredictions(authToken)} className="text-xs text-indigo-600 font-medium">↻ Mới</button>
                </div>
              </div>

              {/* Simulator / Backfill Tools */}
              <div className="card p-4 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-700 text-sm">Chạy lại mô phỏng thuật toán</h4>
                  <p className="text-xs text-slate-500">Giả lập dự đoán cho các kỳ quá khứ để kiểm chứng Lãi/Lỗ</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Số ngày:</span>
                  <input type="number" min="1" max="100" value={backfillDays} onChange={e => setBackfillDays(parseInt(e.target.value) || 1)} className="w-16 h-8 text-sm px-2 border border-slate-300 rounded focus:border-indigo-500 outline-none" />
                  <button onClick={handleBackfill} disabled={backfillRunning} className="h-8 px-4 bg-indigo-600 text-white text-xs font-bold rounded shadow-sm hover:bg-indigo-700 disabled:opacity-50">
                    {backfillRunning ? '⏳ Đang chạy...' : '▶ Chạy Backfill'}
                  </button>
                </div>
              </div>

              {/* Profit/Loss Stats */}
              {profitStats && (
                <div className="card border-0 shadow-sm overflow-hidden mb-4">
                  <div className="bg-slate-100 p-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💰</span>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Bảng thống kê Lãi / Lỗ ({profitStats.days} kỳ)</h4>
                        <div className="text-[11px] text-slate-500">
                          {mode === 'de' ? 'Giả lập đánh Đề: Vốn 1k/số – Trúng được 70k' : 'Giả lập đánh Lô: Vốn 23k/điểm – Trúng được 80k/điểm'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 bg-white">
                    <div className="p-4 text-center">
                      <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-1">Tổng Trúng</div>
                      <div className="text-xl font-black text-slate-700">{profitStats.totalHits} nháy</div>
                    </div>
                    <div className="p-4 text-center">
                      <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-1">Tổng Vốn</div>
                      <div className="text-xl font-black text-slate-700">{formatNumber(profitStats.totalCost)}k</div>
                    </div>
                    <div className="p-4 text-center">
                      <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-1">Tổng Thu</div>
                      <div className="text-xl font-black text-slate-700">{formatNumber(profitStats.totalRevenue)}k</div>
                    </div>
                    <div className={`p-4 text-center ${profitStats.isProfit ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{color: profitStats.isProfit ? '#059669' : '#dc2626'}}>
                        {profitStats.isProfit ? 'LÃI' : 'LỖ'}
                      </div>
                      <div className="text-xl font-black" style={{color: profitStats.isProfit ? '#059669' : '#dc2626'}}>
                        {profitStats.profit > 0 ? '+' : ''}{formatNumber(profitStats.profit)}k
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {predictions.map(pred => <HistoryCard key={`${pred.date}-${pred.mode}`} pred={pred} mode={mode} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
