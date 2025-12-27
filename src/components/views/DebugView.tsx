import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { RefreshCw, Database, Globe, User, AlertCircle, CheckCircle2 } from 'lucide-react';

const DebugView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'public' | 'personal'>('personal');

  // 公開データの監視
  useEffect(() => {
    const q = query(collection(db, "public_status"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPublicData(users);
      
      if (currentUser) {
        const myData = users.find(u => u.id === currentUser.uid);
        setMyPublicData(myData || null);
      }
    }, (err) => setError(err.message));
    return () => unsubscribe();
  }, [currentUser]);

  // 自分自身の詳細データ取得（手動更新）
  const fetchPersonalData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const docRef = doc(db, "users", currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPersonalData(docSnap.data());
      } else {
        setPersonalData({ error: "ドキュメントが存在しません" });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'personal') {
      fetchPersonalData();
    }
  }, [activeTab]);

  // データ整合性チェック
  const checkIntegrity = () => {
    if (!personalData || !myPublicData) return null;
    
    // 履歴データの件数比較
    const historyCount = (personalData.history?.length || 0) + (personalData.shift?.records?.length || 0);
    
    // 公開データ側の件数 (months内のレコード数 + records数)
    let publicCount = 0;
    if (myPublicData.records) publicCount += myPublicData.records.length;
    if (myPublicData.months) {
        Object.values(myPublicData.months).forEach((m: any) => {
            if (m.records) publicCount += m.records.length;
        });
    }

    // 許容誤差範囲内か（同期タイミングで多少ずれるため）
    const isSynced = historyCount === publicCount;

    return { historyCount, publicCount, isSynced };
  };

  const integrity = checkIntegrity();

  return (
    <div className="p-4 bg-gray-950 min-h-screen text-xs font-mono text-gray-300 pb-32">
      <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
        <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
          <Database className="w-5 h-5" /> Debug Console
        </h2>
        <span className="text-[10px] text-gray-500">{currentUser?.email}</span>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/50 p-3 rounded mb-4 text-red-200">
          Error: {error}
        </div>
      )}

      {/* タブ切り替え */}
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => setActiveTab('personal')}
          className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'personal' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          <User className="w-4 h-4" /> My Data (詳細)
        </button>
        <button 
          onClick={() => setActiveTab('public')}
          className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'public' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          <Globe className="w-4 h-4" /> Public List (全体)
        </button>
      </div>

      {activeTab === 'personal' && (
        <div className="space-y-4 animate-in fade-in">
          
          {/* 同期ステータス確認パネル */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-white">データ同期チェック</h3>
              <button onClick={fetchPersonalData} className="p-1 bg-gray-800 rounded hover:bg-gray-700 active:scale-95">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-black/30 p-2 rounded border border-gray-800">
                    <span className="block text-gray-500 text-[10px] uppercase">ローカル保存数 (元)</span>
                    <span className="text-xl font-bold text-blue-400">{integrity?.historyCount ?? '-'} <span className="text-xs">件</span></span>
                </div>
                <div className="bg-black/30 p-2 rounded border border-gray-800">
                    <span className="block text-gray-500 text-[10px] uppercase">公開データ数 (先)</span>
                    <span className="text-xl font-bold text-green-400">{integrity?.publicCount ?? '-'} <span className="text-xs">件</span></span>
                </div>
            </div>

            {integrity && (
                <div className={`p-2 rounded text-center font-bold ${integrity.isSynced ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {integrity.isSynced ? (
                        <span className="flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> 同期されています</span>
                    ) : (
                        <span className="flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4" /> 件数が不一致です (保存待機中?)</span>
                    )}
                </div>
            )}
          </div>

          {/* 生データ表示 */}
          <div className="space-y-2">
            <details className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
              <summary className="p-3 font-bold cursor-pointer hover:bg-gray-700 flex justify-between">
                <span>📁 Users Collection (自分)</span>
                <span className="text-gray-500 text-[10px]">Private</span>
              </summary>
              <pre className="p-3 bg-black text-[10px] text-blue-300 overflow-x-auto max-h-60">
                {JSON.stringify(personalData, null, 2)}
              </pre>
            </details>

            <details className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700" open>
              <summary className="p-3 font-bold cursor-pointer hover:bg-gray-700 flex justify-between">
                <span>🌐 Public Status (自分)</span>
                <span className="text-gray-500 text-[10px]">Public</span>
              </summary>
              <div className="p-3 bg-black">
                {myPublicData ? (
                    <div className="space-y-2">
                        <div className="flex gap-2 text-[10px]">
                            <span className="text-gray-500">records:</span>
                            {myPublicData.records ? <span className="text-green-400">あり ({myPublicData.records.length}件)</span> : <span className="text-red-500">なし</span>}
                        </div>
                        <div className="flex gap-2 text-[10px]">
                            <span className="text-gray-500">months:</span>
                            {myPublicData.months ? <span className="text-green-400">あり ({Object.keys(myPublicData.months).length}ヶ月分)</span> : <span className="text-red-500">なし</span>}
                        </div>
                        <div className="flex gap-2 text-[10px]">
                            <span className="text-gray-500">topRecords:</span>
                            {myPublicData.topRecords ? <span className="text-green-400">あり ({myPublicData.topRecords.length}件)</span> : <span className="text-red-500">なし</span>}
                        </div>
                        <div className="h-px bg-gray-800 my-2"></div>
                        <pre className="text-[10px] text-green-300 overflow-x-auto max-h-60">
                            {JSON.stringify(myPublicData, null, 2)}
                        </pre>
                    </div>
                ) : (
                    <p className="text-gray-500">データなし</p>
                )}
              </div>
            </details>
          </div>
        </div>
      )}

      {activeTab === 'public' && (
        <div className="space-y-4 animate-in fade-in">
          <p className="text-center text-gray-500 text-[10px]">全ユーザーの公開ステータス ({publicData.length}人)</p>
          {publicData.map((u) => (
            <div key={u.id} className="bg-gray-800 p-3 rounded-xl border border-gray-700">
              <div className="flex justify-between mb-2">
                <span className="font-bold text-white">{u.name}</span>
                <span className="text-[10px] text-gray-500">{new Date(u.lastUpdated).toLocaleTimeString()}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
                 <div className="bg-gray-900 p-1 rounded">
                    <span className="block text-gray-500">Records</span>
                    <span className={u.records ? "text-green-400" : "text-red-500"}>{u.records?.length || 0}</span>
                 </div>
                 <div className="bg-gray-900 p-1 rounded">
                    <span className="block text-gray-500">Months</span>
                    <span className={u.months ? "text-green-400" : "text-red-500"}>{u.months ? Object.keys(u.months).length : 0}</span>
                 </div>
                 <div className="bg-gray-900 p-1 rounded">
                    <span className="block text-gray-500">Recent(旧)</span>
                    <span className={u.recentRecords ? "text-yellow-500" : "text-gray-700"}>{u.recentRecords?.length || 0}</span>
                 </div>
              </div>
              <details className="mt-2">
                <summary className="text-[10px] text-gray-500 cursor-pointer">詳細JSON</summary>
                <pre className="mt-1 p-2 bg-black rounded text-[9px] text-gray-400 overflow-x-auto">
                    {JSON.stringify(u, null, 2)}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DebugView;