import React from 'react';
import { 
  Car, 
  Smartphone, 
  MapPin, 
  Zap, 
  TrendingUp, 
  CheckCircle2, 
  Coffee, 
  Skull,
  User,
  Navigation,
  Sparkles,
  ArrowDownCircle
} from 'lucide-react';

/**
 * 漫画のコマ用コンポーネント
 */
const MangaFrame: React.FC<{ 
  page: number; 
  title: string; 
  children: React.ReactNode; 
}> = ({ page, title, children }) => (
  <div className="mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
    <div className="flex items-center gap-3 mb-4">
      <div className="bg-amber-500 text-black font-black px-3 py-1 rounded-full text-sm italic">
        PAGE {page}
      </div>
      <h3 className="text-xl font-black text-white italic tracking-tighter">{title}</h3>
    </div>
    <div className="bg-[#1A222C] rounded-[40px] border-4 border-gray-800 overflow-hidden shadow-[0_0_30px_rgba(245,158,11,0.1)]">
      {children}
    </div>
  </div>
);

/**
 * キャラクター台詞コンポーネント
 */
const SpeechBubble: React.FC<{ 
  char: 'kenji' | 'navi'; 
  text: string; 
  side?: 'left' | 'right' 
}> = ({ char, text, side = 'left' }) => (
  <div className={`flex flex-col ${side === 'right' ? 'items-end' : 'items-start'} mb-4`}>
    <div className={`flex items-center gap-2 mb-1 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
        char === 'kenji' ? 'bg-gray-700 border-gray-500' : 'bg-amber-500 border-white shadow-[0_0_10px_#f59e0b]'
      }`}>
        {char === 'kenji' ? <User size={16} className="text-white" /> : <Zap size={16} className="text-black" />}
      </div>
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
        {char === 'kenji' ? 'Kenji' : 'Navi-Chan'}
      </span>
    </div>
    <div className={`max-w-[85%] p-4 rounded-[20px] font-bold text-sm leading-relaxed shadow-lg ${
      char === 'kenji' 
        ? 'bg-gray-800 text-gray-100 rounded-tl-none border border-gray-700' 
        : 'bg-gradient-to-br from-amber-500 to-yellow-600 text-black rounded-tr-none shadow-[4px_4px_0px_#78350f]'
    }`}>
      {text}
    </div>
  </div>
);

const MangaView: React.FC = () => {
  return (
    <div className="p-4 pb-32 max-w-md mx-auto">
      {/* 漫画タイトルロゴ */}
      <div className="text-center py-10 space-y-2">
        <h1 className="text-5xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-500 to-amber-700 filter drop-shadow-lg">
          秒速！
        </h1>
        <h2 className="text-2xl font-black text-white tracking-[0.3em] uppercase">TAXI-NAVIGATOR</h2>
        <div className="h-1 w-24 bg-amber-500 mx-auto rounded-full"></div>
        <p className="text-gray-500 font-bold text-xs pt-2">〜デキる乗務員の相棒アプリ〜</p>
      </div>

      {/* ページ 1 */}
      <MangaFrame page={1} title="面倒な作業、サヨナラ！">
        <div className="p-6 space-y-6">
          <div className="bg-gray-950/80 p-6 rounded-3xl border border-dashed border-gray-700 relative text-center">
            <Smartphone className="w-16 h-16 text-gray-700 mx-auto mb-2 opacity-20" />
            <p className="text-xs font-bold text-gray-500 leading-relaxed italic">
              深夜の車内...<br />ぐちゃぐちゃの日報と格闘するケンジ
            </p>
          </div>
          <SpeechBubble char="kenji" text="はぁ〜…今日も疲れた。最後にこの日報計算がマジで面倒くさい…" />
          <SpeechBubble char="kenji" text="えーと、さっきの売上が…住所どこだっけ…字が読めねぇ…" />
          
          <div className="py-4 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-40 animate-pulse"></div>
              <Smartphone size={80} className="relative text-amber-500 animate-bounce" />
              <Sparkles className="absolute -top-4 -right-4 text-white animate-spin" />
            </div>
          </div>

          <SpeechBubble char="navi" side="right" text="お疲れ様ですケンジさん！ もう、令和にもなって手書き計算なんて古い古い！" />
          <SpeechBubble char="kenji" text="うわっ！？ なんかスマホから飛び出てきた！？" />
          <SpeechBubble char="navi" side="right" text="私は『TAXI-NAVIGATOR』！ あなたの業務を秒速でサポートする、デキる乗務員の相棒よ！" />
        </div>
      </MangaFrame>

      {/* ページ 2 */}
      <MangaFrame page={2} title="爆速入力＆GPS連携">
        <div className="p-6 space-y-6 bg-gradient-to-b from-transparent to-green-900/10">
          <div className="flex justify-around py-4">
            <MapPin className="text-green-500 animate-pulse" size={40} />
            <Navigation className="text-blue-500 animate-bounce" size={40} />
          </div>
          <SpeechBubble char="kenji" text="お会計3,400円です。あ、住所メモるの忘れてた...！" />
          <SpeechBubble char="navi" side="right" text="ケンジさん、ストップ！ このシステムはGPSを使って自動的に住所取得して登録されてるので、履歴に入ってるわよ" />
          <div className="bg-gray-950 p-4 rounded-2xl border-2 border-amber-500/50 shadow-inner text-center font-black text-amber-500">
             [ 現在地から取得 ] 
          </div>
          <SpeechBubble char="kenji" text="え、それだけ！？ うおっ、数字ボタンもデカくて押しやすいな！" />
          <SpeechBubble char="navi" side="right" text="でしょ？ これで運転だけに集中できるわね！" />
        </div>
      </MangaFrame>

      {/* ページ 3 */}
      <MangaFrame page={3} title="リアルタイム目標管理">
        <div className="p-6 space-y-6">
          <SpeechBubble char="kenji" text="今日はヒマだなぁ。今いくら売上げてるんだろ？" />
          <div className="bg-[#0A0E14] p-5 rounded-3xl border-2 border-gray-800 shadow-2xl space-y-2">
            <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <span>Today's Sales</span>
              <span>Next Goal</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-3xl font-black text-white italic">¥28,500</span>
              <span className="text-lg font-black text-amber-500">あと ¥21,500</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="w-[60%] h-full bg-amber-500 shadow-[0_0_10px_#f59e0b]"></div>
            </div>
          </div>
          <SpeechBubble char="navi" side="right" text="リアルタイムで進捗が見えるから、やる気が出るでしょ！ フレーフレー！" />
          <SpeechBubble char="kenji" text="なるほどな…意外といけてるじゃねぇか！ よし、もう一踏ん張りするか！" />
        </div>
      </MangaFrame>

      {/* ページ 4 */}
      <MangaFrame page={4} title="地図で振り返る走行履歴">
        <div className="p-6 space-y-6 bg-gradient-to-b from-transparent to-blue-900/10">
          <SpeechBubble char="kenji" text="さっきのロングのお客様、どこで拾ったんだっけ？" />
          <div className="flex justify-center py-4">
             <div className="relative p-4 bg-gray-900 rounded-full border-4 border-blue-500/30">
                <MapPin className="text-blue-400" size={48} />
             </div>
          </div>
          <SpeechBubble char="navi" side="right" text="履歴画面の青いピンをタップしてみて！" />
          <SpeechBubble char="kenji" text="（ポチッ）…おぉ！ Googleマップが開いて、正確な場所が出た！" />
          <SpeechBubble char="kenji" text="なるほど、この交差点か。次は夕方にここを狙ってみるか！" />
        </div>
      </MangaFrame>

      {/* ページ 5 */}
      <MangaFrame page={5} title="日報自動化＆ランキング">
        <div className="p-6 space-y-6">
          <SpeechBubble char="kenji" text="業務終了！ さあ、ここから魔の日報計算タイムか..." />
          <SpeechBubble char="navi" side="right" text="もう終わってるわよ！ ほら、この集計画面を見て！" />
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
                <p className="text-[10px] text-gray-500 font-bold mb-1 uppercase">営業収入</p>
                <p className="text-xl font-black text-white">¥58,200</p>
             </div>
             <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
                <p className="text-[10px] text-gray-500 font-bold mb-1 uppercase">乗車回数</p>
                <p className="text-xl font-black text-white">24回</p>
             </div>
          </div>
          <SpeechBubble char="kenji" text="す、すげぇ…！ 疲れて帰ってきてからの面倒な計算地獄が、ゼロ秒！？" />
          <SpeechBubble char="navi" side="right" text="さらに見て！ 仲間内ランキングもあるから、他の人の状況を見るのも楽しみだね。今月は暇だけど自分だけかなぁ？とかもこれを見れば分かるよ" />
          <SpeechBubble char="kenji" text="マジか！ なんか燃えてきたな。明日も頼むぜ、相棒！" />
        </div>
      </MangaFrame>

      {/* ラストメッセージ */}
      <div className="text-center py-12 space-y-6">
        <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto animate-bounce" />
        <div className="space-y-2">
          <p className="text-2xl font-black text-white italic tracking-tighter">
            「TAXI-NAVIGATOR」で、<br />あなたの営業をスマートに。
          </p>
        </div>
        <div className="pt-4 italic font-black text-gray-500 text-sm tracking-widest">
          - FIN -
        </div>
      </div>
      
      {/* 戻るボタンの案内 */}
      <div className="flex flex-col items-center text-gray-500 gap-2 animate-pulse">
        <ArrowDownCircle size={32} />
        <p className="text-[10px] font-black uppercase tracking-widest">Scroll to explore</p>
      </div>
    </div>
  );
};

export default MangaView;