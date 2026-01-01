import React, { useState } from 'react';
import { User, X } from 'lucide-react';
import { ModalWrapper } from './ModalWrapper';

interface SimpleModeNameModalProps {
  onConfirm: (userName: string) => void;
  onClose: () => void;
  currentUserName?: string;
}

export const SimpleModeNameModal: React.FC<SimpleModeNameModalProps> = ({ 
  onConfirm, 
  onClose,
  currentUserName = '' 
}) => {
  const [userName, setUserName] = useState(currentUserName);

  const handleConfirm = () => {
    if (userName.trim()) {
      onConfirm(userName.trim());
    }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="bg-[#131C2B] p-6 rounded-3xl space-y-6 max-w-md w-full">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <User className="w-6 h-6 text-gray-400" /> 名前の入力
          </h3>
          <button 
            onClick={onClose} 
            className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-2 uppercase tracking-widest">
              ユーザー名
            </label>
            <input 
              type="text" 
              value={userName} 
              onChange={(e) => setUserName(e.target.value)} 
              placeholder="名前を入力してください" 
              className="bg-gray-800 text-white font-black w-full outline-none p-4 rounded-2xl border border-gray-700 focus:border-orange-500 transition-colors"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && userName.trim()) {
                  handleConfirm();
                }
              }}
            />
          </div>

          <div className="p-3 bg-orange-900/20 border border-orange-500/30 rounded-xl text-xs text-orange-300">
            簡易入力モードを開始するには、名前の入力が必要です。
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-800 text-gray-300 font-bold rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!userName.trim()}
            className={`flex-1 py-3 rounded-xl font-black transition-all ${
              userName.trim()
                ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            開始
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};
