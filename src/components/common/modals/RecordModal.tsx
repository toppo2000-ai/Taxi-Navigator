import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  MapPin, 
  Navigation, 
  Check, 
  Trash2, 
  Clock, 
  CreditCard, 
  Car, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Minus, 
  AlertCircle 
} from 'lucide-react';
import { SalesRecord, MonthlyStats, PaymentMethod, RideType, ALL_RIDE_TYPES } from '@/types';
import { 
  PAYMENT_LABELS, 
  RIDE_LABELS, 
  toCommaSeparated, 
  fromCommaSeparated, 
  getBusinessDate 
} from '@/utils';
import { ModalWrapper } from './ModalWrapper';
import { KeypadView } from './KeypadView';
import { useGeolocation } from '@/hooks/useGeolocation';

interface RecordModalProps {
  stats: MonthlyStats;
  onSave: (record: Omit<SalesRecord, 'id'>) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  editingRecord?: SalesRecord | null;
}

export const RecordModal: React.FC<RecordModalProps> = ({ 
  stats, 
  onSave, 
  onDelete, 
  onClose, 
  editingRecord 
}) => {
  const [step, setStep] = useState<'amount' | 'details'>(editingRecord ? 'details' : 'amount');
  const [amountStr, setAmountStr] = useState(editingRecord ? editingRecord.amount.toLocaleString() : "");
  const [tollStr, setTollStr] = useState(editingRecord?.toll ? editingRecord.toll.toLocaleString() : "0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(editingRecord?.paymentMethod || stats.enabledPaymentMethods[0] || 'CASH');
  const [rideType, setRideType] = useState<RideType>(editingRecord?.rideType || 'FLOW');
  const { location, error: locationError, isLocating, getCurrentLocation, setLocation } = useGeolocation();
  const [timestamp, setTimestamp] = useState<number>(editingRecord?.timestamp || Date.now());

  const businessDate = getBusinessDate(timestamp, stats.businessStartHour);

  useEffect(() => {
    if (editingRecord?.location) {
      setLocation(editingRecord.location);
    } else if (!editingRecord) {
      getCurrentLocation();
    }
  }, [editingRecord, getCurrentLocation, setLocation]);

  const handleSave = () => {
    const amount = fromCommaSeparated(amountStr);
    const toll = fromCommaSeparated(tollStr);
    if (amount <= 0) return;

    onSave({
      amount,
      toll,
      paymentMethod,
      rideType,
      location: location || undefined,
      timestamp,
      date: businessDate
    });
    onClose();
  };

  const adjustTime = (minutes: number) => {
    setTimestamp(prev => prev + minutes * 60000);
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            {editingRecord ? '売上を編集' : '売上を入力'}
          </h3>
          <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'amount' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800">
              <label className="text-sm font-bold text-gray-500 mb-2 block uppercase tracking-widest">売上金額</label>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-black text-blue-400">¥</span>
                <input 
                  type="text" 
                  readOnly
                  value={amountStr} 
                  className="bg-transparent text-white text-5xl font-black w-full outline-none"
                  placeholder="0"
                />
              </div>
            </div>

            <KeypadView 
              value={amountStr} 
              onChange={setAmountStr} 
              onComplete={() => setStep('details')} 
            />

            <button 
              onClick={() => setStep('details')}
              disabled={!amountStr || amountStr === "0"}
              className="w-full bg-blue-500 py-5 rounded-2xl font-black text-2xl text-white shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
            >
              次へ
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="flex items-center justify-between bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
              <button onClick={() => setStep('amount')} className="flex items-center gap-2 text-blue-400 font-bold">
                <ChevronLeft className="w-5 h-5" /> 金額修正
              </button>
              <div className="text-right">
                <span className="text-xs font-bold text-gray-500 block">売上金額</span>
                <span className="text-xl font-black text-white">¥{amountStr}</span>
              </div>
            </div>

            <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-4">
              <label className="text-sm font-bold text-gray-500 block uppercase tracking-widest flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> 支払い方法
              </label>
              <div className="grid grid-cols-2 gap-2">
                {stats.enabledPaymentMethods.map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`p-4 rounded-2xl font-black text-sm border transition-all ${
                      paymentMethod === m 
                      ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/20' 
                      : 'bg-gray-800 border-gray-700 text-gray-400'
                    } active:scale-95`}
                  >
                    {stats.customPaymentLabels?.[m] || PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-4">
              <label className="text-sm font-bold text-gray-500 block uppercase tracking-widest flex items-center gap-2">
                <Car className="w-4 h-4" /> 乗車区分
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(stats.enabledRideTypes || ALL_RIDE_TYPES).map(r => (
                  <button
                    key={r}
                    onClick={() => setRideType(r)}
                    className={`p-3 rounded-xl font-bold text-xs border transition-all ${
                      rideType === r 
                      ? 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20' 
                      : 'bg-gray-800 border-gray-700 text-gray-400'
                    } active:scale-95`}
                  >
                    {RIDE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-4">
              <label className="text-sm font-bold text-gray-500 block uppercase tracking-widest flex items-center gap-2">
                <Navigation className="w-4 h-4" /> 高速代
              </label>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-black text-gray-400">¥</span>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={tollStr} 
                  onChange={(e) => setTollStr(toCommaSeparated(e.target.value))}
                  className="bg-gray-800 text-white text-3xl font-black w-full outline-none p-3 rounded-2xl border border-gray-700"
                />
              </div>
            </div>

            <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-gray-500 block uppercase tracking-widest flex items-center gap-2">
                  <Clock className="w-4 h-4" /> 発生時刻
                </label>
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded">{businessDate}分</span>
              </div>
              <div className="flex items-center justify-between bg-gray-800 p-2 rounded-2xl border border-gray-700">
                <button onClick={() => adjustTime(-10)} className="p-3 bg-gray-700 rounded-xl text-gray-300 active:scale-90"><Minus className="w-5 h-5" /></button>
                <div className="text-center">
                  <span className="text-2xl font-black text-white">
                    {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button onClick={() => adjustTime(10)} className="p-3 bg-gray-700 rounded-xl text-gray-300 active:scale-90"><Plus className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-gray-500 block uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> 位置情報
                </label>
                <button 
                  onClick={getCurrentLocation}
                  disabled={isLocating}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
                    isLocating ? 'bg-gray-800 text-gray-600' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}
                >
                  {isLocating ? '取得中...' : '再取得'}
                </button>
              </div>
              
              {location ? (
                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 p-3 rounded-2xl">
                  <div className="p-2 bg-green-500 rounded-full text-black">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-400">位置情報を取得済み</p>
                    <p className="text-[10px] text-green-600 font-mono">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
                  </div>
                </div>
              ) : locationError ? (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 p-3 rounded-2xl">
                  <div className="p-2 bg-red-500 rounded-full text-white">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-red-400">{locationError}</p>
                </div>
              ) : (
                <div className="text-center py-4 border-2 border-dashed border-gray-800 rounded-2xl">
                  <p className="text-xs font-bold text-gray-600">位置情報なし</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {editingRecord && onDelete && (
                <button 
                  onClick={() => {
                    if (window.confirm('この売上記録を削除しますか？')) {
                      onDelete(editingRecord.id);
                      onClose();
                    }
                  }}
                  className="flex-1 bg-red-900/20 border border-red-900/50 text-red-500 py-5 rounded-2xl font-black text-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-6 h-6" /> 削除
                </button>
              )}
              <button 
                onClick={handleSave}
                className="flex-[2] bg-green-500 py-5 rounded-2xl font-black text-2xl text-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-7 h-7" /> {editingRecord ? '更新' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};
