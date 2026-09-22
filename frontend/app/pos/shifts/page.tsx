"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from "../../components/NotificationBell";
import UnifiedDateRangePicker, { DateRangeValue } from "../../components/UnifiedDateRangePicker";
import { 
  Clock, Play, Square, DollarSign, FileText, Package, CreditCard, History,
  AlertCircle, X, CheckCircle, TrendingUp, RefreshCw, BarChart3, TrendingDown, Lock, Save, AlertTriangle, List, ArrowDownCircle, ArrowUpCircle, Printer
} from "lucide-react";

// ดึง Timezone อัตโนมัติ พร้อม Fallback กันพัง
const getSystemTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return 'Asia/Bangkok';
  }
};

const getShopTimeZone = (configuredTimeZone?: string) => {
  return configuredTimeZone && configuredTimeZone !== 'auto'
    ? configuredTimeZone
    : 'Asia/Bangkok';
};

const formatDateKey = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getTodayInShopTimeZone = () => formatDateKey(new Date(), 'Asia/Bangkok');

const CHART_INTERVALS = [1, 2, 3, 5, 10, 15, 20, 30, 60, 120, 240, 360, 720, 1440, 10080, 43200];

const getAdaptiveInterval = ({ startTime, endTime, orderCount, chartWidth }: { startTime: string; endTime: string; orderCount: number; chartWidth: number }) => {
  const durationMinutes = Math.max(1, (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
  const targetTicks = chartWidth < 480 ? 6 : chartWidth < 900 ? 8 : 10;
  const desiredMinutes = durationMinutes / targetTicks;
  const densityAdjusted = orderCount > targetTicks * 20 ? desiredMinutes * 1.15 : desiredMinutes;
  return CHART_INTERVALS.find(interval => interval >= densityAdjusted) || CHART_INTERVALS[CHART_INTERVALS.length - 1];
};

const toValidTimestamp = (value: string) => value && !value.includes('Z') && !value.includes('+') ? `${value}Z` : value;

const formatChartLabel = (date: Date, intervalMinutes: number, timeZone: string) => new Intl.DateTimeFormat('th-TH', intervalMinutes >= 1440
  ? { timeZone, day: 'numeric', month: 'short', year: intervalMinutes >= 43200 ? 'numeric' : undefined }
  : { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);

export default function ShiftsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // States สำหรับรอบการขายปัจจุบัน
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [soldProducts, setSoldProducts] = useState<any[]>([]); // เปลี่ยนเป็นสินค้าทั้งหมด
  
  const [currentShopTimezone, setCurrentShopTimezone] = useState<string>(getSystemTimeZone());
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(900);

  // States สำหรับประวัติรอบการขาย (ปฏิทิน)
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);
  const [dateSelection, setDateSelection] = useState<DateRangeValue>(() => {
    const today = getTodayInShopTimeZone();
    return { mode: "range", startDate: today, endDate: today, period: "วันนี้" };
  });
  const [printingShiftId, setPrintingShiftId] = useState<number | null>(null);

  // States สำหรับ Modals เปิด/ปิด กะ
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [closeStep, setCloseStep] = useState(1);
  const [actualCash, setActualCash] = useState("");
  
  // States สำหรับ จัดการเงินสด (เข้า/ออก)
  const [isExpenseModal, setIsExpenseModal] = useState(false);
  const [expenseMode, setExpenseMode] = useState<"in" | "out">("out"); 
  const [expenseData, setExpenseData] = useState({ amount: "", reason: "", pin: "" });
  const [isExpensing, setIsExpensing] = useState(false);

  useEffect(() => {
    const savedUserRaw = localStorage.getItem("userContext");
    if (!savedUserRaw || savedUserRaw === "undefined" || savedUserRaw === "null") {
      router.push("/pin");
      return;
    }
    const savedUser = JSON.parse(savedUserRaw);
    setUser(savedUser);
    fetchCurrentShift(savedUser.shop_id);
  }, [router]);

  const fetchCurrentShift = async (shopId: number) => {
    setLoading(true);
    try {
      const [settingsRes, shiftRes] = await Promise.all([
        fetch(`http://localhost:5000/api/settings?shop_id=${shopId}`),
        fetch(`http://localhost:5000/api/shifts/active?shop_id=${shopId}`)
      ]);
      
      const settingsData = await settingsRes.json();
      const activeTz = getShopTimeZone(settingsData.timezone);
      setCurrentShopTimezone(activeTz);

      const shiftData = await shiftRes.json();
      setCurrentShift(shiftData.shift || null);
      
      if (shiftData.shift) {
        fetchShiftSummary(shiftData.shift.id);
      } else {
        fetchShiftHistory(shopId, dateSelection.startDate, activeTz, dateSelection.endDate);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShiftSummary = async (shiftId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/shifts/${shiftId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setShiftSummary(data.summary);
        // รองรับข้อมูลที่ส่งมาจาก Backend ตัวใหม่
        setSoldProducts(data.soldProducts || data.topProducts || []);
      }
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (!currentShift?.id) return;
    const refreshTimer = window.setInterval(() => fetchShiftSummary(currentShift.id), 30000);
    return () => window.clearInterval(refreshTimer);
  }, [currentShift?.id]);

  const fetchShiftHistory = async (shopId: number, dateStr: string, activeTz: string = currentShopTimezone, endDateStr = dateStr) => {
    try {
      const res = await fetch(`http://localhost:5000/api/shifts?shop_id=${shopId}`);
      if (res.ok) {
        const data = await res.json();
        const safeTz = getShopTimeZone(activeTz);
        const filtered = data.shifts.filter((s: any) => {
          const toDateKey = (value: string) => {
            const validDateStr = value.includes('Z') || value.includes('+') ? value : `${value}Z`;
            return formatDateKey(new Date(validDateStr), safeTz);
          };
          const openedDate = toDateKey(s.opened_at);
          const closedDate = s.closed_at ? toDateKey(s.closed_at) : openedDate;
          return openedDate <= endDateStr && dateStr <= closedDate;
        });
        setShiftHistory(filtered);
      }
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (!currentShift && user) {
      fetchShiftHistory(user.shop_id, dateSelection.startDate, currentShopTimezone, dateSelection.endDate);
    }
  }, [dateSelection, currentShift, user]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const updateChartWidth = () => setChartWidth(chartContainerRef.current?.clientWidth || 900);
    updateChartWidth();
    const observer = new ResizeObserver(updateChartWidth);
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, [currentShift]);

  const formatTime = (dateString: string) => {
      if (!dateString) return "-";
      const validStr = dateString.includes('Z') || dateString.includes('+') ? dateString : `${dateString}Z`;
      const safeTz = getShopTimeZone(currentShopTimezone);
      return new Date(validStr).toLocaleString('th-TH', { timeZone: safeTz });
  };

// ==========================================
  // ระบบสั่งพิมพ์รายงาน 80mm
  // ==========================================
  const printShiftReport = (shopInfo: any, shiftData: any, summaryData: any, soldItemsList: any[], closingCash: number, diffCash: number) => {
    const printWindow = document.createElement("iframe");
    printWindow.style.position = "absolute";
    printWindow.style.top = "-1000px";
    document.body.appendChild(printWindow);

    const doc = printWindow.contentWindow?.document;
    if (!doc) return;

    // แก้ไขจุดที่ 1: เติม ?. ดักค่า null
    const expList = summaryData?.expensesList || []; 
    
    const tCashOut = expList.filter((e: any) => Number(e.amount) > 0).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const tCashIn = expList.filter((e: any) => Number(e.amount) < 0).reduce((s: number, e: any) => s + Math.abs(Number(e.amount)), 0);

    const htmlContent = `
      <html>
      <head>
        <title>Shift Report - ${shiftData.id}</title>
        <style>
          @page { margin: 0; }
          body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 10px; color: #000; box-sizing: border-box; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .flex-between { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .divider-solid { border-top: 1px solid #000; margin: 8px 0; }
          h2, h3 { margin: 5px 0; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px; }
          th, td { text-align: left; padding: 3px 0; }
          th { border-bottom: 1px dashed #000; }
        </style>
      </head>
      <body>
        <div class="text-center font-bold">
          <h2>${shopInfo?.shop_name || 'POS Shop'}</h2>
          <div>สาขา: ${shopInfo?.branch || 'สาขาหลัก'}</div>
          <div class="divider"></div>
          <h3>รายงานปิดรอบการขาย</h3>
          <div>(Shift Closing Report)</div>
        </div>
        
        <div class="divider"></div>
        <div class="flex-between"><span>เลขที่รอบ:</span> <span>${shiftData.id}</span></div>
        <div class="flex-between"><span>พนักงาน:</span> <span>${shiftData.staff_name || 'พนักงาน'}</span></div>
        <div class="flex-between"><span>เปิดรอบ:</span> <span>${formatTime(shiftData.opened_at)}</span></div>
        <div class="flex-between"><span>ปิดรอบ:</span> <span>${formatTime(shiftData.closed_at || new Date().toISOString())}</span></div>
        <div class="divider"></div>

        <div class="flex-between font-bold"><span>เงินสดเริ่มต้น:</span> <span>${Number(shiftData.opening_cash || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
        
        <!-- แก้ไขจุดที่ 2: เติม ?. -->
        <div class="flex-between font-bold"><span>ยอดขายสุทธิ:</span> <span>${Number(summaryData?.totalSales || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
        <div class="flex-between"><span>จำนวนใบเสร็จ:</span> <span>${summaryData?.receiptCount || 0} ใบ</span></div>
        <div class="flex-between"><span>จำนวนสินค้า:</span> <span>${summaryData?.itemCount || 0} ชิ้น</span></div>
        <div class="divider"></div>

        <div class="font-bold text-center">สรุปยอดตามช่องทางชำระเงิน</div>
        <!-- แก้ไขจุดที่ 3: เติม ?. -->
        <div class="flex-between"><span>- เงินสด:</span> <span>${Number(summaryData?.payments?.cash || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
        <div class="flex-between"><span>- โอนเงิน/QR:</span> <span>${Number(summaryData?.payments?.transfer || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
        <div class="flex-between"><span>- บัตรเครดิต:</span> <span>${Number(summaryData?.payments?.credit || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
        <div class="divider"></div>

        <div class="font-bold text-center">กระแสเงินสดเพิ่มเติม</div>
        <div class="flex-between"><span>นำเงินเข้า (Cash In):</span> <span>${tCashIn.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
        <div class="flex-between"><span>เบิกเงินออก (Expenses):</span> <span>${tCashOut.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
        <div class="divider"></div>

        <!-- แก้ไขจุดที่ 4: เติม ?. -->
        <div class="flex-between font-bold"><span>เงินสดที่ควรมี:</span> <span>${Number(summaryData?.expectedCash || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
        <div class="flex-between font-bold"><span>เงินสดที่นับได้:</span> <span>${Number(closingCash || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
        <div class="flex-between font-bold" style="font-size: 14px; margin-top: 4px;">
          <span>ผลต่างเงินสด:</span> 
          <span>${diffCash > 0 ? '+' : ''}${Number(diffCash || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
        <div class="divider-solid"></div>

        <div class="font-bold text-center" style="margin-top:10px;">รายการสินค้าที่ขายได้ทั้งหมด</div>
        <table>
          <thead>
            <tr>
              <th style="width: 50%;">รายการ</th>
              <th class="text-right">จำนวน</th>
              <th class="text-right">ยอด(฿)</th>
            </tr>
          </thead>
          <tbody>
            <!-- ป้องกัน error ใน soldItemsList ด้วย -->
            ${(soldItemsList || []).length > 0 ? (soldItemsList || []).map(p => `
              <tr>
                <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${p.name}</td>
                <td class="text-right">${p.quantity}</td>
                <td class="text-right">${Number(p.total).toLocaleString()}</td>
              </tr>
            `).join('') : '<tr><td colspan="3" class="text-center">- ไม่มีข้อมูลขายสินค้า -</td></tr>'}
          </tbody>
        </table>
        
        <div class="divider" style="margin-top: 15px;"></div>
        <div class="text-center" style="margin-top: 25px; margin-bottom: 20px;">
          <div>.....................................</div>
          <div style="margin-top: 5px;">ลายมือชื่อผู้ตรวจนับ / ปิดรอบ</div>
          <div style="margin-top: 10px; font-size: 10px; color: #555;">พิมพ์เมื่อ: ${formatTime(new Date().toISOString())}</div>
        </div>
      </body>
      </html>
    `;
    
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
        printWindow.contentWindow?.focus();
        printWindow.contentWindow?.print();
        setTimeout(() => { document.body.removeChild(printWindow); }, 1500);
    }, 800);
  };

  const handleOpenShift = async () => {
    if (!openingCash || isNaN(Number(openingCash))) return alert("กรุณาระบุเงินสดเริ่มต้นให้ถูกต้อง");
    try {
      const res = await fetch(`http://localhost:5000/api/shifts/open`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: user.shop_id, staff_id: user.id, opening_cash: Number(openingCash) })
      });
      if (res.ok) {
        setIsOpeningShift(false); setOpeningCash("");
        fetchCurrentShift(user.shop_id);
      } else {
        const errorData = await res.json(); alert(`เกิดข้อผิดพลาด: ${errorData.message || errorData.error}`);
      }
    } catch (error) { alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); }
  };

  const openClosingModal = () => {
    setActualCash("");
    setCloseStep(1);
    setIsClosingShift(true);
  };

  const handleNextCloseStep = () => {
    if (!actualCash || isNaN(Number(actualCash))) return alert("กรุณาระบุเงินสดที่นับจริง");
    setCloseStep(2);
  };

  const handleCloseShift = async () => {
    try {
      const closingPayload = {
        shift_id: currentShift.id, 
        closing_cash: Number(actualCash),
        expected_cash: shiftSummary?.expectedCash || 0,
        cash_difference: Number(actualCash) - (shiftSummary?.expectedCash || 0)
      };

      const res = await fetch(`http://localhost:5000/api/shifts/close`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(closingPayload)
      });

      if (res.ok) {
        try {
          printShiftReport(
            user, 
            { ...currentShift, closed_at: new Date().toISOString() }, 
            shiftSummary, 
            soldProducts, // ใช้สินค้าทั้งหมด 
            closingPayload.closing_cash, 
            closingPayload.cash_difference 
          );
        } catch (printErr) {
          console.error("การสั่งพิมพ์ล้มเหลว:", printErr);
          alert("บันทึกปิดรอบสำเร็จ แต่ระบบไม่สามารถส่งคำสั่งพิมพ์ไปยังเครื่องปริ้นได้ กรุณาพิมพ์ย้อนหลังจากประวัติรอบการขาย");
        }

        setIsClosingShift(false); setActualCash(""); setCurrentShift(null); setShiftSummary(null); setCloseStep(1);
        fetchShiftHistory(user.shop_id, dateSelection.startDate, currentShopTimezone, dateSelection.endDate);
      } else { alert("เกิดข้อผิดพลาดในการปิดรอบ"); }
    } catch (error) { alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); }
  };

  const handleReprintShift = async (pastShift: any) => {
    setPrintingShiftId(pastShift.id);
    try {
      const res = await fetch(`http://localhost:5000/api/shifts/${pastShift.id}/summary`);
      if (res.ok) {
        const data = await res.json();
        printShiftReport(
          user, 
          pastShift, 
          data.summary, 
          data.soldProducts || data.topProducts, // ใช้สินค้าทั้งหมด
          Number(pastShift.closing_cash || 0), 
          Number(pastShift.cash_difference || 0)
        );
      } else {
        alert("ไม่สามารถดึงข้อมูลสรุปรอบการขายย้อนหลังนี้ได้");
      }
    } catch (error) {
      alert("การเชื่อมต่อเซิร์ฟเวอร์ล้มเหลว");
    } finally {
      setPrintingShiftId(null);
    }
  };

  const handleExpense = async () => {
    if (!expenseData.amount || !expenseData.reason || !expenseData.pin) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    setIsExpensing(true);
    try {
      const finalAmount = expenseMode === "in" ? -Math.abs(Number(expenseData.amount)) : Math.abs(Number(expenseData.amount));
      
      const res = await fetch(`http://localhost:5000/api/shifts/expense`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: user.shop_id, shift_id: currentShift.id, pin: expenseData.pin,
          amount: finalAmount, reason: expenseData.reason
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsExpenseModal(false); 
        setExpenseData({ amount: "", reason: "", pin: "" });
        setExpenseMode("out"); 
        fetchShiftSummary(currentShift.id); 
      } else { alert(data.error); }
    } catch (error) { alert("เกิดข้อผิดพลาด"); } finally { setIsExpensing(false); }
  };

  // ==========================================
  // คำนวณเงินสด
  // ==========================================
  const expensesList = shiftSummary?.expensesList || [];
  const totalCashOut = expensesList.filter((e: any) => Number(e.amount) > 0).reduce((sum: number, e: any) => sum + Number(e.amount), 0);
  const totalCashIn = expensesList.filter((e: any) => Number(e.amount) < 0).reduce((sum: number, e: any) => sum + Math.abs(Number(e.amount)), 0);

  // ==========================================
  // เตรียมข้อมูลสำหรับ Line Chart
  // ==========================================
  const safeChartTimezone = getShopTimeZone(currentShopTimezone);
  const chartOrders = (shiftSummary?.chartData || [])
    .map((data: any) => ({ ...data, timestamp: toValidTimestamp(data.timestamp || data.created_at) }))
    .filter((data: any) => data.timestamp && !Number.isNaN(new Date(data.timestamp).getTime()))
    .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const chartStart = toValidTimestamp(currentShift?.opened_at || chartOrders[0]?.timestamp || new Date().toISOString());
  const chartEnd = toValidTimestamp(currentShift?.closed_at || new Date().toISOString());
  const intervalMinutes = getAdaptiveInterval({ startTime: chartStart, endTime: chartEnd, orderCount: chartOrders.length, chartWidth });
  const intervalMs = intervalMinutes * 60000;
  const firstBucket = Math.floor(new Date(chartStart).getTime() / intervalMs) * intervalMs;
  const lastBucket = Math.floor(new Date(chartEnd).getTime() / intervalMs) * intervalMs;
  const bucketMap = new Map<number, { amount: number; orderCount: number; itemCount: number }>();
  chartOrders.forEach((order: any) => {
    const bucket = Math.floor(new Date(order.timestamp).getTime() / intervalMs) * intervalMs;
    const current = bucketMap.get(bucket) || { amount: 0, orderCount: 0, itemCount: 0 };
    current.amount += Number(order.amount) || 0;
    current.orderCount += Number(order.orderCount) || 1;
    current.itemCount += Number(order.itemCount) || 0;
    bucketMap.set(bucket, current);
  });
  const chartDataRaw = [];
  for (let bucket = firstBucket; bucket <= lastBucket; bucket += intervalMs) {
    const values = bucketMap.get(bucket) || { amount: 0, orderCount: 0, itemCount: 0 };
    chartDataRaw.push({ ...values, timestamp: new Date(bucket).toISOString() });
  }
  if (chartOrders.length === 0) chartDataRaw.length = 0;
  const maxChartAmount = Math.max(...chartDataRaw.map(d => Number(d.amount)), 1);
  const chartPoints = chartDataRaw.map((d, i) => {
    const xPercent = chartDataRaw.length === 1 ? 50 : 5 + (i / (chartDataRaw.length - 1)) * 90;
    const yPercent = (Number(d.amount) / maxChartAmount) * 100;
    const yDraw = 85 - (yPercent * 0.65);
    const startDateTime = new Date(d.timestamp).toLocaleString('th-TH', { timeZone: safeChartTimezone, dateStyle: 'short', timeStyle: 'short' });
    const endDateTime = new Date(new Date(d.timestamp).getTime() + intervalMs).toLocaleString('th-TH', { timeZone: safeChartTimezone, dateStyle: 'short', timeStyle: 'short' });
    return { x: xPercent, yDraw, amount: d.amount, orderCount: d.orderCount, itemCount: d.itemCount, label: formatChartLabel(new Date(d.timestamp), intervalMinutes, safeChartTimezone), dateTime: `${startDateTime} - ${endDateTime}` };
  });
  const chartHeight = chartDataRaw.length > 20 ? 340 : chartDataRaw.length > 8 ? 290 : 230;
  
  const svgPathD = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yDraw}`).join(' ');

  return (
    <div className="flex h-screen bg-[#d6d6d6] font-sans overflow-hidden">
      
      {/* Sidebar POS */}
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
          <button className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">รอบการขาย</button>
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

      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header */}
        <div className="h-[90px] bg-[#f5f6f8] flex items-center justify-between z-10 shrink-0 w-full px-8 border-b border-gray-200 shadow-sm">
          <div>
            <h2 className="text-[22px] font-bold text-gray-800">รอบการขาย</h2>
            <p className="text-[14px] text-gray-500">จัดการรอบการขาย สรุปยอด และควบคุมเงินสด</p>
          </div>
          <div className="flex items-center gap-4">
             {currentShift ? (
               <div className="flex items-center gap-3 bg-gray-100 px-5 py-2.5 rounded-full border border-gray-200 shadow-sm">
                 <div className="w-3 h-3 bg-[#7a5c4e] rounded-full animate-pulse"></div>
                 <span className="text-[14px] font-bold text-gray-700">กำลังเปิดรอบการขาย</span>
               </div>
             ) : (
               <div className="flex items-center gap-3 bg-gray-200 px-5 py-2.5 rounded-full border border-gray-300 shadow-sm">
                 <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                 <span className="text-[14px] font-bold text-gray-600">รอบการขายถูกปิด</span>
               </div>
             )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
          
          {loading ? (
             <div className="flex-1 flex items-center justify-center flex-col text-gray-400">
               <RefreshCw className="w-10 h-10 animate-spin mb-4 text-[#7a5c4e]" />
             </div>
          ) : !currentShift ? (
            
            // STATE: ไม่มีรอบการขายเปิดอยู่
            <div className="flex flex-col items-center justify-center flex-1 bg-white rounded-[24px] border border-gray-200 shadow-sm p-8">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <Square className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-[24px] font-bold text-gray-800 mb-2">ยังไม่มีรอบการขายที่เปิดอยู่</h3>
              <p className="text-gray-500 mb-8 text-center max-w-md text-[15px]">คุณต้องเปิดรอบการขายก่อนจึงจะสามารถทำรายการขายในระบบ POS ได้ ยอดขายทั้งหมดจะถูกบันทึกในรอบนี้</p>
              <button 
                onClick={() => setIsOpeningShift(true)}
                className="px-8 py-4 bg-[#7a5c4e] text-white rounded-xl font-bold text-[18px] hover:bg-[#684c3f] shadow-md flex items-center gap-3 transition-all"
              >
                <Play className="w-6 h-6 fill-current" /> เปิดรอบการขาย
              </button>

              <div className="w-full max-w-5xl mt-12 pt-12 border-t border-gray-200">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-[18px] font-bold text-gray-800 flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-500" /> ประวัติรอบการขาย
                  </h4>
                  <UnifiedDateRangePicker value={dateSelection} onChange={setDateSelection} />
                </div>
                
                <div className="bg-gray-50 rounded-[16px] border border-gray-200 overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left border-collapse">
                    <thead className="bg-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500">วัน/เวลาที่เปิด</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500">วัน/เวลาที่ปิด</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500">พนักงาน</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 text-right">ยอดขายสุทธิ</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 text-center">สถานะ</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftHistory.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">ไม่พบประวัติรอบการขายในช่วงเวลานี้</td></tr>
                      ) : shiftHistory.map(shift => (
                        <tr key={shift.id} className="border-b border-dashed border-gray-200 bg-white">
                          <td className="px-6 py-4 text-[14px] text-gray-700">{formatTime(shift.opened_at)}</td>
                          <td className="px-6 py-4 text-[14px] text-gray-700">{shift.closed_at ? formatTime(shift.closed_at) : '-'}</td>
                          <td className="px-6 py-4 text-[14px] text-gray-700">{shift.staff_name}</td>
                          <td className="px-6 py-4 text-[15px] font-bold text-gray-800 text-right">฿{Number(shift.total_sales || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-[12px] font-bold">ปิดแล้ว</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleReprintShift(shift)}
                              disabled={printingShiftId === shift.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 rounded-lg text-[13px] font-bold transition-colors disabled:opacity-50"
                            >
                              {printingShiftId === shift.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                              พิมพ์รายงาน
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

          ) : (
            
            // STATE: มีรอบการขายกำลังเปิดอยู่
            <div className="flex flex-col gap-6">
              
              {/* 1. Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-[24px] p-6 border border-gray-200 shadow-sm flex flex-col justify-center">
                  <span className="text-gray-500 text-[14px] font-medium mb-1">ยอดขายรวม</span>
                  <span className="text-[28px] font-black text-gray-800">฿{(shiftSummary?.totalSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-white rounded-[24px] p-6 border border-gray-200 shadow-sm flex flex-col justify-center">
                  <span className="text-gray-500 text-[14px] font-medium mb-1 flex items-center gap-2"><FileText className="w-4 h-4" /> จำนวนใบเสร็จ</span>
                  <span className="text-[28px] font-black text-gray-800">{shiftSummary?.receiptCount || 0}</span>
                </div>
                <div className="bg-white rounded-[24px] p-6 border border-gray-200 shadow-sm flex flex-col justify-center">
                  <span className="text-gray-500 text-[14px] font-medium mb-1 flex items-center gap-2"><Package className="w-4 h-4" /> สินค้าที่ขายได้</span>
                  <span className="text-[28px] font-black text-gray-800">{shiftSummary?.itemCount || 0} ชิ้น</span>
                </div>
                <div className="bg-[#7a5c4e] rounded-[24px] p-6 shadow-sm flex flex-col justify-center text-white relative overflow-hidden group cursor-pointer hover:bg-[#684c3f] transition-colors" onClick={openClosingModal}>
                  <Square className="w-24 h-24 absolute -right-4 -bottom-4 opacity-10" />
                  <span className="text-white/80 text-[14px] font-medium mb-1">สถานะรอบปัจจุบัน</span>
                  <span className="text-[24px] font-black flex items-center gap-2"><Play className="w-6 h-6 fill-current" /> เปิดอยู่</span>
                  <span className="mt-2 text-[13px] bg-black/20 self-start px-3 py-1 rounded-full border border-white/10 group-hover:bg-black/30 transition-colors">คลิกเพื่อปิดรอบการขาย</span>
                </div>
              </div>

              {/* 2. กราฟยอดขาย (Line Chart) */}
              <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm p-6 flex flex-col">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
                  <BarChart3 className="w-6 h-6 text-[#7a5c4e]" />
                  <div>
                    <h3 className="font-bold text-gray-800 text-[18px]">ยอดขายในรอบการขายนี้</h3>
                    <p className="text-gray-500 text-[13px] mt-0.5">ดูแนวโน้มยอดขายตามช่วงเวลาแบบเรียลไทม์</p>
                  </div>
                </div>

                <div ref={chartContainerRef} className="relative w-full" style={{ height: `${chartHeight}px` }}>
                  <div className="relative h-full w-full">
                  {chartDataRaw.length > 0 ? (
                    <>
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="lineGrad" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#7a5c4e" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#7a5c4e" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        
                        {chartDataRaw.length > 1 && (
                          <path 
                            d={`${svgPathD} L ${chartPoints[chartPoints.length-1].x} 100 L ${chartPoints[0].x} 100 Z`} 
                            fill="url(#lineGrad)" 
                          />
                        )}
                        
                        {chartDataRaw.length > 1 && (
                          <path 
                            d={svgPathD} 
                            fill="none" 
                            stroke="#7a5c4e" 
                            strokeWidth="3" 
                            vectorEffect="non-scaling-stroke" 
                          />
                        )}
                      </svg>

                      {chartPoints.map((p, i) => (
                        <div 
                          key={i} 
                          className="absolute flex flex-col items-center group z-10" 
                          style={{ left: `${p.x}%`, top: `${p.yDraw}%`, transform: 'translate(-50%, -50%)' }}
                        >
                          <div className="w-3.5 h-3.5 bg-white border-[3px] border-[#7a5c4e] rounded-full shadow-sm group-hover:scale-150 transition-transform cursor-pointer"></div>
                          
                          <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col items-center pointer-events-none w-max">
                            <div className="bg-gray-800 text-white text-center px-4 py-2 rounded-xl shadow-lg border border-gray-700/50">
                              <span className="block text-[12px] text-gray-300 font-medium mb-0.5">ช่วงเวลา {p.dateTime}</span>
                              <span className="block text-[15px] font-bold text-gray-600">ยอดขาย ฿{(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              <span className="block text-[12px] text-gray-300">ออเดอร์ {p.orderCount} รายการ</span>
                              <span className="block text-[12px] text-gray-300">สินค้า {p.itemCount} ชิ้น</span>
                            </div>
                            <div className="w-3 h-3 bg-gray-800 rotate-45 -mt-1.5 border-r border-b border-gray-700/50"></div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                      <TrendingUp className="w-16 h-16 mb-4 opacity-40"/>
                      <p className="font-bold text-[16px] text-gray-400">ยังไม่มีข้อมูลยอดขายในรอบนี้</p>
                    </div>
                  )}
                  </div>
                </div>

                {chartDataRaw.length > 0 && (
                  <div className="relative w-full h-[30px] mt-2 border-t border-gray-100 pt-3">
                    {chartPoints.map((p, i) => {
                      const hideLabel = chartPoints.length > 12 && i % Math.ceil(chartPoints.length / 10) !== 0;
                      if (hideLabel) return null;
                      return (
                        <div 
                          key={`label-${i}`} 
                          className="absolute text-[12px] font-bold text-gray-400 whitespace-nowrap" 
                          style={{ left: `${p.x}%`, transform: 'translateX(-50%)' }}
                        >
                          {p.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. รายละเอียด 2 คอลัมน์ */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* ฝั่งซ้าย (2/3) */}
                <div className="xl:col-span-2 flex flex-col gap-6">
                  
                  {/* ข้อมูลรอบการขาย */}
                  <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2"><Clock className="w-5 h-5 text-gray-500" /> ข้อมูลรอบการขาย</h3>
                    </div>
                    <div className="p-6 grid grid-cols-2 gap-y-6">
                      <div className="flex flex-col">
                        <span className="text-[13px] text-gray-400">พนักงาน</span>
                        <span className="text-[15px] font-medium text-gray-800 mt-1">{currentShift.staff_name || user?.name || "พนักงาน"}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] text-gray-400">เวลาที่เปิดรอบ</span>
                        <span className="text-[15px] font-medium text-gray-800 mt-1">{formatTime(currentShift.opened_at)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] text-gray-400">ยอดก่อนส่วนลด</span>
                        <span className="text-[15px] font-medium text-gray-800 mt-1">฿{(shiftSummary?.subTotal || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] text-gray-400">ส่วนลดทั้งหมด</span>
                        <span className="text-[15px] font-medium text-gray-600 mt-1">-฿{(shiftSummary?.totalDiscount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* สรุปกระแสเงินสด */}
                  <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2"><DollarSign className="w-5 h-5 text-gray-500" /> สรุปกระแสเงินสด (Cash Summary)</h3>
                      <button onClick={() => setIsExpenseModal(true)} className="text-[13px] bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-full font-bold hover:bg-gray-100 transition-colors shadow-sm flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-[#7a5c4e]"/> นำเงินเข้า / เบิกเงินออก
                      </button>
                    </div>
                    
                    {/* แก้ไข Padding ทุกแถวให้เท่ากัน (px-4) */}
                    <div className="p-4">
                      <div className="flex justify-between items-center py-3 px-4 border-b border-dashed border-gray-200">
                        <span className="text-[15px] text-gray-500 font-bold">เงินสดเริ่มต้น (Opening Cash)</span>
                        <span className="text-[15px] font-bold text-gray-600">฿{(currentShift?.opening_cash || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 px-4 border-b border-dashed border-gray-200">
                        <span className="text-[15px] font-bold text-gray-700">ยอดขายเงินสด (Cash Sales)</span>
                        <span className="text-[15px] font-black text-gray-800">+฿{(shiftSummary?.cashSales || 0).toLocaleString()}</span>
                      </div>
                      
                      {/* แสดงยอดเงินเข้า ถ้ามี */}
                      {totalCashIn > 0 && (
                        <div className="flex justify-between items-center py-3 px-4 border-b border-dashed border-gray-200 bg-gray-50 rounded-lg my-1">
                          <span className="text-[15px] font-bold text-gray-700">เงินเข้าเพิ่มเติม (Cash In)</span>
                          <span className="text-[15px] font-black text-gray-800">+฿{totalCashIn.toLocaleString()}</span>
                        </div>
                      )}

                      {/* แสดงยอดเงินออก (เบิกจ่าย) */}
                      <div className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg my-1">
                        <span className="text-[15px] font-bold text-gray-700">เงินออก / เบิกจ่าย (Expenses)</span>
                        <span className="text-[15px] font-black text-gray-800">-฿{totalCashOut.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* ประวัติการเงินเข้า/ออก (Log) */}
                  <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm overflow-hidden mb-6">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2"><List className="w-5 h-5 text-gray-500" /> ประวัติการนำเงินเข้าและออก</h3>
                    </div>
                    <div className="p-4 flex flex-col">
                      {expensesList && expensesList.length > 0 ? (
                        expensesList.map((exp: any, idx: number) => {
                          const isCashIn = Number(exp.amount) < 0; 
                          const displayAmount = Math.abs(Number(exp.amount)).toLocaleString();
                          
                          return (
                            <div key={idx} className="flex justify-between items-center p-4 hover:bg-gray-50 rounded-xl transition-colors border-b border-dashed border-gray-100 last:border-0">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-gray-600">
                                  {isCashIn ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[15px] font-bold text-gray-800">{exp.reason}</span>
                                  <span className="text-[13px] text-gray-500 mt-0.5">{formatTime(exp.created_at)}</span>
                                </div>
                              </div>
                              <span className="text-[16px] font-black text-gray-800">
                                {isCashIn ? '+' : '-'}฿{displayAmount}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center text-gray-400 py-8 text-[14px]">
                          ยังไม่มีรายการเบิกจ่ายหรือเพิ่มเงินในรอบการขายนี้
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* ฝั่งขวา (1/3) */}
                <div className="flex flex-col gap-6">
                  
                  {/* การชำระเงิน */}
                  <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2"><CreditCard className="w-5 h-5 text-gray-500" /> การชำระเงิน</h3>
                    </div>
                    <div className="p-4 flex flex-col gap-2">
                      <div className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors">
                        <span className="text-[14px] text-gray-600 font-medium">เงินสด</span>
                        <span className="text-[15px] font-bold text-gray-800">฿{(shiftSummary?.payments?.cash || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors">
                        <span className="text-[14px] text-gray-600 font-medium">เงินโอน / QR</span>
                        <span className="text-[15px] font-bold text-gray-800">฿{(shiftSummary?.payments?.transfer || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors">
                        <span className="text-[14px] text-gray-600 font-medium">บัตรเครดิต</span>
                        <span className="text-[15px] font-bold text-gray-800">฿{(shiftSummary?.payments?.credit || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* สินค้าทั้งหมดที่ขายได้ */}
                  <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[300px]">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2"><Package className="w-5 h-5 text-gray-500" /> สรุปรายการสินค้าทั้งหมด</h3>
                    </div>
                    <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
                      {soldProducts.length === 0 ? (
                        <div className="text-center text-gray-400 py-8 text-[14px]">ยังไม่มีรายการขายในรอบนี้</div>
                      ) : (
                        soldProducts.map((p, idx) => (
                          <div key={idx} className="flex justify-between items-center border-b border-dashed border-gray-100 pb-4 last:border-0 last:pb-0">
                            <div className="flex flex-col">
                              <span className="text-[14px] font-bold text-gray-800 mb-1">{p.name}</span>
                              <span className="text-[12px] text-gray-500 font-medium">ขาย {p.quantity} ชิ้น</span>
                            </div>
                            <span className="text-[15px] font-black text-gray-800">฿{Number(p.total).toLocaleString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =======================================
          MODALS
      ======================================= */}

      {/* Modal: เปิดรอบการขาย */}
      {isOpeningShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-[480px] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#f5f6f8] px-6 py-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-[18px] font-bold text-gray-800">เริ่มรอบการขายใหม่</h3>
              <button onClick={() => setIsOpeningShift(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 bg-[#7a5c4e]/10 rounded-full flex items-center justify-center mb-4">
                  <DollarSign className="w-8 h-8 text-[#7a5c4e]" />
                </div>
                <p className="text-gray-500 text-[14px] text-center font-medium">ระบบจะสร้างรอบการขายใหม่ ยอดขายหลังจากนี้จะถูกบันทึกในรอบปัจจุบัน โดยไม่กระทบกับข้อมูลกะเก่า</p>
              </div>
              <div className="mb-6">
                <label className="block text-[14px] font-bold text-gray-700 mb-2">เงินสดเริ่มต้น (เงินทอนในลิ้นชัก)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[18px]">฿</span>
                  <input type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className="w-full h-[54px] pl-10 pr-4 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] focus:ring-2 focus:ring-[#7a5c4e]/20 text-[18px] font-bold transition-all" placeholder="0.00" autoFocus />
                </div>
              </div>
              <button onClick={handleOpenShift} className="w-full py-4 bg-[#7a5c4e] text-white rounded-xl font-bold text-[16px] hover:bg-[#684c3f] shadow-md transition-all">ยืนยันเปิดรอบการขาย</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ปิดรอบการขาย (Blind Close & Double Confirm) */}
      {isClosingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-[500px] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#f5f6f8] px-6 py-5 flex justify-between items-center border-b border-gray-200">
              <h3 className="text-[18px] font-bold text-gray-800">
                {closeStep === 1 ? "ปิดรอบการขาย" : "ยืนยันการปิดรอบ"}
              </h3>
              <button onClick={() => setIsClosingShift(false)} className="text-gray-400 hover:text-gray-700 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6">
              {closeStep === 1 ? (
                <>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6 flex gap-3 text-orange-800">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-orange-500" />
                    <p className="text-[13px] font-medium">ระบุยอดเงินสดทั้งหมดที่นับได้จริงในลิ้นชัก (ระบบจะไม่แสดงยอดเงินที่ควรมีเพื่อความปลอดภัยของการจัดการเงินสด)</p>
                  </div>
                  
                  <div className="mb-8">
                    <label className="block text-[14px] font-bold text-gray-700 mb-3">ระบุเงินสดที่นับจริงในลิ้นชัก (฿)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[24px]">฿</span>
                      <input 
                        type="number" 
                        value={actualCash} 
                        onChange={(e) => setActualCash(e.target.value)} 
                        className="w-full h-[64px] pl-12 pr-4 rounded-xl border-2 border-gray-200 outline-none focus:border-[#7a5c4e] text-[28px] font-black text-center transition-all bg-gray-50" 
                        placeholder="0.00" 
                        autoFocus 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button onClick={() => setIsClosingShift(false)} className="py-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-[16px] hover:bg-gray-50 transition-colors">ยกเลิก</button>
                    <button onClick={handleNextCloseStep} className="py-4 bg-[#7a5c4e] text-white rounded-xl font-bold text-[16px] hover:bg-[#684c3f] transition-colors shadow-md">ดำเนินการต่อ</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-8 mt-2">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h4 className="text-[18px] font-bold text-gray-800 mb-2">คุณตรวจสอบยอดเงินถูกต้องหรือไม่?</h4>
                    <p className="text-gray-500 text-[14px] mb-6">หลังจากยืนยันแล้วจะไม่สามารถกลับมาแก้ไขรอบนี้ได้อีกและระบบจะพิมพ์รายงานอัตโนมัติ</p>
                    
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 inline-block min-w-[200px]">
                      <span className="block text-[13px] text-gray-500 font-medium mb-1">ยอดเงินสดที่นับได้จริง</span>
                      <span className="block text-[32px] font-black text-gray-800">฿{Number(actualCash).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setCloseStep(1)} className="py-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-[16px] hover:bg-gray-50 transition-colors">กลับไปแก้ไข</button>
                    <button onClick={handleCloseShift} className="py-4 bg-red-500 text-white rounded-xl font-bold text-[16px] hover:bg-red-600 transition-colors shadow-md flex justify-center items-center gap-2">
                      <CheckCircle className="w-5 h-5"/> ยืนยันปิดรอบ
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: เพิ่มเงิน / เบิกเงิน (ดีไซน์ใหม่) */}
      {isExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-[420px] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            
            <div className="p-6 pb-2 text-center relative border-b border-gray-100">
              <button onClick={() => setIsExpenseModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-2"><X className="w-5 h-5"/></button>
              <h3 className="text-[20px] font-bold text-gray-800 mt-2">จัดการเงินสดในลิ้นชัก</h3>
              <p className="text-gray-500 text-[13px] mt-1 font-medium mb-4">เลือกว่าต้องการนำเงินเข้า หรือเบิกเงินออก</p>
              
              {/* Tab สลับโหมด */}
              <div className="flex bg-gray-100 p-1.5 rounded-xl">
                <button 
                  onClick={() => setExpenseMode('in')} 
                  className={`flex-1 py-2.5 text-[14px] font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${expenseMode === 'in' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200/50'}`}
                >
                  <ArrowDownCircle className="w-4 h-4" /> นำเงินเข้า
                </button>
                <button 
                  onClick={() => setExpenseMode('out')} 
                  className={`flex-1 py-2.5 text-[14px] font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${expenseMode === 'out' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500 hover:bg-gray-200/50'}`}
                >
                  <ArrowUpCircle className="w-4 h-4" /> เบิกเงินออก
                </button>
              </div>
            </div>
            
            <div className="px-8 py-5 space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">
                  {expenseMode === 'in' ? 'จำนวนเงินที่นำเข้า (฿)' : 'จำนวนเงินที่เบิกออก (฿)'}
                </label>
                <input type="number" value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] text-[16px] font-bold" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">เหตุผล</label>
                <input type="text" value={expenseData.reason} onChange={e => setExpenseData({...expenseData, reason: e.target.value})} autoComplete="off" className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] text-[14px]" placeholder={expenseMode === 'in' ? "เช่น เติมเงินทอน..." : "เช่น ซื้อน้ำแข็ง, จ่ายค่าของ..."} />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">รหัส PIN 4 หลัก (เพื่อยืนยันตัวตน)</label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="password" maxLength={4} value={expenseData.pin} onChange={e => setExpenseData({...expenseData, pin: e.target.value})} autoComplete="new-password" placeholder="••••" className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] font-bold tracking-[0.5em] text-[18px]" />
                </div>
              </div>
            </div>

            <div className="px-8 pb-6 flex gap-3">
              <button onClick={() => setIsExpenseModal(false)} className="flex-1 py-3.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50">ยกเลิก</button>
              <button onClick={handleExpense} disabled={isExpensing} className={`flex-1 py-3.5 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all ${expenseMode === 'in' ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'} disabled:opacity-50`}>
                {isExpensing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} ยืนยันบันทึก
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}