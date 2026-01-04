import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './services/firebase';
import { Users, CheckCircle, XCircle, Shield, ShieldOff, ArrowLeft, Trash2 } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  status: 'active' | 'pending' | 'banned';
  role: 'admin' | 'user';
  createdAt: any;
}

interface AdminDashboardProps {
  onBack: () => void;
}

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // ユーザー一覧を取得
  const fetchUsers = async () => {
    try {
      console.log('[AdminDashboard] Fetching users from Firestore...');
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      const userList: UserProfile[] = [];
      
      querySnapshot.forEach((doc) => {
        try {
          const data = doc.data();
          // ★重要: stats.userNameをdisplayNameとして使用（statsオブジェクト内にuserNameがある場合）
          const userName = data.stats?.userName || data.displayName || data.email || '（未設定）';
          const userData = {
            id: doc.id,
            email: data.email || '',
            displayName: userName,
            status: data.status || 'pending',
            role: data.role || 'user',
            createdAt: data.createdAt
          };
          console.log('[AdminDashboard] User found:', { id: doc.id, email: userData.email, displayName: userData.displayName, status: userData.status, role: userData.role });
          userList.push(userData as UserProfile);
        } catch (docError) {
          console.error('[AdminDashboard] Error processing user document:', doc.id, docError);
        }
      });
      
      console.log('[AdminDashboard] Total users fetched:', userList.length);
      setUsers(userList);
    } catch (error: any) {
      console.error("[AdminDashboard] Error fetching users:", error);
      console.error("[AdminDashboard] Error details:", {
        code: error?.code,
        message: error?.message,
        stack: error?.stack
      });
      
      // エラーの詳細を表示
      if (error?.code === 403 || error?.code === 'permission-denied') {
        alert("権限エラー: ユーザー情報の取得に失敗しました。\n\nFirebase ConsoleでFirestoreのセキュリティルールを確認してください。\n\nエラーコード: " + error?.code);
      } else {
        alert("ユーザー情報の取得に失敗しました。\n\nエラー: " + (error?.message || 'Unknown error') + "\n\n詳細はブラウザのコンソールを確認してください。");
      }
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
  // 初回マウント時にもユーザー一覧を取得
  fetchUsers();
  
  // 認証状態が変更された時にも再取得
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('[AdminDashboard] Auth state changed, refetching users');
      fetchUsers();
    }
  });

  return () => unsubscribe();
}, []);

  // ステータス更新（承認・BAN）
  const updateUserStatus = async (userId: string, newStatus: 'active' | 'pending' | 'banned') => {
    if (!window.confirm(`このユーザーのステータスを ${newStatus} に変更しますか？`)) return;
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: newStatus
      });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error("Error updating status:", error);
      alert("更新に失敗しました");
    }
  };

  // 権限更新（管理者・一般）
  const toggleUserRole = async (userId: string, currentRole: 'admin' | 'user') => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`このユーザーの権限を ${newRole} に変更しますか？`)) return;

    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error("Error updating role:", error);
      alert("更新に失敗しました");
    }
  };

  // ユーザー削除
  const deleteUser = async (userId: string, userName: string) => {
    const confirmMessage = `ユーザー「${userName}」を削除しますか？\n\nこの操作は取り消せません。ユーザーに関連するすべてのデータ（売上履歴、設定など）が削除されます。`;
    if (!window.confirm(confirmMessage)) return;
    
    // 二重確認
    if (!window.confirm('本当に削除しますか？この操作は取り消せません。')) return;

    try {
      // usersコレクションから削除
      await deleteDoc(doc(db, 'users', userId));
      console.log('[AdminDashboard] Deleted user document:', userId);
      
      // public_statusコレクションからも削除（存在する場合）
      try {
        await deleteDoc(doc(db, 'public_status', userId));
        console.log('[AdminDashboard] Deleted public_status document:', userId);
      } catch (pubStatusError: any) {
        // public_statusが存在しない場合はエラーを無視
        if (pubStatusError?.code !== 'not-found') {
          console.warn('[AdminDashboard] Error deleting public_status (may not exist):', pubStatusError);
        }
      }
      
      // ローカルステートからも削除
      setUsers(users.filter(u => u.id !== userId));
      alert('ユーザーを削除しました');
    } catch (error: any) {
      console.error("[AdminDashboard] Error deleting user:", error);
      if (error?.code === 403 || error?.code === 'permission-denied') {
        alert("権限エラー: ユーザーの削除に失敗しました。\n\nFirebase ConsoleでFirestoreのセキュリティルールを確認してください。");
      } else {
        alert(`ユーザーの削除に失敗しました。\n\nエラー: ${error?.message || 'Unknown error'}`);
      }
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  }

  // ★ここで「管理者以外」だけを表示するようにフィルタリングしています
  const driversOnly = users.filter(user => user.role !== 'admin');

  return (
    <div className="min-h-screen bg-[#0A0E14] text-gray-100 p-4 md:p-8 pb-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-400" />
              ドライバー管理
            </h1>
          </div>
        </div>

        <div className="bg-[#1A222C] rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-800/50 border-b border-gray-700">
                  <th className="p-4 text-sm font-medium text-gray-400">ユーザー名</th>
                  <th className="p-4 text-sm font-medium text-gray-400">ステータス</th>
                  <th className="p-4 text-sm font-medium text-gray-400">権限</th>
                  <th className="p-4 text-sm font-medium text-gray-400">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {driversOnly.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      ドライバーはまだいません
                    </td>
                  </tr>
                ) : (
                  driversOnly.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-white">
                          {user.displayName || user.email || '（未設定）'}
                        </div>
                        {user.email && user.displayName !== user.email && (
                          <div className="text-sm text-gray-500">{user.email}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          user.status === 'active' 
                            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                            : user.status === 'banned'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        }`}>
                          {user.status === 'active' ? '承認済み' : user.status === 'banned' ? '停止中' : '承認待ち'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                          一般
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {/* ステータス変更ボタン */}
                          {user.status !== 'active' && (
                            <button
                              onClick={() => updateUserStatus(user.id, 'active')}
                              className="p-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded border border-green-500/20"
                              title="承認する"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {user.status !== 'banned' && (
                            <button
                              onClick={() => updateUserStatus(user.id, 'banned')}
                              className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded border border-red-500/20"
                              title="利用停止にする"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          
                          {/* 管理者昇格ボタン */}
                          <button
                            onClick={() => toggleUserRole(user.id, user.role)}
                            className="p-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded border border-purple-500/20"
                            title="管理者に変更"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          
                          {/* ユーザー削除ボタン */}
                          <button
                            onClick={() => deleteUser(user.id, user.displayName || user.email)}
                            className="p-1.5 bg-red-600/10 text-red-500 hover:bg-red-600/20 rounded border border-red-600/20"
                            title="ユーザーを削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
