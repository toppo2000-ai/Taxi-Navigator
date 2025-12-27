// キーパッドビューコンポーネント - 数値入力用（売上・高速代入力に使用）
// テンキーを使用した直感的な数値入力を提供
import React from 'react';
import { Check } from 'lucide-react';
import { toCommaSeparated } from '@/utils';

// プロパティ定義
// label: キーパッドの用途ラベル
// value: 現在の入力値（カンマ区切り）
// colorClass: 表示カラー（青・黄など）
// onChange: 数値変更時のコールバック
// onConfirm: 確定ボタン押下時のコールバック
interface KeypadViewProps {
  label: string;
  value: string;
  colorClass: string;
  onChange: (val: string) => void;
  onConfirm: () => void;
}

export const KeypadView: React.FC<KeypadViewProps> = ({ label, value, colorClass, onChange, onConfirm }) => {
  // 数字をクリック時に入力値に追加
  // 最初の0は新規数字に置き換え
  const appendDigit = (digit: string) => {
    const current = value.replace(/,/g, '');
    const updated = current === "0" ? digit : current + digit;
    onChange(toCommaSeparated(updated));
  };

  // バックスペース機能（最後の1文字を削除）
  const handleDelete = () => {
    const current = value.replace(/,/g, '');
    const updated = current.length <= 1 ? "0" : current.slice(0, -1);
    onChange(toCommaSeparated(updated));
  };

  // クリア機能（0にリセット）
  const handleClear = () => {
    onChange("0");
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* 入力値表示エリア */}
      <div className="flex flex-col space-y-2">
        <span className="text-lg font-bold ml-2 uppercase tracking-widest text-gray-400">{label}入力</span>
        <div className={`rounded-3xl p-5 flex items-center justify-end border min-h-[80px] shadow-inner overflow-hidden ${colorClass.replace('text-', 'border-').split(' ')[0]} bg-[#1A2536]`}>
           <span className={`text-[clamp(3rem,12vw,4.5rem)] font-black tracking-tighter truncate w-full text-right ${colorClass}`}>¥{value}</span>
        </div>
      </div>

      {/* テンキー（3x4配置 + 追加ボタン） */}
      <div className="grid grid-cols-4 gap-2">
        {/* 数字ボタン 7-9 と DEL */}
        {[7, 8, 9, 'DEL', 4, 5, 6, 'C', 1, 2, 3, '00'].map((key) => (
          <button
            key={key}
            onClick={() => {
              if (key === 'DEL') handleDelete();
              else if (key === 'C') handleClear();
              else appendDigit(key.toString());
            }}
            className={`h-16 rounded-2xl text-3xl font-bold flex items-center justify-center active:scale-95 transition-all shadow-md ${
              key === 'DEL' || key === 'C' ? 'bg-red-600/90 text-white' : 'bg-[#2D3848] text-white'
            }`}
          >
            {key === 'DEL' ? '←' : key}
          </button>
        ))}
        
        {/* 0ボタン */}
        <button onClick={() => appendDigit('0')} className="h-16 rounded-2xl text-3xl font-bold bg-[#2D3848] text-white flex items-center justify-center active:scale-95 shadow-md">0</button>
        
        {/* 確定ボタン（3列を占める） */}
        <button onClick={onConfirm} className="col-span-3 h-16 bg-green-600 text-white rounded-2xl text-2xl font-black shadow-xl active:scale-95 flex items-center justify-center gap-2">
          <Check className="w-8 h-8" /> 確定
        </button>
      </div>
    </div>
  );
};
