import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { RefreshCw, Database, Globe, User, AlertCircle, CheckCircle2 } from 'lucide-react';

const DebugView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'public' | 'personal'>('personal');
  const [publicData, setPublicData] = useState<any[]>([]);
  const [personalData, setPersonalData] = useState<any>(null);
  const [myPublicData, setMyPublicData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const currentUser = auth.currentUser;

  // 認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthState({
        currentUser: user ? {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
          photoURL: user.photoURL,
          metadata: {
            creationTime: user.metadata.creationTime,
            lastSignInTime: user.metadata.lastSignInTime
          }
        } : null,
        timestamp: new Date().toISOString()
      });
    });
    return () => unsubscribe();
  }, [refreshKey]);

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
          onClick={() => setActiveTab('auth')}
          className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors text-xs ${activeTab === 'auth' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          <Shield className="w-4 h-4" /> 認証状態
        </button>
        <button 
          onClick={() => setActiveTab('personal')}
          className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors text-xs ${activeTab === 'personal' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          <User className="w-4 h-4" /> My Data
        </button>
        <button 
          onClick={() => setActiveTab('public')}
          className={`flex-1 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors text-xs ${activeTab === 'public' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}
        >
          <Globe className="w-4 h-4" /> Public
        </button>
      </div>

      {activeTab === 'auth' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-white">認証状態デバッグ</h3>
              <button 
                onClick={() => setRefreshKey(prev => prev + 1)} 
                className="p-1 bg-gray-800 rounded hover:bg-gray-700 active:scale-95"
                title="更新"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* URL情報 */}
            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-bold text-gray-400 mb-2">📍 現在のURL情報</h4>
              <div className="bg-black/30 p-2 rounded border border-gray-800 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">hostname:</span>
                  <span className="text-blue-400 font-mono">{window.location.hostname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">pathname:</span>
                  <span className="text-blue-400 font-mono">{window.location.pathname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">search:</span>
                  <span className="text-blue-400 font-mono break-all">{window.location.search || '(なし)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">origin:</span>
                  <span className="text-blue-400 font-mono break-all">{window.location.origin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">protocol:</span>
                  <span className="text-blue-400 font-mono">{window.location.protocol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">port:</span>
                  <span className="text-blue-400 font-mono">{window.location.port || '(デフォルト)'}</span>
                </div>
              </div>
            </div>

            {/* URLパラメータ */}
            {window.location.search && (
              <div className="mb-4 space-y-2">
                <h4 className="text-sm font-bold text-gray-400 mb-2">🔗 URLパラメータ</h4>
                <div className="bg-black/30 p-2 rounded border border-gray-800 space-y-1 text-[10px]">
                  {Array.from(new URLSearchParams(window.location.search).entries()).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-500">{key}:</span>
                      <span className="text-yellow-400 font-mono break-all">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 認証状態 */}
            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-bold text-gray-400 mb-2">🔐 Firebase認証状態</h4>
              <div className="bg-black/30 p-2 rounded border border-gray-800">
                {authState?.currentUser ? (
                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 font-bold">ログイン済み</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">UID:</span>
                        <span className="text-blue-400 font-mono break-all">{authState.currentUser.uid}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Email:</span>
                        <span className="text-blue-400 font-mono break-all">{authState.currentUser.email || '(なし)'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Display Name:</span>
                        <span className="text-blue-400">{authState.currentUser.displayName || '(なし)'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Email Verified:</span>
                        <span className={authState.currentUser.emailVerified ? 'text-green-400' : 'text-yellow-400'}>
                          {authState.currentUser.emailVerified ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Created:</span>
                        <span className="text-gray-400 text-[9px]">{authState.currentUser.metadata?.creationTime || '(不明)'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last Sign In:</span>
                        <span className="text-gray-400 text-[9px]">{authState.currentUser.metadata?.lastSignInTime || '(不明)'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 font-bold">未ログイン</span>
                  </div>
                )}
              </div>
            </div>

            {/* Storage情報 */}
            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-bold text-gray-400 mb-2">💾 Storage情報</h4>
              
              {/* localStorage */}
              <details className="bg-black/30 rounded border border-gray-800">
                <summary className="p-2 cursor-pointer hover:bg-gray-800 text-[10px] font-bold">
                  📦 localStorage (認証関連)
                </summary>
                <div className="p-2 space-y-1 text-[10px]">
                  {['auth_redirect_origin', 'auth_redirect_hostname', 'auth_redirect_port', 'local_dev_origin', 'local_dev_hostname', 'local_dev_port'].map(key => {
                    const value = localStorage.getItem(key);
                    return value ? (
                      <div key={key} className="flex justify-between items-start gap-2">
                        <span className="text-gray-500 flex-shrink-0">{key}:</span>
                        <div className="flex-1 flex items-center gap-1">
                          <span className="text-blue-400 font-mono break-all text-[9px]">{value}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(value);
                              alert('コピーしました: ' + value);
                            }}
                            className="p-0.5 bg-gray-700 rounded hover:bg-gray-600"
                            title="コピー"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : null;
                  })}
                  {['auth_redirect_origin', 'auth_redirect_hostname', 'auth_redirect_port', 'local_dev_origin', 'local_dev_hostname', 'local_dev_port'].every(key => !localStorage.getItem(key)) && (
                    <span className="text-gray-500">認証関連のデータなし</span>
                  )}
                </div>
              </details>

              {/* sessionStorage */}
              <details className="bg-black/30 rounded border border-gray-800">
                <summary className="p-2 cursor-pointer hover:bg-gray-800 text-[10px] font-bold">
                  📦 sessionStorage (認証関連)
                </summary>
                <div className="p-2 space-y-1 text-[10px]">
                  {(() => {
                    try {
                      const keys = ['auth_redirect_origin', 'auth_redirect_hostname', 'auth_redirect_port', 'local_dev_origin', 'local_dev_hostname', 'local_dev_port'];
                      const hasData = keys.some(key => sessionStorage.getItem(key));
                      if (!hasData) {
                        return <span className="text-gray-500">認証関連のデータなし</span>;
                      }
                      return keys.map(key => {
                        const value = sessionStorage.getItem(key);
                        return value ? (
                          <div key={key} className="flex justify-between items-start gap-2">
                            <span className="text-gray-500 flex-shrink-0">{key}:</span>
                            <div className="flex-1 flex items-center gap-1">
                              <span className="text-green-400 font-mono break-all text-[9px]">{value}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(value);
                                  alert('コピーしました: ' + value);
                                }}
                                className="p-0.5 bg-gray-700 rounded hover:bg-gray-600"
                                title="コピー"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : null;
                      });
                    } catch (e) {
                      return <span className="text-red-400">sessionStorageにアクセスできません: {String(e)}</span>;
                    }
                  })()}
                </div>
              </details>
            </div>

            {/* 環境情報 */}
            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-bold text-gray-400 mb-2">🌐 環境情報</h4>
              <div className="bg-black/30 p-2 rounded border border-gray-800 space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">User Agent:</span>
                  <span className="text-purple-400 font-mono text-[9px] break-all">{navigator.userAgent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Platform:</span>
                  <span className="text-purple-400">{navigator.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Language:</span>
                  <span className="text-purple-400">{navigator.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cookie Enabled:</span>
                  <span className="text-purple-400">{navigator.cookieEnabled ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">OnLine:</span>
                  <span className="text-purple-400">{navigator.onLine ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            {/* 生データ表示 */}
            <details className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
              <summary className="p-3 font-bold cursor-pointer hover:bg-gray-700 text-[10px]">
                📋 認証状態の生データ (JSON)
              </summary>
              <pre className="p-3 bg-black text-[10px] text-blue-300 overflow-x-auto max-h-60">
                {JSON.stringify(authState, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}

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
