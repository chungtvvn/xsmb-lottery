'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { LotteryDraw, PredictionRecord } from '@/types/lottery';
import { generatePredictions, PredictionScore, formatNumber, getAllNumbers, getNextDrawDate } from '@/lib/lottery-analyzer';
import { format, parseISO, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Props { draws: LotteryDraw[]; }

function makeAuthToken(user: string, pass: string) {
  return btoa(`${user}:${pass}`);
}

// Fixed ball component — always centered regardless of context
function Ball({ n, cls, size = 'md' }: { n: number; cls?: string; size?: 'xs' | 'sm' | 'md' }) {
  const sz = { xs: 'w-7 h-7 text-[11px]', sm: 'w-9 h-9 text-sm', md: 'w-10 h-10 text-sm' }[size];
  return (
    <span className={`${sz} rounded-full inline-flex items-center justify-center font-bold shrink-0 ${cls ?? ''}`}>
      {formatNumber(n)}
    </span>
  );
}

// Expandable detail card for each predicted number
function NumberDetail({ s, rank }: { s: PredictionScore; rank: number }) {
  const [open, setOpen] = useState(false);
  const tierCls = rank <= 6 ? 'number-predicted' : rank <= 12 ? 'number-cold' : 'number-hot';
  const tierBorder = rank <= 6 ? 'border-emerald-200 bg-emerald-50' : rank <= 12 ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50';
  const tierText = rank <= 6 ? 'text-emerald-700' : rank <= 12 ? 'text-blue-700' : 'text-orange-700';
  const gradeCls: Record<string, string> = { 'A+': 'bg-emerald-500 text-white', 'A': 'bg-blue-500 text-white', 'B': 'bg-orange-400 text-white', 'C': 'bg-slate-400 text-white' };

  return (
    <div className={`card border ${tierBorder} transition-all`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/60 rounded-xl"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xs text-slate-400 w-5 text-center font-bold">#{rank}</span>
        <Ball n={s.number} cls={tierCls} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${gradeCls[s.grade]} px-1.5 py-0.5 rounded`}>{s.grade}</span>
            <span className={`text-sm font-bold ${tierText}`}>{s.score.toFixed(1)}đ</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{s.explanation}</p>
        </div>
        {/* Mini bar */}
        <div className="w-20 progress-bar hidden sm:block">
          <div className="progress-fill" style={{
            width: `${s.score}%`,
            background: rank <= 6 ? 'linear-gradient(90deg,#10b981,#059669)' : rank <= 12 ? 'linear-gradient(90deg,#3b82f6,#6366f1)' : 'linear-gradient(90deg,#f97316,#ef4444)',
          }} />
        </div>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="px-3 pb-3 border-t border-slate-100 mt-0 animate-fade-in">
          <p className="text-[11px] text-slate-500 mt-2 mb-2 font-medium">Chi tiết 12 phương pháp phân tích:</p>
          <div className="space-y-1.5">
            {s.methods.map(m => (
              <div key={m.name} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-[11px]">
                <div className="min-w-0">
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
          <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
            {s.reasons.map((r, i) => (
              <span key={i} className="stat-badge badge-purple">{r}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PredictionTab({ draws }: Props) {
  // Auth
  const [isAuthed, setIsAuthed] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [authChecking, setAuthChecking] = useState(false);

  // Data
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingPreds, setLoadingPreds] = useState(false);
  const [savedForNextDraw, setSavedForNextDraw] = useState(false);
  const [activeView, setActiveView] = useState<'predict' | 'history'>('predict');
  const [showAll, setShowAll] = useState(false);  // show top 27 vs top 18

  // Compute
  const sorted = useMemo(
    () => [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [draws]
  );
  const latestDraw = sorted[sorted.length - 1];
  const nextDrawDate = latestDraw ? addDays(parseISO(latestDraw.date), 1) : addDays(new Date(), 1);
  const nextDrawStr = format(nextDrawDate, 'yyyy-MM-dd');
  const nextDrawLabel = format(nextDrawDate, "EEEE, dd/MM/yyyy", { locale: vi });

  const predictionScores: PredictionScore[] = useMemo(() => generatePredictions(draws), [draws]);
  const displayCount = showAll ? 27 : 18;
  const displayed = predictionScores.slice(0, displayCount);

  // Grade breakdown
  const gradeCount = {
    'A+': predictionScores.slice(0, 18).filter(s => s.grade === 'A+').length,
    'A': predictionScores.slice(0, 18).filter(s => s.grade === 'A').length,
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
      const res = await fetch('/api/predictions', { headers: { 'x-auth-token': token } });
      if (res.ok) {
        const data: PredictionRecord[] = await res.json();
        setPredictions(data);
        setSavedForNextDraw(data.some(p => p.date === nextDrawStr));
      }
    } finally { setLoadingPreds(false); }
  }, [nextDrawStr]);

  useEffect(() => {
    if (isAuthed && authToken) loadPredictions(authToken);
  }, [isAuthed, authToken, loadPredictions]);

  const handleLogin = async () => {
    if (!username || !password) { setAuthError('Vui lòng nhập đầy đủ'); return; }
    setAuthChecking(true); setAuthError('');
    const token = makeAuthToken(username, password);
    try {
      const res = await fetch('/api/predictions', { headers: { 'x-auth-token': token } });
      if (res.status === 401) { setAuthError('Sai tên đăng nhập hoặc mật khẩu'); return; }
      const data: PredictionRecord[] = await res.json();
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
      const top18 = predictionScores.slice(0, 18);
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': authToken },
        body: JSON.stringify({
          date: nextDrawStr,
          predictedNumbers: top18.map(s => s.number),
          method: 'Ensemble 12 phương pháp (Markov, Bayes, Trend, DOW, ...)',
          topNumbers: top18.map(s => ({ number: s.number, score: parseFloat(s.score.toFixed(2)) })),
        }),
      });
      if (res.ok) { setSavedForNextDraw(true); await loadPredictions(authToken); }
    } finally { setSaving(false); }
  };

  const handleLogout = () => {
    setIsAuthed(false); setAuthToken(''); setUsername(''); setPassword(''); setPredictions([]);
    sessionStorage.removeItem('xsmb_auth');
  };

  // ── LOGIN ─────────────────────────────────────────────────────
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
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="username"
                className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1.5 block font-medium">Mật khẩu</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            </div>
            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">⚠️ {authError}</div>
            )}
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

  // ── MAIN ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Dự đoán &amp; Lịch sử</h2>
          <p className="text-xs text-slate-400">Người dùng: <span className="font-semibold text-indigo-600">{username}</span></p>
        </div>
        <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 hover:border-red-200">
          Đăng xuất
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveView('predict')} className={`tab-btn ${activeView === 'predict' ? 'tab-btn-active' : 'tab-btn-inactive'}`}>
          🎯 Dự đoán kỳ tiếp
        </button>
        <button onClick={() => setActiveView('history')} className={`tab-btn ${activeView === 'history' ? 'tab-btn-active' : 'tab-btn-inactive'}`}>
          📋 Lịch sử ({predictions.length})
        </button>
      </div>

      {/* ── PREDICTION VIEW ─────────────────────────────────────── */}
      {activeView === 'predict' && (
        <div className="space-y-4">
          {/* Next draw banner */}
          <div className="card p-5 border-l-4 border-l-indigo-500 bg-indigo-50 border-indigo-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-indigo-600 uppercase font-bold tracking-wider">Kỳ xổ số tiếp theo</p>
                <h3 className="text-xl font-bold text-indigo-900 mt-1 capitalize">{nextDrawLabel}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tính từ kết quả mới nhất: {latestDraw ? format(parseISO(latestDraw.date), 'dd/MM/yyyy') : ''} • {draws.length} kỳ lịch sử • 12 phương pháp
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {savedForNextDraw && <span className="stat-badge badge-green text-sm px-3 py-1.5">✓ Đã lưu dự đoán</span>}
                <div className="flex gap-2 text-xs">
                  <span className="stat-badge badge-green">A+: {gradeCount['A+']} số</span>
                  <span className="stat-badge badge-blue">A: {gradeCount['A']} số</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top 6 highlight */}
          <div className="card p-5 border-2 border-emerald-200 bg-emerald-50/40">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-emerald-800 text-sm">🏆 Cực kỳ tự tin — TOP 6 số</h3>
              <span className="stat-badge badge-green">Score cao nhất</span>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              {predictionScores.slice(0, 6).map((s, idx) => (
                <div key={s.number} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-slate-400">#{idx + 1}</span>
                  <Ball n={s.number} cls="number-predicted" size="md" />
                  <div className="text-xs font-bold text-emerald-700">{s.score.toFixed(1)}</div>
                  <span className={`text-[10px] font-bold px-1 rounded ${s.grade === 'A+' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>{s.grade}</span>
                  <div className="text-[9px] text-slate-400 text-center max-w-[52px] leading-tight">{s.explanation.split('•')[0].trim()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tiers 2 & 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5 border border-blue-200 bg-blue-50/30">
              <h3 className="font-bold text-blue-700 text-sm mb-3">⭐ Tự tin cao — Top 7–12</h3>
              <div className="flex flex-wrap gap-3">
                {predictionScores.slice(6, 12).map((s, idx) => (
                  <div key={s.number} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-400">#{idx + 7}</span>
                    <Ball n={s.number} cls="number-cold" size="sm" />
                    <div className="text-[11px] font-bold text-blue-700">{s.score.toFixed(0)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5 border border-orange-200 bg-orange-50/30">
              <h3 className="font-bold text-orange-700 text-sm mb-3">💡 Khả năng — Top 13–18</h3>
              <div className="flex flex-wrap gap-3">
                {predictionScores.slice(12, 18).map((s, idx) => (
                  <div key={s.number} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-400">#{idx + 13}</span>
                    <Ball n={s.number} cls="number-hot" size="sm" />
                    <div className="text-[11px] font-bold text-orange-700">{s.score.toFixed(0)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed expandable table */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Phân tích chi tiết theo từng số</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Click vào từng số để xem giải thích 12 phương pháp</p>
              </div>
              <button
                onClick={() => setShowAll(v => !v)}
                className="text-xs text-indigo-600 hover:underline font-medium"
              >
                {showAll ? '▲ Ẩn bớt' : `▼ Xem Top 27`}
              </button>
            </div>
            <div className="space-y-2">
              {displayed.map((s, idx) => (
                <NumberDetail key={s.number} s={s} rank={idx + 1} />
              ))}
            </div>
          </div>

          {/* Method legend */}
          <div className="card p-5 bg-slate-50">
            <h3 className="font-bold text-slate-700 text-sm mb-3">📖 Giải thích 12 phương pháp phân tích</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
              {[
                { n: 'M1 Momentum 7 kỳ', d: 'Tỉ lệ xuất hiện trong 7 kỳ gần nhất — đánh giá "nóng" ngắn hạn', w: '18%' },
                { n: 'M2 Tần suất 30 kỳ', d: 'Tỉ lệ xuất hiện trong 30 kỳ gần nhất', w: '15%' },
                { n: 'M3 Tần suất 90 kỳ', d: 'Tỉ lệ trung hạn 90 kỳ — đánh giá xu hướng dài hơn', w: '10%' },
                { n: 'M4 Áp lực vắng mặt', d: 'Số kỳ vắng / TB kỳ vắng — cao → sắp trở lại', w: '22%' },
                { n: 'M5 Ngày trong tuần', d: 'Tỉ lệ xuất hiện vào đúng thứ của kỳ tiếp theo', w: '8%' },
                { n: 'M6 Markov', d: 'Xác suất tái xuất/không xuất dựa trên kỳ trước', w: '8%' },
                { n: 'M7 Xu hướng', d: 'So sánh tần suất 15 kỳ vs 45 kỳ để phát hiện trend', w: '7%' },
                { n: 'M8 Giải ĐB/G1', d: 'Bias số hay vào giải đặc biệt và giải nhất', w: '4%' },
                { n: 'M9 Đồng xuất hiện', d: 'Cặp số hay xuất hiện cùng với kỳ trước', w: '4%' },
                { n: 'M10 Bayes', d: 'Cập nhật xác suất prior 27% bằng quan sát 14 kỳ', w: '3%' },
                { n: 'M11 Trọng số thời gian', d: 'Hàm exponential decay — kỳ gần có trọng số cao hơn', w: '5%' },
                { n: 'M12 So sánh max vắng', d: 'Vắng hiện tại so với kỷ lục vắng dài nhất của số đó', w: '6%' },
              ].map(m => (
                <div key={m.n} className="flex gap-2">
                  <span className="font-bold text-indigo-700 shrink-0">{m.w}</span>
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
            <button
              onClick={handleSave} disabled={saving || savedForNextDraw}
              className="px-8 py-3 rounded-xl font-semibold shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: savedForNextDraw ? undefined : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                backgroundColor: savedForNextDraw ? '#f0fdf4' : undefined,
                border: savedForNextDraw ? '1px solid #bbf7d0' : 'none',
                color: savedForNextDraw ? '#15803d' : 'white',
              }}
            >
              {saving ? '⏳ Đang lưu...' : savedForNextDraw ? `✓ Đã lưu kỳ ${format(nextDrawDate, 'dd/MM')}` : `💾 Lưu dự đoán kỳ ${format(nextDrawDate, 'dd/MM')}`}
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORY VIEW ──────────────────────────────────────────── */}
      {activeView === 'history' && (
        <div className="space-y-4">
          {loadingPreds ? (
            <div className="text-center py-8 text-slate-400">Đang tải lịch sử...</div>
          ) : predictions.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-slate-600 font-medium">Chưa có lịch sử dự đoán</p>
              <p className="text-slate-400 text-sm mt-1">Mở tab "Dự đoán kỳ tiếp" và lưu dự đoán đầu tiên</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Lịch sử dự đoán ({predictions.length} kỳ)</h3>
                <button onClick={() => loadPredictions(authToken)} className="text-xs text-indigo-600 font-medium">↻ Làm mới</button>
              </div>

              {predictions.some(p => p.hits !== undefined) && (() => {
                const wr = predictions.filter(p => p.hits !== undefined);
                const totalHits = wr.reduce((a, b) => a + (b.hits || 0), 0);
                const avgHits = wr.length > 0 ? totalHits / wr.length : 0;
                const bestDay = [...wr].sort((a, b) => (b.hits || 0) - (a.hits || 0))[0];
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="card p-3 text-center bg-emerald-50 border-emerald-200">
                      <div className="text-xl font-bold text-emerald-700">{totalHits}</div>
                      <div className="text-xs text-slate-500">Tổng trúng</div>
                    </div>
                    <div className="card p-3 text-center bg-blue-50 border-blue-200">
                      <div className="text-xl font-bold text-blue-700">{avgHits.toFixed(1)}</div>
                      <div className="text-xs text-slate-500">TB/kỳ</div>
                    </div>
                    <div className="card p-3 text-center bg-orange-50 border-orange-200">
                      <div className="text-xl font-bold text-orange-700">{bestDay?.hits || 0}</div>
                      <div className="text-xs text-slate-500">Cao nhất</div>
                    </div>
                  </div>
                );
              })()}

              {predictions.map(pred => {
                const hasResult = pred.hits !== undefined;
                const hitRate = hasResult && pred.predictedNumbers.length > 0
                  ? ((pred.hits || 0) / pred.predictedNumbers.length) * 100 : null;
                return (
                  <div key={pred.date} className={`card p-5 border ${hasResult && (pred.hits || 0) > 0 ? 'border-emerald-200' : hasResult ? 'border-slate-200' : 'border-indigo-200 bg-indigo-50/30'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="font-semibold text-slate-800 capitalize">
                          {format(parseISO(pred.date), "EEEE dd/MM/yyyy", { locale: vi })}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{pred.method}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasResult ? (
                          <>
                            <span className="stat-badge badge-green">✓ {pred.hits} trúng</span>
                            {(pred.miss || 0) > 0 && <span className="stat-badge badge-red">✗ {pred.miss} trượt</span>}
                            {hitRate !== null && <span className="stat-badge badge-blue">{hitRate.toFixed(0)}%</span>}
                          </>
                        ) : <span className="stat-badge badge-purple">⏳ Chờ kết quả</span>}
                      </div>
                    </div>

                    <div className="mb-2">
                      <p className="text-xs text-slate-400 mb-2 font-medium">Dự đoán ({pred.predictedNumbers.length} số):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {pred.predictedNumbers.map(n => {
                          const isHit = hasResult && pred.actualNumbers?.includes(n);
                          return (
                            <Ball key={n} n={n}
                              cls={isHit ? 'number-hit' : hasResult ? 'number-neutral' : 'number-predicted'}
                              size="xs"
                            />
                          );
                        })}
                      </div>
                    </div>

                    {hasResult && pred.actualNumbers && pred.actualNumbers.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400 mb-2 font-medium">Kết quả thực ({pred.actualNumbers.length} số):</p>
                        <div className="flex flex-wrap gap-1.5">
                          {pred.actualNumbers.map(n => (
                            <Ball key={n} n={n}
                              cls={pred.predictedNumbers.includes(n) ? 'number-hit' : 'number-neutral'}
                              size="xs"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
