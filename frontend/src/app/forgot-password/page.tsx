"use client";
import { useToast } from '@/components/shared/ToastProvider';
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    // จำลองการส่งอีเมล
    showToast("ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว!", 'success');
    router.push("/"); // ส่งเสร็จเด้งกลับหน้า Login
  };

  return (
    <div className="min-h-screen bg-[#d6d6d6] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg border border-gray-100 p-8 md:p-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-black mb-2">ลืมรหัสผ่าน?</h1>
          <p className="text-gray-500 text-sm">กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          <input type="email" placeholder="อีเมลที่ใช้สมัครบัญชี" required disabled={isSubmitting} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-black disabled:bg-gray-100" />

          <button type="submit" disabled={isSubmitting} className="w-full bg-black text-white font-bold py-3.5 rounded-lg hover:bg-gray-800 transition-colors active:scale-95 mt-4 disabled:opacity-60 disabled:cursor-not-allowed">
            {isSubmitting ? "กำลังส่งลิงก์..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
          </button>
        </form>

        <button disabled={isSubmitting} onClick={() => router.push('/')} className="w-full mt-4 text-sm font-medium text-gray-500 hover:text-black transition-colors disabled:opacity-50">
          กลับไปหน้าเข้าสู่ระบบ
        </button>
      </div>
    </div>
  );
}
