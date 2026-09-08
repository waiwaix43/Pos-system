"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function StartupLoader({ children }: { children: React.ReactNode }) {
  const [appState, setAppState] = useState<'booting' | 'fading' | 'ready'>('booting');
  const [statusText, setStatusText] = useState("กำลังเตรียมระบบ...");
  const [hasError, setHasError] = useState(false);
  
  const router = useRouter();
  const pathname = usePathname();

  const bootSystem = async () => {
    setHasError(false);
    setAppState('booting');
    setStatusText("กำลังเตรียมระบบ...");
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      setStatusText("กำลังตรวจสอบการเชื่อมต่อ...");
      
      await new Promise(resolve => setTimeout(resolve, 400));
      setStatusText("กำลังตรวจสอบข้อมูลผู้ใช้...");

      const savedUser = localStorage.getItem("userContext");
      let targetRoute = pathname;

      if (!savedUser || savedUser === "undefined" || savedUser === "null") {
        const publicRoutes = ["/", "/register", "/forgot-password"];
        if (!publicRoutes.includes(pathname)) {
          targetRoute = "/";
        }
      } else {
        if (pathname === "/" || pathname === "/register") {
          targetRoute = "/pin";
        }
      }

      if (targetRoute !== pathname) {
         router.push(targetRoute);
         await new Promise(resolve => setTimeout(resolve, 250));
      }

      setStatusText("พร้อมใช้งาน");
      
      setTimeout(() => {
        setAppState('fading');
        setTimeout(() => {
          setAppState('ready');
        }, 400); 
      }, 400);

    } catch (error) {
      console.error("Boot error:", error);
      setHasError(true);
      setStatusText("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  useEffect(() => {
    bootSystem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes startupPop {
          0% { opacity: 0; transform: scale(0.92) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes startupFadeUp {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes startupProgress {
          0% { transform: translateX(-100%); width: 30%; }
          50% { width: 50%; }
          100% { transform: translateX(350%); width: 30%; }
        }
      `}} />

      {appState !== 'booting' && children}

      {appState !== 'ready' && (
        <div 
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#d6d6d6] transition-opacity duration-400 ease-out select-none
            ${appState === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center max-w-md w-full px-8 text-center">
            
            {/* โลโก้จำลอง - ขยายขนาด */}
            <div className="w-[120px] h-[120px] bg-white rounded-[1.5rem] flex items-center justify-center mb-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 motion-safe:animate-[startupPop_0.5s_cubic-bezier(0.16,1,0.3,1)_forwards]">
              <h1 className="text-[40px] font-black italic tracking-wider text-black">POS</h1>
            </div>

            {/* ชื่อระบบ - ขยายขนาด */}
            <h2 className="text-[28px] font-bold text-gray-900 mb-2 opacity-0 motion-safe:animate-[startupFadeUp_0.5s_ease-out_0.1s_forwards]">
              Next POS System
            </h2>
            
            {/* สถานะ / Error - ขยายขนาด */}
            <div className="h-[28px] mb-10 mt-1 opacity-0 motion-safe:animate-[startupFadeUp_0.5s_ease-out_0.2s_forwards]">
              <p className={`text-[16px] font-medium transition-colors duration-300 ${hasError ? 'text-red-500' : 'text-gray-400'}`}>
                {statusText}
              </p>
            </div>

            {/* เส้น Progress Bar - ยาวและหนาขึ้น */}
            <div className="w-64 h-[3px] bg-gray-100 rounded-full overflow-hidden opacity-0 motion-safe:animate-[startupFadeUp_0.5s_ease-out_0.3s_forwards]">
              {!hasError ? (
                 <div className="h-full bg-black rounded-full motion-reduce:hidden motion-safe:animate-[startupProgress_1.5s_ease-in-out_infinite]" style={{ width: '30%' }}></div>
              ) : (
                 <div className="w-full h-full bg-red-100 rounded-full"></div>
              )}
            </div>

            {/* ปุ่ม Retry เมื่อมี Error */}
            {hasError && (
              <button 
                onClick={bootSystem}
                className="mt-10 px-8 py-3 bg-black text-white text-[15px] font-bold rounded-xl hover:bg-gray-800 active:scale-95 transition-all shadow-sm"
              >
                ลองอีกครั้ง
              </button>
            )}
            
          </div>
        </div>
      )}
    </>
  );
}