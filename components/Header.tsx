
import React, { useEffect, useState } from 'react';

export const Header: React.FC = () => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="header-glow px-12 py-4 flex flex-col items-center sticky top-0 z-50 bg-slate-950/90 backdrop-blur-2xl">
      <div className="w-full flex justify-between items-center max-w-[1920px]">
        {/* 左侧菜单装饰 */}
        <div className="hidden lg:flex gap-4">
          <div className="bg-cyan-500/10 border border-cyan-500/30 px-4 py-1 skew-x-[-20deg]">
            <span className="inline-block skew-x-[20deg] text-[10px] cyber-font text-cyan-400 font-bold uppercase tracking-widest">
              ▶ 核心监控系统
            </span>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 px-4 py-1 skew-x-[-20deg]">
            <span className="inline-block skew-x-[20deg] text-[10px] cyber-font text-slate-400 font-bold uppercase tracking-widest">
              ▶ 数据链节点 01
            </span>
          </div>
        </div>

        {/* 居中主标题 */}
        <div className="relative flex flex-col items-center flex-1">
          <div className="absolute -top-4 w-[60%] h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-[2px] bg-cyan-500"></div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-[0.4em] text-white neon-text-cyan uppercase drop-shadow-[0_0_15px_rgba(0,242,255,0.5)]">
              可视化数据大屏标题
            </h1>
            <div className="w-8 h-[2px] bg-cyan-500"></div>
          </div>
          <p className="text-[9px] mono-font text-cyan-300 uppercase tracking-[0.8em] font-medium mt-1 opacity-70">
            VISUALIZING DATA ON LARGE SCREENS // NEURAL_LINK_STABLE
          </p>
        </div>

        {/* 右侧状态展示 */}
        <div className="hidden lg:flex gap-4 items-center">
          <div className="bg-slate-800/50 border border-slate-700 px-4 py-1 skew-x-[20deg]">
            <span className="inline-block skew-x-[-20deg] text-[10px] cyber-font text-slate-400 font-bold uppercase tracking-widest">
              ▶ 系统同步状态: 正常
            </span>
          </div>
          <div className="bg-fuchsia-500/10 border border-fuchsia-500/30 px-4 py-1 skew-x-[20deg]">
            <span className="inline-block skew-x-[-20deg] text-[10px] cyber-font text-fuchsia-400 font-bold uppercase tracking-widest">
              {time}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
