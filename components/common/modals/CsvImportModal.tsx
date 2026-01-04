import React, { useState, useEffect } from 'react';
import { X, FileUp } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase'; 
import { SalesRecord } from '../../../types';
import { CsvImportSection } from '../CsvImportSection';
import { ModalWrapper } from './ModalWrapper';

export const CsvImportModal: React.FC<{
  onClose: () => void;
  onImport: (records: SalesRecord[], targetUid?: string) => void;
  isAdmin: boolean;
  currentUid: string;
}> = ({ onClose, onImport, isAdmin, currentUid }) => {
  const [users, setUsers] = useState<{uid: string, name: string}[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "public_status"));
        const fetchedUsers = querySnapshot.docs
          .map(doc => ({ uid: doc.id, name: doc.data().name || '名称未設定' }))
          .filter(u => u.uid !== currentUid);
        setUsers(fetchedUsers);
      } catch (e) {
        console.error("Failed to fetch users", e);
      }
    };
    if (isAdmin) fetchUsers();
  }, [isAdmin, currentUid]);

  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6">
        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
                <FileUp className="w-6 h-6 text-blue-400" /> CSVインポート
            </h3>
            <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95">
                <X className="w-5 h-5" />
            </button>
        </div>
        
        <CsvImportSection 
            onImport={onImport} 
            isAdmin={isAdmin} 
            users={users} 
        />
      </div>
    </ModalWrapper>
  );
};
