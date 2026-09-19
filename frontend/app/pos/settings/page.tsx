"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from "../../components/NotificationBell";
import InteractiveShopMap from "../../components/InteractiveShopMap";
import "leaflet/dist/leaflet.css";
import { createClient } from "@supabase/supabase-js";
import { 
  Store, 
  TrendingUp, 
  Receipt, 
  CreditCard, 
  Package, 
  FileText, 
  Bell, 
  ShieldCheck, 
  MonitorSmartphone, 
  Settings, 
  AlertCircle,
  RefreshCw,
  Edit3,
  Save,
  X,
  Upload,
  Trash2,
  ArrowUp,
  ArrowDown,
  MapPin,
  LocateFixed
} from "lucide-react";

// ==========================================
// SUPABASE CLIENT (คงไว้เผื่อมีการใช้งานส่วนอื่น)
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// ==========================================
// INTERFACES
// ==========================================
interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  shop_id: number;
  branch: string;
  profile_image?: string;
  status: "active" | "inactive";
}

interface PaymentMethod {
  id: number;
  shop_id: number;
  name: string;
  type: string;
  is_enabled: boolean;
  display_order: number;
}

interface ShopSettings {
  shop_id: number;
  shop_name: string;
  branch_name: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
  allow_negative_stock: boolean;
  auto_deduct_stock: boolean;
  allow_price_override: boolean;
  allow_discounts: boolean;
  require_reason_delete_item: boolean;
  require_reason_cancel_bill: boolean;
  auto_print_receipt: boolean;
  enable_e_receipt: boolean;
  receipt_show_logo: boolean;
  receipt_prefix: string;
  receipt_start_number: string;
  receipt_footer: string;
  alert_low_stock: boolean;
  low_stock_threshold: number;
  vat_enabled: boolean;
  vat_rate: number;
  prices_include_vat: boolean;
  notify_low_stock: boolean;
  notify_out_of_stock: boolean;
  notify_refund: boolean;
  notify_cancel_bill: boolean;
  notify_stock_adjust: boolean;
  hardware_printer_type: string;
  hardware_barcode_scanner: boolean;
  hardware_cash_drawer: boolean;
  language: string;
  currency: string;
  timezone: string;
  date_format: string;
  time_format: string;
  latitude?: number;
  longitude?: number;
}

const DEFAULT_SETTINGS: ShopSettings = {
  shop_id: 0,
  shop_name: "ชื่อร้านของคุณ",
  branch_name: "สาขาหลัก",
  logo: "",
  address: "ที่อยู่ร้าน",
  phone: "-",
  email: "-",
  tax_id: "-",
  allow_negative_stock: false,
  auto_deduct_stock: true,
  allow_price_override: true,
  allow_discounts: true,
  require_reason_delete_item: true,
  require_reason_cancel_bill: true,
  auto_print_receipt: true,
  enable_e_receipt: false,
  receipt_show_logo: false,
  receipt_prefix: "INV-",
  receipt_start_number: "10001",
  receipt_footer: "ขอบคุณที่ใช้บริการ",
  alert_low_stock: true,
  low_stock_threshold: 10,
  vat_enabled: false,
  vat_rate: 7,
  prices_include_vat: true,
  notify_low_stock: true,
  notify_out_of_stock: true,
  notify_refund: true,
  notify_cancel_bill: true,
  notify_stock_adjust: true,
  hardware_printer_type: "none",
  hardware_barcode_scanner: false,
  hardware_cash_drawer: false,
  language: "th",
  currency: "THB",
  timezone: "auto",
  date_format: "DD/MM/YYYY",
  time_format: "24h",
  latitude: undefined,
  longitude: undefined
};

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<string>("shop");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: "success" | "error" }>({ show: false, msg: "", type: "success" });
  
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const [originalSettings, setOriginalSettings] = useState<ShopSettings | null>(null);
  const [currentSettings, setCurrentSettings] = useState<ShopSettings | null>(null);
  
  // Payment Methods State
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [originalPaymentMethods, setOriginalPaymentMethods] = useState<PaymentMethod[]>([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState({ name: "", type: "OTHER" });
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);

  // Logo Upload State
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [isFindingAddress, setIsFindingAddress] = useState(false);
  
  const [securityForm, setSecurityForm] = useState({ oldPass: "", newPass: "", confirmPass: "", oldPin: "", newPin: "", confirmPin: "" });

  useEffect(() => {
    const init = async () => {
      const savedUser = JSON.parse(localStorage.getItem("userContext") || "null");
      if (!savedUser) {
        router.push("/pin");
        return;
      }
      setUser(savedUser);
      
      const isOwner = savedUser.role === "owner" || savedUser.role === "เจ้าของร้าน";
      if(!isOwner) setActiveTab("security");
      
      await fetchSettings(savedUser.shop_id || 1);
    };
    init();
  }, [router]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const fetchSettings = async (shopId: number) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      // โหลด Settings
      const res = await fetch(`http://localhost:5000/api/settings?shop_id=${shopId}`);
      if (!res.ok) throw new Error(`เกิดข้อผิดพลาดในการโหลดข้อมูล (Status: ${res.status})`);
      const data = await res.json();
      const normalizedSettings: ShopSettings = {
        ...DEFAULT_SETTINGS,
        ...data,
        shop_id: Number(data.shop_id ?? shopId)
      };
      setOriginalSettings(normalizedSettings);
      setCurrentSettings(normalizedSettings);
      setLogoPreview(normalizedSettings.logo || null);

      // โหลด Payment Methods
      const payRes = await fetch(`http://localhost:5000/api/payment-methods?shop_id=${shopId}`);
      if (payRes.ok) {
        const payData = await payRes.json();
        setPaymentMethods(payData);
        setOriginalPaymentMethods(JSON.parse(JSON.stringify(payData)));
      }
    } catch (error: any) {
      console.error("Fetch Settings Error:", error);
      setErrorMsg(error.message === "Failed to fetch" ? "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Backend ได้" : error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: "", type: "success" }), 3000);
  };

  const handleChange = (key: keyof ShopSettings, value: any) => {
    if (!currentSettings) return;
    setCurrentSettings(prev => ({ ...prev!, [key]: value }));
    setHasUnsavedChanges(true);
  };

  // จัดการการอัปโหลดรูป Logo
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        return showToast("รองรับไฟล์ JPG, PNG, WEBP เท่านั้น", "error");
      }
      if (file.size > 2 * 1024 * 1024) {
        return showToast("ขนาดไฟล์ต้องไม่เกิน 2MB", "error");
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setHasUnsavedChanges(true);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    handleChange('logo', '');
  };

  const handleFindAddress = async () => {
    const address = currentSettings?.address?.trim();
    if (!address) return showToast("กรุณากรอกที่อยู่ก่อนค้นหาตำแหน่ง", "error");

    setIsFindingAddress(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=th&q=${encodeURIComponent(address)}`, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("ไม่สามารถค้นหาตำแหน่งได้");
      const results = await response.json();
      if (!results.length) return showToast("ไม่พบตำแหน่งจากที่อยู่นี้ ลองเพิ่มตำบล อำเภอ และจังหวัด", "error");

      setCurrentSettings(prev => prev ? ({
        ...prev,
        latitude: Number(results[0].lat),
        longitude: Number(results[0].lon)
      }) : prev);
      setHasUnsavedChanges(true);
      showToast("พบตำแหน่งแล้ว กดบันทึกเพื่อเก็บพิกัดร้าน", "success");
    } catch (error: any) {
      showToast(error.message || "ไม่สามารถค้นหาตำแหน่งได้", "error");
    } finally {
      setIsFindingAddress(false);
    }
  };

  // จัดการลำดับการชำระเงิน
  const handleMovePayment = (index: number, direction: number) => {
    const newMethods = [...paymentMethods];
    if (index + direction < 0 || index + direction >= newMethods.length) return;
    
    const temp = newMethods[index];
    newMethods[index] = newMethods[index + direction];
    newMethods[index + direction] = temp;
    
    newMethods.forEach((m, i) => m.display_order = i);
    setPaymentMethods(newMethods);
    setHasUnsavedChanges(true);
  };

  const handleTogglePayment = (index: number) => {
    const newMethods = [...paymentMethods];
    newMethods[index].is_enabled = !newMethods[index].is_enabled;
    setPaymentMethods(newMethods);
    setHasUnsavedChanges(true);
  };

  const handleAddPaymentMethod = async () => {
    if (!user || !newPaymentMethod.name.trim()) return showToast("กรุณาระบุชื่อช่องทางการชำระเงิน", "error");
    setIsAddingPaymentMethod(true);
    try {
      const response = await fetch("http://localhost:5000/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: user.shop_id, ...newPaymentMethod })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "เพิ่มช่องทางการชำระเงินไม่สำเร็จ");
      setPaymentMethods(previous => [...previous, data]);
      setOriginalPaymentMethods(previous => [...previous, data]);
      setNewPaymentMethod({ name: "", type: "OTHER" });
      showToast("เพิ่มช่องทางการชำระเงินแล้ว", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setIsAddingPaymentMethod(false);
    }
  };

  const handleDeletePaymentMethod = async (method: PaymentMethod) => {
    if (!user || !window.confirm(`ลบช่องทาง “${method.name}” ใช่หรือไม่?`)) return;
    try {
      const response = await fetch(`http://localhost:5000/api/payment-methods/${method.id}?shop_id=${user.shop_id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ลบช่องทางการชำระเงินไม่สำเร็จ");
      setPaymentMethods(previous => previous.filter(item => item.id !== method.id));
      setOriginalPaymentMethods(previous => previous.filter(item => item.id !== method.id));
      showToast("ลบช่องทางการชำระเงินแล้ว", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    }
  };

  const handleNavigationRequest = (target: string) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(target);
      setShowUnsavedModal(true);
    } else {
      executeNavigation(target);
    }
  };

  const executeNavigation = (target: string) => {
    if (target.startsWith('tab:')) {
      setActiveTab(target.replace('tab:', ''));
      setIsEditing(false);
    } else {
      router.push(target);
    }
    setPendingNavigation(null);
    setShowUnsavedModal(false);
  };

  const handleCancelEdit = () => {
    setCurrentSettings(JSON.parse(JSON.stringify(originalSettings)));
    setPaymentMethods(JSON.parse(JSON.stringify(originalPaymentMethods)));
    setLogoPreview(originalSettings?.logo || null);
    setLogoFile(null);
    setIsEditing(false);
    setHasUnsavedChanges(false);
  };

  const handleSaveSettings = async () => {
    if (!currentSettings || !user) return;
    setIsSaving(true);
    try {
      let finalLogoUrl = currentSettings.logo;

      // 1. แปลงไฟล์รูปภาพเป็น Base64 แทนการอัปโหลดขึ้น Supabase Bucket (แก้ปัญหา Bucket not found)
      if (logoFile) {
        finalLogoUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(logoFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
      } else if (logoPreview === null) {
        finalLogoUrl = ''; // กรณีผู้ใช้กดลบโลโก้
      }

      const payloadSettings = { ...currentSettings, logo: finalLogoUrl };

      // 2. บันทึกข้อมูลการตั้งค่าไปที่ Backend
      const resSettings = await fetch(`http://localhost:5000/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: user.shop_id, data: payloadSettings }),
      });
      if (!resSettings.ok) throw new Error("ไม่สามารถบันทึกข้อมูลการตั้งค่าได้");

      // 3. บันทึกช่องทางการชำระเงิน (ถ้ามีการแก้ไข)
      const paymentMethodsChanged = JSON.stringify(paymentMethods) !== JSON.stringify(originalPaymentMethods);
      if (paymentMethodsChanged) {
        const resPayment = await fetch(`http://localhost:5000/api/payment-methods`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shop_id: user.shop_id, methods: paymentMethods }),
        });
        if (!resPayment.ok) throw new Error("ไม่สามารถบันทึกช่องทางการชำระเงินได้");
      }
      
      setCurrentSettings(payloadSettings);
      setOriginalSettings(JSON.parse(JSON.stringify(payloadSettings))); 
      setOriginalPaymentMethods(JSON.parse(JSON.stringify(paymentMethods)));
      setLogoFile(null);
      setIsEditing(false);
      setHasUnsavedChanges(false);
      showToast("บันทึกการตั้งค่าเรียบร้อยแล้ว", "success");
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSecurity = async (type: 'password' | 'pin') => {
    if (type === 'password' && securityForm.newPass !== securityForm.confirmPass) {
      return showToast("รหัสผ่านใหม่ไม่ตรงกัน", "error");
    }
    if (type === 'pin' && securityForm.newPin !== securityForm.confirmPin) {
      return showToast("รหัส PIN ใหม่ไม่ตรงกัน", "error");
    }

    setIsSaving(true);
    try {
      const endpoint = type === 'password' ? '/api/users/change-password' : '/api/users/change-pin';
      const payload = type === 'password' 
        ? { email: user?.email, oldPass: securityForm.oldPass, newPass: securityForm.newPass }
        : { email: user?.email, oldPin: securityForm.oldPin, newPin: securityForm.newPin };

      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");

      showToast(`เปลี่ยน${type === 'password' ? 'รหัสผ่าน' : 'รหัส PIN'}เรียบร้อยแล้ว`, "success");
      setSecurityForm({ oldPass: "", newPass: "", confirmPass: "", oldPin: "", newPin: "", confirmPin: "" });
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const role = user?.role || "cashier";
  const isOwner = role === "owner" || role === "เจ้าของร้าน";
  const isManager = role === "manager" || role === "ผู้จัดการ";
  const hasAccess = isOwner || isManager;
  
  const TABS = [
    { id: "shop", name: "ข้อมูลร้าน", icon: Store, allowed: isOwner },
    { id: "sales", name: "การขาย", icon: TrendingUp, allowed: hasAccess },
    { id: "receipt", name: "ใบเสร็จ", icon: Receipt, allowed: hasAccess },
    { id: "payment", name: "การชำระเงิน", icon: CreditCard, allowed: hasAccess },
    { id: "inventory", name: "สินค้าและคลังสินค้า", icon: Package, allowed: hasAccess },
    { id: "tax", name: "ภาษี", icon: FileText, allowed: isOwner },
    { id: "notifications", name: "การแจ้งเตือน", icon: Bell, allowed: hasAccess },
    { id: "security", name: "ความปลอดภัย", icon: ShieldCheck, allowed: true },
    { id: "hardware", name: "อุปกรณ์ POS", icon: MonitorSmartphone, allowed: hasAccess },
    { id: "system", name: "ระบบ", icon: Settings, allowed: isOwner },
  ];

  const latitude = Number(currentSettings?.latitude);
  const longitude = Number(currentSettings?.longitude);
  const hasMapLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
  const previewItemTotal = 100;
  const previewVatRate = Number(currentSettings?.vat_rate || 0);
  const previewVatEnabled = Boolean(currentSettings?.vat_enabled);
  const previewVatAmount = previewVatEnabled && previewVatRate > 0
    ? currentSettings?.prices_include_vat
      ? previewItemTotal * (previewVatRate / (100 + previewVatRate))
      : previewItemTotal * (previewVatRate / 100)
    : 0;
  const previewSubtotal = currentSettings?.prices_include_vat
    ? previewItemTotal - previewVatAmount
    : previewItemTotal;
  const previewTotal = currentSettings?.prices_include_vat
    ? previewItemTotal
    : previewItemTotal + previewVatAmount;

  const receiptPreview = currentSettings && (
    <div className="w-full max-w-[420px] rounded-[16px] bg-white p-6 text-[13px] text-gray-800 shadow-sm ring-1 ring-gray-200">
      <div className="mb-6 border-b border-gray-200 pb-5 text-center">
        {currentSettings.receipt_show_logo && logoPreview && <img src={logoPreview} alt="โลโก้ร้าน" className="mb-3 h-16 w-16 object-contain mx-auto" />}
        <div className="text-[20px] font-black">{currentSettings.shop_name || "-"}</div>
        <div className="mt-1 text-gray-500">สาขา: {currentSettings.branch_name || "-"}</div>
        <div className="mt-2 whitespace-pre-wrap text-[12px] text-gray-500">{currentSettings.address || "-"}</div>
        <div className="text-[12px] text-gray-500">โทร: {currentSettings.phone || "-"}</div>
        <div className="text-[12px] text-gray-500">Tax ID: {currentSettings.tax_id || "-"}</div>
      </div>

      <div className="mb-5 rounded-xl bg-gray-50 p-4 text-[12px]">
        <div className="flex justify-between"><span className="text-gray-500">เลขที่ใบเสร็จ</span><strong>{currentSettings.receipt_prefix}{currentSettings.receipt_start_number || "0001"}</strong></div>
        <div className="mt-2 flex justify-between"><span className="text-gray-500">ประเภท</span><span>ทานที่ร้าน</span></div>
        <div className="mt-2 flex justify-between"><span className="text-gray-500">สถานะ</span><span className="font-bold text-green-600">สำเร็จ</span></div>
      </div>

      <div className="mb-5">
        <h4 className="mb-3 border-b border-gray-200 pb-2 text-[15px] font-bold">รายการสินค้า</h4>
        <div className="flex justify-between">
          <div><div className="font-medium">สินค้าตัวอย่าง</div><div className="text-[12px] text-gray-500">1 x ฿100.00</div></div>
          <span className="font-bold">฿100.00</span>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-300 pt-4 text-[13px]">
        <div className="flex justify-between"><span className="text-gray-500">ยอดรวมก่อนส่วนลด</span><span>฿{previewSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        <div className="mt-2 flex justify-between"><span className="text-gray-500">ส่วนลดทั้งหมด</span><span className="text-red-500">- ฿0.00</span></div>
        {previewVatEnabled && <div className="mt-2 flex justify-between"><span className="text-gray-500">ภาษีมูลค่าเพิ่ม ({previewVatRate}%)</span><span>฿{previewVatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
        <div className="mt-4 flex justify-between text-[18px] font-black"><span>ยอดสุทธิ</span><span className="text-[#7a5c4e]">฿{previewTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
      </div>

      <div className="mt-5 rounded-xl bg-gray-50 p-4 text-[12px]">
        <h4 className="mb-2 font-bold">ข้อมูลการชำระเงิน</h4>
        <div className="flex justify-between"><span className="text-gray-500">ช่องทาง</span><span>เงินสด</span></div>
        <div className="mt-2 flex justify-between"><span className="text-gray-500">ยอดรับเงิน</span><span>฿{previewTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        <div className="mt-2 flex justify-between"><span className="text-gray-500">เงินทอน</span><span>฿0.00</span></div>
      </div>

      {currentSettings.receipt_footer && <div className="mt-5 border-t border-dashed border-gray-300 pt-4 text-center text-[12px] text-gray-500 whitespace-pre-wrap">{currentSettings.receipt_footer}</div>}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#d6d6d6] font-sans overflow-hidden text-gray-800">
      
      {/* Sidebar Standard POS */}
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
            <button onClick={() => router.push('/pos/employees')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">พนักงาน</button>
            <button className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">การตั้งค่า</button>
          </nav>
        </div>
        <button onClick={() => { localStorage.removeItem("userContext"); router.push('/pin'); }} className="py-6 px-6 text-left text-gray-300 border-t border-[#666666] hover:bg-[#666666] transition-colors text-[16px]">กลับสู่หน้า PIN</button>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header */}
        <div className="h-[90px] bg-[#f5f6f8] flex items-center justify-between z-10 shrink-0 w-full px-8 border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-[22px] font-bold text-gray-800">การตั้งค่า</h2>
              <p className="text-[14px] text-gray-500">จัดการระบบร้านค้าและการดำเนินงาน</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm">
             <div className="flex flex-col text-right">
                <span className="text-[14px] font-bold text-gray-800">{user?.name || "ผู้ใช้งาน"}</span>
                <span className="text-[12px] text-gray-500 uppercase">{user?.role}</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-[#7a5c4e] text-white flex items-center justify-center font-bold">
               {user?.name?.charAt(0) || "U"}
             </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          {/* Inner Sidebar */}
          <div className="w-[260px] bg-white rounded-[20px] shadow-sm border border-gray-200 p-2 shrink-0 flex flex-col overflow-y-auto no-scrollbar">
             {TABS.map((tab) => {
               if (!tab.allowed) return null;
               const Icon = tab.icon;
               const isActive = activeTab === tab.id;
               return (
                 <button
                   key={tab.id}
                   onClick={() => handleNavigationRequest(`tab:${tab.id}`)}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 mb-1 rounded-[12px] text-[15px] font-medium transition-colors ${
                     isActive 
                       ? "bg-[#7a5c4e] text-white shadow-sm" 
                       : "text-slate-600 hover:bg-gray-50 hover:text-slate-900"
                   }`}
                 >
                   <Icon className="w-5 h-5" />
                   <span>{tab.name}</span>
                 </button>
               );
             })}
          </div>

          {/* Setting Panel */}
          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            {errorMsg ? (
               <div className="flex items-center justify-center h-full">
                 <div className="bg-white p-8 rounded-[24px] border border-gray-200 shadow-sm flex flex-col items-center max-w-sm text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-xl font-bold text-gray-800 mb-2">เกิดข้อผิดพลาด</h3>
                    <p className="text-gray-500 mb-6">{errorMsg}</p>
                    <button onClick={() => fetchSettings(user?.shop_id || 1)} className="px-8 py-3 bg-[#7a5c4e] text-white rounded-xl font-bold text-[16px] hover:bg-[#684c3f]">ลองอีกครั้ง</button>
                 </div>
               </div>
            ) : isLoading || !currentSettings ? (
               <div className="flex items-center justify-center h-full">
                 <div className="flex flex-col items-center text-gray-400">
                   <RefreshCw className="w-10 h-10 animate-spin mb-4 text-[#7a5c4e]" />
                   <p className="text-[18px] font-medium">กำลังโหลดข้อมูล...</p>
                 </div>
               </div>
            ) : (
              <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm flex flex-col min-h-full">
                  
                  {activeTab !== 'security' && (
                    <div className="bg-gray-50 border-b border-gray-100 px-8 py-5 flex justify-between items-center rounded-t-[24px] shrink-0">
                      <h3 className="text-[18px] font-bold text-gray-800">
                        {TABS.find(t => t.id === activeTab)?.name}
                      </h3>
                      {!isEditing ? (
                        <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-[15px] hover:bg-gray-50 shadow-sm transition-all">
                           <Edit3 className="w-4 h-4" /> แก้ไขข้อมูล
                        </button>
                      ) : (
                        <div className="flex gap-3">
                           <button onClick={handleCancelEdit} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-[15px] hover:bg-gray-50 disabled:opacity-50 transition-all">
                             <X className="w-4 h-4" /> ยกเลิก
                           </button>
                           <button onClick={handleSaveSettings} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-[#7a5c4e] text-white rounded-xl font-bold text-[15px] hover:bg-[#684c3f] shadow-sm disabled:opacity-50 transition-all">
                             {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                             {isSaving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                           </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-8 flex-1">

                    {/* ข้อมูลร้าน */}
                    {activeTab === 'shop' && (
                      <div className="grid grid-cols-2 gap-6 max-w-3xl">
                        {/* อัปโหลดโลโก้ */}
                        <div className="col-span-2 flex items-center gap-6 mb-4">
                          <div className="w-24 h-24 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                            {logoPreview ? (
                              <img src={logoPreview} alt="Shop Logo" className="w-full h-full object-cover" />
                            ) : (
                              <Store className="w-10 h-10 text-gray-300" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-[15px] font-bold text-gray-800 mb-2">โลโก้ร้าน</h4>
                            <div className="flex gap-3">
                              <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-bold transition-colors ${!isEditing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer shadow-sm'}`}>
                                <Upload className="w-4 h-4" /> อัปโหลดรูปภาพ
                                <input type="file" disabled={!isEditing} onChange={handleLogoSelect} className="hidden" accept="image/png, image/jpeg, image/webp" />
                              </label>
                              {logoPreview && isEditing && (
                                <button onClick={handleRemoveLogo} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-[14px] hover:bg-red-100 flex items-center gap-2">
                                  <Trash2 className="w-4 h-4" /> ลบรูป
                                </button>
                              )}
                            </div>
                            <p className="text-[12px] text-gray-500 mt-2">รองรับ JPG, PNG, WEBP ขนาดไม่เกิน 2MB</p>
                          </div>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-[15px] font-bold text-gray-700 mb-2">ชื่อร้าน</label>
                          <input type="text" disabled={!isEditing} value={currentSettings.shop_name} onChange={(e) => handleChange('shop_name', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] disabled:bg-gray-50 disabled:text-gray-500 text-[15px]" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[15px] font-bold text-gray-700 mb-2">ชื่อสาขา</label>
                          <input type="text" disabled={!isEditing} value={currentSettings.branch_name} onChange={(e) => handleChange('branch_name', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] disabled:bg-gray-50 disabled:text-gray-500 text-[15px]" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[15px] font-bold text-gray-700 mb-2">ที่อยู่</label>
                          <textarea disabled={!isEditing} value={currentSettings.address} onChange={(e) => handleChange('address', e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] disabled:bg-gray-50 disabled:text-gray-500 text-[15px]" />
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <button type="button" disabled={!isEditing || isFindingAddress} onClick={handleFindAddress} className="flex items-center gap-2 rounded-xl bg-[#7a5c4e] px-4 py-2.5 text-[14px] font-bold text-white hover:bg-[#684c3f] disabled:cursor-not-allowed disabled:opacity-50">
                              {isFindingAddress ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                              {isFindingAddress ? "กำลังค้นหาตำแหน่ง..." : "ค้นหาตำแหน่งจากที่อยู่"}
                            </button>
                            {hasMapLocation && <span className="text-[12px] text-green-600">พบพิกัดแล้ว กดบันทึกเพื่อใช้งานจริง</span>}
                          </div>
                          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                            <InteractiveShopMap
                              latitude={hasMapLocation ? latitude : undefined}
                              longitude={hasMapLocation ? longitude : undefined}
                              editable={isEditing}
                              onLocationChange={(nextLatitude, nextLongitude) => {
                                setCurrentSettings(prev => prev ? ({ ...prev, latitude: nextLatitude, longitude: nextLongitude }) : prev);
                                setHasUnsavedChanges(true);
                              }}
                            />
                            <div className="flex items-center justify-between gap-3 px-4 py-3 text-[12px] text-gray-500">
                              {hasMapLocation ? (
                                <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-[#7a5c4e]" /> {latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
                              ) : (
                                <span>กดแก้ไข แล้วคลิกบนแผนที่เพื่อเลือกตำแหน่งร้าน</span>
                              )}
                              {hasMapLocation && <a href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`} target="_blank" rel="noreferrer" className="font-bold text-[#7a5c4e] hover:underline">เปิดแผนที่ขนาดใหญ่</a>}
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[15px] font-bold text-gray-700 mb-2">เบอร์โทรศัพท์</label>
                          <input type="text" disabled={!isEditing} value={currentSettings.phone} onChange={(e) => handleChange('phone', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] disabled:bg-gray-50 disabled:text-gray-500 text-[15px]" />
                        </div>
                        <div>
                          <label className="block text-[15px] font-bold text-gray-700 mb-2">เลขประจำตัวผู้เสียภาษี</label>
                          <input type="text" disabled={!isEditing} value={currentSettings.tax_id} onChange={(e) => handleChange('tax_id', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] disabled:bg-gray-50 disabled:text-gray-500 text-[15px]" />
                        </div>
                      </div>
                    )}

                    {/* การขาย */}
                    {activeTab === 'sales' && (
                      <div className="space-y-4 max-w-3xl">
                        {[
                          { key: 'allow_negative_stock', label: 'อนุญาตขายสินค้าเมื่อ Stock ติดลบ' },
                          { key: 'auto_deduct_stock', label: 'ตัด Stock อัตโนมัติเมื่อทำรายการสำเร็จ' },
                          { key: 'allow_price_override', label: 'อนุญาตแก้ไขราคาสินค้าขณะขาย' },
                          { key: 'allow_discounts', label: 'อนุญาตส่วนลดท้ายบิล' },
                          { key: 'require_reason_delete_item', label: 'ต้องระบุเหตุผลเมื่อลบสินค้าออกจากตะกร้า' },
                          { key: 'require_reason_cancel_bill', label: 'ต้องระบุเหตุผลเมื่อยกเลิกบิล' },
                          { key: 'auto_print_receipt', label: 'พิมพ์ใบเสร็จอัตโนมัติ' },
                          { key: 'enable_e_receipt', label: 'สร้างใบเสร็จอิเล็กทรอนิกส์ (E-Receipt)' },
                        ].map((item) => (
                          <div key={item.key} className={`flex items-center justify-between p-4 rounded-[16px] border ${isEditing ? 'border-gray-300 hover:bg-gray-50' : 'border-gray-100 bg-gray-50 opacity-80'}`}>
                            <span className="font-bold text-[15px] text-gray-800">{item.label}</span>
                            <input type="checkbox" disabled={!isEditing} checked={(currentSettings as any)[item.key]} onChange={(e) => handleChange(item.key as keyof ShopSettings, e.target.checked)} className="w-5 h-5 accent-[#7a5c4e] cursor-pointer" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ใบเสร็จ */}
                    {activeTab === 'receipt' && (
                       <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(320px,1fr)_420px]">
                         <div className="space-y-5">
                            <div>
                               <label className="block text-[15px] font-bold text-gray-700 mb-2">ชื่อร้านบนใบเสร็จ</label>
                               <input type="text" disabled={!isEditing} value={currentSettings.shop_name} onChange={(e) => handleChange('shop_name', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl disabled:bg-gray-50 text-[15px] outline-none focus:border-[#7a5c4e]" />
                            </div>
                             <div className="flex items-center justify-between p-4 rounded-[16px] border border-gray-200">
                               <span className="font-bold text-[15px] text-gray-800">แสดงโลโก้บนใบเสร็จ</span>
                               <input type="checkbox" disabled={!isEditing} checked={currentSettings.receipt_show_logo} onChange={(e) => handleChange('receipt_show_logo', e.target.checked)} className="w-5 h-5 accent-[#7a5c4e] cursor-pointer" />
                             </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div>
                                  <label className="block text-[15px] font-bold text-gray-700 mb-2">Prefix เลขที่ใบเสร็จ</label>
                                  <input type="text" disabled={!isEditing} value={currentSettings.receipt_prefix} onChange={(e) => handleChange('receipt_prefix', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl disabled:bg-gray-50 text-[15px] outline-none focus:border-[#7a5c4e]" />
                               </div>
                               <div>
                                  <label className="block text-[15px] font-bold text-gray-700 mb-2">เลขเริ่มต้น</label>
                                  <input type="text" disabled={!isEditing} value={currentSettings.receipt_start_number} onChange={(e) => handleChange('receipt_start_number', e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl disabled:bg-gray-50 text-[15px] outline-none focus:border-[#7a5c4e]" />
                               </div>
                            </div>
                            <div>
                               <label className="block text-[15px] font-bold text-gray-700 mb-2">ข้อความท้ายใบเสร็จ</label>
                               <textarea disabled={!isEditing} value={currentSettings.receipt_footer} onChange={(e) => handleChange('receipt_footer', e.target.value)} rows={3} className="w-full px-4 py-3 border border-gray-200 rounded-xl disabled:bg-gray-50 text-[15px] outline-none focus:border-[#7a5c4e]" />
                            </div>
                         </div>
                         {/* Receipt Preview */}
                         <div className="min-w-0 rounded-[20px] border border-gray-200 bg-gray-50 p-5 xl:sticky xl:top-4">
                           <div className="mb-4 flex items-center justify-between">
                             <div>
                               <p className="text-[16px] font-bold text-gray-800">ตัวอย่างใบเสร็จ</p>
                               <p className="mt-1 text-[12px] text-gray-500">แสดงผลเหมือนใบเสร็จจากประวัติ</p>
                             </div>
                             <button type="button" onClick={() => setShowReceiptPreview(true)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[12px] font-bold text-gray-700 hover:bg-gray-100">ดูเต็มจอ</button>
                           </div>
                           <div className="max-h-[560px] overflow-x-hidden overflow-y-auto rounded-xl">{receiptPreview}</div>
                         </div>
                      </div>
                    )}

                    {/* การชำระเงิน (Database Data Driven) */}
                    {activeTab === 'payment' && (
                      <div className="max-w-3xl">
                        <div className="mb-4 text-[14px] text-gray-500 bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-2">
                           <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                           <p>กำหนดช่องทางการชำระเงินที่ต้องการแสดงในหน้า POS สามารถเปิด-ปิด และจัดเรียงลำดับได้ ข้อมูลนี้จะถูกบันทึกลงในบิลขายจริง</p>
                        </div>
                        {isEditing && (
                          <div className="mb-5 rounded-[16px] border border-gray-200 bg-gray-50 p-4">
                            <p className="mb-3 text-[14px] font-bold text-gray-800">เพิ่มช่องทางการชำระเงิน</p>
                            <div className="flex flex-col gap-3 sm:flex-row">
                              <input value={newPaymentMethod.name} onChange={(event) => setNewPaymentMethod({ ...newPaymentMethod, name: event.target.value })} placeholder="เช่น TrueMoney, GrabPay" className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-[14px] outline-none focus:border-[#7a5c4e]" />
                              <select value={newPaymentMethod.type} onChange={(event) => setNewPaymentMethod({ ...newPaymentMethod, type: event.target.value })} className="rounded-xl border border-gray-300 px-4 py-3 text-[14px] outline-none focus:border-[#7a5c4e]">
                                <option value="OTHER">ทั่วไป</option>
                                <option value="QR">QR / E-Wallet</option>
                                <option value="TRANSFER">โอนเงิน</option>
                                <option value="CARD">บัตร</option>
                              </select>
                              <button type="button" onClick={handleAddPaymentMethod} disabled={isAddingPaymentMethod} className="rounded-xl bg-[#7a5c4e] px-5 py-3 text-[14px] font-bold text-white disabled:opacity-50">เพิ่ม</button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          {paymentMethods.map((method, index) => (
                            <div key={method.id} className={`flex items-center justify-between p-4 rounded-[16px] border ${isEditing ? 'border-gray-300 bg-white' : 'border-gray-100 bg-gray-50 opacity-80'}`}>
                              <div className="flex items-center gap-4">
                                 <div className="flex flex-col gap-1">
                                   <button disabled={!isEditing || index === 0} onClick={() => handleMovePayment(index, -1)} className="text-gray-400 hover:text-gray-800 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                                   <button disabled={!isEditing || index === paymentMethods.length - 1} onClick={() => handleMovePayment(index, 1)} className="text-gray-400 hover:text-gray-800 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                                 </div>
                                 <span className={`font-bold text-[15px] ${method.is_enabled ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{method.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <input type="checkbox" disabled={!isEditing} checked={method.is_enabled} onChange={() => handleTogglePayment(index)} className="w-5 h-5 accent-[#7a5c4e] cursor-pointer" />
                                {isEditing && <button type="button" onClick={() => handleDeletePaymentMethod(method)} className="text-gray-400 hover:text-red-500" title="ลบช่องทาง"><Trash2 className="h-4 w-4" /></button>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* สินค้าและคลังสินค้า */}
                    {activeTab === 'inventory' && (
                      <div className="space-y-6 max-w-3xl">
                         <div className="flex items-center justify-between p-4 rounded-[16px] border border-gray-200">
                           <span className="font-bold text-[15px] text-gray-800">แจ้งเตือนสินค้าใกล้หมด (Low Stock Alert)</span>
                           <input type="checkbox" disabled={!isEditing} checked={currentSettings.alert_low_stock} onChange={(e) => handleChange('alert_low_stock', e.target.checked)} className="w-5 h-5 accent-[#7a5c4e] cursor-pointer" />
                         </div>
                         {currentSettings.alert_low_stock && (
                            <div className="p-6 bg-gray-50 rounded-[16px] border border-gray-200">
                               <label className="block text-[15px] font-bold text-gray-700 mb-2">จำนวน Stock ขั้นต่ำที่ต้องการแจ้งเตือน</label>
                               <input type="number" disabled={!isEditing} value={currentSettings.low_stock_threshold} onChange={(e) => handleChange('low_stock_threshold', Number(e.target.value))} className="w-48 px-4 py-3 border border-gray-200 rounded-xl disabled:bg-gray-100 text-[15px] font-bold outline-none focus:border-[#7a5c4e]" />
                            </div>
                         )}
                      </div>
                    )}

                    {/* ภาษี */}
                    {activeTab === 'tax' && (
                      <div className="space-y-6 max-w-3xl">
                         <div className="flex items-center justify-between p-4 rounded-[16px] border border-gray-200">
                             <span className="font-bold text-[15px] text-gray-800">เปิดใช้งานระบบภาษีมูลค่าเพิ่ม (VAT)</span>
                             <input type="checkbox" disabled={!isEditing} checked={currentSettings.vat_enabled} onChange={(e) => handleChange('vat_enabled', e.target.checked)} className="w-5 h-5 accent-[#7a5c4e] cursor-pointer" />
                         </div>
                         {currentSettings.vat_enabled && (
                           <div className="grid grid-cols-2 gap-6 p-6 bg-gray-50 rounded-[16px] border border-gray-200">
                              <div>
                                <label className="block text-[15px] font-bold text-gray-700 mb-2">อัตราภาษี (VAT Rate %)</label>
                                <input type="number" disabled={!isEditing} value={currentSettings.vat_rate} onChange={(e) => handleChange('vat_rate', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] disabled:bg-gray-100 text-[15px]" />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[15px] font-bold text-gray-700 mb-3">รูปแบบการคำนวณภาษี</label>
                                <div className="flex gap-6">
                                  <label className="flex items-center gap-2 cursor-pointer text-[15px]">
                                    <input type="radio" disabled={!isEditing} checked={currentSettings.prices_include_vat === true} onChange={() => handleChange('prices_include_vat', true)} className="accent-[#7a5c4e]" />
                                    <span>ราคาสินค้ารวม VAT แล้ว (Inclusive)</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer text-[15px]">
                                    <input type="radio" disabled={!isEditing} checked={currentSettings.prices_include_vat === false} onChange={() => handleChange('prices_include_vat', false)} className="accent-[#7a5c4e]" />
                                    <span>ราคาสินค้ายังไม่รวม VAT (Exclusive)</span>
                                  </label>
                                </div>
                              </div>
                           </div>
                         )}
                      </div>
                    )}

                    {/* การแจ้งเตือน */}
                    {activeTab === 'notifications' && (
                      <div className="space-y-4 max-w-3xl">
                        {[
                          { key: 'notify_low_stock', label: 'แจ้งเตือนเมื่อสินค้าใกล้หมด' },
                          { key: 'notify_out_of_stock', label: 'แจ้งเตือนเมื่อสินค้าหมด' },
                          { key: 'notify_refund', label: 'แจ้งเตือนเมื่อมีการคืนสินค้า' },
                          { key: 'notify_cancel_bill', label: 'แจ้งเตือนเมื่อมีการยกเลิกบิล' },
                          { key: 'notify_stock_adjust', label: 'แจ้งเตือนเมื่อปรับ Stock แมนนวล' },
                        ].map((item) => (
                          <div key={item.key} className={`flex items-center justify-between p-4 rounded-[16px] border ${isEditing ? 'border-gray-300 hover:bg-gray-50' : 'border-gray-100 bg-gray-50 opacity-80'}`}>
                            <span className="font-bold text-[15px] text-gray-800">{item.label}</span>
                            <input type="checkbox" disabled={!isEditing} checked={(currentSettings as any)[item.key]} onChange={(e) => handleChange(item.key as keyof ShopSettings, e.target.checked)} className="w-5 h-5 accent-[#7a5c4e] cursor-pointer" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* อุปกรณ์ POS */}
                    {activeTab === 'hardware' && (
                      <div className="grid grid-cols-1 gap-6 max-w-3xl">
                         <div>
                          <label className="block text-[15px] font-bold text-gray-700 mb-2">เครื่องพิมพ์ใบเสร็จ (Receipt Printer)</label>
                          <select disabled={!isEditing} value={currentSettings.hardware_printer_type} onChange={(e) => handleChange('hardware_printer_type', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none disabled:bg-gray-50 text-[15px] cursor-pointer">
                             <option value="none">ไม่เชื่อมต่อ</option>
                             <option value="usb_58mm">USB Printer (58mm)</option>
                             <option value="usb_80mm">USB Printer (80mm)</option>
                          </select>
                         </div>
                         <div className="flex items-center justify-between p-4 rounded-[16px] border border-gray-200">
                           <span className="font-bold text-[15px] text-gray-800">ลิ้นชักเก็บเงิน (Cash Drawer)</span>
                           <input type="checkbox" disabled={!isEditing} checked={currentSettings.hardware_cash_drawer} onChange={(e) => handleChange('hardware_cash_drawer', e.target.checked)} className="w-5 h-5 accent-[#7a5c4e] cursor-pointer" />
                         </div>
                         <div className="flex items-center justify-between p-4 rounded-[16px] border border-gray-200">
                           <span className="font-bold text-[15px] text-gray-800">เครื่องสแกนบาร์โค้ด (Barcode Scanner)</span>
                           <input type="checkbox" disabled={!isEditing} checked={currentSettings.hardware_barcode_scanner} onChange={(e) => handleChange('hardware_barcode_scanner', e.target.checked)} className="w-5 h-5 accent-[#7a5c4e] cursor-pointer" />
                         </div>
                      </div>
                    )}

                    {/* ระบบ (กำหนดให้เข้ากับไทย 100%) */}
                    {activeTab === 'system' && (
                      <div className="grid grid-cols-2 gap-6 max-w-3xl">
                        <div className="col-span-2 mb-2 text-[14px] text-gray-500 bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-2">
                           <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                           <p>การตั้งค่าระบบพื้นฐานถูกผูกกับมาตรฐานการใช้งานในประเทศไทยโดยอัตโนมัติ เพื่อให้ระบบหลังบ้านคำนวณรายได้และภาษีได้ตรงกันทั้งหมด</p>
                        </div>
                        <div>
                          <label className="block text-[15px] font-bold text-gray-700 mb-2">ภาษา (Language)</label>
                          <input type="text" disabled value="ภาษาไทย" className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-[15px]" />
                        </div>
                        <div>
                          <label className="block text-[15px] font-bold text-gray-700 mb-2">สกุลเงิน (Currency)</label>
                          <input type="text" disabled value="THB (บาท)" className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-[15px]" />
                        </div>
                        <div>
                          <label className="block text-[15px] font-bold text-gray-700 mb-2">เขตเวลา (Timezone)</label>
                          <select disabled={!isEditing} value={currentSettings.timezone} onChange={(e) => handleChange('timezone', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none disabled:bg-gray-50 text-[15px] cursor-pointer">
                            <option value="auto">ใช้เขตเวลาของเครื่อง</option>
                            <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
                            <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                            <option value="Europe/London">Europe/London</option>
                            <option value="America/New_York">America/New_York</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[15px] font-bold text-gray-700 mb-2">รูปแบบวันที่</label>
                          <select disabled={!isEditing} value={currentSettings.date_format} onChange={(e) => handleChange('date_format', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none disabled:bg-gray-50 text-[15px] cursor-pointer">
                             <option value="DD/MM/YYYY">DD/MM/YYYY (เช่น 14/08/2026)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* ความปลอดภัย */}
                    {activeTab === 'security' && (
                      <div className="space-y-6 max-w-3xl">
                         <div className="bg-gray-50 border-b border-gray-100 px-8 py-5 flex justify-between items-center rounded-[24px] mb-6">
                            <h3 className="text-[18px] font-bold text-gray-800">ความปลอดภัยและรหัสผ่าน</h3>
                         </div>
                         <div className="p-8 bg-white rounded-[24px] border border-gray-200 shadow-sm space-y-4">
                            <h4 className="font-bold text-[15px] text-gray-800">เปลี่ยน Password (รหัสผ่านเข้าสู่ระบบ)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                               <input type="password" placeholder="รหัสปัจจุบัน" value={securityForm.oldPass} onChange={(e) => setSecurityForm({...securityForm, oldPass: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl text-[15px] outline-none focus:border-[#7a5c4e]" />
                               <input type="password" placeholder="รหัสใหม่" value={securityForm.newPass} onChange={(e) => setSecurityForm({...securityForm, newPass: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl text-[15px] outline-none focus:border-[#7a5c4e]" />
                               <input type="password" placeholder="ยืนยันรหัสใหม่" value={securityForm.confirmPass} onChange={(e) => setSecurityForm({...securityForm, confirmPass: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl text-[15px] outline-none focus:border-[#7a5c4e]" />
                            </div>
                            <button onClick={() => handleUpdateSecurity('password')} disabled={!securityForm.oldPass || !securityForm.newPass || isSaving} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-[15px] hover:bg-gray-50 disabled:opacity-50 mt-2 transition-colors">อัปเดต Password</button>
                         </div>
                         <div className="p-8 bg-white rounded-[24px] border border-gray-200 shadow-sm space-y-4">
                            <h4 className="font-bold text-[15px] text-gray-800">เปลี่ยน PIN ประจำตัว</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                               <input type="password" maxLength={6} placeholder="PIN เดิม" value={securityForm.oldPin} onChange={(e) => setSecurityForm({...securityForm, oldPin: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl text-[15px] text-center font-mono outline-none focus:border-[#7a5c4e]" />
                               <input type="password" maxLength={6} placeholder="PIN ใหม่" value={securityForm.newPin} onChange={(e) => setSecurityForm({...securityForm, newPin: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl text-[15px] text-center font-mono outline-none focus:border-[#7a5c4e]" />
                               <input type="password" maxLength={6} placeholder="ยืนยัน PIN ใหม่" value={securityForm.confirmPin} onChange={(e) => setSecurityForm({...securityForm, confirmPin: e.target.value})} className="px-4 py-3 border border-gray-200 rounded-xl text-[15px] text-center font-mono outline-none focus:border-[#7a5c4e]" />
                            </div>
                            <button onClick={() => handleUpdateSecurity('pin')} disabled={!securityForm.oldPin || !securityForm.newPin || isSaving} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-[15px] hover:bg-gray-50 disabled:opacity-50 mt-2 transition-colors">อัปเดต PIN</button>
                         </div>
                      </div>
                    )}

                  </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showReceiptPreview && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowReceiptPreview(false)}>
          <div className="w-full max-w-[560px] max-h-[90vh] overflow-x-hidden overflow-y-auto rounded-[24px] bg-gray-100 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[20px] font-bold text-gray-800">ตัวอย่างใบเสร็จ</h3>
              <button type="button" onClick={() => setShowReceiptPreview(false)} className="w-9 h-9 rounded-full bg-white text-gray-500 hover:bg-gray-200 flex items-center justify-center" aria-label="ปิดตัวอย่างใบเสร็จ">
                <X className="w-5 h-5" />
              </button>
            </div>
            {receiptPreview}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-10 right-10 px-6 py-4 rounded-xl shadow-lg font-bold text-[15px] text-white transition-all z-[100] animate-in fade-in slide-in-from-top-5 ${toast.type === 'success' ? 'bg-[#7a5c4e]' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Unsaved Changes Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center">
          <div className="bg-white rounded-[24px] w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-[20px] font-bold text-gray-800 mb-2">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</h3>
            <p className="text-[15px] text-gray-600 mb-8">คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowUnsavedModal(false); setPendingNavigation(null); }} className="px-5 py-2.5 bg-white border border-gray-300 rounded-xl font-bold text-[15px] text-gray-700 hover:bg-gray-50 transition-colors">
                อยู่ต่อ
              </button>
              <button onClick={() => { 
                handleCancelEdit(); 
                if (pendingNavigation) executeNavigation(pendingNavigation);
              }} className="px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold text-[15px] hover:bg-red-100 transition-colors">
                ออกโดยไม่บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}