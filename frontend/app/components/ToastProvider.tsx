"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ToastType = 'info' | 'error' | 'success';
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<any>(null);

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalAlert = window.alert;
      window.alert = (message: any) => {
        const id = Date.now();
        const strMsg = String(message).toLowerCase();
        // Since we can't safely use Thai characters here without worrying about terminal encoding in this specific session,
        // we will classify error toasts based on keywords or if it contains certain patterns.
        const type = strMsg.includes('ผิดพลาด') || strMsg.includes('error') || strMsg.includes('ไม่') ? 'error' : 'info';
        
        setToasts(prev => [...prev, { id, message: String(message), type }]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
      };
    }
  }, []);

  return (
    <ToastContext.Provider value={{ setToasts }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`px-6 py-4 rounded-lg shadow-xl text-white font-medium text-[15px] pointer-events-auto transform transition-all duration-300 translate-y-0 opacity-100 flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
            {toast.type === 'error' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            ) : (
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
