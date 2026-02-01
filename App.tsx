
import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as echarts from 'echarts';
import { Header } from './components/Header';
import { ChartCard } from './components/ChartCard';
import { 
  DataRow, ColumnMapping, ColumnType, ChartMeta, 
  DashboardConfig, FilterState 
} from './types';
import { identifyColumnTypes, cleanData, applyFormulas, calculateMetricStats } from './utils/dataProcessor';

const App: React.FC = () => {
  const [rawData, setRawData] = useState<DataRow[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [charts, setCharts] = useState<ChartMeta[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [config, setConfig] = useState<DashboardConfig>({
    xAxisColumn: '',
    metrics: [],
    groupColumn: '',
    formulas: ''
  });
  const [filters, setFilters] = useState<FilterState>({
    dateRange: ['', ''],
    dimensionFilters: {}
  });
  const [loading, setLoading] = useState(false);

  const globalProcessedData = useMemo(() => {
    let result = applyFormulas(rawData, config.formulas);
    if (config.xAxisColumn && config.xAxisColumn !== 'SUMMARY' && filters.dateRange[0] && filters.dateRange[1]) {
      result = result.filter(row => {
        const val = row[config.xAxisColumn];
        return val >= filters.dateRange[0] && val <= filters.dateRange[1];
      });
    }
    (Object.entries(filters.dimensionFilters) as [string, string[]][]).forEach(([dim, values]) => {
      if (values.length > 0) result = result.filter(row => values.includes(String(row[dim])));
    });
    return result;
  }, [rawData, config.formulas, config.xAxisColumn, filters]);

  const summaryStats = useMemo(() => config.metrics.map(m => calculateMetricStats(globalProcessedData, m)), [globalProcessedData, config.metrics]);

  const processImportedData = (data: any[]) => {
    const identified = identifyColumnTypes(data);
    const cleaned = cleanData(data, identified);
    setRawData(cleaned);
    setMappings(identified);
    const timeCol = identified.find(m => m.type === ColumnType.TIME)?.name || '';
    const metrics = identified.filter(m => m.type === ColumnType.METRIC).map(m => m.name);
    const dims = identified.filter(m => m.type === ColumnType.DIMENSION).map(m => m.name);
    setConfig({ xAxisColumn: timeCol, metrics: metrics.slice(0, 2), groupColumn: dims[0] || '', formulas: '' });
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => processImportedData(res.data) });
    } else {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      processImportedData(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
    }
  };

  const addChart = (type: ChartMeta['type']) => {
    if (!config.metrics.length) return alert('请先在配置面板中选择指标列');
    let descType: ChartMeta['descriptionType'] = 'trend';
    const metricStr = config.metrics.join(' ');
    if (metricStr.includes('贡献') || metricStr.includes('占比') || type === 'pie') descType = 'structure';
    else if (metricStr.includes('排名') || metricStr.includes('TOP') || type === 'ranking') descType = 'ranking';
    else if (type === 'funnel') descType = 'funnel';

    const newChart: ChartMeta = {
      id: crypto.randomUUID(),
      type,
      title: type === 'metric_card' ? `${config.metrics.join('+')} 汇总卡` : `${config.metrics.join('与')} 业务分析`,
      configSnapshot: { ...config },
      isLocked: false,
      isSaved: false,
      descriptionType: descType
    };
    setCharts([...charts, newChart]);
  };

  const exportSavedHTML = () => {
    const saved = charts.filter(c => c.isSaved);
    if (!saved.length) return alert('请先保存并锁定要导出的图表模块。');
    
    // 克隆当前的 DOM 结构
    const rootClone = document.getElementById('dashboard-grid')?.cloneNode(true) as HTMLElement;
    if (!rootClone) return;

    // 查找所有的图表容器，并将 ECharts 画布替换为 Base64 图片
    const containers = document.querySelectorAll('.chart-container-node');
    containers.forEach((realNode) => {
      const chartId = realNode.getAttribute('id');
      const savedMeta = charts.find(c => c.id === chartId);
      if (!savedMeta || !savedMeta.isSaved) return;

      const echartsDom = realNode.querySelector('.echarts-dom-ref');
      if (echartsDom) {
        const instance = echarts.getInstanceByDom(echartsDom as HTMLElement);
        if (instance) {
          const imgBase64 = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: 'transparent' });
          
          // 在克隆的 DOM 中找到对应的节点并替换其内部图表部分为图片
          const cloneNode = rootClone.querySelector(`[id="${chartId}"]`);
          if (cloneNode) {
            const chartArea = cloneNode.querySelector('.chart-content-area');
            if (chartArea) {
              chartArea.innerHTML = `<img src="${imgBase64}" style="width:100%; height:auto;" />`;
            }
          }
        }
      }
    });

    // 移除克隆 DOM 中的交互按钮
    rootClone.querySelectorAll('button').forEach(btn => btn.remove());

    const head = document.head.innerHTML;
    const content = rootClone.innerHTML;
    const html = `<!DOCTYPE html><html><head>${head}<style>body{padding:40px; background:#060c1d; color:#fff; font-family:'微软雅黑';} .tech-card{margin-bottom:40px; border:1px solid rgba(0,242,255,0.3); background:rgba(10,25,50,0.8);}</style></head><body><h1 style="text-align:center; color:#00f2ff; margin-bottom:40px; font-size:32px; font-weight:bold;">业务数据看板导出 - ${new Date().toLocaleDateString()}</h1><div style="max-width:1200px; margin:0 auto; display:grid; grid-template-columns: 1fr; gap:40px;">${content}</div></body></html>`;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `赛博报表_${Date.now()}.html`;
    a.click();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col lg:flex-row p-6 lg:p-12 gap-12 max-w-[1920px] mx-auto w-full">
        <aside className="w-full lg:w-[450px] flex flex-col gap-10 shrink-0">
          <section className="tech-card p-8">
            <h2 className="text-xl font-bold text-cyan-400 uppercase mb-6 tracking-[0.2em] flex items-center gap-3">
              <span className="w-2 h-6 bg-cyan-400"></span> 数据源注入
            </h2>
            <label className="block w-full border-2 border-dashed border-cyan-500/30 p-10 text-center bg-cyan-500/5 cursor-pointer hover:bg-cyan-500/15 transition-all rounded-xl group">
              <div className="flex flex-col items-center gap-4">
                <svg className="w-12 h-12 text-cyan-500/50 group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-base font-black text-cyan-500 tracking-widest uppercase">
                  {loading ? '正在解码...' : '上传 CSV / XLSX'}
                </span>
              </div>
              <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
            </label>
          </section>

          {rawData.length > 0 && (
            <section className="tech-card p-8 flex flex-col gap-8">
              <h2 className="text-xl font-bold text-cyan-400 uppercase tracking-[0.2em] flex items-center gap-3">
                <span className="w-2 h-6 bg-cyan-400"></span> 视觉参数配置
              </h2>
              
              <div>
                <label className="text-base text-cyan-300 uppercase font-black mb-3 block tracking-wider">X轴 / 汇总模式</label>
                <select 
                  value={config.xAxisColumn} 
                  onChange={(e) => setConfig({...config, xAxisColumn: e.target.value})} 
                  className="w-full bg-slate-900 border-2 border-cyan-500/30 p-4 text-base font-bold rounded-lg outline-none text-cyan-100 shadow-lg focus:border-cyan-400"
                >
                  <option value="SUMMARY">▶ 汇总求和模式</option>
                  {mappings.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-base text-cyan-300 uppercase font-black mb-3 block tracking-wider">核心指标选择</label>
                <div className="flex flex-wrap gap-3 max-h-64 overflow-y-auto p-4 border-2 border-cyan-500/20 rounded-xl bg-slate-900/50 custom-scrollbar shadow-inner">
                  {mappings.filter(m => m.type === ColumnType.METRIC).map(m => (
                    <button 
                      key={m.name} 
                      onClick={() => {
                        const next = config.metrics.includes(m.name) ? config.metrics.filter(x => x !== m.name) : [...config.metrics, m.name];
                        setConfig({...config, metrics: next});
                      }} 
                      className={`text-sm px-4 py-2.5 border-2 transition-all font-black rounded-lg ${config.metrics.includes(m.name) ? 'border-cyan-500 bg-cyan-500/30 text-cyan-300 shadow-[0_0_10px_rgba(0,242,255,0.3)]' : 'border-white/10 text-slate-500 hover:border-cyan-500/30'}`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-base text-cyan-300 uppercase font-black mb-3 block tracking-wider">分组维度</label>
                <select 
                  value={config.groupColumn} 
                  onChange={(e) => setConfig({...config, groupColumn: e.target.value})} 
                  className="w-full bg-slate-900 border-2 border-cyan-500/30 p-4 text-base font-bold rounded-lg outline-none text-cyan-100 shadow-lg focus:border-cyan-400"
                >
                  <option value="">-- 请选择分组列 --</option>
                  {mappings.filter(m => m.type === ColumnType.DIMENSION).map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  {type:'metric_card', label:'核心数值卡'}, {type:'line', label:'折线图'}, {type:'bar', label:'柱形图'},
                  {type:'pie', label:'环形图'}, {type:'area', label:'面积图'}, {type:'funnel', label:'漏斗图'},
                  {type:'table', label:'明细表'}, {type:'waterfall', label:'瀑布图'}, {type:'ranking', label:'排名图'}
                ].map(t => (
                  <button 
                    key={t.type} 
                    onClick={() => addChart(t.type as any)} 
                    className="py-3 border-2 border-cyan-500/30 hover:bg-cyan-500/20 text-sm font-black text-cyan-200 transition-all rounded shadow-md active:scale-95"
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-5 mt-8">
                <button 
                  onClick={() => setIsPreview(!isPreview)} 
                  className={`w-full py-5 font-black text-base uppercase tracking-[0.3em] transition-all rounded-lg ${isPreview ? 'bg-amber-600' : 'bg-cyan-600'} text-slate-950 shadow-2xl hover:brightness-110 active:scale-95`}
                >
                  {isPreview ? '◀ 返回主界面' : '▶ 预览全屏布局'}
                </button>
                <button 
                  onClick={exportSavedHTML} 
                  className="w-full py-5 bg-fuchsia-600 text-slate-950 font-black text-base uppercase tracking-[0.3em] shadow-2xl hover:bg-fuchsia-500 transition-all rounded-lg active:scale-95"
                >
                  导出报表 (含图表)
                </button>
              </div>
            </section>
          )}
        </aside>

        <div className="flex-1 space-y-12 overflow-y-auto max-h-[calc(100vh-140px)] pr-6 custom-scrollbar">
          {rawData.length > 0 && !isPreview && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {summaryStats.map(s => (
                <div key={s.name} className="tech-card p-8 border-b-4 border-b-cyan-500 flex flex-col items-center">
                  <p className="text-sm text-slate-500 uppercase mb-3 tracking-widest font-black">{s.name} // 实时总计</p>
                  <p className="text-5xl cyber-font font-black text-cyan-400 neon-text-cyan">{s.sum.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          <div id="dashboard-grid" className="grid grid-cols-1 xl:grid-cols-2 gap-12 pb-24">
            {charts.filter(c => !isPreview || c.isSaved).map(chart => (
              <ChartCard 
                key={chart.id} 
                meta={chart} 
                rawData={globalProcessedData} 
                onRemove={(id) => setCharts(charts.filter(c => c.id !== id))}
                onUpdate={(id, up) => setCharts(charts.map(c => c.id === id ? {...c, ...up} : c))} 
              />
            ))}
          </div>

          {rawData.length === 0 && (
            <div className="h-[75vh] flex flex-col items-center justify-center text-center">
               <div className="relative mb-12">
                 <div className="w-40 h-40 border-2 border-cyan-500/10 rounded-full flex items-center justify-center animate-pulse">
                    <div className="w-24 h-24 border-2 border-cyan-500/30 rounded-full animate-spin"></div>
                 </div>
               </div>
               <h2 className="text-5xl font-black tracking-[0.5em] text-white/90 uppercase">等待协议注入</h2>
               <p className="text-sm mt-6 uppercase text-slate-400 tracking-[0.4em] font-bold">请通过控制台上传业务数据</p>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-white/10 p-6 flex justify-between items-center bg-slate-950/95 text-[10px] mono-font uppercase tracking-[0.4em] text-slate-500">
        <div>CORE-V4 // EXPORT_ENGINE_READY</div>
        <div className="flex gap-12 items-center">
           <span>数据包同步: {rawData.length} 帧</span>
           <span className="text-cyan-800 font-bold">4.22.10-FINAL</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
