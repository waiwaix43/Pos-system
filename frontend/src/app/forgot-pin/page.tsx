"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// สร้าง Component ไอคอนดวงตาแยกออกมา เพื่อลดความซ้ำซ้อนของโค้ด
const EyeIcon = ({ isOpen }: { isOpen: boolean }) => {
  return isOpen ? (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
};

export default function ForgotPinPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    password: "",
    newPin: "",
    confirmPin: ""
  });
  
  // สร้าง State สำหรับเปิด/ปิดดวงตาแยกในแต่ละช่อง
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const savedUser = localStorage.getItem("userContext");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      router.push("/");
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (formData.newPin !== formData.confirmPin) {
      setErrorMsg("รหัส PIN ใหม่ไม่ตรงกัน");
      return;
    }
    
    if (formData.newPin.length !== 4 || isNaN(Number(formData.newPin))) {
      setErrorMsg("กรุณาตั้งรหัส PIN เป็นตัวเลข 4 หลัก");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/reset-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: user?.email, 
          password: formData.password,
          newPin: formData.newPin 
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMsg(data.message);
        setTimeout(() => {
          router.push("/pin"); 
        }, 1500);
      } else {
        setErrorMsg(data.message || "รหัสผ่านบัญชีไม่ถูกต้อง");
      }
    } catch (err) {
      setErrorMsg("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้");
    }
  };

  return (
    <div className="min-h-screen bg-[#d6d6d6] flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg border border-gray-100 p-8 md:p-10 relative">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-black mb-3">ตั้งรหัส PIN ใหม่</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            กรุณายืนยันรหัสผ่านของบัญชี <br/>
            <span className="font-bold text-black">{user?.email}</span> <br/>
            {/* เปลี่ยนสี Role ให้เป็นสีดำเหมือนตัวอื่นตามที่ขอครับ */}
            เพื่อตั้งรหัสเข้าร้านสำหรับตำแหน่ง <span className="font-bold text-black">{user?.role || "ผู้ใช้งาน"}</span>
          </p>
        </div>

        {errorMsg && <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm mb-4 text-center">{errorMsg}</div>}
        {successMsg && <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg text-sm mb-4 text-center">{successMsg}</div>}

        <form onSubmit={handleResetPin} className="space-y-4">
          
          {/* ช่องรหัสผ่านบัญชี */}
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              name="password" 
              value={formData.password}
              onChange={handleChange}
              placeholder="รหัสผ่านบัญชี (Password)" 
              required 
              // ใส่ pl-4 pr-12 เพื่อเว้นที่ให้ตา และ [&::-ms-reveal]:hidden เพื่อซ่อนตาของ Edge ถาวร
              className="w-full pl-4 pr-12 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-black [&::-ms-reveal]:hidden [&::-ms-clear]:hidden" 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <EyeIcon isOpen={showPassword} />
            </button>
          </div>
          
          <div className="pt-4 border-t border-gray-100">
            {/* ช่องรหัส PIN ใหม่ */}
            <div className="relative mb-4">
              <input 
                type={showNewPin ? "text" : "password"} 
                name="newPin" 
                maxLength={4}
                value={formData.newPin}
                onChange={handleChange}
                placeholder="รหัส PIN ใหม่ (ตัวเลข 4 หลัก)" 
                required 
                className="w-full pl-4 pr-12 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-black font-sans [&::-ms-reveal]:hidden [&::-ms-clear]:hidden" 
              />
              <button 
                type="button" 
                onClick={() => setShowNewPin(!showNewPin)} 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <EyeIcon isOpen={showNewPin} />
              </button>
            </div>

            {/* ช่องยืนยันรหัส PIN ใหม่ */}
            <div className="relative">
              <input 
                type={showConfirmPin ? "text" : "password"} 
                name="confirmPin" 
                maxLength={4}
                value={formData.confirmPin}
                onChange={handleChange}
                placeholder="ยืนยันรหัส PIN ใหม่" 
                required 
                className="w-full pl-4 pr-12 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-black font-sans [&::-ms-reveal]:hidden [&::-ms-clear]:hidden" 
              />
              <button 
                type="button" 
                onClick={() => setShowConfirmPin(!showConfirmPin)} 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <EyeIcon isOpen={showConfirmPin} />
              </button>
            </div>
          </div>

          <button type="submit" className="w-full bg-black text-white font-bold py-3.5 rounded-lg hover:bg-gray-800 active:scale-95 transition-all mt-6">
            ยืนยันการเปลี่ยน PIN
          </button>
        </form>

        <button 
          onClick={() => router.push('/pin')} 
          className="w-full mt-6 text-sm font-medium text-gray-500 hover:text-black transition-colors"
        >
          ยกเลิก และกลับไปหน้าเข้าร้าน
        </button>

      </div>
    </div>
  );
}