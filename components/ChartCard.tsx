
import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { ChartMeta, DataRow } from '../types';

const CHART_COLORS = ['#00f2ff', '#f0abfc', '#a855f7', '#4ade80', '#fb923c', '#3b82f6'];

interface ChartCardProps {
  meta: ChartMeta;
  rawData: DataRow[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ChartMeta>) => void;
}

export const ChartCard: React.FC<ChartCardProps> = ({ meta, rawData, onRemove, onUpdate }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 独立数据处理逻辑，确保锁定后配置不丢失
  const chartData = useMemo(() => {
    const { xAxisColumn, metrics, groupColumn } = meta.configSnapshot;
    if (xAxisColumn === 'SUMMARY') {
      const grouped: { [key: string]: DataRow } = {};
      const dimKey = groupColumn || '全局';
      rawData.forEach(row => {
        const key = String(row[dimKey] || '未分组');
        if (!grouped[key]) {
          grouped[key] = { [dimKey]: key };
          metrics.forEach(m => grouped[key][m] = 0);
        }
        metrics.forEach(m => {
          grouped[key][m] += Number(row[m]) || 0;
        });
      });
      return Object.values(grouped).sort((a, b) => (Number(b[metrics[0]]) || 0) - (Number(a[metrics[0]]) || 0));
    }
    return rawData;
  }, [rawData, meta.configSnapshot]);

  useEffect(() => {
    if (meta.type === 'table' || meta.type === 'metric_card') return;
    if (chartRef.current) {
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current, 'dark', { renderer: 'canvas' });
      }
      const option = getOption(meta, chartData);
      chartInstance.current.setOption({
        backgroundColor: 'transparent',
        ...option
      }, true);
    }
  }, [meta, chartData]);

  useEffect(() => {
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, []);

  const getOption = (meta: ChartMeta, data: DataRow[]): echarts.EChartsOption => {
    const { xAxisColumn, groupColumn, metrics } = meta.configSnapshot;
    const dimensionKey = xAxisColumn === 'SUMMARY' ? (groupColumn || '全局') : xAxisColumn;
    const categories = data.map(r => String(r[dimensionKey] || '未分组'));
    const seriesData = metrics.map((m, idx) => ({
      name: m,
      data: data.map(r => Number(r[m]) || 0),
      color: CHART_COLORS[idx % CHART_COLORS.length]
    }));

    const commonGrid = { top: '15%', left: '10%', right: '10%', bottom: '15%', containLabel: true };
    const commonXAxis = {
      type: 'category' as const,
      data: categories,
      axisLabel: { color: '#94a3b8', fontSize: 12 },
      axisLine: { lineStyle: { color: 'rgba(0, 242, 255, 0.2)' } }
    };
    const commonYAxis = {
      type: 'value' as const,
      axisLabel: { color: '#94a3b8', fontSize: 12 },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } }
    };

    switch (meta.type) {
      case 'line':
      case 'area':
        return {
          tooltip: { trigger: 'axis' },
          grid: commonGrid,
          xAxis: commonXAxis,
          yAxis: commonYAxis,
          series: seriesData.map(s => ({
            name: s.name, type: 'line' as const, data: s.data, smooth: true,
            areaStyle: meta.type === 'area' ? { color: s.color + '33' } : undefined
          }))
        };
      case 'bar':
      case 'ranking':
        const isHorizontal = meta.type === 'ranking';
        return {
          tooltip: { trigger: 'axis' },
          grid: commonGrid,
          xAxis: isHorizontal ? { type: 'value' as const } : commonXAxis,
          yAxis: isHorizontal ? { type: 'category' as const, data: categories } : commonYAxis,
          series: seriesData.map(s => ({
            name: s.name, type: 'bar' as const, data: s.data, itemStyle: { borderRadius: 4 }
          }))
        };
      case 'pie':
        return {
          tooltip: { trigger: 'item' },
          series: [{
            type: 'pie' as const, radius: ['40%', '70%'],
            data: data.slice(0, 10).map((r, i) => ({ 
              name: String(r[dimensionKey]), value: Number(r[metrics[0]]), itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] }
            }))
          }]
        };
      case 'funnel':
        return {
          series: [{
            type: 'funnel' as const,
            data: data.slice(0, 6).map((r, i) => ({ name: String(r[dimensionKey]), value: Number(r[metrics[0]]) }))
          }]
        };
      case 'waterfall':
        let current = 0;
        const base = data.map(r => { const b = current; current += Number(r[metrics[0]]); return b; });
        return {
          xAxis: commonXAxis,
          yAxis: commonYAxis,
          series: [
            { type: 'bar' as const, stack: 'total', itemStyle: { color: 'transparent' }, data: base },
            { type: 'bar' as const, stack: 'total', data: data.map(r => Number(r[metrics[0]])) }
          ]
        };
      default: return {};
    }
  };

  return (
    <div 
      id={meta.id}
      className={`tech-card flex flex-col min-h-[450px] transition-all chart-container-node ${meta.isSaved ? 'ring-2 ring-cyan-500 shadow-[0_0_25px_rgba(0,242,255,0.4)]' : ''}`}
    >
      <div className="flex justify-between items-center p-6 border-b border-white/5">
        <div className="border-l-4 border-cyan-500 pl-4">
          <h3 className="text-xl font-bold text-white tracking-wider">{meta.title}</h3>
          <p className="text-[10px] text-slate-500 mono-font uppercase mt-1">
            维度: {meta.configSnapshot.xAxisColumn === 'SUMMARY' ? `汇总(${meta.configSnapshot.groupColumn || '全局'})` : meta.configSnapshot.xAxisColumn}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onUpdate(meta.id, { isSaved: !meta.isSaved })} className={`px-4 py-1.5 border ${meta.isSaved ? 'border-cyan-500 text-cyan-400' : 'border-green-500/50 text-green-400'} text-xs font-bold cyber-font rounded hover:bg-white/5`}>
            {meta.isSaved ? '已锁定' : '保存锁定'}
          </button>
          <button onClick={() => onRemove(meta.id)} className="p-2 border border-red-500/30 text-red-500 hover:bg-red-500/20 rounded transition-colors">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col justify-center chart-content-area relative">
        {meta.type === 'metric_card' ? (
          <div className="flex flex-col items-center gap-6">
            {meta.configSnapshot.metrics.map((m) => {
              const total = chartData.reduce((acc, row) => acc + (Number(row[m]) || 0), 0);
              return (
                <div key={m} className="text-center">
                  <p className="text-sm text-slate-500 uppercase font-bold mb-1 tracking-widest">{m} // 统计</p>
                  <p className="text-6xl font-black text-cyan-400 neon-text-cyan">{total.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        ) : meta.type === 'table' ? (
          <div className="overflow-auto max-h-[350px] border border-white/10 rounded-lg custom-scrollbar bg-slate-900/30">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="sticky top-0 bg-slate-950/90 text-cyan-400 uppercase text-xs font-bold">
                <tr>
                  <th className="p-4 border-b border-white/10">{meta.configSnapshot.xAxisColumn === 'SUMMARY' ? (meta.configSnapshot.groupColumn || '分组') : meta.configSnapshot.xAxisColumn}</th>
                  {meta.configSnapshot.metrics.map(m => <th key={m} className="p-4 border-b border-white/10">{m}</th>)}
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {chartData.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-cyan-500/5 transition-colors">
                    <td className="p-4">{String(r[meta.configSnapshot.xAxisColumn === 'SUMMARY' ? (meta.configSnapshot.groupColumn || '全局') : meta.configSnapshot.xAxisColumn])}</td>
                    {meta.configSnapshot.metrics.map(m => <td key={m} className="p-4 font-mono font-bold text-cyan-100">{Number(r[m])?.toLocaleString()}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={chartRef} className="w-full h-[350px] echarts-dom-ref" />
        )}
      </div>
      <div className="p-4 border-t border-white/5 text-[10px] text-slate-600 mono-font text-center uppercase tracking-widest">
        DATA MODULE 0x{meta.id.substring(0,8)} // SYSTEM_LOCK_STATUS: {meta.isSaved ? 'ON' : 'OFF'}
      </div>
    </div>
  );
};
