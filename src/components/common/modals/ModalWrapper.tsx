import React from 'react';

export const ModalWrapper: React.FC<{ children: React.ReactNode, onClose: () => void }> = ({ children, onClose }) => (
  <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="absolute inset-0" onClick={onClose} />
    <div className="relative w-full max-w-md mx-auto bg-[#131C2B] rounded-t-[32px] p-5 shadow-2xl border-t border-gray-700 flex flex-col max-h-[90vh]">
      <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-6 opacity-50 flex-shrink-0" />
      <div className="overflow-y-auto custom-scrollbar flex-1 pb-safe">
        {children}
      </div>
    </div>
  </div>
);
