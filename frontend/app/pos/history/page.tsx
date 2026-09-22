"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from "../../components/NotificationBell";
import UnifiedDateRangePicker, { DateRangeValue, getTodayIso } from "../../components/UnifiedDateRangePicker";
import { 
  Search, 
  RefreshCw, 
  AlertCircle, 
  X, 
  Printer,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Lock,
  Edit3,
  Save
} from "lucide-react";

// ดึง Timezone อัตโนมัติจากคอมพิวเตอร์
const getSystemTimeZone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

const formatDateKey = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

// ฟังก์ชันแปลงเวลาแบบ Dynamic (รับค่า Timezone จาก Settings)
const formatDynamicTime = (dateString: string, timeZone: string) => {
  if (!dateString) return "-";
  const validDateString = dateString.includes('Z') || dateString.includes('+') ? dateString : `${dateString}Z`;
  const date = new Date(validDateString);
  
  return date.toLocaleString('th-TH', { 
    timeZone: timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [dateSelection, setDateSelection] = useState<DateRangeValue>(() => {
    const today = getTodayIso();
    return { mode: "range", startDate: today, endDate: today, period: "วันนี้" };
  });
  const [statusFilter, setStatusFilter] = useState("ทั้งหมด");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [currentShopTimezone, setCurrentShopTimezone] = useState<string>("auto");
  const [currentReceiptSettings, setCurrentReceiptSettings] = useState<any>(null);

  // States สำหรับ Modal ยืนยันการ Void (ยกเลิกบิล)
  const [voidModal, setVoidModal] = useState({ show: false, receiptId: null, receiptNo: "" });
  const [voidPin, setVoidPin] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);

  // States สำหรับ Modal แก้ไขบิล (Edit Bill)
  const [editAuthModal, setEditAuthModal] = useState({ show: false, receiptId: null, receiptNo: "" });
  const [editDataModal, setEditDataModal] = useState(false);
  const [editPin, setEditPin] = useState("");
  const [editForm, setEditForm] = useState({ payment_method: "", order_type: "" });
  const [isEditing, setIsEditing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("userContext") || "{}");
    if (!savedUser || Object.keys(savedUser).length === 0) {
      router.push("/pin");
      return;
    }
    setUser(savedUser);

    fetch(`http://localhost:5000/api/payment-methods?shop_id=${savedUser.shop_id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPaymentMethods(data.filter(m => m.is_enabled));
      });
  }, [router]);

  const fetchReceipts = useCallback(async () => {
    if (!user?.shop_id) return;
    setLoading(true);
    setError(null);
    try {
      // โหลดการตั้งค่าร้านและประวัติบิลมาพร้อมกัน
      const [settingsRes, ordersRes] = await Promise.all([
        fetch(`http://localhost:5000/api/settings?shop_id=${user.shop_id}`),
        fetch(`http://localhost:5000/api/orders?shop_id=${user.shop_id}`)
      ]);
      
      if (!ordersRes.ok) throw new Error("ไม่สามารถโหลดประวัติใบเสร็จได้");
      
      const settingsData = await settingsRes.json();
      const data = await ordersRes.json();
      setCurrentReceiptSettings(settingsData);
      
      // ตรวจสอบ Timezone: ถ้าตั้งเป็น auto ให้ดึงจากเครื่องคอมพิวเตอร์
      const activeTz = (!settingsData.timezone || settingsData.timezone === "auto") 
        ? getSystemTimeZone() 
        : settingsData.timezone;
        
      setCurrentShopTimezone(activeTz);
      
      let filteredData = data;
      
      if (searchQuery) {
          filteredData = filteredData.filter((order: any) => 
             order.bill_number?.toLowerCase().includes(searchQuery.toLowerCase())
          );
      }

      if (statusFilter !== "ทั้งหมด") {
          const mappedStatus = statusFilter === 'สำเร็จ' ? 'completed' : statusFilter === 'ยกเลิก' ? 'cancelled' : 'refunded';
          filteredData = filteredData.filter((order: any) => order.status === mappedStatus);
      }

      const now = new Date();
      filteredData = filteredData.filter((order: any) => {
          if (!order.created_at) return false;
          
          const validDateString = order.created_at.includes('Z') || order.created_at.includes('+') ? order.created_at : `${order.created_at}Z`;
          const orderDate = new Date(validDateString);

          // แปลงวันที่ตาม Timezone ของร้าน/เครื่องคอมพิวเตอร์
          const todayString = formatDateKey(now, activeTz);
          const orderDateString = formatDateKey(orderDate, activeTz);

          if (dateSelection.period === "ทั้งหมด") return true;
          if (dateSelection.period === "วันนี้") return orderDateString === todayString;
          else if (dateSelection.period === "เมื่อวาน") {
              const yesterday = new Date(new Date(now.toLocaleString('en-US', { timeZone: activeTz })));
              yesterday.setDate(yesterday.getDate() - 1);
              return orderDateString === formatDateKey(yesterday, activeTz);
          } else if (dateSelection.period === "7 วันที่ผ่านมา") {
              const sevenDaysAgo = new Date(now);
              sevenDaysAgo.setDate(now.getDate() - 7);
              return orderDate >= sevenDaysAgo;
          } else if (dateSelection.period === "30 วันที่ผ่านมา") {
              const thirtyDaysAgo = new Date(now);
              thirtyDaysAgo.setDate(now.getDate() - 30);
              return orderDate >= thirtyDaysAgo;
            } else {
              return orderDateString >= dateSelection.startDate && orderDateString <= dateSelection.endDate;
          }
      });

      const formattedReceipts = filteredData.map((order: any) => ({
        id: order.id,
        receiptNo: order.bill_number || "-",
        dateTime: formatDynamicTime(order.created_at, activeTz), // ใช้เวลาที่กำหนดแล้ว
        customerName: 'ลูกค้าทั่วไป', 
        paymentMethod: order.payment_method || 'เงินสด',
        netTotal: Number(order.total_amount) || 0,
        status: order.status === 'completed' ? 'สำเร็จ' : order.status === 'cancelled' ? 'ยกเลิก' : (order.status || 'สำเร็จ')
      }));

      formattedReceipts.sort((a: any, b: any) => b.id - a.id);

      setReceipts(formattedReceipts);
      setTotalPages(Math.ceil(formattedReceipts.length / ITEMS_PER_PAGE) || 1);
      setCurrentPage(1);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery, statusFilter, dateSelection]); 

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleViewDetail = async (receiptId: string) => {
    setDetailLoading(true);
    try {
      const resOrder = await fetch(`http://localhost:5000/api/orders/single/${receiptId}?shop_id=${user?.shop_id}`);
      if (!resOrder.ok) throw new Error("ไม่สามารถโหลดข้อมูลบิลได้");
      const orderData = await resOrder.json();

      const [resItems, resSettings] = await Promise.all([
        fetch(`http://localhost:5000/api/orders/${receiptId}/items`),
        fetch(`http://localhost:5000/api/settings?shop_id=${user?.shop_id}`)
      ]);
      const itemsData = resItems.ok ? await resItems.json() : [];
      const latestSettings = resSettings.ok ? await resSettings.json() : currentReceiptSettings || {};
      const receiptSettings = orderData.receipt_settings || {};
      const displaySettings = {
        ...receiptSettings,
        ...latestSettings
      };
      const hasCurrentSettings = Boolean(resSettings.ok || currentReceiptSettings);
      const vatEnabled = hasCurrentSettings
        ? displaySettings.vat_enabled === true || displaySettings.vat_enabled === 'true'
        : receiptSettings.receipt_vat_enabled === true || receiptSettings.vat_enabled === true;
      const vatRate = Number(hasCurrentSettings ? displaySettings.vat_rate : (receiptSettings.receipt_vat_rate ?? receiptSettings.vat_rate ?? 0));
      const receiptTotal = Number(receiptSettings.receipt_total_amount ?? orderData.total_amount);
      const pricesIncludeVat = hasCurrentSettings
        ? displaySettings.prices_include_vat !== false && displaySettings.prices_include_vat !== 'false'
        : receiptSettings.receipt_prices_include_vat ?? receiptSettings.prices_include_vat ?? true;
      const vatAmount = !hasCurrentSettings && receiptSettings.receipt_vat_amount !== undefined
        ? Number(receiptSettings.receipt_vat_amount)
        : vatEnabled && vatRate > 0
          ? pricesIncludeVat ? receiptTotal * (vatRate / (100 + vatRate)) : receiptTotal - (receiptTotal / (1 + vatRate / 100))
          : 0;
      const subtotalExcludingVat = !hasCurrentSettings && receiptSettings.receipt_subtotal_excluding_vat !== undefined
        ? Number(receiptSettings.receipt_subtotal_excluding_vat)
        : !hasCurrentSettings && receiptSettings.receipt_subtotal !== undefined
          ? Number(receiptSettings.receipt_subtotal)
          : receiptTotal - vatAmount;

      const detailData = {
        id: orderData.id,
        shopName: displaySettings.shop_name || user?.shop_name || "POS Shop",
        branchName: displaySettings.branch_name || user?.branch || "สาขาหลัก",
        address: displaySettings.address || "-",
        phone: displaySettings.phone || "-",
        taxId: displaySettings.tax_id || "-",
        logo: displaySettings.receipt_show_logo === false ? "" : (displaySettings.logo || ""),
        receiptFooter: displaySettings.receipt_footer || "",
        receiptNo: orderData.bill_number,
        dateTime: formatDynamicTime(orderData.created_at, currentShopTimezone),
        employeeName: user?.name || "พนักงาน",
        customerName: "ลูกค้าทั่วไป",
        status: orderData.status === 'completed' ? 'สำเร็จ' : orderData.status === 'cancelled' ? 'ยกเลิก' : orderData.status,
        orderType: orderData.order_type || "ทานที่ร้าน",
        items: itemsData.map((item: any) => ({
          name: item.name || "สินค้า",
          qty: item.quantity,
          unitPrice: Number(item.price), 
          discount: 0,
          total: Number(item.price) * item.quantity,
          sweetness: item.sweetness,
          addon: item.addon_name
        })),
        subTotal: subtotalExcludingVat,
        totalDiscount: 0, 
        vatEnabled,
        vatRate,
        vatAmount,
        netTotal: receiptTotal,
        paymentMethod: orderData.payment_method || "เงินสด",
        amountReceived: Number(orderData.received_amount) || Number(orderData.total_amount),
        change: Number(orderData.change_amount) || 0
      };

      setSelectedReceipt(detailData);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const confirmVoidBill = async () => {
    if (!voidPin || voidPin.length !== 4) return alert("กรุณากรอกรหัส PIN 4 หลักให้ครบถ้วน");
    setIsVoiding(true);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${voidModal.receiptId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: user.shop_id, pin: voidPin, reason: voidReason }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setVoidModal({ show: false, receiptId: null, receiptNo: "" });
        setVoidPin(""); setVoidReason(""); setSelectedReceipt(null); 
        fetchReceipts(); 
      } else {
        alert("เกิดข้อผิดพลาด: " + data.error);
        setVoidPin("");
      }
    } catch (err) { alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); } finally { setIsVoiding(false); }
  };

  const handleAuthEdit = async () => {
    if (!editPin || editPin.length !== 4) return alert("กรุณากรอกรหัส PIN 4 หลัก");
    setIsEditing(true);
    try {
      const response = await fetch(`http://localhost:5000/api/verify-manager-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: user.shop_id, pin: editPin }),
      });
      const data = await response.json();
      if (data.success) {
        setEditForm({ 
          payment_method: selectedReceipt.paymentMethod, 
          order_type: selectedReceipt.orderType 
        });
        setEditAuthModal({ show: false, receiptId: null, receiptNo: "" });
        setEditPin("");
        setEditDataModal(true);
      } else {
        alert("รหัส PIN ไม่ถูกต้อง หรือไม่มีสิทธิ์แก้ไข");
        setEditPin("");
      }
    } catch (err) { alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); } finally { setIsEditing(false); }
  };

  const confirmEditBill = async () => {
    setIsEditing(true);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${selectedReceipt.id}/basic`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          shop_id: user.shop_id, 
          pin: "0000", 
          payment_method: editForm.payment_method,
          order_type: editForm.order_type
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setEditDataModal(false);
        setSelectedReceipt(null);
        fetchReceipts();
      } else {
        alert("เกิดข้อผิดพลาด: " + data.error);
      }
    } catch (err) { alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); } finally { setIsEditing(false); }
  };

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedReceipts = receipts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="flex h-screen bg-[#d6d6d6] font-sans overflow-hidden">
      
      {/* Sidebar */}
      <div className="w-[240px] bg-[#4d4d4d] text-white flex flex-col justify-between shrink-0 shadow-lg z-20 print:hidden">
      <div>
        <div className="h-[90px] flex items-center justify-center gap-3 translate-x-3">
          <h1 className="text-[36px] font-black italic tracking-widest text-white">POS</h1>
          <NotificationBell />
        </div>
        <nav className="sidebar-menu flex flex-col text-[16px]">
          <button onClick={() => router.push('/pos')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">สั่งและชำระเงิน</button>
          <button className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">ประวัติใบเสร็จ</button>
          <button onClick={() => router.push('/pos/inventory')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">สินค้าคงคลัง</button>
          <button onClick={() => router.push('/pos/shifts')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รอบการขาย</button>
          <button onClick={() => router.push('/pos/menu')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">เมนูและโปรโมชั่น</button>
          <button onClick={() => router.push('/pos/reports')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รายงาน</button>
          <button onClick={() => router.push('/pos/employees')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">พนักงาน</button>
          <button onClick={() => router.push('/pos/settings')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">การตั้งค่า</button>
        </nav>
      </div>
      <button onClick={() => {
        if (typeof window !== "undefined") {
          const savedUser = JSON.parse(localStorage.getItem("userContext") || "null");
          localStorage.removeItem("userContext");
          router.push(savedUser?.pin_enabled === false ? '/' : '/pin');
        } else {
          router.push('/pin');
        }
      }} className="py-6 px-6 text-left text-gray-300 border-t border-[#666666] hover:bg-[#666666] transition-colors text-[16px]">{typeof window !== "undefined" ? (JSON.parse(localStorage.getItem("userContext") || "null")?.pin_enabled === false ? 'ออกจากระบบ' : 'กลับสู่หน้า PIN') : 'กลับสู่หน้า PIN'}</button>
    </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header */}
        <div className="h-[90px] bg-[#f5f6f8] flex items-center justify-between z-10 shrink-0 w-full px-8 border-b border-gray-200 shadow-sm print:hidden">
          <div>
            <h2 className="text-[22px] font-bold text-gray-800">ประวัติใบเสร็จ</h2>
            <p className="text-[14px] text-gray-500">ตรวจสอบรายการขายและรายละเอียดใบเสร็จย้อนหลัง</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative flex items-center h-[48px]">
              <Search className="w-5 h-5 text-gray-400 absolute left-4" />
              <input 
                type="text" 
                placeholder="ค้นหาเลขบิล..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                name="search_query_disable_autofill"
                className="h-full pl-12 pr-4 rounded-full border border-gray-200 outline-none focus:border-[#7a5c4e] text-[15px] w-[250px] shadow-sm"
              />
            </div>

            <UnifiedDateRangePicker value={dateSelection} onChange={setDateSelection} />

            <div className="flex items-center border border-gray-200 rounded-full bg-white h-[48px] px-4 shadow-sm">
              <Filter className="w-5 h-5 text-gray-400 mr-2" />
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)} 
                className="bg-transparent outline-none text-[15px] text-gray-700 cursor-pointer font-medium"
              >
                <option value="ทั้งหมด">สถานะทั้งหมด</option>
                <option value="สำเร็จ">สำเร็จ</option>
                <option value="ยกเลิก">ยกเลิก (Void)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-6 print:hidden flex flex-col">
          <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
            
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <RefreshCw className="w-10 h-10 animate-spin mb-4 text-[#7a5c4e]" />
                <p className="text-[18px] font-medium">กำลังโหลดประวัติใบเสร็จ...</p>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">ไม่สามารถโหลดประวัติใบเสร็จได้</h3>
                <p className="text-gray-500 mb-6">{error}</p>
                <button onClick={fetchReceipts} className="px-8 py-3 bg-[#7a5c4e] text-white rounded-xl font-bold text-[16px] hover:bg-[#684c3f]">
                  ลองอีกครั้ง
                </button>
              </div>
            ) : receipts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                <Search className="w-12 h-12 mb-4 text-gray-300" />
                <h3 className="text-xl font-bold text-gray-600 mb-1">ไม่พบรายการใบเสร็จ</h3>
                <p className="text-[15px]">ลองเปลี่ยนช่วงเวลา หรือค้นหาด้วยข้อมูลอื่น</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-auto rounded-t-[24px]">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">เลขที่ใบเสร็จ</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">วันที่และเวลา</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">ลูกค้า</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">ช่องทางการชำระ</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">ยอดสุทธิ</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-center">สถานะ</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedReceipts.map((receipt) => (
                        <tr key={receipt.id} className={`hover:bg-gray-50/80 transition-colors group ${receipt.status === 'ยกเลิก' ? 'opacity-70 bg-gray-50/50' : 'bg-white'}`}>
                          <td className={`px-6 py-4 text-[15px] font-medium border-b border-gray-100 ${receipt.status === 'ยกเลิก' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{receipt.receiptNo}</td>
                          <td className="px-6 py-4 text-[14px] text-gray-600 border-b border-gray-100">{receipt.dateTime}</td>
                          <td className="px-6 py-4 text-[14px] text-gray-600 border-b border-gray-100">{receipt.customerName}</td>
                          <td className="px-6 py-4 text-[14px] text-gray-600 border-b border-gray-100">{receipt.paymentMethod}</td>
                          <td className={`px-6 py-4 text-[15px] font-bold border-b border-gray-100 text-right ${receipt.status === 'ยกเลิก' ? 'text-gray-400' : 'text-black'}`}>฿{receipt.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-6 py-4 border-b border-gray-100 text-center">
                            <span className={`px-3 py-1 rounded-full text-[12px] font-bold border ${
                              receipt.status === 'สำเร็จ' ? 'bg-green-50 text-green-600 border-green-200' :
                              receipt.status === 'ยกเลิก' ? 'bg-red-50 text-red-600 border-red-200' :
                              'bg-orange-50 text-orange-600 border-orange-200'
                            }`}>
                              {receipt.status === 'ยกเลิก' ? 'ยกเลิก (Void)' : receipt.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-100 text-center">
                            <button 
                              onClick={() => handleViewDetail(receipt.id)}
                              disabled={detailLoading}
                              className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-[#7a5c4e] hover:text-white flex items-center justify-center transition-colors mx-auto disabled:opacity-50"
                              title="ดูรายละเอียด"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="border-t border-gray-200 p-4 flex justify-between items-center bg-gray-50 rounded-b-[24px]">
                  <span className="text-sm font-medium text-gray-500">หน้า {currentPage} จาก {totalPages} <span className="text-gray-400 ml-2">({receipts.length} รายการ)</span></span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-10 h-10 border border-gray-200 rounded-xl flex items-center justify-center bg-white hover:bg-gray-100 active:bg-gray-200 disabled:opacity-30 transition-all text-gray-700"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="w-10 h-10 border border-gray-200 rounded-xl flex items-center justify-center bg-white hover:bg-gray-100 active:bg-gray-200 disabled:opacity-30 transition-all text-gray-700"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Receipt Detail Modal (Drawer Style) */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm print:absolute print:inset-0 print:bg-white print:block">
          <div className="w-[500px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right print:w-full print:shadow-none">
            
            <div className="h-[90px] border-b border-gray-200 flex items-center justify-between px-6 shrink-0 print:hidden">
              <h2 className="text-[20px] font-bold text-gray-800">รายละเอียดใบเสร็จ</h2>
              <button 
                onClick={() => setSelectedReceipt(null)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 print:p-0 relative">
              
              {selectedReceipt.status === 'ยกเลิก' && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 -rotate-12 border-4 border-red-500 text-red-500 text-4xl font-black px-6 py-2 rounded-xl opacity-30 pointer-events-none z-10 tracking-widest">
                  VOID
                </div>
              )}

              <div className="text-center mb-8">
                {selectedReceipt.logo && <img src={selectedReceipt.logo} alt="โลโก้ร้าน" className="w-16 h-16 object-contain mx-auto mb-3" />}
                <h3 className="text-[24px] font-black text-gray-800">{selectedReceipt.shopName}</h3>
                <p className="text-[14px] text-gray-500">สาขา: {selectedReceipt.branchName}</p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-500">{selectedReceipt.address}</p>
                <p className="text-[13px] text-gray-500">โทร: {selectedReceipt.phone} | Tax ID: {selectedReceipt.taxId}</p>
              </div>

              <div className="bg-gray-50 rounded-[16px] p-4 mb-6 text-[14px]">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">เลขที่ใบเสร็จ</span>
                  <span className="font-bold text-gray-800">{selectedReceipt.receiptNo}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">วันที่และเวลา</span>
                  <span className="font-medium text-gray-800">{selectedReceipt.dateTime}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">ประเภท</span>
                  <span className="font-medium text-gray-800">{selectedReceipt.orderType}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">สถานะ</span>
                  <span className={`font-bold ${selectedReceipt.status === 'สำเร็จ' ? 'text-green-600' : 'text-red-500'}`}>{selectedReceipt.status === 'ยกเลิก' ? 'ยกเลิก (Void)' : selectedReceipt.status}</span>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-[16px] font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">รายการสินค้า</h4>
                <div className="flex flex-col gap-3">
                  {selectedReceipt.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[14px]">
                      <div className="flex flex-col">
                        <span className={`font-medium ${selectedReceipt.status === 'ยกเลิก' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.name}</span>
                        <span className="text-gray-500 text-[12px]">{item.qty} x ฿{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        {item.sweetness && <span className="text-gray-400 text-[12px]">ความหวาน: {item.sweetness}%</span>}
                        {item.addon && <span className="text-gray-400 text-[12px]">เพิ่ม: {item.addon}</span>}
                      </div>
                      <span className={`font-bold ${selectedReceipt.status === 'ยกเลิก' ? 'text-gray-400' : 'text-gray-800'}`}>฿{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-dashed border-gray-300 pt-4 mb-6 text-[14px]">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">ยอดรวมก่อนส่วนลด</span>
                  <span className={`font-medium ${selectedReceipt.status === 'ยกเลิก' ? 'text-gray-400' : 'text-gray-800'}`}>฿{selectedReceipt.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">ส่วนลดทั้งหมด</span>
                  <span className={`font-medium ${selectedReceipt.status === 'ยกเลิก' ? 'text-gray-400' : 'text-red-500'}`}>- ฿{selectedReceipt.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {selectedReceipt.vatEnabled && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-500">ภาษีมูลค่าเพิ่ม ({selectedReceipt.vatRate}%)</span>
                    <span className={`font-medium ${selectedReceipt.status === 'ยกเลิก' ? 'text-gray-400' : 'text-gray-800'}`}>฿{selectedReceipt.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between mt-4">
                  <span className="text-[18px] font-bold text-gray-800">ยอดสุทธิ</span>
                  <span className={`text-[20px] font-black ${selectedReceipt.status === 'ยกเลิก' ? 'text-gray-400' : 'text-[#7a5c4e]'}`}>฿{selectedReceipt.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-[16px] p-4 text-[14px]">
                <h4 className="font-bold text-gray-800 mb-2">ข้อมูลการชำระเงิน</h4>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">ช่องทาง</span>
                  <span className="font-medium text-gray-800">{selectedReceipt.paymentMethod}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">ยอดรับเงิน</span>
                  <span className={`font-medium ${selectedReceipt.status === 'ยกเลิก' ? 'text-gray-400' : 'text-gray-800'}`}>฿{selectedReceipt.amountReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">เงินทอน</span>
                  <span className={`font-medium ${selectedReceipt.status === 'ยกเลิก' ? 'text-gray-400' : 'text-gray-800'}`}>฿{selectedReceipt.change.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {selectedReceipt.receiptFooter && (
                <div className="text-center text-[12px] text-gray-500 whitespace-pre-wrap mt-6 pt-4 border-t border-dashed border-gray-300">
                  {selectedReceipt.receiptFooter}
                </div>
              )}

            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 shrink-0 grid grid-cols-2 gap-3 print:hidden">
              <button 
                onClick={handlePrint}
                className="col-span-2 py-3.5 bg-[#4d4d4d] text-white rounded-xl font-bold text-[15px] hover:bg-[#333333] transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Printer className="w-5 h-5" /> พิมพ์บิลนี้
              </button>
              
              {selectedReceipt.status !== 'ยกเลิก' && (
                <>
                  <button 
                    onClick={() => setEditAuthModal({ show: true, receiptId: selectedReceipt.id, receiptNo: selectedReceipt.receiptNo })}
                    className="py-3 bg-white text-gray-700 border border-gray-300 rounded-xl font-bold text-[15px] hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Edit3 className="w-4 h-4" /> แก้ไขบิล
                  </button>
                  <button 
                    onClick={() => setVoidModal({ show: true, receiptId: selectedReceipt.id, receiptNo: selectedReceipt.receiptNo })}
                    className="py-3 bg-white text-red-500 border border-red-200 rounded-xl font-bold text-[15px] hover:bg-red-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" /> ยกเลิก (Void)
                  </button>
                </>
              )}
            </div>
            
          </div>
        </div>
      )}

      {/* Security Modal: ยืนยันสิทธิ์สำหรับ "แก้ไขบิล" */}
      {editAuthModal.show && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white w-[420px] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="pt-8 px-8 pb-4 text-center relative">
              <button onClick={() => { setEditAuthModal({ show: false, receiptId: null, receiptNo: "" }); setEditPin(""); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"><X className="w-5 h-5"/></button>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-8 h-8 text-blue-500" /></div>
              <h3 className="text-[22px] font-bold text-gray-900">ยืนยันสิทธิ์แก้ไขบิล</h3>
              <p className="text-gray-500 text-[14px] mt-1">บิลเลขที่: <span className="font-bold text-gray-800">{editAuthModal.receiptNo}</span></p>
            </div>
            <div className="px-8 py-2">
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-[13px] text-blue-800 flex items-start gap-3 mb-6">
                <AlertCircle className="w-5 h-5 shrink-0 text-blue-500 mt-0.5" />
                <p>การแก้ไขบิลทำได้เฉพาะระดับ <b>ผู้จัดการขึ้นไป</b> (สามารถแก้ไขช่องทางการชำระเงินและประเภทการสั่งซื้อได้)</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-bold text-gray-700 mb-1.5">รหัส PIN 4 หลัก</label>
                  <input type="password" maxLength={4} placeholder="••••" value={editPin} onChange={(e) => setEditPin(e.target.value)} autoComplete="new-password" name="editPin_disable_autofill" className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-bold text-center tracking-[1em] text-[20px] transition-all" />
                </div>
              </div>
            </div>
            <div className="px-8 pb-8 pt-6 flex gap-3 mt-2">
              <button onClick={() => { setEditAuthModal({ show: false, receiptId: null, receiptNo: "" }); setEditPin(""); }} className="flex-1 py-3.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors">ย้อนกลับ</button>
              <button onClick={handleAuthEdit} disabled={isEditing || editPin.length !== 4} className="flex-1 py-3.5 bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors disabled:opacity-50 shadow-md shadow-blue-500/20">
                {isEditing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Edit3 className="w-5 h-5" />} ยืนยันสิทธิ์
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: แก้ไขข้อมูลบิล (หลังใส่ PIN ผ่าน) */}
      {editDataModal && selectedReceipt && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white w-[420px] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="bg-[#f5f6f8] px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-[18px] font-bold text-gray-800">แก้ไขข้อมูลบิล</h3>
              <button onClick={() => setEditDataModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[14px] font-bold text-gray-700 mb-2">ประเภทการสั่งซื้อ</label>
                <select value={editForm.order_type} onChange={(e) => setEditForm({...editForm, order_type: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]">
                  <option value="ทานที่ร้าน">ทานที่ร้าน</option>
                  <option value="กลับบ้าน">กลับบ้าน</option>
                  <option value="เดลิเวอรี่">เดลิเวอรี่</option>
                </select>
              </div>
              <div>
                <label className="block text-[14px] font-bold text-gray-700 mb-2">ช่องทางการชำระเงิน</label>
                <select value={editForm.payment_method} onChange={(e) => setEditForm({...editForm, payment_method: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]">
                  {paymentMethods.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-200 grid grid-cols-2 gap-3">
              <button onClick={() => setEditDataModal(false)} className="py-3.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors">ยกเลิก</button>
              <button onClick={confirmEditBill} disabled={isEditing} className="py-3.5 bg-[#7a5c4e] text-white rounded-xl font-bold hover:bg-[#684c3f] transition-colors flex items-center justify-center gap-2 shadow-sm">
                {isEditing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Modal: ยืนยันการยกเลิกบิล (Void Redesigned) */}
      {voidModal.show && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white w-[420px] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="pt-8 px-8 pb-4 text-center relative">
              <button onClick={() => { setVoidModal({ show: false, receiptId: null, receiptNo: "" }); setVoidPin(""); setVoidReason(""); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"><X className="w-5 h-5"/></button>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-8 h-8 text-red-500" /></div>
              <h3 className="text-[22px] font-bold text-gray-900">ยืนยันสิทธิ์ยกเลิกบิล</h3>
              <p className="text-gray-500 text-[14px] mt-1">บิลเลขที่: <span className="font-bold text-gray-800">{voidModal.receiptNo}</span></p>
            </div>
            <div className="px-8 py-2">
              <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl text-[13px] text-red-800 flex items-start gap-3 mb-6">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                <p>การยกเลิกบิลจะทำให้ยอดเงินในบิลนี้กลายเป็น 0 ฿ และสต็อกสินค้าจะถูกคืนกลับเข้าระบบโดยอัตโนมัติ (เฉพาะระดับ <b>ผู้จัดการขึ้นไป</b>)</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-bold text-gray-700 mb-1.5">เหตุผลที่ยกเลิกบิล (ตัวเลือก)</label>
                  <input type="text" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} autoComplete="off" name="voidReason_disable_autofill" className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-[15px] transition-all" placeholder="เช่น ลูกค้าเปลี่ยนใจ, คีย์ผิด..." />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-gray-700 mb-1.5">รหัส PIN 4 หลัก (Manager / Owner)</label>
                  <input type="password" maxLength={4} placeholder="••••" value={voidPin} onChange={(e) => setVoidPin(e.target.value)} autoComplete="new-password" name="voidPin_disable_autofill" className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 font-bold text-center tracking-[1em] text-[20px] transition-all" />
                </div>
              </div>
            </div>
            <div className="px-8 pb-8 pt-6 flex gap-3 mt-2">
              <button onClick={() => { setVoidModal({ show: false, receiptId: null, receiptNo: "" }); setVoidPin(""); setVoidReason(""); }} className="flex-1 py-3.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors">ย้อนกลับ</button>
              <button onClick={confirmVoidBill} disabled={isVoiding || voidPin.length !== 4} className="flex-1 py-3.5 bg-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-50 shadow-md shadow-red-500/20">
                {isVoiding ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}