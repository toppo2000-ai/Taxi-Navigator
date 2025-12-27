import React, { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo 
} from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore'; 
import { db } from '@/services/firebase';

import UnauthorizedView from '@/pages/UnauthorizedView';
import AdminDashboard from '@/pages/AdminDashboard';

import { 
  SalesRecord, 
  PaymentMethod, 
  MonthlyStats, 
  RideType, 
  ALL_RIDE_TYPES,
  Shift
} from '@/types';

import {
  getBusinessDate,
  getBillingPeriod,
  formatDate,
  generateDefaultDutyDays,
  calculatePeriodStats,
} from '@/utils';

import { useAuth } from '@/hooks/useAuth';
import { useShift } from '@/hooks/useShift';
import { useHistory } from '@/hooks/useHistory';
import { useStats } from '@/hooks/useStats';

import DebugView from '@/components/views/DebugView';
import Dashboard from '@/components/dashboard/Dashboard';
import HistoryView from '@/components/views/HistoryView';
import AnalysisView from '@/components/views/AnalysisView';
import MangaView from '@/components/views/MangaView';
import { 
  RecordModal, 
  DailyReportModal, 
  SettingsModal,
  ShiftEditModal
} from '@/components/common/Modals';
import { Header } from '@/components/common/Header';
import { Navigation } from '@/components/common/Navigation';
import { SplashScreen, LoginScreen, OnboardingScreen } from '@/components/common/AuthScreens';
import { Shield } from 'lucide-react';

export default function App() {
  // --- Hooks ---
  const { user, isAuthChecking, userProfile, loginAsGuest } = useAuth();
  const [viewingUid, setViewingUid] = useState<string | null>(null);
  const targetUid = viewingUid || user?.uid;

  const { monthlyStats, setMonthlyStats } = useStats(targetUid);
  const { history, setHistory, dayMetadata, setDayMetadata } = useHistory(targetUid);
  const { shift, setShift, breakState, setBreakState, broadcastStatus } = useShift(user, targetUid, monthlyStats, history);

  // --- UI States ---
  const [appInitLoading, setAppInitLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'analysis' | 'guide' | 'debug'>('home');
  const [targetHistoryDate, setTargetHistoryDate] = useState<string | Date | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [recordModalState, setRecordModalState] = useState<{ open: boolean; initialData?: Partial<SalesRecord> }>({ open: false });
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShiftEditOpen, setIsShiftEditOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAppInitLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const currentPeriodStats = useMemo(() => {
    const { totalSales, totalRides } = calculatePeriodStats(monthlyStats, history, shift);

    return { 
      ...monthlyStats, 
      totalSales, 
      totalRides 
    };
  }, [history, shift, monthlyStats]);

  const saveToDB = async (updates: any, statusOverride?: 'active' | 'break' | 'riding') => {
    if (!user || !targetUid) return;

    if (user.uid === 'guest-user') {
      const currentData = JSON.parse(localStorage.getItem('taxi_navigator_guest_data') || '{}');
      localStorage.setItem('taxi_navigator_guest_data', JSON.stringify({ ...currentData, ...updates }));
      return;
    }

    try { 
      await setDoc(doc(db, "users", targetUid), updates, { merge: true });
      const nextStatus = statusOverride || (updates.breakState?.isActive || breakState.isActive ? 'break' : 'active');
      broadcastStatus(nextStatus);
    } catch (e) {
      console.error("Save to DB failed:", e);
    }
  };

  const handleStart = (goal: number, hours: number) => {
    if (!user) return;
    const startHour = monthlyStats.businessStartHour ?? 9;
    const todayBusinessDate = getBusinessDate(Date.now(), startHour);
    const todaysRecords = history.filter(r => getBusinessDate(r.timestamp, startHour) === todayBusinessDate);
    const otherRecords = history.filter(r => getBusinessDate(r.timestamp, startHour) !== todayBusinessDate);
    
    const newShift: Shift = { 
      id: Math.random().toString(36).substr(2, 9), 
      startTime: todaysRecords.length > 0 ? Math.min(...todaysRecords.map(r => r.timestamp)) : Date.now(), 
      dailyGoal: goal, 
      plannedHours: hours, 
      records: todaysRecords,
      totalRestMinutes: dayMetadata[todayBusinessDate]?.totalRestMinutes || 0 
    };

    setShift(newShift);
    setHistory(otherRecords);
    saveToDB({ shift: newShift, history: otherRecords }, 'active'); 
    window.scrollTo(0, 0);
  };

  const finalizeShift = () => {
    if (shift && user) {
      const newHistory = [...history, ...shift.records].sort((a, b) => a.timestamp - b.timestamp);
      const startHour = monthlyStats.businessStartHour ?? 9;
      const bDate = getBusinessDate(shift.startTime, startHour);
      const newMeta = { ...dayMetadata, [bDate]: { ...(dayMetadata[bDate] || {}), totalRestMinutes: shift.totalRestMinutes } };

      saveToDB({ shift: null, history: newHistory, dayMetadata: newMeta, breakState: { isActive: false, startTime: null } });
      broadcastStatus('completed');
    }
    setShift(null);
    setBreakState({ isActive: false, startTime: null });
    setActiveTab('home'); 
    setIsDailyReportOpen(false);
  };

  const handleSaveRecord = useCallback(async (...args: any[]) => {
    if (!user) return;
    const [amt, toll, method, ride, nonCash, timestamp, pickup, dropoff, pickupCoords, dropoffCoords, pMale, pFemale, remarks, isBadCustomer] = args;
    const editId = recordModalState.initialData?.id;
    const startHour = monthlyStats.businessStartHour ?? 9;
    
    const recordObj: SalesRecord = { 
      id: editId || Math.random().toString(36).substr(2, 9), 
      amount: amt, toll, paymentMethod: method, nonCashAmount: nonCash, rideType: ride, timestamp, 
      pickupLocation: pickup, dropoffLocation: dropoff, pickupCoords: pickupCoords || "", dropoffCoords: dropoffCoords || "",
      passengersMale: pMale, passengersFemale: pFemale, remarks, isBadCustomer
    };

    const isSameDay = shift && getBusinessDate(shift.startTime, startHour) === getBusinessDate(timestamp, startHour);
    let newShift = shift;
    let newHistory = history;

    if (editId) {
      const isInShift = shift?.records.some(r => r.id === editId);
      if (isInShift) {
        if (isSameDay) newShift = { ...shift!, records: shift!.records.map(r => r.id === editId ? recordObj : r).sort((a, b) => a.timestamp - b.timestamp) };
        else { newShift = { ...shift!, records: shift!.records.filter(r => r.id !== editId) }; newHistory = [...history, recordObj].sort((a, b) => a.timestamp - b.timestamp); }
      } else {
        if (isSameDay) { newHistory = history.filter(r => r.id !== editId); newShift = { ...shift!, records: [...shift!.records, recordObj].sort((a, b) => a.timestamp - b.timestamp) }; }
        else newHistory = history.map(r => r.id === editId ? recordObj : r).sort((a, b) => a.timestamp - b.timestamp);
      }
    } else {
      if (isSameDay) newShift = { ...shift!, records: [...shift!.records, recordObj].sort((a, b) => a.timestamp - b.timestamp) };
      else newHistory = [...history, recordObj].sort((a, b) => a.timestamp - b.timestamp);
    }

    setShift(newShift);
    setHistory(newHistory);
    saveToDB({ shift: newShift, history: newHistory }, 'active'); 
    setRecordModalState({ open: false });
  }, [shift, history, recordModalState.initialData, monthlyStats, user]);

  const handleDeleteRecord = useCallback(() => {
    if (!user || !recordModalState.initialData?.id) return;
    const id = recordModalState.initialData.id;
    const newShift = shift ? { ...shift, records: shift.records.filter(r => r.id !== id) } : null;
    const newHistory = history.filter(r => r.id !== id);
    setShift(newShift);
    setHistory(newHistory);
    saveToDB({ shift: newShift, history: newHistory }, 'active'); 
    setRecordModalState({ open: false });
  }, [recordModalState.initialData, shift, history, user]);

  const handleUpdateMonthlyStats = (newStats: Partial<MonthlyStats>) => {
    setMonthlyStats(prev => {
      const updated = { ...prev, ...newStats };
      if (newStats.shimebiDay !== undefined && newStats.shimebiDay !== prev.shimebiDay) {
        updated.dutyDays = generateDefaultDutyDays(newStats.shimebiDay, newStats.businessStartHour ?? prev.businessStartHour);
      }
      saveToDB({ stats: updated });
      return updated;
    });
  };

  const handleGuestLogin = () => {
    loginAsGuest();
    setMonthlyStats(prev => ({ ...prev, userName: 'ゲストユーザー' }));
  };

  if (appInitLoading || isAuthChecking) return <SplashScreen />;
  if (!user) return <LoginScreen onGuestLogin={handleGuestLogin} />;
  if (userProfile?.status !== 'active') return <UnauthorizedView />;
  if (!monthlyStats.userName) return <OnboardingScreen onSave={async (name) => handleUpdateMonthlyStats({ userName: name })} />;
  if (isAdminMode) return <AdminDashboard onBack={() => setIsAdminMode(false)} />;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0A0E14] text-white font-sans pb-28 overflow-x-hidden relative w-full">
      {viewingUid && viewingUid !== user?.uid && (
        <div className="bg-red-600 text-white px-4 py-2 flex justify-between items-center sticky top-0 z-50 shadow-md safe-top animate-in slide-in-from-top">
          <span className="text-xs font-bold animate-pulse flex items-center gap-2"><Shield size={16} />代理操作中: {monthlyStats.userName || '名称未設定'}</span>
          <button onClick={() => setViewingUid(null)} className="bg-white text-red-600 text-xs font-black px-3 py-1.5 rounded-full active:scale-95 shadow-sm">解除する</button>
        </div>
      )}

      <Header isAdmin={userProfile?.role === 'admin'} onViewSettings={() => setIsSettingsOpen(true)} onViewAdmin={() => setIsAdminMode(true)} />

      <main className="w-full overflow-x-hidden">
        {activeTab === 'home' && (
          <Dashboard 
            shift={shift} stats={currentPeriodStats} breakState={breakState}
            onStart={handleStart} onEnd={() => setIsDailyReportOpen(true)} 
            onAdd={(rm) => setRecordModalState({ open: true, initialData: rm ? { remarks: rm } : undefined })} 
            onEdit={(rec) => setRecordModalState({ open: true, initialData: rec })} 
            onUpdateGoal={(val) => handleUpdateMonthlyStats({ monthlyGoal: val })} 
            onUpdateShiftGoal={(val) => { if(shift) { const s = {...shift, dailyGoal: val}; setShift(s); saveToDB({shift: s}); } }} 
            onAddRestMinutes={(m) => { if(shift) { const s = {...shift, totalRestMinutes: (shift.totalRestMinutes||0)+m}; setShift(s); saveToDB({shift: s}); } }}
            onToggleBreak={() => { const ns = breakState.isActive ? {isActive:false, startTime:null} : {isActive:true, startTime:Date.now()}; setBreakState(ns); saveToDB({breakState: ns}, ns.isActive ? 'break' : 'active'); }}
            setBreakState={(s) => { setBreakState(s); saveToDB({breakState: s}); }}
            onShiftEdit={() => setIsShiftEditOpen(true)}
          />
        )}
        {activeTab === 'history' && (
          <HistoryView 
            history={[...history, ...(shift?.records || [])]} dayMetadata={dayMetadata} 
            customPaymentLabels={monthlyStats.customPaymentLabels || {}} 
            businessStartHour={monthlyStats.businessStartHour ?? 9} shimebiDay={monthlyStats.shimebiDay}
            onEditRecord={(rec) => setRecordModalState({ open: true, initialData: rec })} 
            onUpdateMetadata={(date, meta) => { const m = { ...dayMetadata, [date]: { ...(dayMetadata[date] || {}), ...meta } }; setDayMetadata(m); saveToDB({ dayMetadata: m }); }} 
            stats={monthlyStats} initialTargetDate={targetHistoryDate} onClearTargetDate={() => setTargetHistoryDate(null)}
          />
        )}
        {activeTab === 'analysis' && <AnalysisView history={[...history, ...(shift?.records || [])]} stats={monthlyStats} onNavigateToHistory={(d) => { setTargetHistoryDate(d); setActiveTab('history'); }} />}
        {activeTab === 'guide' && <MangaView />}
        {activeTab === 'debug' && <DebugView />}
      </main>
      
      {recordModalState.open && (
        <RecordModal 
          initialData={recordModalState.initialData} enabledMethods={monthlyStats.enabledPaymentMethods} 
          enabledRideTypes={monthlyStats.enabledRideTypes || ALL_RIDE_TYPES} customLabels={monthlyStats.customPaymentLabels || {}} 
          onClose={() => setRecordModalState({ open: false })} onSave={handleSaveRecord} onDelete={handleDeleteRecord} businessStartHour={monthlyStats.businessStartHour ?? 9} 
        />
      )}
      {isDailyReportOpen && shift && <DailyReportModal shift={shift} customLabels={monthlyStats.customPaymentLabels || {}} enabledMethods={monthlyStats.enabledPaymentMethods} businessStartHour={monthlyStats.businessStartHour ?? 9} onConfirm={finalizeShift} onClose={() => setIsDailyReportOpen(false)} />}
      {isSettingsOpen && <SettingsModal stats={monthlyStats} isAdmin={userProfile?.role === 'admin'} onUpdateStats={handleUpdateMonthlyStats} onClose={() => setIsSettingsOpen(false)} onImpersonate={(uid) => { setViewingUid(uid); setIsSettingsOpen(false); }} />}
      {isShiftEditOpen && shift && <ShiftEditModal shift={shift} onClose={() => setIsShiftEditOpen(false)} onSave={(st, ph) => { if(shift) { const s = {...shift, startTime:st, plannedHours:ph}; setShift(s); saveToDB({shift: s}); } }} />}
      
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
