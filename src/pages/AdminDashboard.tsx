import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';   // ★追加
import { db, auth } from '@/services/firebase';                 // ★auth も追加
import { Users, CheckCircle, XCircle, Shield, ShieldOff, ArrowLeft } from 'lucide-react';

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
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      const userList: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        userList.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
      alert("ユーザー情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
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

  if (loading) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  }

  // ★ここで「管理者以外」だけを表示するようにフィルタリングしています
  const driversOnly = users.filter(user => user.role !== 'admin');

  return (
    <div className="min-h-screen bg-dark text-gray-100 p-4 md:p-8 pb-24">
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

        <div className="bg-card rounded-xl border border-gray-800 overflow-hidden">
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
                        {/* 修正箇所：変なテキストが出ないように修正済み */}
                        <div className="font-medium text-white">
                          {user.displayName || '（未設定）'}
                        </div>
                        <div className="text-sm text-gray-500">{user.email || 'メールアドレスなし'}</div>
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