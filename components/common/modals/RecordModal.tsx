import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Loader2, 
  Trash2, 
  MessageSquare, 
  Info, 
  Skull, 
  CalendarDays, 
  Car, 
  Users,
  ChevronRight, 
  MapPin, 
  MapPinned, 
  PlusCircle, 
  Building2, 
  CheckCircle2, 
  Map as MapIcon,
  Clock,
  FileText,
  Target,
  Power,
  CreditCard
} from 'lucide-react';
import { SalesRecord, PaymentMethod, RideType, ALL_RIDE_TYPES, Shift, MonthlyStats } from '../../../types';
import { 
  toCommaSeparated, 
  fromCommaSeparated, 
  getBusinessDate, 
  formatBusinessTime, 
  PAYMENT_LABELS, 
  formatJapaneseAddress, 
  RIDE_LABELS, 
  getGoogleMapsUrl,
  getBillingPeriod,
  formatDate,
  calculatePeriodStats
} from '../../../utils';
import { findTaxiStand, TaxiStandDef } from '../../../taxiStands';
import { findHotel } from '../../../hotels';
import { ModalWrapper } from './ModalWrapper';
import { KeypadView } from './KeypadView';
import { ColleagueStatusList } from '../ColleagueStatusList';
import { db, auth } from '../../../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export const RecordModal: React.FC<{ 
  initialData?: Partial<SalesRecord>;
  enabledMethods: PaymentMethod[];
  enabledRideTypes: RideType[];
  customLabels: Record<string, string>;
  onClose: () => void; 
  onSave: (
    amount: number, 
    toll: number, 
    method: PaymentMethod, 
    ride: RideType, 
    nonCashAmount: number, 
    timestamp: number, 
    pickup?: string, 
    dropoff?: string, 
    pickupCoords?: string, 
    dropoffCoords?: string, 
    pMale?: number, 
    pFemale?: number,
    remarks?: string,
    isBadCustomer?: boolean,
    returnToll?: number,
    id?: string,
    keepOpen?: boolean
  ) => Promise<void>;
  onDelete: () => void;
  businessStartHour: number;
  followingUsers?: string[];
  shift?: Shift | null;
  history?: SalesRecord[];
  monthlyStats?: MonthlyStats;
}> = ({ initialData, enabledMethods, enabledRideTypes, customLabels, onClose, onSave, onDelete, businessStartHour, followingUsers = [], shift, history = [], monthlyStats }) => {
  // ★一時保存用の固定IDを生成（新規なら新規発行、編集なら既存のものを保持）
  const tempIdRef = useRef(initialData?.id || Math.random().toString(36).substr(2, 9));

  // Keypad State
  const [activeInput, setActiveInput] = useState<'amount' | 'toll' | 'nonCash' | 'returnToll' | null>(null);
  
  const [amountStr, setAmountStr] = useState(initialData?.amount ? initialData.amount.toLocaleString() : "0");
  const [tollStr, setTollStr] = useState(initialData?.toll ? initialData.toll.toLocaleString() : "0");
  const [returnTollStr, setReturnTollStr] = useState(initialData?.returnToll ? initialData.returnToll.toLocaleString() : "0"); 
  const [method, setMethod] = useState<PaymentMethod>(initialData?.paymentMethod || (enabledMethods[0] || 'CASH'));
  
  const safeEnabledRideTypes = (enabledRideTypes && enabledRideTypes.length > 0) ? enabledRideTypes : ALL_RIDE_TYPES;
  const [rideType, setRideType] = useState<RideType>(initialData?.rideType || safeEnabledRideTypes[0]);

  const [otherAmountStr, setOtherAmountStr] = useState(initialData?.nonCashAmount ? initialData.nonCashAmount.toLocaleString() : "0");
  
  // 住所・座標ステート
  const [pickup, setPickup] = useState(initialData?.pickupLocation || "");
  const [dropoff, setDropoff] = useState(initialData?.dropoffLocation || "");
  const [pickupCoords, setPickupCoords] = useState(initialData?.pickupCoords || ""); 
  const [dropoffCoords, setDropoffCoords] = useState(initialData?.dropoffCoords || ""); 

  const [passengersMale, setPassengersMale] = useState(initialData?.passengersMale ?? 0); 
  const [passengersFemale, setPassengersFemale] = useState(initialData?.passengersFemale ?? 0);
  const [remarks, setRemarks] = useState(initialData?.remarks || "");
  const [isBadCustomer, setIsBadCustomer] = useState(initialData?.isBadCustomer || false);
  
  // 備考欄から選択された決済アプリを取得（初期値）
  useEffect(() => {
    if (initialData?.remarks) {
      const remarks = initialData.remarks;
      if (remarks.includes('GO決済')) {
        setSelectedPaymentApp('GO決済');
      } else if (remarks.includes('Didi決済')) {
        setSelectedPaymentApp('Didi決済');
      } else if (remarks.includes('Uber決済')) {
        setSelectedPaymentApp('Uber決済');
      } else if (remarks.includes('QR決済')) {
        setSelectedPaymentApp('QRコード');
      }
    }
  }, [initialData?.remarks]);

  const [isLocating, setIsLocating] = useState<'pickup' | 'dropoff' | 'stopover' | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAppTypeModal, setShowAppTypeModal] = useState(false);
  const [showPaymentAppTypeModal, setShowPaymentAppTypeModal] = useState(false);
  const [selectedPaymentApp, setSelectedPaymentApp] = useState<string>('');
  
  // リアルタイム更新用の現在時刻
  const [currentTime, setCurrentTime] = useState(Date.now());
  // 当日の最初の出庫時刻
  const [todayStartTime, setTodayStartTime] = useState<number | null>(null);

  // 乗り場選択用State
  const [standSelection, setStandSelection] = useState<TaxiStandDef | null>(null);
  // ホテル選択用State
  const [hotelSelection, setHotelSelection] = useState<string | null>(null);
  
  // リアルタイム更新用のuseEffect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // 1秒ごとに更新
    
    return () => clearInterval(interval);
  }, []);
  
  // public_statusからtodayStartTimeを取得
  useEffect(() => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      setTodayStartTime(null);
      return;
    }
    
    const unsub = onSnapshot(doc(db, "public_status", currentUserId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const todayStart = data.todayStartTime;
        if (todayStart) {
          // todayStartTimeが当日の営業日か確認
          const todayStartBusinessDate = getBusinessDate(todayStart, businessStartHour);
          const currentBusinessDate = getBusinessDate(Date.now(), businessStartHour);
          if (todayStartBusinessDate === currentBusinessDate) {
            setTodayStartTime(todayStart);
          } else {
            setTodayStartTime(null);
          }
        } else {
          setTodayStartTime(null);
        }
      } else {
        setTodayStartTime(null);
      }
    }, (error) => {
      console.error('[RecordModal] Error loading todayStartTime:', error);
      setTodayStartTime(null);
    });
    
    return () => unsub();
  }, [businessStartHour]);

  // 現在選択されている決済方法名に「アプリ」が含まれているか判定
  const isAppPayment = useMemo(() => {
    const label = customLabels[method] || PAYMENT_LABELS[method];
    return label ? label.includes('アプリ') : false;
  }, [method, customLabels]);

  // 備考欄から選択された決済アプリを更新
  useEffect(() => {
    if (remarks) {
      if (remarks.includes('GO決済')) {
        setSelectedPaymentApp('GO決済');
      } else if (remarks.includes('Didi決済')) {
        setSelectedPaymentApp('Didi決済');
      } else if (remarks.includes('Uber決済')) {
        setSelectedPaymentApp('Uber決済');
      } else if (remarks.includes('QR決済')) {
        setSelectedPaymentApp('QRコード');
      } else if (!remarks.match(/(GO|Didi|Uber|QR)決済/)) {
        // 決済アプリの文字列が含まれていない場合、リセット
        if (method !== 'QR') {
          setSelectedPaymentApp('');
        }
      }
    } else {
      if (method !== 'QR') {
        setSelectedPaymentApp('');
      }
    }
  }, [remarks, method]);

  // 乗車区分のアプリ選択時のハンドラー（備考欄に「GO配車」などとセット）
  const handleRideAppTypeSelect = (appName: string) => {
    // 既存のアプリ配車の文字列を削除（GO配車、Didi配車、Uber配車、S.RIDE配車、s.ride配車）
    const displayName = appName === 's.ride' ? 'S.RIDE' : appName;
    const appText = `${displayName}配車 `;
    setRemarks(prev => {
      if (!prev) return appText;
      // 既存のアプリ配車の文字列を削除（大文字・小文字両方に対応）
      let cleaned = prev
        .replace(/GO配車\s*/g, '')
        .replace(/Didi配車\s*/g, '')
        .replace(/Uber配車\s*/g, '')
        .replace(/S\.RIDE配車\s*/g, '')
        .replace(/s\.ride配車\s*/g, '');
      // 新しいアプリ配車の文字列を追加
      return cleaned ? `${cleaned}${appText}` : appText;
    });
    setShowAppTypeModal(false);
  };

  // 支払い種別のアプリ選択時のハンドラー（備考欄に「GO決済」などとセット）
  const handlePaymentAppTypeSelect = (appName: string) => {
    // 既存の決済アプリの文字列を削除（GO決済、Didi決済、Uber決済、QR決済）
    const appText = `${appName}決済 `;
    setRemarks(prev => {
      if (!prev) return appText;
      // 既存の決済アプリの文字列を削除
      let cleaned = prev
        .replace(/GO決済\s*/g, '')
        .replace(/Didi決済\s*/g, '')
        .replace(/Uber決済\s*/g, '')
        .replace(/QR決済\s*/g, '');
      // 新しい決済アプリの文字列を追加
      return cleaned ? `${cleaned}${appText}` : appText;
    });
    setSelectedPaymentApp(appName === 'QR' ? 'QRコード' : `${appName}決済`);
    setShowPaymentAppTypeModal(false);
  };


  const rideTypeRef = useRef<HTMLDivElement>(null);
  const amountSectionRef = useRef<HTMLDivElement>(null);
  const prevActiveInputRef = useRef<string | null>(null);

  // バックグラウンド一時保存用関数
  const triggerAutoSave = async (currentPickup: string, currentPickupCoords: string) => {
    const [year, month, day] = recordDate.split('-').map(Number);
    const [hour, min] = recordTime.split(':').map(Number);
    const currentTs = new Date(year, month - 1, day, hour, min).getTime();

    await onSave(
      fromCommaSeparated(amountStr),
      fromCommaSeparated(tollStr),
      method,
      rideType,
      fromCommaSeparated(otherAmountStr),
      currentTs,
      currentPickup,
      dropoff,
      currentPickupCoords,
      dropoffCoords,
      passengersMale,
      passengersFemale,
      remarks,
      isBadCustomer,
      fromCommaSeparated(returnTollStr),
      tempIdRef.current,
      true 
    );
  };

  const [recordDate, setRecordDate] = useState(() => {
    const d = initialData?.timestamp ? new Date(initialData.timestamp) : new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });
  const [recordTime, setRecordTime] = useState(() => {
    const d = initialData?.timestamp ? new Date(initialData.timestamp) : new Date();
    return d.toTimeString().split(' ')[0].slice(0, 5);
  });

  const businessTimePreview = useMemo(() => {
    if (!recordDate || !recordTime) return '';
    const [year, month, day] = recordDate.split('-').map(Number);
    const [hour, min] = recordTime.split(':').map(Number);
    const d = new Date(year, month - 1, day, hour, min);
    
    const bDate = getBusinessDate(d.getTime(), businessStartHour);
    const bTime = formatBusinessTime(d.getTime(), businessStartHour);
    return `${bDate} ${bTime}`;
  }, [recordDate, recordTime, businessStartHour]);

  useEffect(() => {
    if (!activeInput) {
        setTimeout(() => {
            rideTypeRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 50);
    }
  }, []);

  useEffect(() => {
    if (activeInput === null && (prevActiveInputRef.current === 'amount' || prevActiveInputRef.current === 'toll')) {
        setTimeout(() => {
            amountSectionRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 50);
    }
    prevActiveInputRef.current = activeInput;
  }, [activeInput]);

  useEffect(() => {
    if (!initialData?.id && pickup === "") {
      fetchAddress('pickup');
    }
  }, []);

  useEffect(() => {
    if (method !== 'CASH' && activeInput !== 'nonCash') {
      const fare = fromCommaSeparated(amountStr);
      const toll = fromCommaSeparated(tollStr);
      setOtherAmountStr((fare + toll).toLocaleString());
    }
  }, [amountStr, tollStr, method]);

  const fetchAddress = async (type: 'pickup' | 'dropoff' | 'stopover') => {
    setIsLocating(type);
    try {
      const pos: GeolocationPosition = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          timeout: 10000,
          enableHighAccuracy: true 
        });
      });
      const { latitude, longitude } = pos.coords;
      const coordsString = `${latitude},${longitude}`; 

      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'ja' }
      });
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      const formatted = formatJapaneseAddress(data);
      if (formatted) {
        if (type === 'pickup') { 
            setPickup(formatted); 
            setPickupCoords(coordsString); 
            
            const detectedHotel = findHotel(formatted);
            const detectedStand = findTaxiStand(formatted);
            
            if (detectedHotel) {
                setHotelSelection(detectedHotel);
                if (detectedStand) setStandSelection(detectedStand);
            } else if (detectedStand) {
                setStandSelection(detectedStand);
            } else {
                triggerAutoSave(formatted, coordsString);
            }
        }
        else if (type === 'dropoff') { setDropoff(formatted); setDropoffCoords(coordsString); }
        return formatted;
      }
    } catch (err) {
      console.error("Geolocation failed", err);
    } finally {
      setIsLocating(null);
    }
    return '';
  };

  const handleAddStopover = async () => {
    const formattedAddr = await fetchAddress('stopover');
    if (!formattedAddr) return;

    setRemarks(prev => {
      if (!prev.includes('(経由)')) {
        const base = prev.trim() ? prev.trim() + "\n" : "";
        return base + `(経由)${formattedAddr}`;
      }

      const parts = prev.split('(経由)');
      const lastStop = parts[1].split('→').pop()?.trim();
      if (lastStop === formattedAddr) return prev;
      return prev + `→${formattedAddr}`;
    });
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    let finalDropoff = dropoff;
    let finalDropoffCoords = dropoffCoords;
    if (!initialData?.id && !finalDropoff) {
      setIsLocating('dropoff');
      try {
        const pos: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        finalDropoffCoords = `${pos.coords.latitude},${pos.coords.longitude}`;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'ja' } });
        const data = await res.json();
        const autoAddress = formatJapaneseAddress(data);
        if (autoAddress) finalDropoff = autoAddress;
      } catch (e) { console.error(e); }
      setIsLocating(null);
    }

    const finalAmount = fromCommaSeparated(amountStr);
    const finalToll = fromCommaSeparated(tollStr);
    const finalReturnToll = fromCommaSeparated(returnTollStr);
    const nonCash = method !== 'CASH' ? fromCommaSeparated(otherAmountStr) : 0;
    
    const [year, month, day] = recordDate.split('-').map(Number);
    const [hour, min] = recordTime.split(':').map(Number);
    const finalTimestamp = new Date(year, month - 1, day, hour, min).getTime();
    
    await onSave(
      finalAmount, 
      finalToll, 
      method, 
      rideType, 
      nonCash, 
      finalTimestamp, 
      pickup, 
      finalDropoff,
      pickupCoords, 
      finalDropoffCoords, 
      passengersMale,
      passengersFemale,
      remarks,
      isBadCustomer,
      finalReturnToll,
      tempIdRef.current,
      false
    );
    setIsSaving(false);
  };

  const cyclePassenger = (type: 'male' | 'female') => {
    if (type === 'male') {
      setPassengersMale(prev => (prev + 1) > 4 ? 0 : prev + 1);
    } else {
      setPassengersFemale(prev => (prev + 1) > 4 ? 0 : prev + 1);
    }
  };

  const currentKeypadValue = activeInput === 'amount' ? amountStr 
                            : activeInput === 'toll' ? tollStr 
                            : activeInput === 'returnToll' ? returnTollStr
                            : activeInput === 'nonCash' ? otherAmountStr : "0";
  
  const handleKeypadChange = (val: string) => {
    if (activeInput === 'amount') setAmountStr(val);
    else if (activeInput === 'toll') setTollStr(val);
    else if (activeInput === 'returnToll') setReturnTollStr(val);
    else if (activeInput === 'nonCash') setOtherAmountStr(val);
  };

  const getKeypadLabel = () => {
    if (activeInput === 'amount') return '運賃';
    if (activeInput === 'toll') return '高速代';
    if (activeInput === 'returnToll') return '帰路高速';
    if (activeInput === 'nonCash') return '決済額';
    return '';
  };

  const getKeypadColor = () => {
    if (activeInput === 'amount') return 'text-amber-500';
    if (activeInput === 'toll') return 'text-white';
    if (activeInput === 'returnToll') return 'text-indigo-400';
    if (activeInput === 'nonCash') return 'text-blue-500';
    return 'text-white';
  };

  const handleStandSelect = (option: string) => {
      if (standSelection) {
          const newPickup = `${standSelection.name} ${option}`;
          setPickup(newPickup);
          setStandSelection(null);
          triggerAutoSave(newPickup, pickupCoords);
      }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6 relative">
          
          {hotelSelection ? (
              <div className="space-y-6 py-4 animate-in slide-in-from-bottom-4 flex flex-col h-full">
                  <div className="text-center space-y-2 mb-2 mt-4">
                      <div className="bg-cyan-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse">
                          <Building2 className="w-10 h-10 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-black text-white leading-tight tracking-tight mb-2">{hotelSelection}</h3>
                        <p className="text-lg font-bold text-cyan-200/70">ですか？</p>
                      </div>
                  </div>
                  
                  <div className="flex-1 content-start space-y-4 px-4">
                      <button
                          onClick={() => {
                              setPickup(hotelSelection); 
                              setHotelSelection(null);   
                              setStandSelection(null);   
                              triggerAutoSave(hotelSelection, pickupCoords);
                          }}
                          className="relative w-full overflow-hidden bg-black hover:bg-gray-900 border-2 border-cyan-500/50 hover:border-cyan-400 text-white font-black py-6 rounded-3xl text-2xl transition-all active:scale-95 shadow-xl group"
                      >
                          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
                          <div className="relative z-10 flex items-center justify-center gap-3">
                             <CheckCircle2 className="w-8 h-8 text-cyan-400" />
                             <span>はい、そうです</span>
                          </div>
                      </button>
                  </div>
                  
                  <div className="pt-6 mt-auto">
                    <button 
                        onClick={() => {
                            setHotelSelection(null);
                            if (!standSelection) {
                                triggerAutoSave(pickup, pickupCoords);
                            }
                        }}
                        className="group w-full py-5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black rounded-2xl text-lg border border-rose-400/50 active:scale-95 transition-all shadow-[0_0_20px_rgba(225,29,72,0.4)] flex items-center justify-between px-6"
                    >
                        <span className="flex flex-col items-start leading-none gap-1">
                            <span className="text-[10px] opacity-80 font-bold tracking-widest">NO</span>
                            <span>いいえ、違います</span>
                        </span>
                        <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
              </div>
          ) : standSelection ? (
              <div className="space-y-6 py-4 animate-in slide-in-from-bottom-4 flex flex-col h-full">
                  <div className="text-center space-y-2 mb-2">
                      <div className="bg-cyan-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                          <MapIcon className="w-8 h-8 text-cyan-400" />
                      </div>
                      <h3 className="text-3xl font-black text-white leading-tight tracking-tight">{standSelection.name}</h3>
                      <p className="text-sm font-bold text-cyan-200/70 bg-cyan-900/30 py-1 px-3 rounded-full inline-block">乗り場番号かを選択</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 flex-1 content-start">
                      {standSelection.options.map(opt => (
                          <button
                              key={opt}
                              onClick={() => handleStandSelect(opt)}
                           className="relative overflow-hidden bg-black hover:bg-gray-900 border-2 border-cyan-500/50 hover:border-cyan-400 text-white font-black py-6 rounded-2xl text-2xl transition-all active:scale-95 shadow-lg group"
      >
                              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
                              <span className="relative z-10">{opt}</span>
                          </button>
                      ))}
                  </div>
                  
                  <div className="pt-6 mt-auto">
                    <button 
                        onClick={() => {
                            setStandSelection(null);
                            triggerAutoSave(pickup, pickupCoords);
                        }}
                        className="group w-full py-5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black rounded-2xl text-lg border border-rose-400/50 active:scale-95 transition-all shadow-[0_0_20px_rgba(225,29,72,0.4)] flex items-center justify-between px-6"
                    >
                        <span className="flex flex-col items-start leading-none gap-1">
                            <span className="text-[10px] opacity-80 font-bold tracking-widest">CANCEL</span>
                            <span>いいえ、通常の流し乗車です</span>
                        </span>
                        <div className="bg-white/20 p-1.5 rounded-full">
                            <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>
                  </div>
              </div>
          ) : activeInput ? (
            <KeypadView 
              label={getKeypadLabel()}
              value={currentKeypadValue}
              colorClass={getKeypadColor()}
              onChange={handleKeypadChange}
              onConfirm={() => setActiveInput(null)}
            />
          ) : (
            <div className="space-y-5 max-h-[85vh] overflow-y-auto custom-scrollbar pb-2 relative">
              <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                <div className="flex flex-col w-full">
                  <h2 className="text-2xl font-black text-white">{initialData?.id ? '記録の修正' : '詳細入力'}</h2>
                </div>
                
                <div className="absolute top-0 right-14 flex items-center">
                    <button
                      type="button"
                      onClick={() => setIsBadCustomer(!isBadCustomer)}
                      className={`p-2 rounded-full border-2 transition-all ${
                        isBadCustomer 
                          ? 'bg-red-900/50 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                          : 'bg-gray-900 border-gray-700 text-gray-600'
                      }`}
                    >
                      <Skull className="w-6 h-6" />
                    </button>
                </div>

                <button onClick={onClose} className="text-gray-500 p-2 absolute top-0 right-0"><X className="w-8 h-8" /></button>
              </div>

              <div className="bg-gray-800 p-4 rounded-3xl border-2 border-blue-500 text-center relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>
                  <label className="text-xs font-black text-amber-500 uppercase tracking-widest block mb-1 flex items-center justify-center gap-2">
                      <CalendarDays className="w-4 h-4" /> 入力対象日
                  </label>
                  <input 
                    type="date" 
                    value={recordDate} 
                    onChange={(e) => setRecordDate(e.target.value)} 
                    className="bg-transparent text-white text-3xl font-black w-full text-center outline-none uppercase tracking-widest"
                  />
              </div>

              <div className="space-y-6">
                <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                  <label className="text-xl font-black text-gray-500 uppercase block tracking-widest mb-3">1. 時間</label>
                  <div className="flex gap-3">
                    <input type="time" value={recordTime} onChange={(e) => setRecordTime(e.target.value)} className="w-full bg-gray-800 border-2 border-blue-500 rounded-xl p-4 text-3xl font-black outline-none focus:border-blue-400 shadow-inner text-white text-center" />
                  </div>
                  <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold px-1 mt-2 justify-center">
                    <Info className="w-4 h-4" />
                      <span>営業日換算: {businessTimePreview}</span>
                  </div>
                </div>

                <div className="space-y-4 bg-gray-800 p-2 rounded-3xl border-2 border-blue-500 opacity-80 hover:opacity-100 transition-opacity">
                  <label className="text-xl font-black text-gray-500 uppercase block tracking-widest px-2 mb-3">2. 乗降地</label>
                  <div>
                    <div className="flex justify-between items-center mb-1 px-1">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-green-400" /> 乗車地
                      </label>
                      <button 
                        onClick={() => fetchAddress('pickup')}
                        className="text-[10px] bg-gray-800 text-green-400 font-black px-2 py-1 rounded-lg border border-green-500/20 active:scale-90 flex items-center gap-1 whitespace-nowrap"
                      >
                        {isLocating === 'pickup' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                        現在地
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={pickup} 
                        onChange={(e) => { setPickup(e.target.value); if(!e.target.value) setPickupCoords(""); }}
                        placeholder="乗車時に自動取得" 
                        className="flex-1 bg-gray-700 border-2 border-blue-500 rounded-2xl p-3 text-lg font-black outline-none focus:border-green-500 shadow-inner"
                      />
                      {/* ★非表示: スマホ拡大表示時に画面が左右にずれるため */}
                      {/* {pickupCoords && (
                        <a 
                          href={getGoogleMapsUrl(pickupCoords) || "#"} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30 active:scale-90 flex items-center justify-center"
                        >
                          <MapPinned className="w-6 h-6" />
                        </a>
                      )} */}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1 px-1">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <MapPinned className="w-3 h-3 text-red-400" /> 降車地
                      </label>
                      <button 
                        onClick={() => fetchAddress('dropoff')}
                        className="text-[10px] bg-gray-800 text-red-400 font-black px-2 py-1 rounded-lg border border-red-500/20 active:scale-90 flex items-center gap-1 whitespace-nowrap"
                      >
                        {isLocating === 'dropoff' ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPinned className="w-3 h-3" />}
                        現在地
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={dropoff} 
                        onChange={(e) => { setDropoff(e.target.value); if(!e.target.value) setDropoffCoords(""); }}
                        placeholder="保存時に自動取得" 
                        className="flex-1 bg-gray-700 border-2 border-blue-500 rounded-2xl p-3 text-lg font-black outline-none focus:border-red-500 shadow-inner"
                      />
                      {/* ★非表示: スマホ拡大表示時に画面が左右にずれるため */}
                      {/* {dropoffCoords && (
                        <a 
                          href={getGoogleMapsUrl(dropoffCoords) || "#"} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30 active:scale-90 flex items-center justify-center"
                        >
                          <MapPinned className="w-6 h-6" />
                        </a>
                      )} */}
                    </div>
                  </div>
                </div>

                <div ref={rideTypeRef} className="scroll-mt-4">
                  <label className="text-xl font-black text-gray-500 uppercase mb-3 block tracking-widest flex items-center justify-between">
                    <span>3. 乗車区分</span>
                    {rideType === 'APP' && (() => {
                      // 備考欄からアプリ名を抽出
                      if (remarks.includes('GO配車')) return <span className="text-xl font-black text-gray-400">GO配車</span>;
                      if (remarks.includes('Didi配車')) return <span className="text-xl font-black text-gray-400">Didi配車</span>;
                      if (remarks.includes('Uber配車')) return <span className="text-xl font-black text-gray-400">Uber配車</span>;
                      if (remarks.includes('S.RIDE配車') || remarks.includes('s.ride配車')) return <span className="text-xl font-black text-gray-400">S.RIDE配車</span>;
                      return null;
                    })()}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {safeEnabledRideTypes.map(r => (
                      <button
                        key={r}
                        onClick={() => {
                          setRideType(r);
                          // アプリを選択した場合、ポップアップを表示（新規入力時のみ）
                          if (r === 'APP' && !initialData?.id) {
                            setShowAppTypeModal(true);
                          }
                        }}
                        className={`py-4 rounded-2xl font-black border-2 transition-all shadow-sm whitespace-nowrap ${
                          r === 'HIRE' 
                            ? 'text-2xl' // ハイヤーだけ文字サイズを小さく
                            : 'text-3xl'
                        } ${
                          rideType === r ? 'bg-amber-500 border-amber-500 text-black' : 'bg-gray-800 border-blue-500 text-gray-400'
                        } active:scale-95`}
                      >
                        {RIDE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-800 p-4 rounded-3xl border-2 border-blue-500">
                  <label className="text-xl font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-amber-500" /> 4. 乗車人数
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => cyclePassenger('male')}
                      className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all active:scale-95 h-32 ${
                        passengersMale > 0 
                          ? 'bg-blue-900/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                          : 'bg-gray-700 border-blue-500 text-gray-500'
                      }`}
                    >
                      <span className="text-sm font-bold uppercase tracking-widest mb-1">男性</span>
                      <span className={`text-6xl font-black ${passengersMale > 0 ? 'text-white' : 'text-gray-600'}`}>
                        {passengersMale}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cyclePassenger('female')}
                      className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all active:scale-95 h-32 ${
                        passengersFemale > 0 
                          ? 'bg-pink-900/20 border-pink-500 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]' 
                          : 'bg-gray-700 border-blue-500 text-gray-500'
                      }`}
                    >
                      <span className="text-sm font-bold uppercase tracking-widest mb-1">女性</span>
                      <span className={`text-6xl font-black ${passengersFemale > 0 ? 'text-white' : 'text-gray-600'}`}>
                        {passengersFemale}
                      </span>
                    </button>
                  </div>
                </div>

                <div ref={amountSectionRef} className="scroll-mt-4">
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-xl font-black text-gray-400 uppercase tracking-widest">5. 金額入力</label>
                        <button 
                          onClick={() => setActiveInput('returnToll')}
                          className={`text-[10px] font-black px-3 py-1.5 rounded-full border transition-all active:scale-95 flex items-center gap-1 ${fromCommaSeparated(returnTollStr) > 0 ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_10px_rgba(99,102,241,0.4)]' : 'bg-gray-800 border-gray-700 text-gray-500'}`}
                        >
                          帰路高速代: ¥{returnTollStr}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div 
                        onClick={() => setActiveInput('amount')}
                        className="bg-gray-800 p-4 rounded-3xl border-2 border-blue-500 flex flex-col items-center justify-center shadow-inner cursor-pointer active:scale-[0.98] transition-all min-h-[100px]"
                      >
                        <span className="text-amber-500 font-bold text-sm uppercase mb-1 tracking-widest">運賃</span>
                        <div className="flex items-baseline">
                           <span className="text-amber-500 font-black text-xl mr-1">¥</span>
                           <span className="text-white text-[clamp(2rem,8vw,2.5rem)] font-black truncate leading-none">
                             {amountStr || "0"}
                           </span>
                        </div>
                      </div>
                      
                      <div
                        onClick={() => setActiveInput('toll')}
                        className="bg-gray-800 border-2 border-blue-500 rounded-3xl p-4 flex flex-col items-center justify-center shadow-inner cursor-pointer active:scale-[0.98] transition-all min-h-[100px]"
                      >
                        <span className="text-gray-400 font-bold text-sm uppercase mb-1 tracking-widest">高速代</span>
                        <div className="flex items-baseline">
                           <span className="text-white text-[clamp(2rem,8vw,2.5rem)] font-black truncate leading-none">
                             {tollStr || "0"}
                           </span>
                        </div>
                      </div>
                    </div>
                </div>

                <div>
                  <label className="text-xl font-black text-gray-400 uppercase mb-3 block tracking-widest flex items-center justify-between">
                    <span>6. 決済方法</span>
                    {selectedPaymentApp && (
                      <span className="text-xl font-black text-gray-400">{selectedPaymentApp}</span>
                    )}
                  </label>
                  <div className="relative">
                    <select 
                      value={method} 
                      onChange={(e) => {
                        const newMethod = e.target.value as PaymentMethod;
                        setMethod(newMethod);
                        // アプリ/QRを選択した場合、ポップアップを表示
                        if (newMethod === 'QR') {
                          setShowPaymentAppTypeModal(true);
                        } else {
                          // 他の決済方法を選択した場合、選択した決済アプリをリセット
                          setSelectedPaymentApp('');
                        }
                      }} 
                      className="w-full bg-gray-800 border-2 border-blue-500 rounded-2xl p-4 text-white text-xl font-black outline-none appearance-none focus:border-blue-400 cursor-pointer shadow-inner"
                    >
                      {enabledMethods.map(m => (
                        <option key={m} value={m}>{customLabels[m] || PAYMENT_LABELS[m]}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500"><ChevronRight className="w-6 h-6 rotate-90" /></div>
                  </div>
                </div>

                {/* ★追加: アプリ決済の場合のみ表示される GO/DiDi/Uber 選択ボタン */}
                {isAppPayment && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1 block">
                      アプリ会社選択 (備考へ自動入力)
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handlePaymentAppTypeSelect('GO')}
                        className={`flex-1 py-4 rounded-xl font-black text-3xl border transition-all active:scale-95 ${
                          remarks.includes('GO決済') 
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
                        }`}
                      >
                        GO
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaymentAppTypeSelect('DiDi')}
                        className={`flex-1 py-4 rounded-xl font-black text-3xl border transition-all active:scale-95 ${
                          remarks.includes('DiDi決済')
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
                        }`}
                      >
                        DiDi
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaymentAppTypeSelect('Uber')}
                        className={`flex-1 py-4 rounded-xl font-black text-3xl border transition-all active:scale-95 ${
                          remarks.includes('Uber決済')
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
                        }`}
                      >
                        Uber
                      </button>
                    </div>
                  </div>
                )}

                {method !== 'CASH' && (
                  <div className="bg-blue-900/10 p-4 rounded-3xl border border-blue-900/30 shadow-inner">
                    <label className="text-xs text-blue-400 font-bold uppercase mb-1 block tracking-widest">{customLabels[method] || PAYMENT_LABELS[method]}決済額</label>
                    <div 
                      onClick={() => setActiveInput('nonCash')}
                      className="flex items-center gap-2 cursor-pointer active:scale-[0.99] transition-all"
                    >
                      <span className="text-blue-500 font-black text-2xl">¥</span>
                      <span className="w-full bg-transparent border-b border-blue-900/50 p-1 text-3xl font-black text-white outline-none">
                        {otherAmountStr || "0"}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xl font-bold text-gray-400 flex items-center gap-2 uppercase tracking-widest">
                      <MessageSquare className="w-5 h-5" /> 7. 備考
                    </label>
                    <button
                      type="button"
                      onClick={handleAddStopover}
                      className="text-xs bg-blue-600/20 text-blue-400 font-black px-3 py-1.5 rounded-full border border-blue-500/20 active:scale-95 flex items-center gap-1 transition-all"
                    >
                      {isLocating === 'stopover' ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlusCircle className="w-3 h-3" />}
                      経由地追加
                    </button>
                  </div>
                  <textarea 
                    value={remarks} 
                    onChange={(e) => setRemarks(e.target.value)} 
                    placeholder="メモ、待機時間など..." 
                    className="w-full bg-gray-800 border-2 border-blue-500 rounded-2xl p-3 text-white text-base min-h-[80px] outline-none focus:border-blue-400 shadow-inner" 
                  />
                </div>

                <div className="flex flex-col gap-3 pt-5 pb-5">
                  <button 
                    disabled={isSaving}
                    onClick={handleSave} 
                    className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3"
                  >
                    {isSaving ? <><Loader2 className="w-6 h-6 animate-spin" /> 保存中...</> : (initialData?.id ? '保存する' : 'この内容で完了')}
                  </button>
                  {initialData?.id && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); if (isConfirmingDelete) { onDelete(); } else { setIsConfirmingDelete(true); } }} 
                      className={`w-full py-4 font-black text-lg flex items-center justify-center gap-2 rounded-2xl transition-all border-2 active:scale-95 ${
                        isConfirmingDelete ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'text-red-500 border-red-500/30'
                      }`}
                    >
                      {isConfirmingDelete ? '本当に削除しますか？' : <><Trash2 className="w-5 h-5" /> 記録を削除</>}
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (isConfirmingCancel) { 
                        onClose(); 
                      } else { 
                        setIsConfirmingCancel(true); 
                      } 
                    }}
                    onBlur={() => setTimeout(() => setIsConfirmingCancel(false), 200)}
                    className={`w-full py-4 text-xl font-bold active:scale-90 tracking-widest uppercase transition-all ${
                      isConfirmingCancel 
                        ? 'bg-red-600 text-white' 
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                  >
                    {isConfirmingCancel ? '本当にキャンセルしますか？' : 'Cancel'}
                  </button>
                </div>
              </div>
              
              {/* 他担当の稼働状況を表示 */}
              <div className="mt-6">
                <ColleagueStatusList followingUsers={followingUsers} />
              </div>

              {/* ★追加: 統計情報セクション */}
              {shift && monthlyStats && Array.isArray(shift.records) && (
                <div className="mt-6 space-y-4 bg-gray-800 rounded-3xl p-4 border-2 border-blue-500">
                  {/* ステータスバー */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-white font-black text-sm">
                          営業中 {(() => {
                            const now = Date.now();
                            // 再出庫時はtodayStartTimeを使用、なければshift.startTimeを使用
                            const startTimeForCalculation = todayStartTime || shift.startTime;
                            const diff = now - startTimeForCalculation;
                            const hours = Math.floor(diff / (1000 * 60 * 60));
                            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                            return `${hours}時間${String(minutes).padStart(2, '0')}分`;
                          })()}
                        </span>
                      </div>
                      <div className="text-gray-400 text-xs font-bold ml-5">
                        {(() => {
                          const now = new Date();
                          const dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                          const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
                          return `${dateStr} (~${timeStr})`;
                        })()}
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="bg-red-600 hover:bg-red-500 text-white font-black text-xs px-4 py-2 rounded-full transition-all active:scale-95"
                    >
                      終了
                    </button>
                  </div>

                  {/* 主要売上表示 */}
                  <div className="text-center mb-4">
                    <div className="flex items-baseline justify-center gap-1 mb-2">
                      <span className="text-amber-500 font-black text-4xl">¥</span>
                      <span className="text-white font-black text-5xl">
                        {(() => {
                          const total = (shift.records || []).reduce((sum: number, r: SalesRecord) => sum + (r.amount || 0), 0);
                          return total.toLocaleString();
                        })()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-gray-700 p-2 rounded-xl border-2 border-blue-500">
                        <div className="text-gray-400 text-xs font-bold mb-1">税抜合計</div>
                        <div className="text-white font-black text-sm">
                          ¥{(() => {
                            const total = (shift.records || []).reduce((sum: number, r: SalesRecord) => sum + (r.amount || 0), 0);
                            const net = Math.floor(total / 1.1);
                            return net.toLocaleString();
                          })()}
                        </div>
                      </div>
                      <div className="bg-red-900/30 p-2 rounded-xl border border-red-500/30">
                        <div className="text-gray-400 text-xs font-bold mb-1">基準値</div>
                        <div className="text-white font-black text-sm">
                          {(() => {
                            const now = currentTime;
                            const total = (shift.records || []).reduce((sum: number, r: SalesRecord) => sum + (r.amount || 0), 0);
                            if (!shift.plannedHours || shift.plannedHours === 0) return '0';
                            // 再出庫時はtodayStartTimeを使用、なければshift.startTimeを使用
                            const startTimeForCalculation = todayStartTime || shift.startTime;
                            const currentElapsedHours = (now - startTimeForCalculation) / (1000 * 60 * 60);
                            const hourlyTarget = (shift.dailyGoal || 0) / shift.plannedHours;
                            const idealCurrentSales = hourlyTarget * currentElapsedHours;
                            const diff = total - idealCurrentSales;
                            return diff >= 0 ? `+${Math.round(diff).toLocaleString()}` : Math.round(diff).toLocaleString();
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 目標達成度 */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-black text-sm">
                        {(() => {
                          const total = (shift.records || []).reduce((sum: number, r: SalesRecord) => sum + (r.amount || 0), 0);
                          const progress = (shift.dailyGoal || 0) > 0 ? (total / (shift.dailyGoal || 1)) * 100 : 0;
                          return `${Math.floor(progress)}% 達成`;
                        })()}
                      </span>
                      <span className="text-gray-400 text-xs font-bold">今日の目標 ¥{(shift.dailyGoal || 0).toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div 
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(100, (() => {
                            const total = (shift.records || []).reduce((sum: number, r: SalesRecord) => sum + (r.amount || 0), 0);
                            return (shift.dailyGoal || 0) > 0 ? (total / (shift.dailyGoal || 1)) * 100 : 0;
                          })())}%` 
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* KPIグリッド */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-700 p-3 rounded-xl border-2 border-blue-500">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-xs font-bold">時間あたりの売上</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-amber-500 font-black text-lg">¥</span>
                        <span className="text-white font-black text-xl">
                          {(() => {
                            const now = currentTime;
                            const total = (shift.records || []).reduce((sum: number, r: SalesRecord) => sum + (r.amount || 0), 0);
                            // 再出庫時はtodayStartTimeを使用、なければshift.startTimeを使用
                            const startTimeForCalculation = todayStartTime || shift.startTime;
                            const elapsedMinutes = (now - startTimeForCalculation) / 60000;
                            if (elapsedMinutes <= 0) return '0';
                            return Math.floor((total / elapsedMinutes) * 60).toLocaleString();
                          })()}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-700 p-3 rounded-xl border-2 border-blue-500">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-xs font-bold">乗車回数</span>
                      </div>
                      <div className="text-white font-black text-xl">
                        {(shift.records || []).length}回
                      </div>
                    </div>

                    <div className="bg-gray-700 p-3 rounded-xl border-2 border-blue-500">
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-xs font-bold">月間必要 / 日</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-amber-500 font-black text-lg">¥</span>
                        <span className="text-white font-black text-xl">
                          {(() => {
                            if (!monthlyStats.monthlyGoal || !Array.isArray(monthlyStats.dutyDays)) return '0';
                            const remainingDays = monthlyStats.dutyDays.filter((d: string) => {
                              const today = getBusinessDate(Date.now(), businessStartHour);
                              return d >= today;
                            }).length;
                            if (remainingDays === 0) return '0';
                            const periodStats = (() => {
                              if (!monthlyStats) return 0;
                              const stats = calculatePeriodStats(monthlyStats, history || [], shift || null);
                              return stats.totalSales;
                            })();
                            const remaining = monthlyStats.monthlyGoal - periodStats;
                            return remaining > 0 ? Math.ceil(remaining / remainingDays).toLocaleString() : '0';
                          })()}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-700 p-3 rounded-xl border-2 border-blue-500">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-xs font-bold">目標まで残り</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-amber-500 font-black text-lg">¥</span>
                        <span className="text-white font-black text-xl">
                          {(() => {
                            const total = (shift.records || []).reduce((sum: number, r: SalesRecord) => sum + (r.amount || 0), 0);
                            const remaining = Math.max(0, (shift.dailyGoal || 0) - total);
                            return remaining.toLocaleString();
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
      </div>

      {/* アプリ選択ポップアップ（乗車区分用） */}
      {showAppTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-gray-900 rounded-3xl p-6 max-w-md w-full border-2 border-blue-500 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-white flex items-center gap-2">
                <Car className="w-6 h-6 text-blue-400" />
                どのアプリですか？
              </h3>
              <button
                onClick={() => setShowAppTypeModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleRideAppTypeSelect('GO')}
                className="bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-2xl font-black text-2xl border-2 border-blue-500 transition-all active:scale-95 shadow-lg"
              >
                GO
              </button>
              <button
                onClick={() => handleRideAppTypeSelect('Didi')}
                className="bg-orange-600 hover:bg-orange-700 text-white py-6 rounded-2xl font-black text-2xl border-2 border-orange-500 transition-all active:scale-95 shadow-lg"
              >
                Didi
              </button>
              <button
                onClick={() => handleRideAppTypeSelect('Uber')}
                className="bg-black hover:bg-gray-900 text-white py-6 rounded-2xl font-black text-2xl border-2 border-gray-700 transition-all active:scale-95 shadow-lg"
              >
                Uber
              </button>
              <button
                onClick={() => handleRideAppTypeSelect('s.ride')}
                className="bg-green-500 hover:bg-green-600 text-white py-6 rounded-2xl font-black text-xl border-2 border-green-400 transition-all active:scale-95 shadow-lg"
              >
                S.RIDE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 決済アプリ選択ポップアップ */}
      {showPaymentAppTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-gray-900 rounded-3xl p-6 max-w-md w-full border-2 border-blue-500 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-white flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-blue-400" />
                決済アプリを選択
              </h3>
              <button
                onClick={() => setShowPaymentAppTypeModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handlePaymentAppTypeSelect('GO')}
                className="bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-2xl font-black text-2xl border-2 border-blue-500 transition-all active:scale-95 shadow-lg"
              >
                GO
              </button>
              <button
                onClick={() => handlePaymentAppTypeSelect('Didi')}
                className="bg-orange-600 hover:bg-orange-700 text-white py-6 rounded-2xl font-black text-2xl border-2 border-orange-500 transition-all active:scale-95 shadow-lg"
              >
                Didi
              </button>
              <button
                onClick={() => handlePaymentAppTypeSelect('Uber')}
                className="bg-black hover:bg-gray-900 text-white py-6 rounded-2xl font-black text-2xl border-2 border-gray-700 transition-all active:scale-95 shadow-lg"
              >
                Uber
              </button>
              <button
                onClick={() => handlePaymentAppTypeSelect('QR')}
                className="bg-purple-600 hover:bg-purple-700 text-white py-6 rounded-2xl font-black text-xl border-2 border-purple-500 transition-all active:scale-95 shadow-lg"
              >
                QRコード
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalWrapper>
  );
};
