// ========== デバッグビューコンポーネント ==========
// 開発者向けのデバッグ情報表示
// - Firestore の公開データ(public_status)を監視
// - 自分の詳細データ(users コレクション)を表示
// - ローカルデータと公開データの一致性を検証
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { RefreshCw, Database, Globe, User, AlertCircle, CheckCircle2 } from 'lucide-react';

const DebugView: React.FC = () => {
  // ========== 認証 ==========
  const { user: currentUser } = useAuth();  // 現在のログインユーザー情報

  // ========== State 管理 ==========
  // タブ表示制御（個人詳細データ / 全体公開リスト）
  const [activeTab, setActiveTab] = useState<'public' | 'personal'>('personal');
  
  // 全ユーザーの公開データ一覧（Firestore 監視）
  const [publicData, setPublicData] = useState<any[]>([]);
  
  // 自分の公開データ（全ユーザー中から抽出）
  const [myPublicData, setMyPublicData] = useState<any | null>(null);
  
  // 自分の詳細データ(users コレクションから取得)
  const [personalData, setPersonalData] = useState<any | null>(null);
  
  // エラーメッセージ
  const [error, setError] = useState<string | null>(null);
  
  // データ取得中フラグ
  const [loading, setLoading] = useState(false);

  // ========== Effects ==========
  // Firestore の public_status コレクションをリアルタイム監視
  // 全ユーザーの公開データを取得し、自分のデータを抽出
  useEffect(() => {
    const q = query(collection(db, "public_status"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPublicData(users);
      
      // 自分のデータを一覧から抽出
      if (currentUser) {
        const myData = users.find(u => u.id === currentUser.uid);
        setMyPublicData(myData || null);
      }
    }, (err) => setError(err.message));
    return () => unsubscribe();
  }, [currentUser]);

  // ========== 取得関数 ==========
  // 自分の詳細データを Firestore から取得（手動更新用）
  const fetchPersonalData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const docRef = doc(db, "users", currentUser.uid);  // 自分の users ドキュメントを参照
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPersonalData(docSnap.data());  // ドキュメントデータを保存
      } else {
        setPersonalData({ error: "ドキュメントが存在しません" });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // タブ切り替え時に詳細データを取得
  useEffect(() => {
    if (activeTab === 'personal') {
      fetchPersonalData();
    }
  }, [activeTab]);

  // ========== ロジック ==========
  // ローカルデータと公開データの一致性検証
  // (両者が残されている記録数が一致しているか)
  const checkIntegrity = () => {
    if (!personalData || !myPublicData) return null;
    
    // ローカル詳細データ側の記録数
    // (履歴 + 現在のシフト記録)
    const historyCount = (personalData.history?.length || 0) + (personalData.shift?.records?.length || 0);
    
    // 公開データ側の記録数
    // (月別レコード + 現最取得レコード)
    let publicCount = 0;
    if (myPublicData.records) publicCount += myPublicData.records.length;
    if (myPublicData.months) {
        Object.values(myPublicData.months).forEach((m: any) => {
            if (m.records) publicCount += m.records.length;
        });
    }

    // 同一性検証（両方の記録数が一致）
    const isSynced = historyCount === publicCount;

    return { historyCount, publicCount, isSynced };
  };

  // 検証結果を計算
  const integrity = checkIntegrity();

  // ========== JSX レンダリング ==========
  return (
    <div className="p-4 bg-gray-950 min-h-screen text-xs font-mono text-gray-300 pb-32">
      {/* ヘッダーセクション */}
      <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
        <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
          <Database className="w-5 h-5" /> Debug Console
        </h2>
        {/* 現在ログイン中のユーザーメールを表示 */}
        <span className="text-[10px] text-gray-500">{currentUser?.email}</span>
      </div>

      {/* エラーメッセージ表示 */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 p-3 rounded mb-4 text-red-200">
          Error: {error}
        </div>
      )}

      {/* タブ選択ボタン */}
      <div className="flex gap-2 mb-4">
        {/* 個人詳細データタブボタン */}
        <button 
          onClick={() => setActiveTab('personal')}
          className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'personal' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          <User className="w-4 h-4" /> My Data (詳細)
        </button>
        {/* 全体公開データリストタブボタン */}
        <button 
          onClick={() => setActiveTab('public')}
          className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'public' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          <Globe className="w-4 h-4" /> Public List (全体)
        </button>
      </div>

      {activeTab === 'personal' && (
        <div className="space-y-4 animate-in fade-in">
          
          {/* データ同期チェックパネル */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-white">データ同期チェック</h3>
              {/* 手動更新ボタン */}
              <button onClick={fetchPersonalData} className="p-1 bg-gray-800 rounded hover:bg-gray-700 active:scale-95">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {/* ローカルと公開データの件数比較 */}
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

            {/* 同期状態インジケーター */}
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

          {/* 詳細データ表示セクション */}
          <div className="space-y-2">
            {/* Users コレクションのプライベートデータ展開表示 */}
            <details className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
              <summary className="p-3 font-bold cursor-pointer hover:bg-gray-700 flex justify-between">
                <span>📁 Users Collection (自分)</span>
                <span className="text-gray-500 text-[10px]">Private</span>
              </summary>
              <pre className="p-3 bg-black text-[10px] text-blue-300 overflow-x-auto max-h-60">
                {JSON.stringify(personalData, null, 2)}
              </pre>
            </details>

            {/* Public Status コレクションの公開データ展開表示 */}
            <details className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700" open>
              <summary className="p-3 font-bold cursor-pointer hover:bg-gray-700 flex justify-between">
                <span>🌐 Public Status (自分)</span>
                <span className="text-gray-500 text-[10px]">Public</span>
              </summary>
              <div className="p-3 bg-black">
                {myPublicData ? (
                    <div className="space-y-2">
                        {/* records フィールドの確認 */}
                        <div className="flex gap-2 text-[10px]">
                            <span className="text-gray-500">records:</span>
                            {myPublicData.records ? <span className="text-green-400">あり ({myPublicData.records.length}件)</span> : <span className="text-red-500">なし</span>}
                        </div>
                        {/* months フィールドの確認 */}
                        <div className="flex gap-2 text-[10px]">
                            <span className="text-gray-500">months:</span>
                            {myPublicData.months ? <span className="text-green-400">あり ({Object.keys(myPublicData.months).length}ヶ月分)</span> : <span className="text-red-500">なし</span>}
                        </div>
                        {/* topRecords フィールドの確認 */}
                        <div className="flex gap-2 text-[10px]">
                            <span className="text-gray-500">topRecords:</span>
                            {myPublicData.topRecords ? <span className="text-green-400">あり ({myPublicData.topRecords.length}件)</span> : <span className="text-red-500">なし</span>}
                        </div>
                        {/* 区切り線 */}
                        <div className="h-px bg-gray-800 my-2"></div>
                        {/* 詳細JSON表示 */}
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
          {/* ユーザー数表示 */}
          <p className="text-center text-gray-500 text-[10px]">全ユーザーの公開ステータス ({publicData.length}人)</p>
          {/* 各ユーザーのデータカード */}
          {publicData.map((u) => (
            <div key={u.id} className="bg-gray-800 p-3 rounded-xl border border-gray-700">
              {/* ユーザー名と最終更新時刻 */}
              <div className="flex justify-between mb-2">
                <span className="font-bold text-white">{u.name}</span>
                <span className="text-[10px] text-gray-500">{new Date(u.lastUpdated).toLocaleTimeString()}</span>
              </div>
              {/* データフィールド別の統計情報グリッド */}
              <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
                 {/* 現在の乗車記録 */}
                 <div className="bg-gray-900 p-1 rounded">
                    <span className="block text-gray-500">Records</span>
                    <span className={u.records ? "text-green-400" : "text-red-500"}>{u.records?.length || 0}</span>
                 </div>
                 {/* 月別アーカイブ */}
                 <div className="bg-gray-900 p-1 rounded">
                    <span className="block text-gray-500">Months</span>
                    <span className={u.months ? "text-green-400" : "text-red-500"}>{u.months ? Object.keys(u.months).length : 0}</span>
                 </div>
                 {/* 旧形式のデータ（レガシー） */}
                 <div className="bg-gray-900 p-1 rounded">
                    <span className="block text-gray-500">Recent(旧)</span>
                    <span className={u.recentRecords ? "text-yellow-500" : "text-gray-700"}>{u.recentRecords?.length || 0}</span>
                 </div>
              </div>
              {/* 詳細JSON表示（展開可能） */}
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

// ========== エクスポート ==========
// DebugView コンポーネントをデフォルトエクスポート
export default DebugView;
