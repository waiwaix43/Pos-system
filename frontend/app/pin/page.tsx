"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PinPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [user, setUser] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false); 
  const [errorMsg, setErrorMsg] = useState(""); 
  const [isErrorAnimation, setIsErrorAnimation] = useState(false);
  
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState(""); 
  const [imageError, setImageError] = useState(false); 

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // ดึงข้อมูล User และ รายชื่อ Role ทั้งหมดของร้าน
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("userContext");
      
      if (savedUser && savedUser !== "undefined" && savedUser !== "null") {
        const parsedUser = JSON.parse(savedUser);

        if (parsedUser && parsedUser.email) {
          fetch(`${apiUrl}/api/settings?shop_id=${encodeURIComponent(parsedUser.shop_id)}`)
            .then((res) => res.ok ? res.json() : null)
            .then((settings) => {
              if (settings?.pin_enabled === false) {
                router.push("/pos");
                return;
              }

              setUser(parsedUser);
              setSelectedRole(parsedUser.role || "");

              if (settings?.logo) {
                setUser((currentUser: any) => currentUser ? { ...currentUser, profile_image: settings.logo } : currentUser);
                setImageError(false);
              }

              fetch(`${apiUrl}/api/staff-roles?email=${encodeURIComponent(parsedUser.email)}`)
                .then(async (res) => {
                  if (!res.ok) return null;
                  
                  const contentType = res.headers.get("content-type");
                  if (contentType && contentType.includes("application/json")) {
                    return res.json();
                  }
                  return null;
                })
                .then((data) => {
                  if (Array.isArray(data) && data.length > 0) {
                    setAvailableRoles(data);
                    if (!data.includes(parsedUser.role)) {
                      setSelectedRole(data[0]);
                    }
                  } else if (parsedUser.role) {
                    setAvailableRoles([parsedUser.role]);
                  }
                })
                .catch((err) => {
                  console.warn("ไม่สามารถดึงข้อมูล Role ได้:", err);
                  if (parsedUser.role) setAvailableRoles([parsedUser.role]);
                });
            })
            .catch((err) => {
              console.warn("ไม่สามารถโหลดการตั้งค่า PIN ได้:", err);
              setUser(parsedUser);
              setSelectedRole(parsedUser.role || "");
            });

          fetch(`${apiUrl}/api/staff-roles?email=${encodeURIComponent(parsedUser.email)}`)
            .then(async (res) => {
              if (!res.ok) return null;
              
              const contentType = res.headers.get("content-type");
              if (contentType && contentType.includes("application/json")) {
                return res.json();
              }
              return null;
            })
            .then((data) => {
              if (Array.isArray(data) && data.length > 0) {
                setAvailableRoles(data);
                if (!data.includes(parsedUser.role)) {
                  setSelectedRole(data[0]);
                }
              } else if (parsedUser.role) {
                setAvailableRoles([parsedUser.role]);
              }
            })
            .catch((err) => {
              console.warn("ไม่สามารถดึงข้อมูล Role ได้:", err);
              if (parsedUser.role) setAvailableRoles([parsedUser.role]);
            });
        } else {
          localStorage.removeItem("userContext");
          router.push("/");
        }
      } else {
        localStorage.removeItem("userContext");
        router.push("/");
      }
    } catch (e) {
      console.error("Local storage error:", e);
      localStorage.removeItem("userContext");
      router.push("/");
    }
  }, [router, apiUrl]);

  // ระบบพิมพ์ PIN ผ่าน Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isVerifying) return;

      if (e.key >= "0" && e.key <= "9") {
        handleNumberClick(e.key);
      } else if (e.key === "Backspace") {
        setPin((prev) => prev.slice(0, -1));
        setErrorMsg(""); 
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, isVerifying]);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4 && !isVerifying) {
      setErrorMsg(""); 
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) verifyPin(newPin);
    }
  };

  // ตรวจสอบ PIN กับ Backend
  const verifyPin = async (inputPin: string) => {
    setIsVerifying(true);
    setErrorMsg("");
    try {
      const response = await fetch(`${apiUrl}/api/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: user?.email,
          role: selectedRole, 
          pin: inputPin 
        }),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        
        if (data.success) {
          if (data.user) {
            localStorage.setItem("userContext", JSON.stringify(data.user));
          }
          setTimeout(() => router.push("/pos"), 150);
        } else {
          handlePinError(data.message || "รหัส PIN ไม่ถูกต้อง");
        }
      } else {
        throw new Error("Server returned non-JSON response");
      }
    } catch (err) {
      console.error("Verification error:", err);
      handlePinError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  // รวม Logic การจัดการเมื่อเกิด Error เพื่อให้มี Shake Animation
  const handlePinError = (message: string) => {
    setErrorMsg(message);
    setIsErrorAnimation(true);
    setTimeout(() => {
      setIsErrorAnimation(false);
      setPin("");
      setIsVerifying(false);
    }, 300);
  };

  return (
    <>
      {/* เก็บไว้เฉพาะ Animation สั่นตอนกรอกรหัสผิด */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .anim-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}} />

      <div className="min-h-screen bg-[#d6d6d6] flex flex-col items-center justify-center font-sans relative select-none overflow-hidden">
        
        <div className="flex flex-col items-center">
          
          {/* Logo */}
          <div className="w-[100px] h-[100px] bg-white rounded-full flex items-center justify-center mb-5 overflow-hidden border border-gray-200 shadow-[0_4px_16px_rgba(0,0,0,0.03)]">
             {user?.profile_image && !imageError ? (
               <img 
                  src={user.profile_image} 
                  alt="Logo" 
                  className="w-full h-full object-contain"
                  onError={() => setImageError(true)} 
               />
             ) : (
               <svg viewBox="0 0 24 24" fill="currentColor" className="w-[42px] h-[42px] text-gray-300">
                 <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
               </svg>
             )}
          </div>
          
          <h2 className="text-[24px] font-bold text-gray-900 mb-1">
            {user?.shop_name || "กำลังโหลด..."}
          </h2>
          <p className="text-[15px] text-gray-400 font-medium mb-2">
            {user?.branch || "สาขาหลัก"}
          </p>
          
          {/* Role */}
          <div className="mb-8 text-[16px] font-medium text-gray-500">
            {user?.role || "กำลังโหลด..."}
          </div>

          {/* กล่องแสดงการกรอกรหัส */}
          <div 
            className={`w-[380px] h-[72px] border-2 bg-white rounded-2xl flex items-center justify-center gap-6 mb-4 transition-all duration-200
              ${isVerifying ? 'border-gray-200 opacity-70' : 
                isErrorAnimation ? 'border-red-400 bg-red-50/50 anim-shake' : 
                pin.length > 0 ? 'border-gray-700 shadow-sm' : 'border-gray-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)]'}`}
          >
            {pin.length > 0 || isVerifying ? (
              // แสดงจุดเรียงตามจำนวน
              [...Array(4)].map((_, i) => (
                <div key={i} className="w-4 h-4 flex items-center justify-center">
                  {i < pin.length && (
                    <span className="w-full h-full bg-gray-800 rounded-full shadow-sm" />
                  )}
                  {i >= pin.length && (
                    <span className="w-3 h-3 bg-gray-200 rounded-full opacity-50" />
                  )}
                </div>
              ))
            ) : (
              <span className="text-gray-300 tracking-wide text-[16px] font-medium">
                กรอกรหัสผ่าน 4 หลัก
              </span>
            )}
          </div>

          {/* จุดสำหรับแสดงข้อความ Error */}
          <div className="h-6 mb-4">
              {errorMsg && (
                <p className="text-red-500 font-medium text-[14px]">
                  {errorMsg}
                </p>
              )}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-x-8 gap-y-6 mb-10 pointer-events-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button 
                key={num} 
                disabled={isVerifying}
                onClick={() => handleNumberClick(num.toString())} 
                className="w-[86px] h-[86px] bg-white border border-gray-200 rounded-full text-[26px] font-medium text-gray-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] transition-colors duration-150 
                           hover:bg-black hover:text-white hover:border-black hover:shadow-md
                           active:bg-gray-800 active:border-gray-800
                           disabled:opacity-50 disabled:pointer-events-none"
              >
                {num}
              </button>
            ))}
            <div />
            <button 
              disabled={isVerifying}
              onClick={() => handleNumberClick("0")} 
              className="w-[86px] h-[86px] bg-white border border-gray-200 rounded-full text-[26px] font-medium text-gray-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] transition-colors duration-150 
                         hover:bg-black hover:text-white hover:border-black hover:shadow-md
                         active:bg-gray-800 active:border-gray-800
                         disabled:opacity-50 disabled:pointer-events-none"
            >
              0
            </button>
            
            <button 
              disabled={isVerifying}
              onClick={() => {
                setPin(pin.slice(0, -1));
                setErrorMsg("");
              }} 
              className="w-[86px] h-[86px] flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-400 transition-colors duration-150
                         hover:bg-red-50 hover:text-red-600 hover:border-red-100
                         active:bg-red-100
                         disabled:opacity-50 disabled:pointer-events-none"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[34px] h-[34px]">
                <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/>
              </svg>
            </button>
          </div>

          {/* ลืมรหัสผ่าน Effect เรียบหรู (นำกลับมาให้ตามคำขอ) */}
          <button 
            onClick={() => router.push("/forgot-pin")} 
            disabled={isVerifying}
            className="text-[15px] text-gray-400 font-medium transition-all duration-200 ease-out relative pb-1
                       hover:text-gray-800 hover:-translate-y-[1px] active:scale-95
                       after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1.5px] after:bg-gray-800 after:scale-x-0 after:origin-right hover:after:scale-x-100 hover:after:origin-left after:transition-transform after:duration-300
                       disabled:opacity-50 disabled:pointer-events-none"
          >
            ลืม PIN เข้าร้าน?
          </button>

        </div>

        {/* แถบด้านล่างสำหรับออกจากระบบ */}
        <div className="absolute bottom-10 w-full px-12 flex justify-between items-center text-[13px]">
          
          <button 
            onClick={() => {
              localStorage.clear();
              router.push("/");
            }} 
            disabled={isVerifying}
            className="group flex items-center gap-2 text-gray-500 font-semibold px-4 py-2.5 rounded-lg transition-colors duration-200
                       hover:bg-red-50 hover:text-red-700
                       disabled:opacity-50 disabled:pointer-events-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-[3px]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>ออกจากระบบ</span>
          </button>
          
          <span className="text-gray-400 opacity-60 font-medium pointer-events-none text-[12px] tracking-wider">
            Next POS System v1.0
          </span>
        </div>
        
      </div>
    </>
  );
}