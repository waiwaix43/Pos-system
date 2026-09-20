"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from "../../components/NotificationBell";
import { createClient } from "@supabase/supabase-js";
import {
  Search, Plus, RefreshCw, Edit3, X, Save, Trash2, Power,
  UserCircle, Users, ShieldCheck, ShieldAlert, Key,
  Activity, Clock, Mail, Phone, Lock
} from "lucide-react";

// ==========================================
// SUPABASE CLIENT (สำหรับ Upload รูปโปรไฟล์)
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

interface Staff {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  image_url: string | null;
  created_at: string;
}

export default function EmployeeManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [toast, setToast] = useState<{ show: boolean; msg: string; type: "success" | "error" }>({ show: false, msg: "", type: "success" });

  // Modal & Drawer States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formData, setFormData] = useState<any>({});

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [staffActivity, setStaffActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Security: PIN Override Modal
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPin, setAuthPin] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // ==========================================
  // 1. FETCH DATA
  // ==========================================
  const fetchStaffData = async (shopId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/staff?shop_id=${shopId}`);
      if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลพนักงานได้");
      const data = await res.json();
      setStaffList(data);
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("userContext") || "null");
    if (!savedUser) {
      router.push("/pin");
      return;
    }
    // Block unauthorized access completely at frontend routing level
    if (savedUser.role === "Cashier" || savedUser.role === "พนักงาน") {
      alert("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
      router.push("/pos");
      return;
    }
    setUser(savedUser);
    fetchStaffData(savedUser.shop_id || 1);
  }, [router]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: "", type: "success" }), 4000);
  };

 // ==========================================
  // 2. SUMMARY CALCULATIONS
  // ==========================================
  const totalStaff = staffList.length;
  const activeStaff = staffList.filter(s => s.status === 'active').length;
  const managerStaff = staffList.filter(s => ['เจ้าของร้าน', 'ผู้จัดการ'].includes(s.role)).length;
  const inactiveStaff = staffList.filter(s => s.status === 'inactive').length;

  const filteredStaff = staffList.filter(s => {
    const safeName = s.name || "";
    const safeEmail = s.email || "";
    const searchLower = (searchTerm || "").toLowerCase();

    const matchSearch = safeName.toLowerCase().includes(searchLower) ||
      safeEmail.toLowerCase().includes(searchLower) ||
      (s.phone && s.phone.includes(searchTerm));      
    const matchRole = roleFilter ? s.role === roleFilter : true;
    const matchStatus = statusFilter ? s.status === statusFilter : true;
    
    return matchSearch && matchRole && matchStatus;
  });

  // ==========================================
  // 3. ACTIONS & MODALS
  // ==========================================
  const handleOpenAddModal = () => {
    setFormMode("add");
    setFormData({ role: 'พนักงาน', status: 'active', pin: '', password: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (staff: Staff) => {
    setFormMode("edit");
    setFormData({ ...staff, pin: '', password: '' }); // Don't fetch actual pin/password
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleOpenDrawer = async (staff: Staff) => {
    setSelectedStaff(staff);
    setIsDrawerOpen(true);
    setActivityLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/staff/${staff.id}/activity?shop_id=${user.shop_id}`);
      if (res.ok) setStaffActivity(await res.json());
      else setStaffActivity([]);
    } catch {
      setStaffActivity([]);
    } finally {
      setActivityLoading(false);
    }
  };

  // ==========================================
  // 4. UPLOAD IMAGE
  // ==========================================
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) return showToast("ขนาดรูปต้องไม่เกิน 2MB", "error");

    setIsUploading(true);
    try {
      if (!supabase) throw new Error("ยังไม่ได้ตั้งค่าระบบจัดเก็บรูปภาพ");
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.shop_id}-staff-${Date.now()}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage.from('profiles').upload(fileName, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(fileName);
      setFormData({ ...formData, image_url: publicUrl });
      showToast("อัปโหลดรูปโปรไฟล์สำเร็จ", "success");
    } catch (err: any) {
      showToast("อัปโหลดรูปไม่สำเร็จ: " + err.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  // ==========================================
  // 5. SAVE WITH SECURITY OVERRIDE
  // ==========================================
  const handleSave = () => {
    // 5.1 Validation
    if (!formData.name || !formData.email || !formData.role) {
      return showToast("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน", "error");
    }
    if (formMode === "add" && (!formData.password || !formData.pin)) {
      return showToast("ต้องกำหนดรหัสผ่านและ PIN สำหรับบัญชีใหม่", "error");
    }
    if (formData.pin && formData.pin.length !== 4) {
      return showToast("รหัส PIN ต้องมี 4 หลัก", "error");
    }

    // 5.2 Security Check: Prevent elevating to Owner/Manager without Manager PIN
    const isElevatingPrivilege = ['เจ้าของร้าน', 'ผู้จัดการ'].includes(formData.role);
    const isEditingOtherManager = formMode === 'edit' && ['เจ้าของร้าน', 'ผู้จัดการ'].includes(selectedStaff?.role || '');
    const isSelf = formData.id === user.id;

    if (!isSelf && (isElevatingPrivilege || isEditingOtherManager) && user.role !== 'เจ้าของร้าน') {
      // Require PIN override
      setPendingAction(() => executeSaveData);
      setAuthModalOpen(true);
    } else {
      executeSaveData();
    }
  };

  const executeSaveData = async () => {
    setIsSaving(true);
    try {
      const method = formMode === 'edit' ? 'PUT' : 'POST';
      const endpoint = formMode === 'edit' ? `/api/staff/${formData.id}` : `/api/staff`;

      const payload = { ...formData, shop_id: user.shop_id };

      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึก");

      showToast("บันทึกข้อมูลพนักงานเรียบร้อยแล้ว", "success");
      setIsModalOpen(false);
      fetchStaffData(user.shop_id);
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setIsSaving(false);
      setAuthModalOpen(false);
      setAuthPin("");
      setPendingAction(null);
    }
  };

  const handleToggleStatus = async (staff: Staff) => {
    if (staff.id === user?.id) {
      return showToast("ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้", "error");
    }

    const nextStatus = staff.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`http://localhost:5000/api/staff/${staff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...staff, status: nextStatus, shop_id: user.shop_id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ไม่สามารถเปลี่ยนสถานะพนักงานได้");

      showToast(nextStatus === "active" ? "เปิดใช้งานพนักงานแล้ว" : "ปิดการใช้งานพนักงานแล้ว", "success");
      setIsDrawerOpen(false);
      fetchStaffData(user.shop_id);
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleDeleteStaff = async (staff: Staff) => {
    if (staff.id === user?.id) {
      return showToast("ไม่สามารถลบบัญชีของตัวเองได้", "error");
    }
    if (!window.confirm(`ต้องการลบพนักงาน ${staff.name} ออกจากระบบหรือไม่?`)) return;

    try {
      const res = await fetch(`http://localhost:5000/api/staff/${staff.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: user.shop_id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ไม่สามารถลบพนักงานได้");

      showToast("ลบพนักงานเรียบร้อยแล้ว", "success");
      setIsDrawerOpen(false);
      fetchStaffData(user.shop_id);
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const confirmSecurityOverride = async () => {
    if (!authPin) return;
    try {
      const res = await fetch(`http://localhost:5000/api/verify-manager-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: user.shop_id, pin: authPin })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error("รหัส PIN ผิด หรือคุณไม่มีสิทธิ์อนุมัติ");

      if (pendingAction) pendingAction();
    } catch (error: any) {
      showToast(error.message, "error");
      setAuthPin("");
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="flex h-screen bg-[#d6d6d6] font-sans overflow-hidden text-gray-800">

      {/* 🌟 Sidebar คง UI เดิม 🌟 */}
      <div className="w-[240px] bg-[#4d4d4d] text-white flex flex-col justify-between shrink-0 shadow-lg z-20">
        <div>
          <div className="h-[90px] flex items-center justify-center gap-3 translate-x-3">
            <h1 className="text-[36px] font-black italic tracking-widest text-white">POS</h1>
            <NotificationBell />
          </div>
          <nav className="sidebar-menu flex flex-col text-[16px]">
            <button onClick={() => router.push('/pos')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">สั่งและชำระเงิน</button>
            <button onClick={() => router.push('/pos/history')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">ประวัติใบเสร็จ</button>
            <button onClick={() => router.push('/pos/inventory')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">สินค้าคงคลัง</button>
            <button onClick={() => router.push('/pos/shifts')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รอบการขาย</button>
            <button onClick={() => router.push('/pos/menu')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">เมนูและโปรโมชั่น</button>
            <button onClick={() => router.push('/pos/reports')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รายงาน</button>
            <button onClick={() => router.push('/pos/employees')} className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">พนักงาน</button>
            <button onClick={() => router.push('/pos/settings')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">การตั้งค่า</button>
          </nav>
        </div>
        <button onClick={() => {
          const savedUser = JSON.parse(localStorage.getItem("userContext") || "null");
          localStorage.removeItem("userContext");
          router.push(savedUser?.pin_enabled === false ? '/' : '/pin');
        }} className="py-6 px-6 text-left text-gray-300 border-t border-[#666666] hover:bg-[#666666] transition-colors text-[16px]">{JSON.parse(localStorage.getItem("userContext") || "null")?.pin_enabled === false ? 'ออกจากระบบ' : 'กลับสู่หน้า PIN'}</button>
      </div>

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="h-[90px] bg-[#f5f6f8] flex items-center justify-between z-10 shrink-0 w-full px-8 border-b border-gray-200 shadow-sm">
          <div>
            <h2 className="text-[22px] font-bold text-gray-800">พนักงาน (Employees)</h2>
            <p className="text-[13px] text-gray-500">จัดการข้อมูลพนักงาน บทบาท และสิทธิ์การใช้งานระบบ POS</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleOpenAddModal} className="h-[46px] px-6 bg-[#7a5c4e] text-white rounded-full font-bold text-[15px] hover:bg-[#684c3f] transition-colors flex items-center gap-2 shadow-sm">
              <Plus className="w-5 h-5" /> เพิ่มพนักงาน
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 relative">
          <div className="w-full flex flex-col gap-6">

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-6 shrink-0">
              <div className="bg-white p-6 rounded-[24px] border border-gray-200 shadow-sm flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><Users className="w-7 h-7" /></div>
                <div><div className="text-[13px] font-bold text-gray-400 uppercase">พนักงานทั้งหมด</div><div className="text-[28px] font-black text-gray-800 leading-none mt-1">{totalStaff}</div></div>
              </div>
              <div className="bg-white p-6 rounded-[24px] border border-gray-200 shadow-sm flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><ShieldCheck className="w-7 h-7" /></div>
                <div><div className="text-[13px] font-bold text-gray-400 uppercase">กำลังใช้งาน (Active)</div><div className="text-[28px] font-black text-gray-800 leading-none mt-1">{activeStaff}</div></div>
              </div>
              <div className="bg-white p-6 rounded-[24px] border border-gray-200 shadow-sm flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><Key className="w-7 h-7" /></div>
                <div><div className="text-[13px] font-bold text-gray-400 uppercase">ระดับผู้จัดการ</div><div className="text-[28px] font-black text-gray-800 leading-none mt-1">{managerStaff}</div></div>
              </div>
              <div className="bg-white p-6 rounded-[24px] border border-gray-200 shadow-sm flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><ShieldAlert className="w-7 h-7" /></div>
                <div><div className="text-[13px] font-bold text-gray-400 uppercase">ปิดใช้งาน (Inactive)</div><div className="text-[28px] font-black text-gray-800 leading-none mt-1">{inactiveStaff}</div></div>
              </div>
            </div>

            {/* TABLE AREA */}
            <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm flex flex-col min-h-[500px] overflow-hidden">

              {/* Filters */}
              <div className="bg-gray-50 border-b border-gray-100 px-4 md:px-6 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3 flex-wrap w-full">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input type="text" placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-full text-[13px] outline-none focus:border-[#7a5c4e] w-full sm:w-[300px] shadow-sm bg-white" />
                  </div>
                  <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-full text-[13px] outline-none focus:border-[#7a5c4e] bg-white text-gray-600 shadow-sm">
                    <option value="">บทบาททั้งหมด</option>
                    <option value="เจ้าของร้าน">เจ้าของร้าน</option>
                    <option value="ผู้จัดการ">ผู้จัดการ</option>
                    <option value="พนักงาน">พนักงาน</option>
                    <option value="Cashier">แคชเชียร์</option>
                  </select>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-full text-[13px] outline-none focus:border-[#7a5c4e] bg-white text-gray-600 shadow-sm">
                    <option value="">สถานะทั้งหมด</option>
                    <option value="active">กำลังใช้งาน</option>
                    <option value="inactive">ปิดใช้งาน</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-x-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                    <RefreshCw className="w-8 h-8 animate-spin mb-3 text-[#7a5c4e]" />
                    <span className="text-[14px]">กำลังโหลดข้อมูล...</span>
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                    <Users className="w-12 h-12 mb-3 text-gray-300" />
                    <span className="text-[15px] font-bold text-gray-600">ไม่พบข้อมูลพนักงาน</span>
                  </div>
                ) : (
                  <table className="w-full min-w-[780px] text-left border-collapse">
                    <thead className="bg-white sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">พนักงาน</th>
                        <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">ติดต่อ</th>
                        <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">บทบาท</th>
                        <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-center">สถานะ</th>
                        <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.map(staff => (
                        <tr key={staff.id} className="hover:bg-gray-50 border-b border-dashed border-gray-100 group transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleOpenDrawer(staff)}>
                              <div className="w-10 h-10 rounded-full bg-gray-200 border border-gray-300 overflow-hidden shrink-0 flex items-center justify-center text-gray-400 bg-white">
                                {staff.image_url ? <img src={staff.image_url} className="w-full h-full object-cover" /> : <UserCircle className="w-6 h-6" />}
                              </div>
                              <div>
                                <div className="font-bold text-[14px] text-gray-800 group-hover:text-[#7a5c4e] transition-colors">{staff.name}</div>
                                <div className="text-[12px] text-gray-500 mt-0.5">เริ่มงาน: {new Date(staff.created_at).toLocaleDateString('th-TH')}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <div className="text-[13px] text-gray-700 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> {staff.email}</div>
                              <div className="text-[13px] text-gray-700 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" /> {staff.phone || '-'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold border bg-gray-50 text-gray-700 border-gray-300">
                              {staff.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase border bg-gray-50 text-gray-700 border-gray-300">
                              {staff.status === 'active' ? 'ใช้งาน' : 'ระงับ'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenDrawer(staff)} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-md text-[12px] font-bold hover:bg-gray-50">ดูข้อมูล</button>
                            <button onClick={() => handleOpenEditModal(staff)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Edit3 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== TOAST ===================== */}
      {toast.show && (
        <div className={`fixed top-10 right-10 px-6 py-4 rounded-xl shadow-lg font-bold text-[15px] text-white transition-all z-[100] animate-in fade-in slide-in-from-top-5 ${toast.type === 'success' ? 'bg-[#7a5c4e]' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* ===================== MODAL ADD/EDIT ===================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0 bg-[#f5f6f8] rounded-t-[24px]">
              <h3 className="text-[20px] font-bold text-gray-800 flex items-center gap-2">
                <UserCircle className="w-6 h-6 text-[#7a5c4e]" />
                {formMode === 'add' ? 'เพิ่มพนักงานใหม่' : 'แก้ไขข้อมูลพนักงาน'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-white space-y-8">

              {/* 1. ข้อมูลส่วนตัว */}
              <section>
                <h4 className="text-[15px] font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">ข้อมูลทั่วไป</h4>
                <div className="flex gap-6 items-start">
                  <div className="flex flex-col items-center gap-3 w-[120px] shrink-0">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden relative">
                      {formData.image_url ? <img src={formData.image_url} className="w-full h-full object-cover" /> : <UserCircle className="w-10 h-10 text-gray-300" />}
                      {isUploading && <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin text-[#7a5c4e]" /></div>}
                    </div>
                    <div className="relative overflow-hidden">
                      <input type="file" onChange={handleImageUpload} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" disabled={isUploading} />
                      <span className="text-[12px] font-bold text-[#7a5c4e] bg-[#7a5c4e]/10 px-3 py-1.5 rounded-full whitespace-nowrap cursor-pointer hover:bg-[#7a5c4e]/20 transition-colors">
                        อัปโหลดรูป
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[13px] font-bold text-gray-600 mb-1.5">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px]" placeholder="ระบุชื่อจริง" />
                      </div>
                      <div>
                        <label className="block text-[13px] font-bold text-gray-600 mb-1.5">เบอร์โทรศัพท์</label>
                        <input type="tel" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px]" placeholder="08X-XXX-XXXX" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[13px] font-bold text-gray-600 mb-1.5">อีเมล (ใช้เข้าสู่ระบบ) <span className="text-red-500">*</span></label>
                      <input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} disabled={formMode === 'edit'} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px] disabled:bg-gray-100 disabled:text-gray-500" />
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. บทบาท & ความปลอดภัย */}
              <section>
                <h4 className="text-[15px] font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                  บทบาทและความปลอดภัย
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[13px] font-bold text-gray-600 mb-1.5">บทบาท (Role) <span className="text-red-500">*</span></label>
                    <select value={formData.role || 'พนักงาน'} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px] bg-white">
                      <option value="พนักงาน">พนักงาน (Employee)</option>
                      <option value="Cashier">แคชเชียร์ (Cashier)</option>
                      <option value="ผู้จัดการ">ผู้จัดการ (Manager)</option>
                      {user?.role === 'เจ้าของร้าน' && <option value="เจ้าของร้าน">เจ้าของร้าน (Owner)</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-gray-600 mb-1.5">สถานะบัญชี</label>
                    <select value={formData.status || 'active'} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px] bg-white">
                      <option value="active">กำลังใช้งาน (Active)</option>
                      <option value="inactive">ปิดใช้งาน (Inactive)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                  <p className="text-[12px] font-bold text-orange-800 mb-3 flex items-center gap-1.5"><Lock className="w-4 h-4" /> รหัสผ่านและ PIN</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-medium text-orange-700 mb-1">รหัสผ่าน (Dashboard)</label>
                      <input type="password" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-orange-200 outline-none focus:border-orange-400 text-[13px]" placeholder={formMode === 'edit' ? 'ปล่อยว่างถ้าไม่เปลี่ยน' : 'รหัสผ่าน 6 ตัวขึ้นไป'} />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-orange-700 mb-1">รหัส PIN (สำหรับ POS)</label>
                      <input type="password" maxLength={4} value={formData.pin || ''} onChange={e => setFormData({ ...formData, pin: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-orange-200 outline-none focus:border-orange-400 text-[16px] tracking-widest text-center" placeholder="••••" />
                    </div>
                  </div>
                  {formMode === 'edit' && <p className="text-[11px] text-orange-600 mt-2">* หากใส่รหัสใหม่ ระบบจะบันทึกทับรหัสเดิมทันที</p>}
                </div>
              </section>

            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end bg-gray-50 rounded-b-[24px] shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-[14px] hover:bg-gray-100 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={isSaving || isUploading} className="flex items-center gap-2 px-8 py-3 bg-[#7a5c4e] text-white rounded-xl font-bold text-[14px] hover:bg-[#684c3f] transition-colors shadow-sm disabled:opacity-50">
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== DRAWER (DETAIL & ACTIVITY) ===================== */}
      {isDrawerOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className="w-[500px] h-full bg-[#f5f6f8] shadow-2xl flex flex-col animate-in slide-in-from-right">

            <div className="h-[90px] border-b border-gray-200 flex items-center justify-between px-8 shrink-0 bg-white shadow-sm z-10">
              <h2 className="text-[20px] font-bold text-gray-800 flex items-center gap-2">
                ข้อมูลพนักงาน
              </h2>
              <button onClick={() => setIsDrawerOpen(false)} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-8 pb-6 bg-white border-b border-gray-200 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full border-4 border-gray-100 overflow-hidden mb-4 bg-gray-50 flex items-center justify-center shadow-sm">
                  {selectedStaff.image_url ? <img src={selectedStaff.image_url} className="w-full h-full object-cover" /> : <UserCircle className="w-12 h-12 text-gray-300" />}
                </div>
                <h3 className="text-[22px] font-black text-gray-800">{selectedStaff.name}</h3>
                <p className="text-[14px] text-gray-500 font-medium mb-3">{selectedStaff.email}</p>

                <div className="flex gap-2">
                  <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-gray-50 text-gray-700 border border-gray-300">{selectedStaff.role}</span>
                  <span className="px-3 py-1 rounded-full text-[12px] font-bold border bg-gray-50 text-gray-700 border-gray-300">
                    {selectedStaff.status === 'active' ? 'กำลังใช้งาน' : 'ถูกระงับ'}
                  </span>
                </div>

                <button onClick={() => handleOpenEditModal(selectedStaff)} className="mt-6 w-full py-2.5 bg-white border border-gray-300 rounded-xl text-[14px] font-bold text-gray-700 hover:bg-gray-50 shadow-sm flex items-center justify-center gap-2">
                  <Edit3 className="w-4 h-4" /> แก้ไขข้อมูล
                </button>
                <div className="mt-3 grid grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => handleToggleStatus(selectedStaff)}
                    disabled={selectedStaff.id === user?.id}
                    className="py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-[13px] font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Power className="w-4 h-4" />
                    {selectedStaff.status === "active" ? "ปิดการใช้งาน" : "เปิดใช้งาน"}
                  </button>
                  <button
                    onClick={() => handleDeleteStaff(selectedStaff)}
                    disabled={selectedStaff.id === user?.id}
                    className="py-2.5 bg-red-50 border border-red-200 rounded-xl text-[13px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> ลบพนักงาน
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <h4 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Activity className="w-4 h-4" /> ประวัติการทำรายการล่าสุด</h4>
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    {activityLoading ? (
                      <div className="flex justify-center p-8 text-gray-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
                    ) : staffActivity.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-gray-400 text-center">
                        <Activity className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-[13px] font-medium">ยังไม่มีประวัติการทำรายการ</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {staffActivity.map((act, i) => (
                          <div key={i} className="p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                              {act.type === 'SALE' ? <span className="text-[10px] font-black text-green-600">฿</span> : <Clock className="w-3.5 h-3.5 text-gray-500" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-0.5">
                                <p className="text-[14px] font-bold text-gray-800">{act.action}</p>
                                <span className="text-[11px] font-medium text-gray-400 whitespace-nowrap ml-2">{new Date(act.created_at).toLocaleDateString('th-TH')}</span>
                              </div>
                              <p className="text-[13px] text-gray-500">{act.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SECURITY OVERRIDE MODAL ===================== */}
      {authModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white p-8 rounded-[32px] w-full max-w-sm shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-[20px] font-bold text-gray-800 mb-2">ยืนยันสิทธิ์ผู้จัดการ</h3>
            <p className="text-[14px] text-gray-500 mb-6">การกระทำนี้ต้องการสิทธิ์ระดับผู้จัดการขึ้นไป กรุณาใส่รหัส PIN เพื่อยืนยัน</p>

            <input
              type="password"
              maxLength={4}
              value={authPin}
              onChange={e => setAuthPin(e.target.value)}
              className="w-full h-14 bg-gray-50 border border-gray-300 rounded-xl text-center text-[24px] tracking-[1em] font-black outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 mb-6"
              placeholder="••••"
              autoFocus
            />

            <div className="flex w-full gap-3">
              <button onClick={() => { setAuthModalOpen(false); setAuthPin(""); setPendingAction(null); }} className="flex-1 py-3.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={confirmSecurityOverride} disabled={!authPin} className="flex-1 py-3.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50">ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}