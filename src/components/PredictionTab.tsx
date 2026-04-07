'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { LotteryDraw, LotteryMode, PredictionRecord } from '@/types/lottery';
import { generatePredictions, PredictionScore, formatNumber, getDrawNumbers, getNextDrawDate } from '@/lib/lottery-analyzer';
import { format, parseISO, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Props { draws: LotteryDraw[]; mode: LotteryMode; }

function makeAuthToken(user: string, pass: string) { return btoa(`${user}:${pass}`); }

// Fixed ball — always inline-flex centered
function Ball({ n, cls, size = 'md', title }: { n: number; cls?: string; size?: 'xs' | 'sm' | 'md'; title?: string }) {
  const sz = { xs: 'w-7 h-7 text-[11px]', sm: 'w-9 h-9 text-sm', md: 'w-10 h-10 text-sm' }[size];
  return (
    <span className={`${sz} rounded-full inline-flex items-center justify-center font-bold shrink-0 ${cls ?? ''}`} title={title}>
      {formatNumber(n)}
    </span>
  );
}

// Tier styling helpers
interface TierConfig {
  label: string;
  short: string;
  range: readonly [number, number];
  ballCls: string;
  border: string;
  text: string;
  bar: string;
}

const TIER_CONFIG: TierConfig[] = [
  { label: 'Cực kỳ tự tin', short: '⭐⭐', range: [0, 5],   ballCls: 'number-predicted', border: 'border-emerald-200 bg-emerald-50/40', text: 'text-emerald-700', bar: 'linear-gradient(90deg,#10b981,#059669)' },
  { label: 'Tự tin cao',    short: '⭐',   range: [6, 11],  ballCls: 'number-cold',      border: 'border-blue-200 bg-blue-50/30',    text: 'text-blue-700',    bar: 'linear-gradient(90deg,#3b82f6,#6366f1)' },
  { label: 'Khả năng',      short: '💡',   range: [12, 17], ballCls: 'number-hot',       border: 'border-orange-200 bg-orange-50/30', text: 'text-orange-700',  bar: 'linear-gradient(90deg,#f97316,#ef4444)' },
];

function getTierForIndex(idx: number) {
  return TIER_CONFIG.find(t => idx >= t.range[0] && idx <= t.range[1]) ?? TIER_CONFIG[2];
}

// Expandable number detail card
function NumberDetail({ s, rank }: { s: PredictionScore; rank: number }) {
  const [open, setOpen] = useState(false);
  const tier = getTierForIndex(rank - 1);
  const gradeCls: Record<string, string> = { 'A+': 'bg-emerald-500 text-white', 'A': 'bg-blue-500 text-white', 'B': 'bg-orange-400 text-white', 'C': 'bg-slate-400 text-white' };

  return (
    <div className={`card border ${tier.border} transition-all`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/60 rounded-xl" onClick={() => setOpen(o => !o)}>
        <span className="text-xs text-slate-400 w-5 text-center font-bold">#{rank}</span>
        <Ball n={s.number} cls={tier.ballCls} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${gradeCls[s.grade]} px-1.5 py-0.5 rounded`}>{s.grade}</span>
            <span className={`text-sm font-bold ${tier.text}`}>{s.score.toFixed(1)}đ</span>
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
          <p className="text-[11px] text-slate-500 mt-2 mb-2 font-medium">Chi tiết 12 phương pháp:</p>
          <div className="space-y-1.5">
            {s.methods.map(m => (
              <div key={m.name} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-[11px]">
                <div className="min-w-0 truncate">
                  <span className="font-semibold text-slate-700">{m.name}</span>
                  <span className="text-slate-400 ml-1">— {m.detail}</span>
                </div>
                <div className="w-16 progress-bar">
                  <div className="progress-fill" style={{ width: `${m.score}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
                </div>
                <span className="text-right font-bold text-slate-700 w-10">{m.contribution.toFixed(1)}đ</span>
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

// History card with TIERED color-coded numbers
function HistoryCard({ pred, mode }: { pred: PredictionRecord; mode: LotteryMode }) {
  const hasResult = pred.actualNumbers !== undefined && pred.actualNumbers.length > 0;
  const actualSet = new Set(pred.actualNumbers ?? []);
  const predictedSet = new Set(pred.predictedNumbers);
  const tier1 = pred.predictedNumbers.slice(0, 6);
  const tier2 = pred.predictedNumbers.slice(6, 12);
  const tier3 = pred.predictedNumbers.slice(12, 18);

  const hits = pred.hits ?? 0;
  const total = pred.predictedNumbers.length;
  const hitRate = total > 0 ? (hits / total) * 100 : 0;

  // Determine ball class for a number in a known tier
  const getBallCls = (n: number, tierIdx: number) => {
    if (!hasResult) return TIER_CONFIG[tierIdx].ballCls;
    if (actualSet.has(n)) return 'number-hit';      // trúng
    return 'number-miss';                            // trượt
  };

  const tierLabel = (tier: typeof TIER_CONFIG[0], numbers: number[], tierIdx: number) => (
    <div className="mb-2">
      <div className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
        <span>{tier.short}</span>
        <span>{tier.label}</span>
        {hasResult && (
          <span className="ml-auto text-[9px] font-normal">
            {numbers.filter(n => actualSet.has(n)).length}/{numbers.length} trúng
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {numbers.map(n => (
          <div key={n} className="flex flex-col items-center gap-0.5">
            <Ball n={n} cls={getBallCls(n, tierIdx)} size="xs"
              title={hasResult ? (actualSet.has(n) ? '✓ Trúng' : '✗ Trượt') : undefined} />
            {hasResult && (
              <span className={`text-[8px] font-bold leading-none ${actualSet.has(n) ? 'text-amber-600' : 'text-slate-300'}`}>
                {actualSet.has(n) ? '✓' : '✗'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`card p-4 border ${hasResult && hits > 0 ? 'border-emerald-300' : hasResult ? 'border-slate-200' : 'border-indigo-200 bg-indigo-50/20'}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-semibold text-slate-800 capitalize text-sm">
            {format(parseISO(pred.date), "EEEE dd/MM/yyyy", { locale: vi })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{pred.method}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`stat-badge text-sm px-2 py-1 ${mode === 'de' ? 'badge-orange' : 'badge-purple'}`}>
            {mode === 'de' ? '♦️ Đề' : '🎰 Lô'}
          </span>
          {hasResult ? (
            <>
              <span className="stat-badge badge-green">✓ {hits} trúng</span>
              {(pred.miss ?? 0) > 0 && <span className="stat-badge badge-red">✗ {pred.miss} trượt</span>}
              <span className="stat-badge badge-blue">{hitRate.toFixed(0)}% tỉ lệ</span>
            </>
          ) : (
            <span className="stat-badge badge-purple">⏳ Chờ kết quả</span>
          )}
        </div>
      </div>

      {/* Tiered predicted numbers */}
      <div className="space-y-1">
        {tier1.length > 0 && tierLabel(TIER_CONFIG[0], tier1, 0)}
        {tier2.length > 0 && tierLabel(TIER_CONFIG[1], tier2, 1)}
        {tier3.length > 0 && tierLabel(TIER_CONFIG[2], tier3, 2)}
      </div>

      {/* Actual result */}
      {hasResult && pred.actualNumbers && pred.actualNumbers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 font-medium mb-1.5">
            Kết quả thực ({pred.actualNumbers.length} số):
          </p>
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

  const sorted = useMemo(() => [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [draws]);
  const latestDraw = sorted[sorted.length - 1];
  const nextDrawDate = latestDraw ? addDays(parseISO(latestDraw.date), 1) : addDays(new Date(), 1);
  const nextDrawStr = format(nextDrawDate, 'yyyy-MM-dd');
  const nextDrawLabel = format(nextDrawDate, "EEEE, dd/MM/yyyy", { locale: vi });

  // Count for Đề mode: top 5 vs top 3; Lô: top 18 vs top 27
  const defaultCount = mode === 'de' ? 5 : 18;
  const expandedCount = mode === 'de' ? 10 : 27;
  const displayCount = showAll ? expandedCount : defaultCount;

  const predictionScores: PredictionScore[] = useMemo(
    () => generatePredictions(draws, expandedCount, mode),
    [draws, mode, expandedCount]
  );
  const displayed = predictionScores.slice(0, displayCount);

  const gradeCount = {
    'A+': predictionScores.slice(0, defaultCount).filter(s => s.grade === 'A+').length,
    'A': predictionScores.slice(0, defaultCount).filter(s => s.grade === 'A').length,
  };

  // Auth
  useEffect(() => {
    const saved = sessionStorage.getItem('xsmb_auth');
    if (saved) {
      try {
        const { token, user } = JSON.parse(saved);
        setAuthToken(token); setUsername(user); setIsAuthed(true);
      } catch { /* ignore */ }
    }
  }, []);

  const loadPredictions = useCallback(async (token: string) => {
    setLoadingPreds(true);
    try {
      const res = await fetch(`/api/predictions?mode=${mode}`, { headers: { 'x-auth-token': token } });
      if (res.ok) {
        const data: PredictionRecord[] = await res.json();
        // Sort descending by date
        data.sort((a, b) => b.date.localeCompare(a.date));
        setPredictions(data);
        setSavedForNextDraw(data.some(p => p.date === nextDrawStr));
      }
    } finally { setLoadingPreds(false); }
  }, [nextDrawStr, mode]);

  useEffect(() => {
    if (isAuthed && authToken) loadPredictions(authToken);
  }, [isAuthed, authToken, loadPredictions]);

  // Reset saved flag when mode changes
  useEffect(() => {
    setSavedForNextDraw(predictions.some(p => p.date === nextDrawStr && (p.mode ?? 'lo') === mode));
  }, [mode, predictions, nextDrawStr]);

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

  const handleSave = async () => {
    if (!isAuthed || !authToken) return;
    setSaving(true);
    try {
      const topN = predictionScores.slice(0, defaultCount);
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': authToken },
        body: JSON.stringify({
          date: nextDrawStr,
          mode,
          predictedNumbers: topN.map(s => s.number),
          method: `Ensemble 12 phương pháp (${mode === 'de' ? '♦️ Đề' : '🎰 Lô'})`,
          topNumbers: topN.map(s => ({ number: s.number, score: parseFloat(s.score.toFixed(2)) })),
        }),
      });
      if (res.ok) { setSavedForNextDraw(true); await loadPredictions(authToken); }
    } finally { setSaving(false); }
  };

  const handleLogout = () => {
    setIsAuthed(false); setAuthToken(''); setUsername(''); setPassword('');
    setPredictions([]); setSavedForNextDraw(false);
    sessionStorage.removeItem('xsmb_auth');
  };

  if (!isAuthed) {
    return (
      <div className="max-w-sm mx-auto pt-8 animate-fade-in">
        <div className="card p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl shadow-md"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>🔮</div>
            <h2 className="text-2xl font-bold text-slate-800">Dự đoán &amp; Lịch sử</h2>
            <p className="text-slate-500 text-sm mt-2">Đăng nhập để xem và lưu dự đoán</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 mb-1.5 block font-medium">Tên đăng nhập</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="username"
                className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1.5 block font-medium">Mật khẩu</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            </div>
            {authError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">⚠️ {authError}</div>}
            <button onClick={handleLogin} disabled={authChecking}
              className="w-full py-3 rounded-xl font-semibold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              {authChecking ? '⏳ Đang xác thực...' : 'Đăng nhập'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            Dự đoán &amp; Lịch sử —{' '}
            <span className={mode === 'de' ? 'text-amber-700' : 'text-indigo-700'}>
              {mode === 'de' ? '♦️ Chế độ Đề (Giải ĐB)' : '🎰 Chế độ Lô (Toàn bộ)'}
            </span>
          </h2>
          <p className="text-xs text-slate-400">Người dùng: <span className="font-semibold text-indigo-600">{username}</span></p>
        </div>
        <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 hover:border-red-200">Đăng xuất</button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveView('predict')} className={`tab-btn ${activeView === 'predict' ? 'tab-btn-active' : 'tab-btn-inactive'}`}>🎯 Dự đoán kỳ tiếp</button>
        <button onClick={() => setActiveView('history')} className={`tab-btn ${activeView === 'history' ? 'tab-btn-active' : 'tab-btn-inactive'}`}>📋 Lịch sử ({predictions.length})</button>
      </div>

      {/* ── PREDICTION ─────────────────────────────────────────── */}
      {activeView === 'predict' && (
        <div className="space-y-4">
          {/* Next draw banner */}
          <div className={`card p-5 border-l-4 ${mode === 'de' ? 'border-l-amber-500 bg-amber-50 border-amber-200' : 'border-l-indigo-500 bg-indigo-50 border-indigo-200'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={`text-xs uppercase font-bold tracking-wider ${mode === 'de' ? 'text-amber-600' : 'text-indigo-600'}`}>
                  {mode === 'de' ? '♦️ Đề — Kỳ tiếp theo' : '🎰 Lô — Kỳ xổ số tiếp theo'}
                </p>
                <h3 className="text-xl font-bold text-slate-900 mt-1 capitalize">{nextDrawLabel}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kết quả mới nhất: {latestDraw ? format(parseISO(latestDraw.date), 'dd/MM/yyyy') : ''}
                  {mode === 'de' && latestDraw && <span className="ml-2 font-bold text-amber-700">ĐB gần nhất: {formatNumber(latestDraw.special)}</span>}
                  {' '}• {draws.length} kỳ • 12 phương pháp
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {savedForNextDraw && <span className="stat-badge badge-green text-sm px-3 py-1.5">✓ Đã lưu</span>}
                <div className="flex gap-2 text-xs">
                  <span className="stat-badge badge-green">A+: {gradeCount['A+']}s</span>
                  <span className="stat-badge badge-blue">A: {gradeCount['A']}s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tier 1 — Cực kỳ tự tin */}
          <div className={`card p-5 border-2 ${TIER_CONFIG[0].border}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-bold text-sm ${TIER_CONFIG[0].text}`}>
                🏆 Cực kỳ tự tin — Top {mode === 'de' ? 3 : 6} số
              </h3>
              <span className="stat-badge badge-green">Score cao nhất</span>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              {predictionScores.slice(0, mode === 'de' ? 3 : 6).map((s, idx) => (
                <div key={s.number} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-slate-400">#{idx + 1}</span>
                  <Ball n={s.number} cls={TIER_CONFIG[0].ballCls} size="md" />
                  <div className="text-xs font-bold text-emerald-700">{s.score.toFixed(1)}</div>
                  <span className={`text-[10px] font-bold px-1 rounded ${s.grade === 'A+' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>{s.grade}</span>
                  <div className="text-[9px] text-slate-400 text-center max-w-[52px] leading-tight">{s.explanation.split('•')[0].trim()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier 2 & 3 — Lô mode only (Đề has fewer numbers) */}
          {mode === 'lo' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`card p-5 border ${TIER_CONFIG[1].border}`}>
                <h3 className={`font-bold text-sm mb-3 ${TIER_CONFIG[1].text}`}>⭐ Tự tin cao — Top 7–12</h3>
                <div className="flex flex-wrap gap-3">
                  {predictionScores.slice(6, 12).map((s, idx) => (
                    <div key={s.number} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-400">#{idx + 7}</span>
                      <Ball n={s.number} cls={TIER_CONFIG[1].ballCls} size="sm" />
                      <div className="text-[11px] font-bold text-blue-700">{s.score.toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`card p-5 border ${TIER_CONFIG[2].border}`}>
                <h3 className={`font-bold text-sm mb-3 ${TIER_CONFIG[2].text}`}>💡 Khả năng — Top 13–18</h3>
                <div className="flex flex-wrap gap-3">
                  {predictionScores.slice(12, 18).map((s, idx) => (
                    <div key={s.number} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-400">#{idx + 13}</span>
                      <Ball n={s.number} cls={TIER_CONFIG[2].ballCls} size="sm" />
                      <div className="text-[11px] font-bold text-orange-700">{s.score.toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Đề tier 2 */}
          {mode === 'de' && (
            <div className={`card p-5 border ${TIER_CONFIG[1].border}`}>
              <h3 className={`font-bold text-sm mb-3 ${TIER_CONFIG[1].text}`}>⭐ Tự tin — Top 4–5 (Đề)</h3>
              <div className="flex flex-wrap gap-4">
                {predictionScores.slice(3, 5).map((s, idx) => (
                  <div key={s.number} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-400">#{idx + 4}</span>
                    <Ball n={s.number} cls={TIER_CONFIG[1].ballCls} size="sm" />
                    <div className="text-[11px] font-bold text-blue-700">{s.score.toFixed(1)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed expandable list */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Phân tích chi tiết từng số</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Click để xem giải thích 12 phương pháp</p>
              </div>
              <button onClick={() => setShowAll(v => !v)} className="text-xs text-indigo-600 hover:underline font-medium">
                {showAll ? '▲ Ẩn bớt' : `▼ Top ${expandedCount}`}
              </button>
            </div>
            <div className="space-y-2">
              {displayed.map((s, idx) => <NumberDetail key={s.number} s={s} rank={idx + 1} />)}
            </div>
          </div>

          {/* Method legend */}
          <div className="card p-5 bg-slate-50">
            <h3 className="font-bold text-slate-700 text-sm mb-3">📖 12 phương pháp phân tích</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              {[
                { n: 'M1 Momentum 7kỳ', w: '18%', d: 'Tần suất trong 7 kỳ gần nhất' },
                { n: 'M2 Tần suất 30kỳ', w: '15%', d: 'Tần suất trung hạn' },
                { n: 'M3 Tần suất 90kỳ', w: '10%', d: 'Tần suất dài hạn' },
                { n: 'M4 Áp lực vắng mặt', w: '22%', d: 'Vắng/TB → sigmoid pressure' },
                { n: 'M5 Ngày trong tuần', w: '8%', d: 'Pattern theo thứ của kỳ tiếp' },
                { n: 'M6 Markov', w: '8%', d: 'Xác suất tái xuất/đổi từ kỳ trước' },
                { n: 'M7 Xu hướng MA', w: '7%', d: 'MA15 vs MA45 — trend tăng/giảm' },
                { n: 'M8 Giải ĐB/G1', w: '4%', d: 'Bias số hay vào giải cao' },
                { n: 'M9 Đồng xuất hiện', w: '4%', d: 'Cặp số hay cùng giải trước' },
                { n: 'M10 Bayes', w: '3%', d: 'Cập nhật prior bằng 14 kỳ QS' },
                { n: 'M11 Trọng số thời gian', w: '5%', d: 'Exponential decay kỳ gần hơn' },
                { n: 'M12 So max vắng LS', w: '6%', d: 'Vắng hiện tại / kỷ lục vắng' },
              ].map(m => (
                <div key={m.n} className="flex gap-2">
                  <span className="font-bold text-indigo-700 shrink-0 w-8">{m.w}</span>
                  <div>
                    <span className="font-semibold text-slate-700">{m.n}</span>
                    <span className="text-slate-400"> — {m.d}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-center">
            <button onClick={handleSave} disabled={saving || savedForNextDraw}
              className="px-8 py-3 rounded-xl font-semibold shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed text-white"
              style={{ background: savedForNextDraw ? '#d1fae5' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: savedForNextDraw ? '#065f46' : 'white' }}>
              {saving ? '⏳ Đang lưu...' : savedForNextDraw
                ? `✓ Đã lưu ${mode === 'de' ? 'Đề' : 'Lô'} kỳ ${format(nextDrawDate, 'dd/MM')}`
                : `💾 Lưu dự đoán ${mode === 'de' ? 'Đề' : 'Lô'} kỳ ${format(nextDrawDate, 'dd/MM')}`}
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORY ─────────────────────────────────────────────── */}
      {activeView === 'history' && (
        <div className="space-y-4">
          {loadingPreds ? (
            <div className="text-center py-8 text-slate-400">Đang tải lịch sử...</div>
          ) : predictions.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-slate-600 font-medium">Chưa có lịch sử dự đoán {mode === 'de' ? 'Đề' : 'Lô'}</p>
              <p className="text-slate-400 text-sm mt-1">Mở tab "Dự đoán kỳ tiếp" và lưu dự đoán đầu tiên</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-bold text-slate-800">Lịch sử {mode === 'de' ? '♦️ Đề' : '🎰 Lô'} ({predictions.length} kỳ)</h3>
                <div className="flex items-center gap-2">
                  {/* Legend */}
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="w-4 h-4 rounded-full bg-amber-500 inline-block" />trúng
                    <span className="w-4 h-4 rounded-full bg-slate-200 inline-block" />trượt
                  </div>
                  <button onClick={() => loadPredictions(authToken)} className="text-xs text-indigo-600 font-medium">↻ Làm mới</button>
                </div>
              </div>

              {/* Stats summary */}
              {predictions.some(p => p.hits !== undefined) && (() => {
                const wr = predictions.filter(p => p.hits !== undefined);
                const totalHits = wr.reduce((a, b) => a + (b.hits || 0), 0);
                const avgHits = wr.length > 0 ? totalHits / wr.length : 0;
                const bestDay = [...wr].sort((a, b) => (b.hits || 0) - (a.hits || 0))[0];
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="card p-3 text-center bg-emerald-50 border-emerald-200"><div className="text-xl font-bold text-emerald-700">{totalHits}</div><div className="text-xs text-slate-500">Tổng trúng</div></div>
                    <div className="card p-3 text-center bg-blue-50 border-blue-200"><div className="text-xl font-bold text-blue-700">{avgHits.toFixed(1)}</div><div className="text-xs text-slate-500">TB/kỳ</div></div>
                    <div className="card p-3 text-center bg-orange-50 border-orange-200"><div className="text-xl font-bold text-orange-700">{bestDay?.hits || 0}</div><div className="text-xs text-slate-500">Cao nhất</div></div>
                  </div>
                );
              })()}

              {/* Tier legend */}
              <div className="flex flex-wrap gap-3 text-xs p-3 bg-slate-50 rounded-xl border border-slate-200">
                {TIER_CONFIG.map(t => (
                  <div key={t.label} className="flex items-center gap-1.5">
                    <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold text-white ${t.ballCls}`}>00</span>
                    <span className="text-slate-500">{t.short} {t.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold number-hit">✓</span>
                  <span className="text-slate-500">Đã trúng</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold number-miss">✗</span>
                  <span className="text-slate-500">Trượt</span>
                </div>
              </div>

              {predictions.map(pred => (
                <HistoryCard key={`${pred.date}-${pred.mode}`} pred={pred} mode={mode} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
