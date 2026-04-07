'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { LotteryDraw, PredictionRecord } from '@/types/lottery';
import { generatePredictions, formatNumber, getAllNumbers, getNextDrawDate } from '@/lib/lottery-analyzer';
import { format, parseISO, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Props {
  draws: LotteryDraw[];
}

function makeAuthToken(user: string, pass: string) {
  return btoa(`${user}:${pass}`);
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

  // Derive next draw date from latest data entry (not today)
  const sorted = useMemo(
    () => [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [draws]
  );
  const latestDraw = sorted[sorted.length - 1];
  const nextDrawDate = latestDraw ? addDays(parseISO(latestDraw.date), 1) : addDays(new Date(), 1);
  const nextDrawStr = format(nextDrawDate, 'yyyy-MM-dd');
  const nextDrawLabel = format(nextDrawDate, "EEEE, dd/MM/yyyy", { locale: vi });

  // Prediction scores based on latest data
  const predictionScores = useMemo(() => generatePredictions(draws), [draws]);

  // ── Auth ──────────────────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem('xsmb_auth');
    if (saved) {
      try {
        const { token, user } = JSON.parse(saved);
        setAuthToken(token);
        setUsername(user);
        setIsAuthed(true);
      } catch { /* ignore */ }
    }
  }, []);

  const loadPredictions = useCallback(async (token: string) => {
    setLoadingPreds(true);
    try {
      const res = await fetch('/api/predictions', {
        headers: { 'x-auth-token': token },
      });
      if (res.ok) {
        const data: PredictionRecord[] = await res.json();
        setPredictions(data);
        setSavedForNextDraw(data.some(p => p.date === nextDrawStr));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPreds(false);
    }
  }, [nextDrawStr]);

  useEffect(() => {
    if (isAuthed && authToken) {
      loadPredictions(authToken);
    }
  }, [isAuthed, authToken, loadPredictions]);

  const handleLogin = async () => {
    if (!username || !password) {
      setAuthError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    setAuthChecking(true);
    setAuthError('');
    const token = makeAuthToken(username, password);
    try {
      const res = await fetch('/api/predictions', { headers: { 'x-auth-token': token } });
      if (res.status === 401) {
        setAuthError('Sai tên đăng nhập hoặc mật khẩu');
        return;
      }
      const data: PredictionRecord[] = await res.json();
      setAuthToken(token);
      setIsAuthed(true);
      sessionStorage.setItem('xsmb_auth', JSON.stringify({ token, user: username }));
      setPredictions(data);
      setSavedForNextDraw(data.some(p => p.date === nextDrawStr));
    } catch {
      setAuthError('Lỗi kết nối server');
    } finally {
      setAuthChecking(false);
    }
  };

  const handleSavePrediction = async () => {
    if (!isAuthed || !authToken) return;
    setSaving(true);
    try {
      const top18 = predictionScores.slice(0, 18);
      const record = {
        date: nextDrawStr,
        predictedNumbers: top18.map(s => s.number),
        method: 'Ensemble 8 phương pháp (Tần suất + Vắng mặt + Bayes + DOW)',
        topNumbers: top18.map(s => ({ number: s.number, score: parseFloat(s.score.toFixed(2)) })),
      };
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': authToken },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        setSavedForNextDraw(true);
        await loadPredictions(authToken);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    setIsAuthed(false);
    setAuthToken('');
    setUsername('');
    setPassword('');
    setPredictions([]);
    sessionStorage.removeItem('xsmb_auth');
  };

  // ── LOGIN ─────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="max-w-sm mx-auto pt-8 animate-fade-in">
        <div className="card p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl shadow-md"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              🔮
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Dự đoán &amp; Lịch sử</h2>
            <p className="text-slate-500 text-sm mt-2">Đăng nhập để xem và lưu dự đoán</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 mb-1.5 block font-medium">Tên đăng nhập</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1.5 block font-medium">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
                ⚠️ {authError}
              </div>
            )}
            <button
              onClick={handleLogin}
              disabled={authChecking}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 shadow-md"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {authChecking ? '⏳ Đang xác thực...' : 'Đăng nhập'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN VIEW ─────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Dự đoán &amp; Lịch sử</h2>
          <p className="text-xs text-slate-400">Người dùng: <span className="font-semibold text-indigo-600">{username}</span></p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-slate-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 hover:border-red-200"
        >
          Đăng xuất
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveView('predict')}
          className={`tab-btn ${activeView === 'predict' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
        >
          🎯 Dự đoán kỳ tiếp
        </button>
        <button
          onClick={() => setActiveView('history')}
          className={`tab-btn ${activeView === 'history' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
        >
          📋 Lịch sử ({predictions.length})
        </button>
      </div>

      {/* ── PREDICTION VIEW ── */}
      {activeView === 'predict' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="card p-5 border-l-4 border-l-indigo-500 bg-indigo-50 border-indigo-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-indigo-600 uppercase font-bold tracking-wider">Kỳ xổ số tiếp theo</p>
                <h3 className="text-xl font-bold text-indigo-900 mt-1 capitalize">{nextDrawLabel}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Dựa trên kết quả mới nhất: {latestDraw ? format(parseISO(latestDraw.date), 'dd/MM/yyyy') : ''}
                  &nbsp;• {draws.length} kỳ lịch sử
                </p>
              </div>
              {savedForNextDraw && (
                <span className="stat-badge badge-green text-sm px-3 py-1.5">✓ Đã lưu dự đoán</span>
              )}
            </div>
          </div>

          {/* Tier cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: '🏆 Cực kỳ tự tin', sublabel: 'Top 1–6 • Score cao nhất', slice: [0, 6] as [number, number], ballClass: 'number-predicted', textColor: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50' },
              { label: '⭐ Tự tin cao',     sublabel: 'Top 7–12 • Xác suất tốt',  slice: [6, 12] as [number, number], ballClass: 'number-cold',      textColor: 'text-blue-700',    border: 'border-blue-200',    bg: 'bg-blue-50' },
              { label: '💡 Khả năng',       sublabel: 'Top 13–18 • Theo dõi',     slice: [12, 18] as [number, number], ballClass: 'number-hot',       textColor: 'text-orange-700',  border: 'border-orange-200',  bg: 'bg-orange-50' },
            ].map(tier => (
              <div key={tier.label} className={`card p-5 border ${tier.border} ${tier.bg}`}>
                <h3 className={`text-sm font-bold ${tier.textColor} mb-0.5`}>{tier.label}</h3>
                <p className="text-xs text-slate-400 mb-4">{tier.sublabel}</p>
                <div className="grid grid-cols-3 gap-2">
                  {predictionScores.slice(...tier.slice).map(s => (
                    <div key={s.number} className="text-center">
                      <span className={`number-ball ${tier.ballClass} mx-auto block mb-1`}>
                        {formatNumber(s.number)}
                      </span>
                      <div className={`text-xs font-bold ${tier.textColor}`}>{s.score.toFixed(0)}đ</div>
                      <div className="text-[9px] text-slate-400 leading-tight mt-0.5 break-words">
                        {s.reasons[0] || ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Detailed score table */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-1 text-sm">Bảng điểm chi tiết (Top 27 số)</h3>
            <p className="text-xs text-slate-400 mb-4">8 phương pháp: Tần suất 7/14/30/90 kỳ • Áp lực vắng • Ngày trong tuần • Giải cao • Bayes</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200">
                    <th className="text-left py-2 pr-3 font-semibold">Hạng</th>
                    <th className="text-left py-2 pr-3 font-semibold">Số</th>
                    <th className="text-right py-2 pr-3 font-semibold w-36">Điểm tổng</th>
                    <th className="text-left py-2 font-semibold">Lý do chính</th>
                  </tr>
                </thead>
                <tbody>
                  {predictionScores.slice(0, 27).map((s, idx) => (
                    <tr key={s.number} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-1.5 pr-3">
                        <span className={`text-xs font-bold ${idx < 6 ? 'text-emerald-700' : idx < 12 ? 'text-blue-700' : 'text-orange-600'}`}>
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className={`number-ball number-ball-xs ${idx < 6 ? 'number-predicted' : idx < 12 ? 'number-cold' : 'number-hot'}`}>
                          {formatNumber(s.number)}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 progress-bar">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${s.score}%`,
                                background: idx < 6
                                  ? 'linear-gradient(90deg,#10b981,#059669)'
                                  : idx < 12
                                  ? 'linear-gradient(90deg,#3b82f6,#6366f1)'
                                  : 'linear-gradient(90deg,#f97316,#ef4444)',
                              }}
                            />
                          </div>
                          <span className="text-slate-800 font-semibold w-8 text-right">{s.score.toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="py-1.5 text-slate-400">
                        {s.reasons.slice(0, 2).join(' • ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Method breakdown for #1 */}
            {predictionScores.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-2">Điểm chi tiết theo phương pháp (số #{formatNumber(predictionScores[0].number)}):</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(predictionScores[0].methods).map(([method, val]) => (
                    <span key={method} className="stat-badge badge-gray">
                      {method}: {val}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex justify-center gap-3">
            <button
              onClick={handleSavePrediction}
              disabled={saving || savedForNextDraw}
              className="px-8 py-3 rounded-xl font-semibold transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: savedForNextDraw
                  ? undefined
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                backgroundColor: savedForNextDraw ? '#f0fdf4' : undefined,
                border: savedForNextDraw ? '1px solid #bbf7d0' : 'none',
                color: savedForNextDraw ? '#15803d' : 'white',
              }}
            >
              {saving ? '⏳ Đang lưu...' : savedForNextDraw ? `✓ Đã lưu cho kỳ ${format(nextDrawDate, 'dd/MM')}` : `💾 Lưu dự đoán kỳ ${format(nextDrawDate, 'dd/MM')}`}
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
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
            <div className="space-y-3">
              {/* Header + summary */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Lịch sử dự đoán ({predictions.length} kỳ)</h3>
                <button onClick={() => loadPredictions(authToken)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  ↻ Làm mới
                </button>
              </div>

              {predictions.some(p => p.hits !== undefined) && (() => {
                const withResults = predictions.filter(p => p.hits !== undefined);
                const totalHits = withResults.reduce((a, b) => a + (b.hits || 0), 0);
                const avgHits = withResults.length > 0 ? totalHits / withResults.length : 0;
                const bestDay = [...withResults].sort((a, b) => (b.hits || 0) - (a.hits || 0))[0];
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="card p-3 text-center bg-emerald-50 border-emerald-200">
                      <div className="text-xl font-bold text-emerald-700">{totalHits}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Tổng số trúng</div>
                    </div>
                    <div className="card p-3 text-center bg-blue-50 border-blue-200">
                      <div className="text-xl font-bold text-blue-700">{avgHits.toFixed(1)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">TB trúng/kỳ</div>
                    </div>
                    <div className="card p-3 text-center bg-orange-50 border-orange-200">
                      <div className="text-xl font-bold text-orange-700">{bestDay?.hits || 0}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Cao nhất/kỳ</div>
                    </div>
                  </div>
                );
              })()}

              {predictions.map(pred => {
                const hasResult = pred.hits !== undefined;
                const hitRate = hasResult && pred.predictedNumbers.length > 0
                  ? ((pred.hits || 0) / pred.predictedNumbers.length) * 100
                  : null;

                return (
                  <div key={pred.date} className={`card p-5 border ${hasResult ? (pred.hits && pred.hits > 0 ? 'border-emerald-200' : 'border-slate-200') : 'border-indigo-200 bg-indigo-50/30'}`}>
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
                            {pred.miss !== undefined && pred.miss > 0 && (
                              <span className="stat-badge badge-red">✗ {pred.miss} trượt</span>
                            )}
                            {hitRate !== null && (
                              <span className="stat-badge badge-blue">{hitRate.toFixed(0)}%</span>
                            )}
                          </>
                        ) : (
                          <span className="stat-badge badge-purple">⏳ Chờ kết quả</span>
                        )}
                      </div>
                    </div>

                    <div className="mb-2">
                      <p className="text-xs text-slate-400 mb-2 font-medium">Dự đoán ({pred.predictedNumbers.length} số):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {pred.predictedNumbers.map(n => {
                          const isHit = hasResult && pred.actualNumbers?.includes(n);
                          return (
                            <span key={n}
                              className={`number-ball number-ball-xs ${isHit ? 'number-hit' : hasResult ? 'number-neutral' : 'number-predicted'}`}
                              title={isHit ? 'TRÚNG!' : ''}>
                              {formatNumber(n)}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {hasResult && pred.actualNumbers && pred.actualNumbers.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400 mb-2 font-medium">Kết quả thực ({pred.actualNumbers.length} số):</p>
                        <div className="flex flex-wrap gap-1.5">
                          {pred.actualNumbers.map(n => (
                            <span key={n}
                              className={`number-ball number-ball-xs ${pred.predictedNumbers.includes(n) ? 'number-hit' : 'number-neutral'}`}>
                              {formatNumber(n)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
