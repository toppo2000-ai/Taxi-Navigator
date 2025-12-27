import React, { useState, useEffect, useMemo } from 'react';
import { Watch, Clock, Monitor } from 'lucide-react';

type ClockStyle = 'digital' | 'analog' | 'fliqlo';

interface FullScreenClockProps {
  onClose: () => void;
}

export const FullScreenClock: React.FC<FullScreenClockProps> = ({ onClose }) => {
  const [mode, setMode] = useState<'select' | 'view'>('select');
  const [style, setStyle] = useState<ClockStyle>('digital');
  const [time, setTime] = useState(new Date());
  
  // 画面の向き判定用
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1秒ごとに時刻更新
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cyber Digital用のランダムカラー生成 (起動時に一度だけ決定)
  const neonColor = useMemo(() => {
    const colors = [
      { text: 'text-cyan-400', shadow: 'rgba(34,211,238,0.8)', border: 'border-cyan-500/50', line: 'bg-cyan-500' },
      { text: 'text-fuchsia-400', shadow: 'rgba(232,121,249,0.8)', border: 'border-fuchsia-500/50', line: 'bg-fuchsia-500' },
      { text: 'text-lime-400', shadow: 'rgba(163,230,53,0.8)', border: 'border-lime-500/50', line: 'bg-lime-500' },
      { text: 'text-amber-400', shadow: 'rgba(251,191,36,0.8)', border: 'border-amber-500/50', line: 'bg-amber-500' },
      { text: 'text-rose-400', shadow: 'rgba(251,113,133,0.8)', border: 'border-rose-500/50', line: 'bg-rose-500' },
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []); 

  const handleSelect = (s: ClockStyle) => {
    setStyle(s);
    setMode('view');
  };

  // --- 1. Cyber Digital Clock ---
  const DigitalClock = () => (
    <div className="flex flex-col items-center justify-center h-full w-full bg-black font-mono animate-in zoom-in duration-300 p-4 relative overflow-hidden">
      {/* 背景エフェクト */}
      <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,${neonColor.shadow.replace('0.8','0.1')},transparent_70%)] pointer-events-none`}></div>

      {/* 枠線装飾 */}
      <div className={`absolute inset-6 border-2 ${neonColor.border} opacity-50 rounded-3xl pointer-events-none`}></div>
      <div className={`absolute top-6 left-1/2 -translate-x-1/2 w-1/4 h-1.5 ${neonColor.line} shadow-[0_0_20px_${neonColor.shadow}] rounded-b-full`}></div>
      <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-1/4 h-1.5 ${neonColor.line} shadow-[0_0_20px_${neonColor.shadow}] rounded-t-full`}></div>

      {/* 時刻 */}
      <div 
        className={`${neonColor.text} text-[22vw] leading-none font-black tabular-nums tracking-tighter z-10`}
        style={{ textShadow: `0 0 30px ${neonColor.shadow}` }}
      >
        {time.toLocaleTimeString('ja-JP', { hour12: false })}
      </div>

      {/* 日付と曜日 */}
      <div className="mt-10 text-center space-y-4 z-10">
        <div className={`text-[5vw] font-bold ${neonColor.text} opacity-90 tracking-widest uppercase`}>
          {time.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
        <div className={`text-[6vw] font-black ${neonColor.text} tracking-[0.2em] uppercase border-y-2 ${neonColor.border} py-2 px-10 inline-block bg-black/50 backdrop-blur-sm`}>
          {time.toLocaleDateString('en-US', { weekday: 'long' })}
        </div>
      </div>
    </div>
  );

  // --- 2. Fliqlo Clock (画像完全再現) ---
  const FliqloClock = () => {
    // 12時間表記に変換
    let hours = time.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0時は12時
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(time.getMinutes()).padStart(2, '0');

    const FlipCard = ({ num }: { num: string }) => (
      <div className={`bg-[#1a1a1a] rounded-[12%] flex items-center justify-center relative overflow-hidden shadow-2xl ${isPortrait ? 'w-[75vw] h-[35vh]' : 'w-[40vw] h-[80vh]'} border-[1px] border-[#333]`}>
        {/* 文字 */}
        <span className={`font-sans font-bold text-[#d4d4d4] leading-none tracking-tighter scale-y-[1.3] ${isPortrait ? 'text-[32vh]' : 'text-[70vh]'} translate-y-[2%]`}>
          {num}
        </span>
        
        {/* 真ん中の切れ込みライン */}
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-[#000] z-20 shadow-[0_1px_2px_rgba(0,0,0,0.8)]"></div>
        
        {/* カードの立体感（ごく薄いグラデーション） */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-10"></div>
      </div>
    );

    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#000000] animate-in fade-in duration-500">
        <div className={`flex ${isPortrait ? 'flex-col gap-6' : 'flex-row gap-6'} items-center justify-center w-full h-full p-6 relative`}>
          
          {/* ★修正箇所: ここにあった背後のAM/PM表示を削除しました */}

          <div className="relative">
             {/* 時カード */}
             <FlipCard num={hoursStr} />
             {/* AM/PMを時カードの中に配置 (こちらを残す) */}
             <div className="absolute top-[8%] left-[8%] text-[#d4d4d4] font-bold text-[3vh] font-sans tracking-wider z-30 opacity-90">
                {ampm}
             </div>
          </div>

          {/* 分カード */}
          <FlipCard num={minutesStr} />
        </div>
      </div>
    );
  };

  // --- 3. Analog Clock (ダークモード仕様) ---
  const AnalogClock = () => {
    const secRatio = time.getSeconds() / 60;
    const minRatio = (secRatio + time.getMinutes()) / 60;
    const hourRatio = (minRatio + time.getHours()) / 12;

    return (
      <div className="flex items-center justify-center h-full bg-[#0d0d0d] animate-in spin-in-3 duration-500">
        {/* 時計盤 */}
        <div className="relative w-[85vw] h-[85vw] max-w-[600px] max-h-[600px] bg-[#1a1a1a] rounded-full shadow-[20px_20px_60px_#050505,-20px_-20px_60px_#2a2a2a] border-[8px] border-[#252525] flex items-center justify-center">
          
          {/* 目盛り (洗練されたデザイン) */}
          {[...Array(60)].map((_, i) => {
            const isHour = i % 5 === 0;
            return (
              <div 
                key={i} 
                className="absolute w-full h-full flex justify-center pt-4"
                style={{ transform: `rotate(${i * 6}deg)` }}
              >
                <div className={`rounded-full ${
                  isHour 
                    ? 'w-1.5 h-6 bg-gray-200 shadow-[0_0_8px_rgba(255,255,255,0.3)]' 
                    : 'w-0.5 h-2 bg-gray-600 opacity-50'
                }`}></div>
              </div>
            );
          })}

          {/* 数字 (3, 6, 9, 12 のみ表示) */}
          <div className="absolute inset-10 pointer-events-none">
             <span className="absolute top-0 left-1/2 -translate-x-1/2 text-5xl font-bold text-gray-200">12</span>
             <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-5xl font-bold text-gray-200">6</span>
             <span className="absolute left-0 top-1/2 -translate-y-1/2 text-5xl font-bold text-gray-200">9</span>
             <span className="absolute right-0 top-1/2 -translate-y-1/2 text-5xl font-bold text-gray-200">3</span>
          </div>

          {/* 時針 */}
          <div 
            className="absolute w-3 h-[24%] bg-gray-200 rounded-full origin-bottom bottom-[50%] shadow-lg z-20"
            style={{ transform: `rotate(${hourRatio * 360}deg)` }}
          />
          {/* 分針 */}
          <div 
            className="absolute w-2 h-[34%] bg-gray-400 rounded-full origin-bottom bottom-[50%] shadow-lg z-30"
            style={{ transform: `rotate(${minRatio * 360}deg)` }}
          />
          {/* 秒針 (アクセントカラー: オレンジ) */}
          <div 
            className="absolute w-1 h-[38%] bg-amber-600 rounded-full origin-bottom bottom-[50%] shadow-[0_0_10px_rgba(245,158,11,0.5)] z-40"
            style={{ transform: `rotate(${secRatio * 360}deg)` }}
          />
          
          {/* 中心点 */}
          <div className="absolute w-5 h-5 bg-amber-600 rounded-full z-50 border-4 border-[#1a1a1a]"></div>
        </div>
      </div>
    );
  };

  // --- 表示モード分岐 ---

  if (mode === 'select') {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-3xl font-black text-white tracking-tight">CLOCK STYLE</h2>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Select your favorite design</p>
          </div>

          <button 
            onClick={() => handleSelect('digital')}
            className="w-full bg-cyan-950/30 border border-cyan-800/50 p-5 rounded-3xl flex items-center gap-5 group active:scale-95 transition-all hover:bg-cyan-900/40 hover:border-cyan-500/50"
          >
            <div className="p-4 bg-cyan-500/10 rounded-2xl text-cyan-400 group-hover:text-white group-hover:bg-cyan-500 transition-all shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                <Monitor className="w-8 h-8" />
            </div>
            <div className="text-left">
                <span className="block text-xl font-black text-white group-hover:text-cyan-100 transition-colors">CYBER DIGITAL</span>
                <span className="text-xs text-cyan-600 font-bold uppercase tracking-wider group-hover:text-cyan-300">Neon Random Color</span>
            </div>
          </button>

          <button 
            onClick={() => handleSelect('analog')}
            className="w-full bg-gray-900 border border-gray-800 p-5 rounded-3xl flex items-center gap-5 group active:scale-95 transition-all hover:bg-gray-800 hover:border-gray-600"
          >
            <div className="p-4 bg-gray-800 rounded-2xl text-gray-400 group-hover:text-white group-hover:bg-gray-600 transition-all">
                <Watch className="w-8 h-8" />
            </div>
            <div className="text-left">
                <span className="block text-xl font-black text-white">DARK ANALOG</span>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider group-hover:text-gray-300">Modern & Chic</span>
            </div>
          </button>

          <button 
            onClick={() => handleSelect('fliqlo')}
            className="w-full bg-stone-950 border border-stone-800 p-5 rounded-3xl flex items-center gap-5 group active:scale-95 transition-all hover:bg-stone-900 hover:border-stone-600"
          >
            <div className="p-4 bg-stone-900 rounded-2xl text-stone-400 group-hover:text-white group-hover:bg-stone-700 transition-all">
                <Clock className="w-8 h-8" />
            </div>
            <div className="text-left">
                <span className="block text-xl font-black text-white">FLIQLO STYLE</span>
                <span className="text-xs text-stone-600 font-bold uppercase tracking-wider group-hover:text-stone-400">Retro Flip Clock</span>
            </div>
          </button>

          <button onClick={onClose} className="mt-10 py-4 w-full text-gray-600 font-bold text-sm tracking-widest hover:text-white transition-colors uppercase">
            Close
          </button>
        </div>
      </div>
    );
  }

  // Viewモード (全画面表示)
  return (
    <div className="fixed inset-0 z-[9999] cursor-pointer bg-black overflow-hidden" onClick={onClose}>
      {style === 'digital' && <DigitalClock />}
      {style === 'analog' && <AnalogClock />}
      {style === 'fliqlo' && <FliqloClock />}
      
      {/* 閉じるヒント (目立ちすぎないように) */}
      <div className="absolute bottom-8 w-full text-center pointer-events-none opacity-0 hover:opacity-50 transition-opacity duration-1000 animate-[pulse_4s_infinite]">
        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30 bg-black/40 px-6 py-2 rounded-full backdrop-blur-md">
          Tap to Close
        </span>
      </div>
    </div>
  );
};