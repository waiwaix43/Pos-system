"use client";
import { useToast } from '@/components/shared/ToastProvider';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from '@/components/shared/NotificationBell';
import UnifiedDateRangePicker, { DateRangeValue, getCurrentMonthToDate } from '@/components/shared/UnifiedDateRangePicker';
import { 
  Download, 
  Printer, 
  RefreshCw, 
  AlertCircle,
  TrendingUp,
  DollarSign,
  Package,
  CreditCard,
  Users,
  UserCircle,
  RotateCcw,
  Tag,
  FileText,
  Wallet,
  Activity,
  Clock,
  Archive,
  ChevronDown,
  BarChart3,
  FileSpreadsheet,
  FileIcon,
  Search,
  X
} from "lucide-react";

// ==========================================
// Custom Hook สำหรับโหลด API แยกส่วนอิสระ (Independent Fetching)
// ==========================================
function useReportAPI(endpoint: string, paramsStr: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApi = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:5000${endpoint}?${paramsStr}`);
      if (!res.ok) throw new Error(`ไม่สามารถโหลดข้อมูลได้ (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paramsStr) fetchApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsStr]);

  return { data, loading, error, retry: fetchApi };
}

const formatCurrency = (value: number) => `฿${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatSalesDate = (key: string, granularity: string, timeZone: string) => {
  const dateKey = granularity === "month" ? `${key}-01` : key.split("T")[0];
  const date = new Date(`${dateKey}T00:00:00+07:00`);
  if (granularity === "hour") return date.toLocaleDateString("th-TH", { timeZone, day: "numeric", month: "short", year: "numeric" }) + ` ${key.slice(11, 16)} น.`;
  return date.toLocaleDateString("th-TH", { timeZone, day: "numeric", month: "short", year: "numeric" });
};
const formatAxisLabel = (key: string, granularity: string, timeZone: string) => {
  if (granularity === "hour") return key.slice(11, 16);
  const dateKey = granularity === "month" ? `${key}-01` : key;
  return new Date(`${dateKey}T00:00:00+07:00`).toLocaleDateString("th-TH", { timeZone, day: "numeric", month: "short", year: "2-digit" });
};
const getDateKeyInBangkok = (date: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const getChartBucketKey = (dateKey: string, granularity: string) => {
  if (granularity === "month") return dateKey.slice(0, 7);
  if (granularity === "week") {
    const date = new Date(`${dateKey}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
  }
  return dateKey;
};
const getDateKeyRange = (startDate: string, endDate: string, granularity: string) => {
  if (!startDate || !endDate || startDate > endDate) return [];
  if (granularity === "month") {
    const keys: string[] = [];
    const [startYear, startMonth] = startDate.split("-").map(Number);
    const [endYear, endMonth] = endDate.split("-").map(Number);
    for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth);) {
      keys.push(`${year}-${String(month).padStart(2, "0")}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return keys;
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (granularity === "week") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const keys: string[] = [];
  for (const cursor = start; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + (granularity === "week" ? 7 : 1))) {
    keys.push(cursor.toISOString().slice(0, 10));
  }
  return keys;
};
const getInitialReportDateRange = (): DateRangeValue => {
  if (typeof window === "undefined") return getCurrentMonthToDate();
  const params = new URLSearchParams(window.location.search);
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  if (startDate && endDate) return { mode: "range", startDate, endDate, period: params.get("period") || "กำหนดเอง" };
  return getCurrentMonthToDate();
};

export default function ReportsDashboardPage() {
  const { showToast } = useToast();

  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  // Date Filter State
  const [dateSelection, setDateSelection] = useState<DateRangeValue>(getInitialReportDateRange);
  const [queryParams, setQueryParams] = useState<string>("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedSalesBucket, setSelectedSalesBucket] = useState<any | null>(null);
  const [hoveredSalesBucket, setHoveredSalesBucket] = useState<any | null>(null);
  const [chartGranularity, setChartGranularity] = useState("day");
  const [chartMetric, setChartMetric] = useState<"value" | "orderCount" | "itemCount">("value");
  const [reportTimeZone, setReportTimeZone] = useState("Asia/Bangkok");

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("userContext") || "{}");
    if (!savedUser || Object.keys(savedUser).length === 0) {
      router.push("/pin");
      return;
    }
    if (savedUser.role === "พนักงาน" || savedUser.role === "Cashier") {
      showToast("คุณไม่มีสิทธิ์เข้าถึงหน้านี้", 'error');
      router.push("/pos");
      return;
    }
    setUser(savedUser);
    fetch(`http://localhost:5000/api/settings?shop_id=${savedUser.shop_id}`)
      .then((response) => response.ok ? response.json() : null)
      .then((settings) => {
        if (settings?.timezone && settings.timezone !== "auto") setReportTimeZone(settings.timezone);
      })
      .catch(() => undefined);
  }, [router]);

  // อัปเดต Query Parameter เมื่อ User เปลี่ยนวันที่
  useEffect(() => {
    if (!user?.shop_id) return;
    if (!dateSelection.startDate || !dateSelection.endDate) return;

    const params = new URLSearchParams({
      shop_id: user.shop_id.toString(),
      period: dateSelection.period,
      startDate: dateSelection.startDate,
      endDate: dateSelection.endDate,
    });
    setQueryParams(params.toString());
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [dateSelection, user]);

  useEffect(() => {
    if (!dateSelection.startDate || !dateSelection.endDate) return;
    const dayCount = Math.max(1, Math.floor((Date.parse(`${dateSelection.endDate}T00:00:00Z`) - Date.parse(`${dateSelection.startDate}T00:00:00Z`)) / 86400000) + 1);
    setChartGranularity(dayCount <= 14 ? "day" : dayCount <= 180 ? "week" : "month");
  }, [dateSelection.startDate, dateSelection.endDate]);

  // ==========================================
  // Hooks โหลดข้อมูลแยกส่วน (Isolated Fetching)
  // ==========================================
  const summaryApi = useReportAPI("/api/reports/summary", queryParams);
  const salesApi = useReportAPI("/api/reports/sales", queryParams);
  const paymentsApi = useReportAPI("/api/reports/payments", queryParams);
  const productsApi = useReportAPI("/api/reports/products", queryParams);
  const shiftsApi = useReportAPI("/api/reports/shifts", queryParams);
  const inventoryApi = useReportAPI("/api/reports/inventory", queryParams);
  const customersApi = useReportAPI("/api/reports/customers", queryParams);
  const employeesApi = useReportAPI("/api/reports/employees", queryParams);
  const profitApi = useReportAPI("/api/reports/profit", queryParams);
  const taxApi = useReportAPI("/api/reports/tax", queryParams);
  const discountsApi = useReportAPI("/api/reports/discounts", queryParams);
  const returnsApi = useReportAPI("/api/reports/returns", queryParams);
  const expensesApi = useReportAPI("/api/reports/expenses", queryParams);
  const stockMovementsApi = useReportAPI("/api/reports/stock-movement", queryParams);

  // สิทธิ์ Cashier ซ่อนรายงานการเงิน
  const isCashier = user?.role === "Cashier";
  const sourceSalesChart = Array.isArray(salesApi.data?.chart)
    ? salesApi.data.chart
    : Array.isArray(salesApi.data?.trend)
      ? salesApi.data.trend
      : [];
  const salesChart = (() => {
    if (sourceSalesChart.length === 0) return [];
    const grouped = new Map<string, any>();
    const ensureBucket = (key: string) => {
      if (!grouped.has(key)) grouped.set(key, { key, label: key, value: 0, orderCount: 0, itemCount: 0, orders: [] });
      return grouped.get(key);
    };
    const hasOrderDetails = sourceSalesChart.every((bucket: any) => Array.isArray(bucket.orders));
    if (hasOrderDetails) {
      sourceSalesChart.flatMap((bucket: any) => bucket.orders).forEach((order: any) => {
        const key = getChartBucketKey(getDateKeyInBangkok(order.createdAt), chartGranularity);
        const bucket = ensureBucket(key);
        const amount = Number(order.amount) || 0;
        const itemCount = Number(order.itemCount) || 0;
        bucket.value += amount;
        bucket.orderCount += 1;
        bucket.itemCount += itemCount;
        bucket.orders.push(order);
      });
    } else {
      sourceSalesChart.forEach((sourceBucket: any) => {
        const dateKey = String(sourceBucket.key || sourceBucket.label || "").slice(0, 10);
        const key = getChartBucketKey(dateKey, chartGranularity);
        const bucket = ensureBucket(key);
        bucket.value += Number(sourceBucket.value ?? sourceBucket.amount) || 0;
        bucket.orderCount += Number(sourceBucket.orderCount) || 0;
        bucket.itemCount += Number(sourceBucket.itemCount) || 0;
        bucket.orders.push(...(sourceBucket.orders || []));
      });
    }
    getDateKeyRange(dateSelection.startDate, dateSelection.endDate, chartGranularity).forEach(ensureBucket);
    return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key)).map(bucket => ({
      ...bucket,
      averageBill: bucket.orderCount > 0 ? bucket.value / bucket.orderCount : 0,
    }));
  })();
  const maxSalesValue = Math.max(...salesChart.map((item: any) => Number(item[chartMetric]) || 0), 0) * 1.2;
  const summary = summaryApi.data?.summary || summaryApi.data || {};
  const totalSales = Number(summary.netSales) || 0;
  const totalBills = Number(summary.totalBills) || 0;
  const totalItems = Number(summary.totalItems) || 0;
  const averageBill = Number(summary.avgBill) || 0;
  const rangeDayCount = dateSelection.startDate && dateSelection.endDate
    ? Math.max(1, Math.floor((Date.parse(`${dateSelection.endDate}T00:00:00Z`) - Date.parse(`${dateSelection.startDate}T00:00:00Z`)) / 86400000) + 1)
    : 1;
  const bestSalesBucket = salesChart.reduce((best: any, bucket: any) => Number(bucket.value) > Number(best?.value || 0) ? bucket : best, null);
  const dailyAverage = totalSales / rangeDayCount;

  const handleExport = (format: string) => {
    window.location.href = `http://localhost:5000/api/reports/export?shop_id=${user?.shop_id}&format=${format}&period=${dateSelection.period}&startDate=${dateSelection.startDate}&endDate=${dateSelection.endDate}`;
    setShowExportMenu(false);
  };

  // Helper สำหรับ Render Generic Table หาก Backend ไม่ส่ง Structure ที่รู้จักกลับมา
  const renderGenericTable = (data: any) => {
    if (!data) return <EmptyState />;
    if (data.available === false) return <UnavailableState message={data.message} />;
    
    // แบบเก่า { table: { headers: [], rows: [] } }
    if (data.table?.headers && data.table?.rows) {
      if (data.table.rows.length === 0) return <EmptyState />;
      return (
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-full">
            <thead>
              <tr>
                {data.table.headers.map((h: string, i: number) => (
                  <th key={i} className="px-4 py-3 text-[12px] font-bold text-gray-500 border-b border-gray-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.table.rows.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50 border-b border-dashed border-gray-100 last:border-0">
                  {Object.values(row).map((val: any, j: number) => (
                    <td key={j} className="px-4 py-3 text-[14px] text-gray-800">{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    // แบบ Array of Objects
    if (Array.isArray(data) && data.length > 0) {
      const keys = Object.keys(data[0]);
      return (
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-full">
            <thead>
              <tr>
                {keys.map((k, i) => (
                  <th key={i} className="px-4 py-3 text-[12px] font-bold text-gray-500 border-b border-gray-200 uppercase whitespace-nowrap">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 border-b border-dashed border-gray-100 last:border-0">
                  {keys.map((k, j) => (
                    <td key={j} className="px-4 py-3 text-[14px] text-gray-800">{row[k]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <EmptyState />;
  };

  const renderStockMovementTable = (data: any) => {
    if (!data) return <EmptyState />;
    if (data.available === false) return <UnavailableState message={data.message} />;
    if (!Array.isArray(data) || data.length === 0) return <EmptyState />;

    return (
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              {['วันที่', 'รายการวัตถุดิบ', 'ประเภท', 'จำนวนที่เปลี่ยน', 'หน่วย', 'คงเหลือ', 'รายละเอียด'].map((heading) => (
                <th key={heading} className="border-b border-gray-200 px-3 py-3 text-[11px] font-bold text-gray-500 whitespace-nowrap">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((movement: any, index: number) => {
              const quantityText = String(movement['จำนวนที่เปลี่ยน'] ?? '-');
              const isOutgoing = quantityText.startsWith('-');
              return (
                <tr key={`${movement['วันที่']}-${movement['รายการวัตถุดิบ']}-${index}`} className="border-b border-dashed border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-3 text-[12px] text-gray-500 whitespace-nowrap">{movement['วันที่']}</td>
                  <td className="px-3 py-3 text-[13px] font-bold text-gray-800">{movement['รายการวัตถุดิบ']}</td>
                  <td className="px-3 py-3 text-[12px] text-gray-600 whitespace-nowrap">{movement['ประเภท']}</td>
                  <td className={`px-3 py-3 text-right text-[14px] font-black whitespace-nowrap ${isOutgoing ? 'text-red-500' : 'text-green-600'}`}>{quantityText}</td>
                  <td className="px-3 py-3 text-[12px] text-gray-500">{movement['หน่วย']}</td>
                  <td className="px-3 py-3 text-right text-[13px] font-bold text-gray-700">{movement['คงเหลือหลังรายการ']}</td>
                  <td className="px-3 py-3 text-[12px] text-gray-500">{movement['รายละเอียด']}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f7f6f3] font-sans print:h-auto print:overflow-visible print:bg-white md:flex-row">

      {/* 🌟 Main Sidebar (ห้ามเปลี่ยน) 🌟 */}
      <div className="z-20 flex max-h-[34vh] w-full shrink-0 flex-col justify-between overflow-y-auto bg-[#4d4d4d] text-white shadow-lg print:hidden md:max-h-none md:w-[240px]">
        <div>
          <div className="flex h-[54px] items-center justify-center gap-3 md:h-[90px] md:translate-x-3">
            <h1 className="text-[28px] font-black italic tracking-widest text-white md:text-[36px]">POS</h1>
            <NotificationBell />
          </div>
          <nav className="sidebar-menu grid grid-cols-2 text-[12px] md:flex md:flex-col md:text-[16px]">
            <button onClick={() => router.push('/pos')} className="border-b border-[#666666] px-3 py-2 text-left text-gray-300 transition-colors hover:bg-[#666666] md:px-6 md:py-5">สั่งและชำระเงิน</button>
            <button onClick={() => router.push('/pos/history')} className="border-b border-[#666666] px-3 py-2 text-left text-gray-300 transition-colors hover:bg-[#666666] md:px-6 md:py-5">ประวัติใบเสร็จ</button>
            <button onClick={() => router.push('/pos/inventory')} className="border-b border-[#666666] px-3 py-2 text-left text-gray-300 transition-colors hover:bg-[#666666] md:px-6 md:py-5">สินค้าคงคลัง</button>
            <button onClick={() => router.push('/pos/shifts')} className="border-b border-[#666666] px-3 py-2 text-left text-gray-300 transition-colors hover:bg-[#666666] md:px-6 md:py-5">รอบการขาย</button>
            {user && user.role !== 'พนักงาน' && user.role !== 'Cashier' && (
          <button onClick={() => router.push('/pos/menu')} className="border-b border-[#666666] px-3 py-2 text-left text-gray-300 transition-colors hover:bg-[#666666] md:px-6 md:py-5">เมนูและโปรโมชั่น</button>
          )}
            {user && user.role !== 'พนักงาน' && user.role !== 'Cashier' && (
          <button className="border-b border-[#666666] border-l-4 border-l-white bg-[#666666] px-3 py-2 text-left font-medium transition-colors md:px-6 md:py-5">รายงาน</button>
          )}
            {user && user.role !== 'พนักงาน' && user.role !== 'Cashier' && (
          <button onClick={() => router.push('/pos/employees')} className="border-b border-[#666666] px-3 py-2 text-left text-gray-300 transition-colors hover:bg-[#666666] md:px-6 md:py-5">พนักงาน</button>
          )}
            <button onClick={() => router.push('/pos/settings')} className="border-b border-[#666666] px-3 py-2 text-left text-gray-300 transition-colors hover:bg-[#666666] md:px-6 md:py-5">การตั้งค่า</button>
          </nav>
        </div>
        <button onClick={() => {
        if (user?.pin_enabled === false) {
          localStorage.removeItem("userContext");
          router.push('/');
        } else {
          router.push('/pin');
        }
      }} className="border-t border-[#666666] px-3 py-2 text-left text-[12px] text-gray-300 transition-colors hover:bg-[#666666] md:px-6 md:py-6 md:text-[16px]">
        {user?.pin_enabled === false ? 'ออกจากระบบ' : 'กลับสู่หน้า PIN'}
      </button>
      </div>

      {/* ===================== MAIN DASHBOARD CONTENT ===================== */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        
        <div className="z-10 flex w-full shrink-0 flex-col gap-4 border-b border-gray-200 bg-white px-4 py-4 shadow-sm print:hidden sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold text-gray-900 sm:text-[22px]">แนวโน้มยอดขาย (Sales Analytics)</h2>
            <p className="mt-1 text-[13px] text-gray-500">ภาพรวมยอดขายและสถิติการขายตามช่วงเวลา</p>
          </div>
          
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
            <UnifiedDateRangePicker value={dateSelection} onChange={setDateSelection} className="max-w-full" />

            {/* Export Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)} 
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-[14px] font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                <Download className="w-4 h-4" /> Export <ChevronDown className="w-4 h-4 text-gray-400"/>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-14 w-[180px] bg-white border border-gray-200 rounded-[16px] shadow-xl py-2 z-50 overflow-hidden">
                  <button onClick={() => handleExport("csv")} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-[14px] font-bold text-gray-700"><FileText className="w-4 h-4 text-[#7a5c4e]"/> Export CSV</button>
                  <button onClick={() => handleExport("excel")} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-[14px] font-bold text-gray-700"><FileSpreadsheet className="w-4 h-4 text-gray-600"/> Export Excel</button>
                  <button onClick={() => handleExport("pdf")} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-[14px] font-bold text-gray-700"><FileIcon className="w-4 h-4 text-gray-600"/> Export PDF</button>
                </div>
              )}
            </div>

            <button onClick={() => window.print()} className="flex h-[48px] w-[48px] items-center justify-center rounded-xl border border-[#7a5c4e] bg-[#7a5c4e] text-white shadow-sm transition-colors hover:bg-[#684c3f]" title="พิมพ์ Dashboard" aria-label="พิมพ์ Dashboard">
              <Printer className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 🌟 DASHBOARD AREA 🌟 */}
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden bg-[#f7f6f3] p-4 sm:p-6 print:overflow-visible print:bg-white print:p-0">
          <div className="flex w-full min-w-0 flex-col gap-6">
            
            <SectionWrapper state={summaryApi} title="" hideTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard title="ยอดขายรวม" value={totalSales} icon={<DollarSign />} isCurrency description="ยอดขายสุทธิในช่วงที่เลือก" />
                <KPICard title="จำนวนบิล" value={totalBills} icon={<FileText />} description="รายการขายที่สำเร็จ" />
                <KPICard title="สินค้าที่ขาย" value={totalItems} icon={<Package />} description="จำนวนชิ้นจากรายการขาย" unit="ชิ้น" />
                <KPICard title="ค่าเฉลี่ยต่อบิล" value={averageBill} icon={<Activity />} isCurrency description="ยอดขายรวม ÷ จำนวนบิล" />
              </div>
            </SectionWrapper>

            <SectionWrapper state={salesApi} title={`กราฟแนวโน้มยอดขาย${chartGranularity === "day" ? "รายวัน" : chartGranularity === "week" ? "รายสัปดาห์" : "รายเดือน"}`} icon={<BarChart3 className="h-5 w-5 text-[#7a5c4e]" />}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <p className="text-[13px] text-gray-500">ยอดขายจริงตามรายการที่สำเร็จในช่วงเวลาที่เลือก</p>
                <div className="flex flex-wrap gap-2">
                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-gray-500">
                    ช่วงกราฟ
                    <select value={chartGranularity} onChange={event => setChartGranularity(event.target.value)} className="min-h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-700">
                      <option value="day">รายวัน</option>
                      <option value="week">รายสัปดาห์</option>
                      <option value="month">รายเดือน</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-gray-500">
                    แสดงข้อมูล
                    <select value={chartMetric} onChange={event => setChartMetric(event.target.value as typeof chartMetric)} className="min-h-10 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-700">
                      <option value="value">ยอดขาย</option>
                      <option value="orderCount">จำนวนบิล</option>
                      <option value="itemCount">จำนวนสินค้าที่ขาย</option>
                    </select>
                  </label>
                </div>
              </div>
              {salesChart.length > 0 ? (
                <>
                  <div className="mb-4 min-h-[92px]">
                    {hoveredSalesBucket && (
                      <div className="rounded-xl border border-[#e5d7cb] bg-[#f8f4ef] px-4 py-3 text-gray-800 shadow-sm" aria-live="polite">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[#e8ddd4] pb-2">
                          <span className="text-[13px] font-bold">{formatSalesDate(hoveredSalesBucket.key, chartGranularity, reportTimeZone)}</span>
                          <span className="text-[11px] font-medium text-gray-500">รายละเอียดช่วงเวลา</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div><span className="block text-[11px] text-gray-500">ยอดขาย</span><span className="text-[13px] font-bold">{formatCurrency(hoveredSalesBucket.value)}</span></div>
                          <div><span className="block text-[11px] text-gray-500">จำนวนบิล</span><span className="text-[13px] font-bold">{hoveredSalesBucket.orderCount.toLocaleString()} บิล</span></div>
                          <div><span className="block text-[11px] text-gray-500">จำนวนสินค้า</span><span className="text-[13px] font-bold">{hoveredSalesBucket.itemCount.toLocaleString()} ชิ้น</span></div>
                          <div><span className="block text-[11px] text-gray-500">เฉลี่ยต่อบิล</span><span className="text-[13px] font-bold">{formatCurrency(hoveredSalesBucket.averageBill)}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative h-[330px] w-full rounded-xl border border-[#e9e3dc] bg-[#fcfbf9] px-2 pb-2 pt-4 sm:px-4">
                    <div className="pointer-events-none absolute left-[58px] right-3 top-4 h-[220px] sm:left-[76px] sm:right-5">
                      {[0, 25, 50, 75, 100].map(level => {
                        const tickValue = maxSalesValue * level / 100;
                        const tickLabel = chartMetric === "value"
                          ? formatCurrency(tickValue)
                          : Math.round(tickValue).toLocaleString();
                        return (
                          <div key={level} className="absolute inset-x-0 border-t border-dashed border-[#e5e1dc]" style={{ bottom: `${level}%` }}>
                            <span className="absolute -left-[54px] -top-[9px] w-[48px] text-right text-[9px] leading-3 text-gray-500 sm:-left-[70px] sm:w-[64px] sm:text-[10px]">{tickLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="absolute left-[58px] right-3 top-4 flex h-[300px] items-stretch sm:left-[76px] sm:right-5">
                      {salesChart.map((bucket: any) => {
                        const metricValue = Number(bucket[chartMetric]) || 0;
                        const height = maxSalesValue > 0 ? Math.max(metricValue / maxSalesValue * 100, metricValue > 0 ? 1 : 0) : 0;
                        const axisLabel = formatAxisLabel(bucket.key, chartGranularity, reportTimeZone);
                        return (
                          <button key={bucket.key} type="button" onClick={() => setSelectedSalesBucket(bucket)} onMouseEnter={() => setHoveredSalesBucket(bucket)} onMouseLeave={() => setHoveredSalesBucket(null)} onFocus={() => setHoveredSalesBucket(bucket)} onBlur={() => setHoveredSalesBucket(null)} className="flex min-w-0 flex-1 flex-col items-center rounded-sm px-px text-center focus-visible:z-10 focus-visible:bg-[#f4eee8] focus-visible:ring-2 focus-visible:ring-[#7a5c4e]" aria-label={`${formatSalesDate(bucket.key, chartGranularity, reportTimeZone)}: ${chartMetric === "value" ? formatCurrency(metricValue) : metricValue.toLocaleString()}`} title={`${formatSalesDate(bucket.key, chartGranularity, reportTimeZone)} · ${chartMetric === "value" ? formatCurrency(metricValue) : metricValue.toLocaleString()}`}>
                            <span className="flex h-[220px] w-full items-end">
                              <span className={`w-[60%] max-w-14 rounded-t-lg shadow-[0_3px_8px_rgba(122,92,78,0.12)] transition-[height,background-color,box-shadow] duration-200 ${hoveredSalesBucket?.key === bucket.key ? "bg-[#684c3f] shadow-[0_4px_10px_rgba(104,76,63,0.24)]" : "bg-[#9b806f]"}`} style={{ height: `${height}%` }} />
                            </span>
                            <span className="mt-2 w-full whitespace-normal break-words text-[9px] leading-3 text-gray-600 sm:text-[10px]">{axisLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : <EmptyState />}
            </SectionWrapper>

            <SectionWrapper state={salesApi} title="สรุปยอดขาย" icon={<TrendingUp className="h-5 w-5 text-[#7a5c4e]" />}>
              {totalBills > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <SummaryMetric label="ยอดขายสูงสุด" value={formatCurrency(Number(bestSalesBucket?.value) || 0)} />
                  <SummaryMetric label="วันที่ขายดีที่สุด" value={bestSalesBucket && Number(bestSalesBucket.value) > 0 ? formatSalesDate(bestSalesBucket.key, chartGranularity, reportTimeZone) : "ไม่มีข้อมูลยอดขาย"} />
                  <SummaryMetric label="จำนวนบิลทั้งหมด" value={`${totalBills.toLocaleString()} บิล`} />
                  <SummaryMetric label="สินค้าขายทั้งหมด" value={`${totalItems.toLocaleString()} ชิ้น`} />
                  <SummaryMetric label="ค่าเฉลี่ยต่อบิล" value={formatCurrency(averageBill)} />
                  <SummaryMetric label="ยอดขายเฉลี่ยต่อวัน" value={formatCurrency(dailyAverage)} />
                </div>
              ) : <EmptyState />}
            </SectionWrapper>

            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
              <SectionWrapper state={productsApi} title="สินค้าขายดี" icon={<Package className="h-5 w-5 text-[#7a5c4e]" />}>
                {Array.isArray(productsApi.data) && productsApi.data.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-[480px] border-collapse text-left">
                      <thead><tr className="border-b border-gray-200 text-[11px] font-bold text-gray-500"><th className="px-3 py-3">อันดับ</th><th className="px-3 py-3">สินค้า</th><th className="px-3 py-3 text-right">จำนวนขาย</th><th className="px-3 py-3 text-right">ยอดขาย</th></tr></thead>
                      <tbody>{productsApi.data.map((product: any, index: number) => (
                        <tr key={`${product["ชื่อสินค้า"]}-${index}`} className="border-b border-[#f0ece7] text-[13px] text-gray-700 last:border-0 hover:bg-[#faf8f5]">
                          <td className="px-3 py-3 font-semibold text-[#7a5c4e]">{index + 1}</td>
                          <td className="px-3 py-3 font-semibold text-gray-800">{product["ชื่อสินค้า"] || "ไม่ระบุชื่อ"}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">{Number(product["ขายได้ (ชิ้น)"] || 0).toLocaleString()} ชิ้น</td>
                          <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">{formatCurrency(Number(String(product["ยอดรวม (฿)"] || 0).replace(/,/g, "")) || 0)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <EmptyState />}
              </SectionWrapper>

              <SectionWrapper state={paymentsApi} title="ยอดขายตามช่องทางการชำระเงิน" icon={<CreditCard className="h-5 w-5 text-[#7a5c4e]" />}>
                {Array.isArray(paymentsApi.data) && paymentsApi.data.length > 0 ? (() => {
                  const rows = paymentsApi.data.map((payment: any) => ({
                    method: payment["ช่องทาง"] || "ไม่ระบุ",
                    count: Number(payment["จำนวนรายการ"]) || 0,
                    amount: Number(String(payment["ยอดรวม (฿)"] || 0).replace(/,/g, "")) || 0,
                  }));
                  const paymentTotal = rows.reduce((sum: number, payment: any) => sum + payment.amount, 0);
                  return (
                    <div className="w-full overflow-x-auto">
                      <table className="w-full min-w-[520px] border-collapse text-left">
                        <thead><tr className="border-b border-gray-200 text-[11px] font-bold text-gray-500"><th className="px-3 py-3">ช่องทาง</th><th className="px-3 py-3 text-right">จำนวนบิล</th><th className="px-3 py-3 text-right">ยอดขาย</th><th className="px-3 py-3">% ยอดขาย</th></tr></thead>
                        <tbody>{rows.map((payment: any, index: number) => {
                          const percent = paymentTotal > 0 ? payment.amount / paymentTotal * 100 : 0;
                          return (
                            <tr key={`${payment.method}-${index}`} className="border-b border-[#f0ece7] text-[13px] text-gray-700 last:border-0">
                              <td className="px-3 py-3 font-semibold text-gray-800">{payment.method}</td>
                              <td className="px-3 py-3 text-right whitespace-nowrap">{payment.count.toLocaleString()}</td>
                              <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">{formatCurrency(payment.amount)}</td>
                              <td className="min-w-[110px] px-3 py-3">
                                <div className="flex items-center gap-2"><div className="h-2 min-w-10 flex-1 rounded-full bg-[#eee8e2]"><div className="h-2 rounded-full bg-[#7a5c4e]" style={{ width: `${percent}%` }} /></div><span className="w-10 text-right text-[11px] text-gray-500">{percent.toFixed(1)}%</span></div>
                              </td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                    </div>
                  );
                })() : <EmptyState />}
              </SectionWrapper>
            </div>

            {/* 4. OPERATION ANALYTICS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <SectionWrapper state={shiftsApi} title="ประสิทธิภาพรอบการขาย" className="lg:col-span-1" icon={<Clock className="w-5 h-5 text-[#7a5c4e]"/>}>
                  {renderGenericTable(shiftsApi.data)}
               </SectionWrapper>
               
               <SectionWrapper state={employeesApi} title="ประสิทธิภาพพนักงาน" className="lg:col-span-1" icon={<UserCircle className="w-5 h-5 text-[#7a5c4e]"/>}>
                  {renderGenericTable(employeesApi.data)}
               </SectionWrapper>
               
               <SectionWrapper state={customersApi} title="วิเคราะห์ลูกค้า" className="lg:col-span-1" icon={<Users className="w-5 h-5 text-[#7a5c4e]"/>}>
                  {renderGenericTable(customersApi.data)}
               </SectionWrapper>
            </div>

            {/* 5. INVENTORY & STOCK */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <SectionWrapper state={inventoryApi} title="สถานะสินค้าคงคลัง" className="lg:col-span-1" icon={<Archive className="w-5 h-5 text-[#7a5c4e]"/>}>
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 border border-gray-100 p-4 rounded-[16px] text-center">
                      <span className="block text-[12px] font-bold text-gray-500 uppercase">สินค้าทั้งหมด</span>
                      <span className="block text-[24px] font-black text-gray-700">{inventoryApi.data?.totalItems}</span>
                    </div>
                    <button type="button" onClick={() => router.push('/pos/inventory?stock=out')} className="bg-gray-50 border border-gray-200 p-4 rounded-[16px] text-center hover:bg-gray-100 transition-colors">
                      <span className="block text-[12px] font-bold text-gray-600 uppercase">สินค้าหมด</span>
                      <span className="block text-[24px] font-black text-gray-800">{inventoryApi.data?.outOfStock || 0}</span>
                    </button>
                    <button type="button" onClick={() => router.push('/pos/inventory?stock=low')} className="bg-gray-50 border border-gray-200 p-4 rounded-[16px] text-center hover:bg-gray-100 transition-colors">
                      <span className="block text-[12px] font-bold text-gray-600 uppercase">ใกล้หมดสต็อก</span>
                      <span className="block text-[24px] font-black text-gray-800">{inventoryApi.data?.lowStock || 0}</span>
                    </button>
                  </div>
                  {renderGenericTable(inventoryApi.data?.table || inventoryApi.data?.alertItems || inventoryApi.data)}
               </SectionWrapper>

               <SectionWrapper state={stockMovementsApi} title="การเคลื่อนไหวของ Stock" className="lg:col-span-1" icon={<Activity className="w-5 h-5 text-[#7a5c4e]"/>}>
                {renderStockMovementTable(stockMovementsApi.data)}
               </SectionWrapper>
            </div>

            {/* 6. FINANCIAL & ACCOUNTING */}
            {!isCashier && (
              <>
                <SectionWrapper state={profitApi} title="ภาพรวมทางการเงิน" icon={<Wallet className="w-5 h-5 text-[#7a5c4e]"/>}>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="bg-gray-50 border border-gray-200 p-5 rounded-[16px] flex flex-col justify-center">
                       <span className="text-[13px] font-bold text-gray-500 mb-1">รายรับรวม</span>
                       <span className="text-[22px] font-black text-gray-800">฿{Number(profitApi.data?.revenue || 0).toLocaleString()}</span>
                     </div>
                     <div className="bg-gray-50 border border-gray-200 p-5 rounded-[16px] flex flex-col justify-center">
                       <span className="text-[13px] font-bold text-gray-500 mb-1">รายจ่ายรวม</span>
                       <span className="text-[22px] font-black text-gray-800">฿{Number(profitApi.data?.expenses || 0).toLocaleString()}</span>
                     </div>
                     <div className="bg-gray-50 border border-gray-200 p-5 rounded-[16px] flex flex-col justify-center">
                       <span className="text-[13px] font-bold text-gray-500 mb-1">ต้นทุนสินค้า (COGS)</span>
                       <span className="text-[18px] font-black text-gray-800">{profitApi.data?.cogsAvailable ? `฿${Number(profitApi.data.cogs).toLocaleString()}` : "ยังคำนวณไม่ได้"}</span>
                     </div>
                     <div className="bg-gray-50 border border-gray-200 p-5 rounded-[16px] flex flex-col justify-center">
                       <span className="text-[13px] font-bold text-gray-500 mb-1">กำไรสุทธิ (Net Profit)</span>
                       <span className="text-[18px] font-black text-gray-800">{profitApi.data?.cogsAvailable ? `฿${Number(profitApi.data.netProfit).toLocaleString()}` : "ยังคำนวณไม่ได้"}</span>
                     </div>
                  </div>
                </SectionWrapper>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   <SectionWrapper state={taxApi} title="ภาษี (Tax)" className="lg:col-span-1" icon={<FileText className="w-5 h-5 text-[#7a5c4e]"/>}>
                      {renderGenericTable(taxApi.data)}
                   </SectionWrapper>
                   <SectionWrapper state={discountsApi} title="ส่วนลด (Discounts)" className="lg:col-span-1" icon={<Tag className="w-5 h-5 text-[#7a5c4e]"/>}>
                      {renderGenericTable(discountsApi.data)}
                   </SectionWrapper>
                   <SectionWrapper state={returnsApi} title="การคืนสินค้า (Returns)" className="lg:col-span-1" icon={<RotateCcw className="w-5 h-5 text-[#7a5c4e]"/>}>
                      {renderGenericTable(returnsApi.data)}
                   </SectionWrapper>
                </div>
              </>
            )}

            <div className="h-10"></div> {/* Bottom Padding */}
          </div>
        </div>
      </div>

      {selectedSalesBucket && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedSalesBucket(null)}>
          <div className="max-h-[85vh] w-full max-w-[760px] overflow-hidden rounded-[20px] bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h3 className="text-[18px] font-bold text-gray-800">รายละเอียดการขาย</h3>
                <p className="mt-1 text-[13px] text-gray-500">{formatSalesDate(selectedSalesBucket.key || selectedSalesBucket.label, chartGranularity, reportTimeZone)}</p>
              </div>
              <button type="button" onClick={() => setSelectedSalesBucket(null)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="ปิดรายละเอียด"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 border-b border-gray-100 p-6 sm:grid-cols-4">
              <DetailMetric label="ยอดขายรวม" value={formatCurrency(Number(selectedSalesBucket.value) || 0)} />
              <DetailMetric label="จำนวนบิล" value={`${selectedSalesBucket.orderCount || 0} บิล`} />
              <DetailMetric label="จำนวนสินค้า" value={`${selectedSalesBucket.itemCount || 0} ชิ้น`} />
              <DetailMetric label="ยอดเฉลี่ย / บิล" value={formatCurrency(Number(selectedSalesBucket.averageBill) || 0)} />
            </div>
            <div className="max-h-[48vh] overflow-auto px-6 pb-6">
              {selectedSalesBucket.orders?.length ? (
                <table className="w-full min-w-[620px] text-left">
                  <thead><tr className="border-b border-gray-200 text-[12px] text-gray-500"><th className="py-3">เลขที่บิล</th><th>เวลา</th><th>พนักงาน</th><th>จำนวนสินค้า</th><th>ยอดรวม</th><th>ช่องทางชำระเงิน</th></tr></thead>
                  <tbody>{selectedSalesBucket.orders.map((order: any) => <tr key={order.id} className="border-b border-dashed border-gray-100 text-[13px] text-gray-700"><td className="py-3 font-bold">{order.billNumber || `#${order.id}`}</td><td>{new Date(order.createdAt).toLocaleTimeString("th-TH", { timeZone: reportTimeZone, hour: "2-digit", minute: "2-digit" })}</td><td>{order.staffName || "ไม่ระบุ"}</td><td>{order.itemCount} ชิ้น</td><td>{formatCurrency(Number(order.amount) || 0)}</td><td>{order.paymentMethod || "ไม่ระบุ"}</td></tr>)}</tbody>
                </table>
              ) : <EmptyState />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// องค์ประกอบย่อย (UI Components)
// ==========================================

function SectionWrapper({ state, title, icon, children, className = "", hideTitle = false }: any) {
  if (state.loading) {
    return (
      <div className={`flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-8 shadow-sm ${className}`}>
        <RefreshCw className="w-6 h-6 animate-spin text-gray-300 mb-2" />
        <span className="text-[13px] font-medium text-gray-400">กำลังโหลด...</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm ${className}`}>
        <AlertCircle className="w-8 h-8 text-red-300 mb-2" />
        <span className="text-[14px] font-bold text-gray-700 mb-1">ไม่สามารถโหลดข้อมูลได้</span>
        <button onClick={state.retry} className="text-[12px] font-bold text-red-500 bg-red-50 px-4 py-1.5 rounded-full hover:bg-red-100 transition-colors mt-2">
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className={`${hideTitle ? "" : "flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm"} ${className}`}>
      {!hideTitle && (
        <div className="flex shrink-0 items-center gap-3 rounded-t-2xl border-b border-gray-100 bg-[#fbfaf8] px-5 py-4 sm:px-6">
          {icon}
          <h3 className="text-[15px] font-bold text-gray-900 sm:text-[16px]">{title}</h3>
        </div>
      )}
      <div className={`flex-1 flex flex-col ${!hideTitle ? 'p-6' : ''}`}>
        {children}
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, isCurrency = false, hidden = false, description = "", unit = "" }: any) {
  if (hidden) return null;
  return (
    <div className="flex min-h-[152px] min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 text-gray-500">
         <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4eee8] text-[#7a5c4e]">
           {icon}
         </div>
         <span className="text-[13px] font-bold text-gray-600">{title}</span>
      </div>
      <span className="mt-4 break-words text-[26px] font-black leading-tight text-gray-900 sm:text-[30px]">
        {isCurrency ? formatCurrency(Number(value) || 0) : `${Number(value || 0).toLocaleString()}${unit ? ` ${unit}` : ""}`}
      </span>
      <span className="mt-2 text-[11px] leading-4 text-gray-500">{description}</span>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#eee9e3] bg-[#fcfbf9] p-4">
      <span className="block text-[12px] font-medium text-gray-500">{label}</span>
      <span className="mt-1 block break-words text-[17px] font-bold leading-6 text-gray-900">{value}</span>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-gray-50 p-3"><span className="block text-[11px] font-bold text-gray-500">{label}</span><span className="mt-1 block text-[15px] font-black text-gray-800">{value}</span></div>;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
      <Search className="w-8 h-8 mb-3 opacity-30" />
      <span className="text-[14px] font-bold text-gray-500 mb-1">ยังไม่มีข้อมูลในช่วงเวลานี้</span>
      <span className="text-[12px]">ลองเปลี่ยนช่วงเวลาเพื่อดูข้อมูลเพิ่มเติม</span>
    </div>
  );
}

function UnavailableState({ message }: { message: string }) {
  return <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400"><AlertCircle className="mb-3 h-8 w-8 opacity-40" /><span className="text-[13px] font-bold text-gray-500">{message}</span></div>;
}