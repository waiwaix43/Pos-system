"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      
      const response = await fetch(`${apiUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("userContext", JSON.stringify({
          id: data.user.id,
          shop_id: data.user.shop_id,
          name: data.user.name,
          email: data.user.email,
          shop_name: data.user.shop_name,
          branch: data.user.branch,
          role: data.user.role,
          profile_image: data.user.profile_image
        }));

        if (data.hasPin) {
          router.push("/pin");
        } else {
          router.push("/pos");
        }
      } else {
        setErrorMsg(data.error || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch (error) {
      setErrorMsg("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#d6d6d6] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg border border-gray-100 p-8 md:p-10">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black italic tracking-wider text-black">POS</h1>
        </div>
        
        {errorMsg && (
          <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm mb-4 text-center">
            {errorMsg}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            placeholder="อีเมล" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-black disabled:bg-gray-100" 
          />
          
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="รหัสผ่าน" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              disabled={isLoading}
              // เพิ่ม pl-4 pr-12 เพื่อเว้นที่ให้ดวงตา และเพิ่ม [&::-ms-reveal]:hidden เพื่อซ่อนดวงตาของ Edge
              className="w-full pl-4 pr-12 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-black disabled:bg-gray-100 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden" 
            />
            
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)} 
              disabled={isLoading}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              )}
            </button>
          </div>

          <div className="text-right">
            <button 
              type="button" 
              onClick={() => router.push('/forgot-password')} 
              className="text-sm font-medium text-black hover:underline"
            >
              ลืมรหัสผ่าน
            </button>
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className={`w-full font-bold py-3.5 rounded-lg text-white flex justify-center items-center gap-2 
              ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'}`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังเข้าสู่ระบบ...
              </>
            ) : "เข้าสู่ระบบ"}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="px-4 text-sm text-gray-400">หรือ</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>
        
        <button 
          type="button" 
          disabled={isLoading}
          onClick={() => router.push('/register')} 
          className="w-full bg-white text-black font-bold py-3.5 rounded-lg border-2 border-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          สร้างบัญชีผู้ใช้
        </button>
      </div>
    </div>
  );
}