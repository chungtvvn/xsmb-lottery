'use client';

import { useState, useMemo } from 'react';
import { LotteryDraw } from '@/types/lottery';
import { analyzeData, formatNumber, getAllNumbers } from '@/lib/lottery-analyzer';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell
} from 'recharts';

interface Props {
  draws: LotteryDraw[];
}

type Period = 30 | 90 | 180 | 365 | 0;

export default function StatisticsTab({ draws }: Props) {
  const [period, setPeriod] = useState<Period>(90);
  const [subTab, setSubTab] = useState<'overview' | 'heatmap' | 'pairs' | 'recent' | 'advanced'>('overview');

  const analysis = useMemo(() => analyzeData(draws, period), [draws, period]);
  const latestDraw = draws.length > 0 ? draws[draws.length - 1] : null;

  // Chart data: top 30 numbers by frequency
  const chartData = [...analysis.numberStats]
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
    .map(s => ({
      name: formatNumber(s.number),
      count: s.count,
    }));

  const heatmapMax = Math.max(...analysis.numberStats.map(s => s.count), 1);

  // Adjacent pairs
  const adjacentPairs = analysis.pairStats.filter(p => {
    const [a, b] = p.pair.split('-').map(Number);
    return Math.abs(a - b) === 1;
  });

  // Decade stats
  const decadeStats = useMemo(() => Array.from({ length: 10 }, (_, decade) => {
    const nums = analysis.numberStats.filter(s => Math.floor(s.number / 10) === decade);
    const total = nums.reduce((a, b) => a + b.count, 0);
    return { decade: `${decade * 10}–${decade * 10 + 9}`, total, avg: total / 10, numbers: nums };
  }), [analysis]);

  const decadeMax = Math.max(...decadeStats.map(d => d.total), 1);

  return (
    <div className="space-y-4">
      {/* Latest Draw */}
      {latestDraw && (
        <div className="card p-5 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Kết quả gần nhất</h2>
              <p className="text-sm text-slate-500">
                {format(parseISO(latestDraw.date), "EEEE, dd/MM/yyyy", { locale: vi })}
              </p>
            </div>
            <div className="text-xs text-slate-400 text-right">
              <div>{draws.length} kỳ • Từ {format(parseISO(draws[0].date), 'MM/yyyy')}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[320px]">
              <tbody>
                {[
                  { key: 'special', label: 'Đặc Biệt', cls: 'prize-special', vals: [latestDraw.special] },
                  { key: 'prize1',  label: 'Giải Nhất', cls: 'prize-1', vals: [latestDraw.prize1] },
                  { key: 'prize2',  label: 'Giải Nhì',  cls: 'prize-2', vals: [latestDraw.prize2_1, latestDraw.prize2_2] },
                  { key: 'prize3',  label: 'Giải Ba',   cls: 'prize-3', vals: [latestDraw.prize3_1, latestDraw.prize3_2, latestDraw.prize3_3, latestDraw.prize3_4, latestDraw.prize3_5, latestDraw.prize3_6] },
                  { key: 'prize4',  label: 'Giải Tư',   cls: 'prize-4', vals: [latestDraw.prize4_1, latestDraw.prize4_2, latestDraw.prize4_3, latestDraw.prize4_4] },
                  { key: 'prize5',  label: 'Giải Năm',  cls: 'prize-5', vals: [latestDraw.prize5_1, latestDraw.prize5_2, latestDraw.prize5_3, latestDraw.prize5_4, latestDraw.prize5_5, latestDraw.prize5_6] },
                  { key: 'prize6',  label: 'Giải Sáu',  cls: 'prize-6', vals: [latestDraw.prize6_1, latestDraw.prize6_2, latestDraw.prize6_3] },
                  { key: 'prize7',  label: 'Giải Bảy',  cls: 'prize-7', vals: [latestDraw.prize7_1, latestDraw.prize7_2, latestDraw.prize7_3, latestDraw.prize7_4] },
                ].map(row => (
                  <tr key={row.key} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 text-slate-500 whitespace-nowrap w-24 text-xs font-medium">{row.label}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {row.vals.map((v, i) => (
                          <span key={i} className={`number-ball number-ball-sm ${row.cls}`}>
                            {formatNumber(v)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Period Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 font-medium">Khoảng phân tích:</span>
        {([30, 90, 180, 365, 0] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p ? 'tab-btn-active' : 'tab-btn-inactive'}`}
          >
            {p === 0 ? `Tất cả (${draws.length})` : `${p} kỳ`}
          </button>
        ))}
        <div className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
          {analysis.totalDraws} kỳ phân tích
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar p-1 bg-slate-100 rounded-xl">
        {[
          { key: 'overview', label: '📈 Tổng quan' },
          { key: 'heatmap',  label: '🗂️ Bảng nhiệt' },
          { key: 'pairs',    label: '🔗 Cặp số' },
          { key: 'recent',   label: '📅 Lịch sử' },
          { key: 'advanced', label: '🧮 Nâng cao' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key as typeof subTab)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              subTab === t.key
                ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW ══════════════════════════════════════════ */}
      {subTab === 'overview' && (
        <div className="space-y-4 animate-fade-in">
          {/* Hot & Cold */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="font-bold text-orange-600 mb-3 text-sm flex items-center gap-1.5">
                🔥 Số nóng <span className="text-xs font-normal text-slate-400">(xuất hiện nhiều nhất)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {analysis.topFrequent.slice(0, 15).map(s => (
                  <div key={s.number} className="text-center">
                    <span className="number-ball number-hot cursor-default block"
                      title={`${s.count} lần (${s.frequency.toFixed(1)}%)`}>
                      {formatNumber(s.number)}
                    </span>
                    <div className="text-[10px] text-orange-500 mt-0.5 font-semibold">{s.count}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-bold text-blue-600 mb-3 text-sm flex items-center gap-1.5">
                🧊 Số lạnh <span className="text-xs font-normal text-slate-400">(vắng mặt lâu nhất)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {analysis.topAbsent.slice(0, 15).map(s => (
                  <div key={s.number} className="text-center">
                    <span className="number-ball number-cold cursor-default block"
                      title={`Vắng ${s.currentAbsence} kỳ`}>
                      {formatNumber(s.number)}
                    </span>
                    <div className="text-[10px] text-blue-500 mt-0.5 font-semibold">{s.currentAbsence}k</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Frequency chart */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-4 text-sm">Top 30 số xuất hiện nhiều nhất ({analysis.totalDraws} kỳ)</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 2, right: 8, left: -25, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }}
                    interval={0} angle={-45} textAnchor="end" height={38}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                    formatter={(val) => [`${val} lần`, 'Xuất hiện']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, idx) => (
                      <Cell key={idx}
                        fill={idx < 5 ? '#f97316' : idx < 12 ? '#6366f1' : '#94a3b8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Full stats table */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-4 text-sm">Chi tiết thống kê 100 số (00–99)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[540px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200">
                    <th className="text-left py-2 pr-3 font-semibold">Số</th>
                    <th className="text-right py-2 pr-3 font-semibold">Số lần</th>
                    <th className="text-right py-2 pr-3 font-semibold">Tần suất</th>
                    <th className="text-right py-2 pr-3 font-semibold">Vắng hiện tại</th>
                    <th className="text-right py-2 pr-3 font-semibold">TB giữa 2 lần</th>
                    <th className="text-right py-2 pr-3 font-semibold">Vắng dài nhất</th>
                    <th className="text-left py-2 font-semibold">Vị trí hay</th>
                  </tr>
                </thead>
                <tbody>
                  {[...analysis.numberStats]
                    .sort((a, b) => b.count - a.count)
                    .map(s => (
                      <tr key={s.number} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-1.5 pr-3">
                          <span className={`number-ball number-ball-xs ${
                            s.count > analysis.totalDraws * 0.35 ? 'number-hot'
                            : s.currentAbsence > 12 ? 'number-cold'
                            : 'number-neutral'
                          }`}>
                            {formatNumber(s.number)}
                          </span>
                        </td>
                        <td className="text-right py-1.5 pr-3 text-slate-800 font-semibold">{s.count}</td>
                        <td className="text-right py-1.5 pr-3">
                          <span className={`stat-badge ${s.frequency > 38 ? 'badge-orange' : s.frequency > 28 ? 'badge-green' : 'badge-blue'}`}>
                            {s.frequency.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-right py-1.5 pr-3">
                          <span className={`font-semibold ${s.currentAbsence > 18 ? 'text-red-600' : s.currentAbsence > 10 ? 'text-orange-500' : 'text-slate-500'}`}>
                            {s.currentAbsence} kỳ
                          </span>
                        </td>
                        <td className="text-right py-1.5 pr-3 text-slate-500">{s.avgInterval} kỳ</td>
                        <td className="text-right py-1.5 pr-3">
                          <span className={`font-semibold ${s.maxAbsenceStreak > 30 ? 'text-red-500' : 'text-slate-500'}`}>
                            {s.maxAbsenceStreak} kỳ
                          </span>
                        </td>
                        <td className="py-1.5 text-slate-400">{s.positions.slice(0, 2).join(', ') || '–'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HEATMAP ══════════════════════════════════════════ */}
      {subTab === 'heatmap' && (
        <div className="space-y-4 animate-fade-in">
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-1 text-sm">Bảng nhiệt tần suất 100 số (00–99)</h3>
            <p className="text-xs text-slate-400 mb-4">Màu đậm = xuất hiện nhiều • Màu nhạt = xuất hiện ít</p>
            <div className="grid grid-cols-10 gap-1.5">
              {[...analysis.numberStats]
                .sort((a, b) => a.number - b.number)
                .map(s => {
                  const intensity = s.count / heatmapMax;
                  const bg = `rgba(99,102,241,${0.08 + intensity * 0.88})`;
                  return (
                    <div
                      key={s.number}
                      title={`${formatNumber(s.number)}: ${s.count} lần (${s.frequency.toFixed(1)}%) | Vắng: ${s.currentAbsence}kỳ | Max vắng: ${s.maxAbsenceStreak}kỳ`}
                      className="aspect-square rounded-lg flex flex-col items-center justify-center cursor-default transition-all hover:scale-110 hover:shadow-md"
                      style={{ background: bg, border: `1px solid rgba(99,102,241,${0.1 + intensity * 0.5})` }}
                    >
                      <span className="text-[10px] font-bold" style={{ color: intensity > 0.5 ? 'white' : '#3730a3' }}>
                        {formatNumber(s.number)}
                      </span>
                      <span className="text-[8px]" style={{ color: intensity > 0.5 ? 'rgba(255,255,255,0.8)' : '#6366f1' }}>
                        {s.count}
                      </span>
                    </div>
                  );
                })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 mt-4 text-xs text-slate-400">
              <span>Ít</span>
              <div className="flex gap-0.5 flex-1 max-w-32">
                {[0.08, 0.25, 0.45, 0.65, 0.88].map(v => (
                  <div key={v} className="h-3 flex-1 rounded" style={{ background: `rgba(99,102,241,${v})` }} />
                ))}
              </div>
              <span>Nhiều</span>
            </div>
          </div>

          {/* Decade analysis */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-4 text-sm">Phân tích theo nhóm thập phân</h3>
            <div className="space-y-3">
              {decadeStats.map(d => (
                <div key={d.decade} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-16 shrink-0 font-medium">{d.decade}</span>
                  <div className="flex-1 progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${(d.total / decadeMax) * 100}%`,
                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-700 font-semibold w-16 text-right">{d.total} lần</span>
                  <span className="text-xs text-slate-400 w-16 text-right">TB: {d.avg.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ PAIRS ════════════════════════════════════════════ */}
      {subTab === 'pairs' && (
        <div className="space-y-4 animate-fade-in">
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-1 text-sm">Top 50 cặp số hay xuất hiện cùng kỳ</h3>
            <p className="text-xs text-slate-400 mb-4">Trong cùng 1 kỳ xổ số</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[420px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-200">
                    <th className="text-left py-2 pr-4 font-semibold">Hạng</th>
                    <th className="text-left py-2 pr-4 font-semibold">Cặp số</th>
                    <th className="text-right py-2 pr-4 font-semibold">Số lần</th>
                    <th className="text-right py-2 pr-4 font-semibold">Tần suất</th>
                    <th className="text-right py-2 font-semibold">Gần nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.pairStats.map((p, idx) => {
                    const [a, b] = p.pair.split('-');
                    return (
                      <tr key={p.pair} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-1.5 pr-4 text-slate-400">#{idx + 1}</td>
                        <td className="py-1.5 pr-4">
                          <div className="flex items-center gap-1.5">
                            <span className="number-ball number-ball-xs number-hot">{a.padStart(2, '0')}</span>
                            <span className="text-slate-300">+</span>
                            <span className="number-ball number-ball-xs number-hot">{b.padStart(2, '0')}</span>
                          </div>
                        </td>
                        <td className="text-right py-1.5 pr-4 text-slate-800 font-semibold">{p.count}</td>
                        <td className="text-right py-1.5 pr-4">
                          <span className="stat-badge badge-purple">{p.frequency.toFixed(1)}%</span>
                        </td>
                        <td className="text-right py-1.5 text-slate-400">
                          {p.lastDate ? format(parseISO(p.lastDate), 'dd/MM/yy') : '–'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Adjacent pairs */}
          {adjacentPairs.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold text-slate-800 mb-4 text-sm">Cặp số liên tiếp hay cùng xuất hiện</h3>
              <div className="flex flex-wrap gap-3">
                {adjacentPairs.map(p => {
                  const [a, b] = p.pair.split('-');
                  return (
                    <div key={p.pair} className="flex items-center gap-1.5 card card-hover p-2">
                      <span className="number-ball number-ball-xs" style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)', color: 'white' }}>
                        {a.padStart(2, '0')}
                      </span>
                      <span className="number-ball number-ball-xs" style={{ background: 'linear-gradient(135deg, #c084fc, #f472b6)', color: 'white' }}>
                        {b.padStart(2, '0')}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">{p.count}×</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ RECENT HISTORY ══════════════════════════════════ */}
      {subTab === 'recent' && (
        <div className="card p-5 animate-fade-in">
          <h3 className="font-bold text-slate-800 mb-4 text-sm">30 kết quả gần nhất</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-200 text-center">
                  <th className="text-left py-2 pr-3 font-semibold">Ngày</th>
                  <th className="py-2 pr-2 font-semibold">ĐB</th>
                  <th className="py-2 pr-2 font-semibold">G1</th>
                  <th className="py-2 pr-2 font-semibold">G2</th>
                  <th className="text-left py-2 pr-2 font-semibold">G3</th>
                  <th className="text-left py-2 pr-2 font-semibold">G4</th>
                  <th className="text-left py-2 pr-2 font-semibold">G5</th>
                  <th className="text-left py-2 pr-2 font-semibold">G6</th>
                  <th className="text-left py-2 font-semibold">G7</th>
                </tr>
              </thead>
              <tbody>
                {draws.slice(-30).reverse().map(draw => (
                  <tr key={draw.date} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap font-medium">
                      {format(parseISO(draw.date), 'EEE dd/MM/yy', { locale: vi })}
                    </td>
                    <td className="py-1.5 pr-2 text-center">
                      <span className="prize-special rounded-md px-1.5 py-0.5 text-xs">{formatNumber(draw.special)}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-center">
                      <span className="prize-1 rounded-md px-1.5 py-0.5 text-xs">{formatNumber(draw.prize1)}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-center text-orange-600 whitespace-nowrap font-semibold">
                      {formatNumber(draw.prize2_1)} {formatNumber(draw.prize2_2)}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-600 whitespace-nowrap">
                      {[draw.prize3_1,draw.prize3_2,draw.prize3_3,draw.prize3_4,draw.prize3_5,draw.prize3_6].map(formatNumber).join(' ')}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-500 whitespace-nowrap">
                      {[draw.prize4_1,draw.prize4_2,draw.prize4_3,draw.prize4_4].map(formatNumber).join(' ')}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-500 whitespace-nowrap">
                      {[draw.prize5_1,draw.prize5_2,draw.prize5_3,draw.prize5_4,draw.prize5_5,draw.prize5_6].map(formatNumber).join(' ')}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-400 whitespace-nowrap">
                      {[draw.prize6_1,draw.prize6_2,draw.prize6_3].map(formatNumber).join(' ')}
                    </td>
                    <td className="py-1.5 text-slate-400 whitespace-nowrap">
                      {[draw.prize7_1,draw.prize7_2,draw.prize7_3,draw.prize7_4].map(formatNumber).join(' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ ADVANCED ════════════════════════════════════════ */}
      {subTab === 'advanced' && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Số phổ biến nhất', value: formatNumber(analysis.topFrequent[0]?.number ?? 0), sub: `${analysis.topFrequent[0]?.count ?? 0} lần`, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
              { label: 'Vắng mặt lâu nhất', value: formatNumber(analysis.topAbsent[0]?.number ?? 0), sub: `${analysis.topAbsent[0]?.currentAbsence ?? 0} kỳ`, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
              { label: 'Vắng dài nhất LS', value: `${Math.max(...analysis.numberStats.map(s => s.maxAbsenceStreak))} kỳ`, sub: `Số ${formatNumber(analysis.numberStats.sort((a,b) => b.maxAbsenceStreak - a.maxAbsenceStreak)[0]?.number ?? 0)}`, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
              { label: 'Tổng kỳ lịch sử', value: draws.length.toString(), sub: `Từ ${format(parseISO(draws[0]?.date || new Date().toISOString()), 'MM/yyyy')}`, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
            ].map(stat => (
              <div key={stat.label} className={`card p-4 text-center border ${stat.bg}`}>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                <div className="text-xs text-slate-400">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Absence streak - current */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-1 text-sm">Chuỗi vắng mặt hiện tại (toàn lịch sử)</h3>
            <p className="text-xs text-slate-400 mb-4">Số kỳ liên tiếp không xuất hiện tính đến kỳ cuối • Cột xanh = chưa quá hạn • Đỏ = đã vượt TB</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[...analysis.numberStats]
                .sort((a, b) => b.currentAbsence - a.currentAbsence)
                .slice(0, 20)
                .map(s => {
                  const overdue = s.currentAbsence > s.avgInterval;
                  return (
                    <div key={s.number} className={`card p-3 border ${overdue ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`number-ball number-ball-sm ${overdue ? 'number-hot' : 'number-cold'}`}>
                          {formatNumber(s.number)}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-800">{s.currentAbsence} kỳ</div>
                          <div className="text-[10px] text-slate-400">TB: {s.avgInterval}k | Max: {s.maxAbsenceStreak}k</div>
                        </div>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(100, (s.currentAbsence / Math.max(s.avgInterval * 2, 1)) * 100)}%`,
                            background: overdue
                              ? 'linear-gradient(90deg, #ef4444, #f97316)'
                              : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                          }}
                        />
                      </div>
                      <div className="text-[10px] mt-1 font-medium" style={{ color: overdue ? '#dc2626' : '#64748b' }}>
                        {overdue ? `⚠️ Quá ${(s.currentAbsence - s.avgInterval).toFixed(0)}k` : '✓ Bình thường'}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Max absence streak in history */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-1 text-sm">Top 20 chuỗi vắng mặt dài nhất lịch sử</h3>
            <p className="text-xs text-slate-400 mb-4">Chuỗi kỳ liên tiếp không xuất hiện dài nhất từ trước đến nay</p>
            <div className="space-y-2">
              {[...analysis.numberStats]
                .sort((a, b) => b.maxAbsenceStreak - a.maxAbsenceStreak)
                .slice(0, 20)
                .map((s, idx) => {
                  const maxVal = analysis.numberStats.reduce((m, x) => Math.max(m, x.maxAbsenceStreak), 1);
                  return (
                    <div key={s.number} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-6">#{idx + 1}</span>
                      <span className="number-ball number-ball-xs number-neutral">{formatNumber(s.number)}</span>
                      <div className="flex-1 progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${(s.maxAbsenceStreak / maxVal) * 100}%`,
                            background: 'linear-gradient(90deg, #f97316, #ef4444)',
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-800 w-14 text-right">{s.maxAbsenceStreak} kỳ</span>
                      <span className="text-xs text-slate-400 w-16 text-right">TB:{s.avgInterval}k</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Return probability */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-1 text-sm">Xác suất xuất hiện kỳ tiếp (mô hình điều chỉnh)</h3>
            <p className="text-xs text-slate-400 mb-4">Kết hợp tần suất lịch sử + áp lực vắng mặt</p>
            <div className="space-y-2">
              {[...analysis.numberStats]
                .map(s => {
                  const baseProb = Math.min(0.99, s.frequency / 100);
                  const dueRatio = s.avgInterval > 0 ? s.currentAbsence / s.avgInterval : 0;
                  const adjustedProb = Math.min(0.95, baseProb * (1 + Math.log1p(dueRatio) * 0.6));
                  return { ...s, probability: adjustedProb };
                })
                .sort((a, b) => b.probability - a.probability)
                .slice(0, 20)
                .map(s => (
                  <div key={s.number} className="flex items-center gap-3">
                    <span className="number-ball number-ball-xs number-predicted">{formatNumber(s.number)}</span>
                    <div className="flex-1 progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${s.probability * 100}%`,
                          background: 'linear-gradient(90deg, #10b981, #059669)',
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 w-12 text-right">
                      {(s.probability * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-400 w-20">Vắng: {s.currentAbsence}k/{s.avgInterval}k</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Day of week analysis */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-4 text-sm">Phân tích theo ngày trong tuần (Top 5 số mỗi ngày)</h3>
            <div className="grid grid-cols-7 gap-2">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, dow) => {
                const dayDraws = draws.filter(d => new Date(d.date).getDay() === dow);
                const numCount: Record<number, number> = {};
                dayDraws.forEach(d => getAllNumbers(d).forEach(n => { numCount[n] = (numCount[n] || 0) + 1; }));
                const topNums = Object.entries(numCount)
                  .sort((a, b) => Number(b[1]) - Number(a[1]))
                  .slice(0, 5)
                  .map(([n]) => parseInt(n));
                return (
                  <div key={day} className="card p-2 text-center border border-slate-100">
                    <div className="text-xs font-bold text-indigo-700 mb-1">{day}</div>
                    <div className="text-[10px] text-slate-400 mb-2">{dayDraws.length}kỳ</div>
                    <div className="flex flex-col gap-1 items-center">
                      {topNums.map(n => (
                        <span key={n} className="number-ball number-ball-xs number-hot">{formatNumber(n)}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
