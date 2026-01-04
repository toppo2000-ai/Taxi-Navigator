import React, { useState } from 'react';
import { Car, Gauge, CheckCircle2 } from 'lucide-react';
import { Shift, PaymentMethod } from '../../../types';
import { ReportSummaryView } from '../../history/DailyDetailView';
import { ModalWrapper } from './ModalWrapper';

export const DailyReportModal: React.FC<{
  shift: Shift;
  customLabels: Record<string, string>;
  enabledMethods?: PaymentMethod[];
  businessStartHour: number;
  onConfirm: (endOdo?: number) => void;
  onClose: () => void;
}> = ({ shift, customLabels, enabledMethods, businessStartHour, onConfirm, onClose }) => {
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [endOdo, setEndOdo] = useState('');
  const [showWarning, setShowWarning] = useState(false);

  const startOdoNum = shift.startOdo || 0;
  const endOdoNum = endOdo ? Number(endOdo) : 0;
  const distance = (endOdoNum > startOdoNum) ? endOdoNum - startOdoNum : 0;

  const handleNext = () => {
    if (!endOdo) {
      setShowWarning(true);
    } else {
      setStep('confirm');
    }
  };

  const handleWarningYes = () => {
      setShowWarning(false);
      setStep('confirm');
  };

  const handleWarningNo = () => {
      setShowWarning(false);
  };

  const handleConfirm = () => {
      onConfirm(endOdo !== '' ? Number(endOdo) : undefined);
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6 relative">
        
        {showWarning && (
           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm rounded-[32px] animate-in fade-in duration-200 p-4">
              <div className="w-full space-y-6 text-center">
                <div className="bg-amber-500/10 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                    <Car className="w-10 h-10 text-amber-500" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-white mb-2">確認</h3>
                    <p className="text-gray-300 font-bold leading-relaxed">
                      入庫時ODOが入力されてませんが<br/>いいですか？
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <button 
                        onClick={handleWarningNo} 
                        className="bg-gray-800 text-gray-300 py-4 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-transform border border-gray-700"
                    >
                        いいえ
                    </button>
                    <button 
                        onClick={handleWarningYes} 
                        className="bg-amber-500 text-black py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-transform"
                    >
                        はい
                    </button>
                </div>
              </div>
           </div>
        )}

        {step === 'input' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
             <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-white flex items-center justify-center gap-2">
                  <Gauge className="w-8 h-8 text-amber-500" /> 入庫処理
                </h3>
                <p className="text-sm font-bold text-gray-500">入庫時のメーター数値を入力してください</p>
             </div>

             <div className="space-y-2">
                 <p className="text-xs font-black text-gray-500 uppercase tracking-widest text-left pl-1">入庫時メーター</p>
                 <div className="flex items-center bg-gray-950 rounded-2xl p-5 border-2 border-gray-700 focus-within:border-amber-500 transition-all shadow-inner">
                    <Gauge className="text-gray-500 w-8 h-8 mr-3" />
                    <input 
                        type="number" 
                        inputMode="numeric" 
                        value={endOdo} 
                        onChange={(e) => setEndOdo(e.target.value)} 
                        placeholder="入庫ODO"
                        className="bg-transparent text-white text-[clamp(1.5rem,8vw,2.5rem)] font-black w-full outline-none text-center placeholder-gray-700"
                        autoFocus
                    />
                    <span className="text-gray-500 font-bold ml-2">km</span>
                 </div>
                 {startOdoNum > 0 && (
                    <p className="text-right text-xs font-bold text-gray-600 px-1">
                      出庫時: {startOdoNum.toLocaleString()} km
                    </p>
                 )}
             </div>

             <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={handleNext} 
                  className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-transform"
                >
                  確認へ進む
                </button>
                <button onClick={onClose} className="w-full py-4 text-lg font-bold text-gray-500 uppercase active:scale-95 tracking-widest">
                  閉じる
                </button>
             </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-white">日報確認</h3>
                <p className="text-sm font-bold text-gray-500">シフトを終了して日報を作成します</p>
            </div>
            
            <div className="bg-gray-900/30 rounded-3xl p-2 border border-gray-800">
                 <ReportSummaryView 
                    records={shift.records} 
                    customLabels={customLabels} 
                    startTime={shift.startTime}
                    endTime={Date.now()}
                    totalRestMinutes={shift.totalRestMinutes}
                    enabledMethods={enabledMethods}
                    startOdo={startOdoNum}
                    endOdo={endOdoNum > 0 ? endOdoNum : undefined}
                />
                 
                 <div className="mt-2 grid grid-cols-3 gap-2 px-1 pb-1">
                    <div className="bg-gray-900/50 p-2 rounded-xl text-center border border-gray-800">
                        <span className="text-[12px] text-gray-500 font-bold uppercase block">開始ODO</span>
                        <span className="text-lg font-black text-white">{startOdoNum.toLocaleString()}</span>
                    </div>
                    <div className="bg-gray-900/50 p-2 rounded-xl text-center border border-gray-800">
                        <span className="text-[12px] text-gray-500 font-bold uppercase block">終了ODO</span>
                        <span className={`text-lg font-black ${endOdo ? 'text-amber-500' : 'text-gray-600'}`}>
                            {endOdo ? Number(endOdo).toLocaleString() : '---'}
                        </span>
                    </div>
                    <div className="bg-gray-900/50 p-2 rounded-xl text-center border border-gray-800">
                        <span className="text-[12px] text-gray-500 font-bold uppercase block">差異</span>
                        <span className="text-lg font-black text-blue-400">{distance.toLocaleString()} <span className="text-xs text-gray-500">km</span></span>
                    </div>
                 </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
                <button onClick={handleConfirm} className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white py-5 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 border border-red-400/30">
                    <CheckCircle2 className="w-8 h-8" /> 業務終了
                </button>
                <button onClick={() => setStep('input')} className="w-full py-4 text-lg font-bold text-gray-500 uppercase active:scale-95 tracking-widest">
                    戻る
                </button>
            </div>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};
