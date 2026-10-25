"use client";
import { useToast } from '@/components/shared/ToastProvider';
import { useState, useEffect, useRef } from "react";
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
 X,
 ShoppingCart,
 Copy,
 Check,
 Maximize2,
 Minimize2,
 AlertTriangle
} from "lucide-react";

// ==========================================
// Custom Hook สำหรับโหลด API แยกส่วนอิสระ (Independent Fetching)
// ==========================================
function useReportAPI(endpoint: string, paramsStr: string) {
 const [data, setData] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const inFlightParamsRef = useRef<string | null>(null);
 const requestIdRef = useRef(0);

 const fetchApi = async () => {
 if (inFlightParamsRef.current === paramsStr) return;
 inFlightParamsRef.current = paramsStr;
 const currentReqId = ++requestIdRef.current;
 setLoading(true);
 setError(null);
 try {
 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}${endpoint}?${paramsStr}`);
 if (!res.ok) throw new Error(`ไม่สามารถโหลดข้อมูลได้ (${res.status})`);
 const json = await res.json();
 if (currentReqId === requestIdRef.current) setData(json);
 } catch (e: any) {
 if (currentReqId === requestIdRef.current) setError(e.message || "เกิดข้อผิดพลาด");
 } finally {
 if (currentReqId === requestIdRef.current) {
 inFlightParamsRef.current = null;
 setLoading(false);
 }
 }
 };

 useEffect(() => {
 if (paramsStr) fetchApi();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [paramsStr]);

 return { data, loading, error, retry: fetchApi };
}

const formatCurrency = (value: number) => `฿${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const quantityFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2, useGrouping: true });
const formatStockQuantity = (value: unknown) => {
 if (value == null) return '-';
 const numericValue = Number(value);
 if (!Number.isFinite(numericValue)) return String(value);
 const formattedValue = quantityFormatter.format(numericValue);
 return String(value).startsWith('+') && numericValue > 0 ? `+${formattedValue}` : formattedValue;
};
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
 const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(date) ? date : `${date}Z`;
 const parts = new Intl.DateTimeFormat("en-CA", {
 timeZone: "Asia/Bangkok",
 year: "numeric",
 month: "2-digit",
 day: "2-digit",
 }).formatToParts(new Date(timestamp));
 const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
 return `${values.year}-${values.month}-${values.day}`;
};
const getChartBucketKey = (dateKey: string, granularity: string, startDate?: string) => {
 if (granularity === "month") return dateKey.slice(0, 7);
  if (granularity === "week" && startDate) {
    const date = new Date(`${dateKey}T00:00:00Z`);
    const start = new Date(`${startDate}T00:00:00Z`);
    const diffTime = date.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return startDate;
    const bucketDays = Math.floor(diffDays / 7) * 7;
    const bucketDate = new Date(start.getTime());
    bucketDate.setUTCDate(bucketDate.getUTCDate() + bucketDays);
    return bucketDate.toISOString().slice(0, 10);
  } else if (granularity === "week") {
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

 const keys: string[] = [];
 for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + (granularity === "week" ? 7 : 1))) {
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
 const [selectedSalesBucket, setSelectedSalesBucket] = useState<any | null>(null);
 const [hoveredSalesBucket, setHoveredSalesBucket] = useState<any | null>(null);
 const [chartGranularity, setChartGranularity] = useState("day");
 const [chartMetric, setChartMetric] = useState<"value" | "orderCount" | "itemCount">("value");
 const [reportTimeZone, setReportTimeZone] = useState("Asia/Bangkok");
 const [stockViewTab, setStockViewTab] = useState<'summary' | 'log'>('summary');
 const [stockSearchTerm, setStockSearchTerm] = useState('');
 const [stockFilterAlertOnly, setStockFilterAlertOnly] = useState(false);
 const [isStockExpanded, setIsStockExpanded] = useState(false);
 const printingRef = useRef(false);

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
 fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/settings?shop_id=${savedUser.shop_id}`)
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
 setChartGranularity(dayCount <= 90 ? "day" : "month");
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
 const employeesApi = useReportAPI("/api/reports/employees", queryParams);
 const profitApi = useReportAPI("/api/reports/profit", queryParams);
 const taxApi = useReportAPI("/api/reports/tax", queryParams);
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
 const key = getChartBucketKey(getDateKeyInBangkok(order.createdAt), chartGranularity, dateSelection.startDate);
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
 const key = getChartBucketKey(dateKey, chartGranularity, dateSelection.startDate);
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

 // Helper สำหรับ Render Generic Table หาก Backend ไม่ส่ง Structure ที่รู้จักกลับมา
  const renderGenericTable = (data: any, maxHeight: string = "max-h-[360px]") => {
    if (!data) return <EmptyState />;
    if (data.available === false) return <UnavailableState message={data.message} />;
    
    // แบบเก่า { table: { headers: [], rows: [] } }
    if (data.table?.headers && data.table?.rows) {
      if (data.table.rows.length === 0) return <EmptyState />;
      return (
        <div className={`overflow-auto w-full ${maxHeight}`}>
          <table className="w-full text-left border-collapse min-w-full">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e5e7eb]">
              <tr>
                {data.table.headers.map((h: string, i: number) => (
                  <th key={i} className="px-3 py-2.5 text-[11px] font-bold text-gray-500 whitespace-nowrap uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.table.rows.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50 border-b border-dashed border-gray-100 last:border-0">
                  {Object.values(row).map((val: any, j: number) => (
                    <td key={j} className="px-3 py-2 text-[13px] text-gray-800 whitespace-nowrap">{val}</td>
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
        <div className={`overflow-auto w-full ${maxHeight}`}>
          <table className="w-full text-left border-collapse min-w-full">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e5e7eb]">
              <tr>
                {keys.map((k, i) => (
                  <th key={i} className="px-3 py-2.5 text-[11px] font-bold text-gray-500 whitespace-nowrap uppercase">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 border-b border-dashed border-gray-100 last:border-0">
                  {keys.map((k, j) => (
                    <td key={j} className="px-3 py-2 text-[13px] text-gray-800 whitespace-nowrap">{row[k]}</td>
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

  const renderShiftsCard = (data: any) => {
    if (!data) return <EmptyState />;
    if (data.available === false) return <UnavailableState message={data.message} />;
    const shifts: any[] = Array.isArray(data) ? data : (data.table?.rows || []);
    if (shifts.length === 0) return <EmptyState />;

    const totalShifts = shifts.length;
    const openCount = shifts.filter((s: any) => String(s["สถานะ"] || '').includes('เปิด')).length;
    const totalSales = shifts.reduce((sum: number, s: any) => sum + (Number(String(s["ยอดขาย"] || '0').replace(/,/g, '')) || 0), 0);

    return (
      <div className="flex flex-1 flex-col justify-between">
        <div className="mb-3.5 grid grid-cols-2 gap-2.5">
          <div className="bg-gray-50 border border-gray-100 p-3 rounded-[14px]">
            <span className="block text-[11px] font-bold text-gray-500 uppercase">รอบการขายทั้งหมด</span>
            <span className="block text-[18px] font-black text-gray-800">{totalShifts} รอบ</span>
            <span className="block text-[10px] text-gray-400 mt-0.5 font-medium">
              {openCount > 0 ? `เปิดอยู่ ${openCount} รอบ` : 'ปิดครบทุกรอบ'}
            </span>
          </div>
          <div className="bg-gray-50 border border-gray-100 p-3 rounded-[14px]">
            <span className="block text-[11px] font-bold text-gray-500 uppercase">ยอดขายทุกรอบ</span>
            <span className="block text-[18px] font-black text-gray-800">฿{Math.round(totalSales).toLocaleString()}</span>
            <span className="block text-[10px] text-gray-400 mt-0.5 font-medium">
              เฉลี่ย ฿{totalShifts > 0 ? Math.round(totalSales / totalShifts).toLocaleString() : 0} / รอบ
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[260px] rounded-lg">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[30%]" />
              <col className="w-[18%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e5e7eb]">
              <tr>
                <th className="px-2 py-2 text-[11px] font-bold text-gray-500 uppercase whitespace-nowrap">พนักงาน</th>
                <th className="px-2 py-2 text-[11px] font-bold text-gray-500 uppercase whitespace-nowrap">เวลาเปิด</th>
                <th className="px-1.5 py-2 text-[11px] font-bold text-gray-500 uppercase whitespace-nowrap">สถานะ</th>
                <th className="px-2 py-2 text-right text-[11px] font-bold text-gray-500 uppercase whitespace-nowrap">ยอดขาย</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s: any, i: number) => {
                const rawTime = String(s["เวลาเปิดกะ"] || '');
                const parts = rawTime.split(' ');
                const dateStr = parts[0] || rawTime;
                const timeStr = parts.slice(1).join(' ');
                const isOpen = String(s["สถานะ"] || '').includes('เปิด');
                const saleNum = Number(String(s["ยอดขาย"] || '0').replace(/,/g, '')) || 0;

                return (
                  <tr key={i} className="hover:bg-gray-50 border-b border-dashed border-gray-100 last:border-0">
                    <td className="px-2 py-2.5 text-[12px] font-medium text-gray-800 truncate" title={s["พนักงาน"]}>
                      {s["พนักงาน"]}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-col leading-tight">
                        <span className="text-[11px] font-medium text-gray-700 whitespace-nowrap">{dateStr}</span>
                        {timeStr && <span className="text-[10px] text-gray-400 whitespace-nowrap">{timeStr}</span>}
                      </div>
                    </td>
                    <td className="px-1.5 py-2.5">
                      {isOpen ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                          เปิด
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 whitespace-nowrap">
                          ปิดแล้ว
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right text-[12px] font-semibold text-gray-800 whitespace-nowrap">
                      ฿{saleNum.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderEmployeesCard = (data: any) => {
    if (!data) return <EmptyState />;
    if (data.available === false) return <UnavailableState message={data.message} />;
    const employees: any[] = Array.isArray(data) ? data : (data.table?.rows || []);
    if (employees.length === 0) return <EmptyState />;

    const totalStaff = employees.length;
    const totalBills = employees.reduce((sum: number, e: any) => sum + (Number(e["จำนวนบิล"]) || 0), 0);
    const totalSales = employees.reduce((sum: number, e: any) => sum + (Number(String(e["ยอดขาย (฿)"] || '0').replace(/,/g, '')) || 0), 0);
    const avgPerBill = totalBills > 0 ? Math.round(totalSales / totalBills) : 0;

    const sorted = [...employees].sort((a: any, b: any) => (Number(String(b["ยอดขาย (฿)"] || '0').replace(/,/g, '')) - Number(String(a["ยอดขาย (฿)"] || '0').replace(/,/g, ''))));
    const topStaff = sorted[0];
    const topStaffSales = Number(String(topStaff?.["ยอดขาย (฿)"] || '0').replace(/,/g, '')) || 0;
    const topStaffPercent = totalSales > 0 ? Math.round((topStaffSales / totalSales) * 100) : 100;

    return (
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="mb-3.5 grid grid-cols-2 gap-2.5">
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-[14px]">
              <span className="block text-[11px] font-bold text-gray-500 uppercase">พนักงานทั้งหมด</span>
              <span className="block text-[18px] font-black text-gray-800">{totalStaff} คน</span>
              <span className="block text-[10px] text-gray-400 mt-0.5 font-medium">รวม {totalBills.toLocaleString()} บิล</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-[14px]">
              <span className="block text-[11px] font-bold text-gray-500 uppercase">ยอดขายพนักงานรวม</span>
              <span className="block text-[18px] font-black text-gray-800">฿{Math.round(totalSales).toLocaleString()}</span>
              <span className="block text-[10px] text-gray-400 mt-0.5 font-medium">เฉลี่ย ฿{avgPerBill.toLocaleString()} / บิล</span>
            </div>
          </div>

          <div className="overflow-y-auto overflow-x-hidden max-h-[220px] rounded-lg">
            <table className="w-full text-left border-collapse table-fixed">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[20%]" />
                <col className="w-[24%]" />
                <col className="w-[24%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e5e7eb]">
                <tr>
                  <th className="px-2 py-2 text-[11px] font-bold text-gray-500 uppercase whitespace-nowrap">พนักงาน</th>
                  <th className="px-2 py-2 text-right text-[11px] font-bold text-gray-500 uppercase whitespace-nowrap">บิล</th>
                  <th className="px-2 py-2 text-right text-[11px] font-bold text-gray-500 uppercase whitespace-nowrap">เฉลี่ย/บิล</th>
                  <th className="px-2 py-2 text-right text-[11px] font-bold text-gray-500 uppercase whitespace-nowrap">ยอดขาย</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp: any, i: number) => {
                  const bills = Number(emp["จำนวนบิล"]) || 0;
                  const sales = Number(String(emp["ยอดขาย (฿)"] || '0').replace(/,/g, '')) || 0;
                  const avg = bills > 0 ? Math.round(sales / bills) : 0;
                  return (
                    <tr key={i} className="hover:bg-gray-50 border-b border-dashed border-gray-100 last:border-0">
                      <td className="px-2 py-2.5 text-[12px] font-medium text-gray-800 truncate" title={emp["พนักงาน"]}>
                        {emp["พนักงาน"]}
                      </td>
                      <td className="px-2 py-2.5 text-right text-[12px] text-gray-600 whitespace-nowrap">
                        {bills.toLocaleString()}
                      </td>
                      <td className="px-2 py-2.5 text-right text-[12px] text-gray-500 whitespace-nowrap">
                        ฿{avg.toLocaleString()}
                      </td>
                      <td className="px-2 py-2.5 text-right text-[12px] font-semibold text-gray-800 whitespace-nowrap">
                        ฿{sales.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
          <span>พนักงานขายดีเด่น: <b className="text-gray-800 font-semibold">{topStaff?.["พนักงาน"] || '-'}</b></span>
          <span className="font-semibold text-[#7a5c4e]">฿{topStaffSales.toLocaleString()} ({topStaffPercent}%)</span>
        </div>
      </div>
    );
  };

  const renderTaxCard = (data: any) => {
    if (!data) return <EmptyState />;
    if (data.available === false) return <UnavailableState message={data.message} />;
    const taxList: any[] = Array.isArray(data) ? data : (data.table?.rows ? data.table.rows : [data]);
    if (taxList.length === 0) return <EmptyState />;

    const row = taxList[0] || {};
    const rateStr = String(row["อัตราภาษี"] || '7%');
    const taxBase = Number(String(row["ฐานภาษี (฿)"] || '0').replace(/,/g, '')) || 0;
    const taxAmount = Number(String(row["ภาษี (฿)"] || '0').replace(/,/g, '')) || 0;
    const grossTotal = taxBase + taxAmount;

    return (
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="mb-3.5 grid grid-cols-2 gap-2.5">
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-[14px]">
              <span className="block text-[11px] font-bold text-gray-500 uppercase">อัตราภาษี (VAT)</span>
              <span className="block text-[18px] font-black text-gray-800">{rateStr}</span>
              <span className="block text-[10px] text-gray-400 mt-0.5 font-medium">คำนวณจากยอดขาย</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-[14px]">
              <span className="block text-[11px] font-bold text-gray-500 uppercase">ภาษีมูลค่าเพิ่ม</span>
              <span className="block text-[18px] font-black text-gray-800">
                ฿{taxAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="block text-[10px] text-gray-400 mt-0.5 font-medium">ยอดภาษีที่ต้องนำส่ง</span>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50/70 border border-gray-100 p-3 text-[12px] space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
              <span className="text-gray-500 font-medium">ฐานภาษีสุทธิ (ก่อน VAT)</span>
              <span className="font-semibold text-gray-800">
                ฿{taxBase.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
              <span className="text-gray-500 font-medium">ภาษีมูลค่าเพิ่ม ({rateStr})</span>
              <span className="font-semibold text-[#7a5c4e]">
                ฿{taxAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
              <span className="text-gray-700 font-bold">ยอดขายรวมสุทธิ (รวม VAT)</span>
              <span className="font-black text-[13px] text-gray-900">
                ฿{grossTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500 font-medium">รูปแบบการบันทึก</span>
              <span className="text-gray-600 font-medium">ราคารวมภาษีในตัว (Inclusive)</span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
          <span className="text-gray-500">สถานะระบบภาษี</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            เปิดใช้งาน VAT {rateStr}
          </span>
        </div>
      </div>
    );
  };

  const handlePrintShoppingList = (summaryList: any[]) => {
    if (printingRef.current) return;
    if (!summaryList || summaryList.length === 0) {
      showToast("ไม่พบรายการวัตถุดิบที่ใช้ไปในช่วงนี้", "info");
      return;
    }
    printingRef.current = true;
    window.setTimeout(() => { printingRef.current = false; }, 1200);
    const filtered = stockFilterAlertOnly ? summaryList.filter(s => s.status === 'out' || s.status === 'low') : summaryList;
    const periodLabel = dateSelection.period === 'วันนี้' ? 'วันนี้' : dateSelection.period || `${dateSelection.startDate} ถึง ${dateSelection.endDate}`;
    const shopName = user?.shops?.shop_name || user?.shop_name || 'POS Shop';
    const totalCost = filtered.reduce((sum, item) => sum + (Number(item.estimatedCost) || 0), 0);
    const outCount = filtered.filter(i => i.status === 'out').length;
    const lowCount = filtered.filter(i => i.status === 'low').length;
    const printDate = new Date().toLocaleDateString('th-TH', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const printWin = window.open('', '_blank', 'width=960,height=900');
    if (!printWin) {
      showToast("กรุณาอนุญาตป๊อปอัปเพื่อพิมพ์รายการ", "error");
      return;
    }

    const rowsHtml = filtered.map((item, index) => {
      const storageUnit = item.mainUnit || item.unit || '';
      const storageQty = formatStockQuantity(item.currentStockBase);
      const remainingText = `${storageQty} ${storageUnit}${item.packageSize > 1 ? ` (${formatStockQuantity(item.currentStockQuantity)} ${item.packageUnit})` : ''}`;
      const usedText = `${formatStockQuantity(item.totalUsedQuantity)} ${item.packageUnit || storageUnit}${item.packageSize > 1 ? ` (${formatStockQuantity(item.totalUsedBase)} ${storageUnit})` : ''}`;
      const statusBadge = item.status === 'out' 
        ? '<div style="color: #b91c1c; font-size: 11px; font-weight: bold; margin-top: 2px;">(หมดสต็อก)</div>' 
        : item.status === 'low' 
        ? '<div style="color: #666; font-size: 11px; margin-top: 2px;">(ใกล้หมด)</div>' 
        : '';
      const costStr = item.estimatedCost > 0 ? `฿${Number(item.estimatedCost).toLocaleString()}` : '-';

      return `
        <tr>
          <td style="text-align: center; vertical-align: middle; width: 45px; white-space: nowrap;">
            <div style="width: 16px; height: 16px; border: 1.5px solid #222; border-radius: 3px; margin: 0 auto; background: #fff;"></div>
          </td>
          <td style="text-align: center; font-size: 12px; font-weight: bold; width: 35px; white-space: nowrap;">${index + 1}</td>
          <td>
            <div style="font-weight: bold; font-size: 13px; color: #000;">${item.name}</div>
            ${item.categoryName && item.categoryName !== '-' ? `<div style="font-size: 11px; color: #666;">หมวด: ${item.categoryName}</div>` : ''}
          </td>
          <td style="text-align: right; font-size: 12px; white-space: nowrap;">${usedText}</td>
          <td style="text-align: right; font-size: 12px; white-space: nowrap;">
            <div>${remainingText}</div>
            ${statusBadge}
          </td>
          <td style="text-align: right; font-size: 13px; font-weight: bold; color: #000; white-space: nowrap;">
            ${item.suggestedBuyText}
          </td>
          <td style="text-align: right; font-size: 12px; font-weight: bold; white-space: nowrap;">${costStr}</td>
          <td style="text-align: center; vertical-align: middle; width: 90px; white-space: nowrap;">
            <div style="border-bottom: 1px dotted #888; width: 60px; margin: 0 auto; height: 16px;"></div>
          </td>
        </tr>
      `;
    }).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>ใบสั่งซื้อ / รายการซื้อวัตถุดิบคืน - ${shopName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 10mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 24px;
            font-size: 12px;
            line-height: 1.4;
          }
          .no-print-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f4f4f4;
            border: 1px solid #ddd;
            padding: 10px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .no-print-bar button {
            padding: 8px 18px;
            font-size: 13px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            border: 1px solid #333;
          }
          .btn-print {
            background: #000;
            color: #fff;
          }
          .btn-close {
            background: #fff;
            color: #000;
            margin-left: 8px;
          }
          .header {
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .header h1 {
            margin: 0 0 4px 0;
            font-size: 20px;
            font-weight: 800;
            color: #000;
          }
          .header-meta {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #333;
            margin-top: 4px;
          }
          .kpi-row {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 16px;
          }
          .kpi-card {
            border: 1px solid #333;
            border-radius: 6px;
            padding: 8px 10px;
            text-align: center;
          }
          .kpi-label {
            font-size: 11px;
            font-weight: bold;
            color: #444;
          }
          .kpi-value {
            font-size: 16px;
            font-weight: 800;
            color: #000;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
            margin-bottom: 16px;
          }
          th {
            background: #f0f0f0;
            color: #000;
            font-weight: bold;
            font-size: 11px;
            padding: 8px 6px;
            border: 1px solid #000;
            text-align: left;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          th.center { text-align: center; }
          th.right { text-align: right; }
          td {
            padding: 6px 6px;
            border: 1px solid #ccc;
            vertical-align: middle;
            color: #000;
          }
          tr { page-break-inside: avoid; }
          tr:nth-child(even) td {
            background: #fafafa;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .total-summary {
            border: 1.5px solid #000;
            padding: 10px 14px;
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            font-weight: bold;
            background: #f9f9f9;
            margin-bottom: 24px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 36px;
            padding: 0 20px;
          }
          .sign-col {
            text-align: center;
            font-size: 12px;
          }
          .sign-line {
            margin-bottom: 6px;
          }
          @media print {
            .no-print-bar { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div><b>🖨️ ตัวอย่างก่อนพิมพ์รายการสั่งซื้อวัตถุดิบ (A4)</b></div>
          <div>
            <button class="btn-print" onclick="window.print()">สั่งพิมพ์ (Print)</button>
            <button class="btn-close" onclick="window.close()">ปิดหน้าต่าง</button>
          </div>
        </div>

        <div class="header">
          <h1>🛒 ใบสั่งซื้อวัตถุดิบ / คืนสต็อกสินค้า</h1>
          <div class="header-meta">
            <div>ร้าน: <b>${shopName}</b> | ยอดการใช้ช่วง: <b>${periodLabel}</b></div>
            <div>วันที่พิมพ์: <b>${printDate}</b></div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">รายการที่ต้องซื้อ</div>
            <div class="kpi-value">${filtered.length} รายการ</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">สินค้าหมดสต็อก</div>
            <div class="kpi-value">${outCount} รายการ</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">สินค้าใกล้หมด</div>
            <div class="kpi-value">${lowCount} รายการ</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">งบประมาณรวม (ประมาณ)</div>
            <div class="kpi-value">฿${Math.round(totalCost).toLocaleString()}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="center" style="width: 45px; white-space: nowrap;">เช็ค</th>
              <th class="center" style="width: 35px; white-space: nowrap;">#</th>
              <th>รายการวัตถุดิบ</th>
              <th class="right" style="width: 130px; white-space: nowrap;">ใช้ไป (${periodLabel})</th>
              <th class="right" style="width: 150px; white-space: nowrap;">คงเหลือในร้าน</th>
              <th class="right" style="width: 140px; white-space: nowrap;">แนะนำซื้อคืน</th>
              <th class="right" style="width: 80px; white-space: nowrap;">ประมาณการ</th>
              <th class="center" style="width: 90px; white-space: nowrap;">จำนวนซื้อจริง</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="total-summary">
          <div>รวมทั้งหมด: <b>${filtered.length}</b> รายการ</div>
          <div>ประมาณการงบประมาณรวม: <b>฿${Math.round(totalCost).toLocaleString()}</b></div>
        </div>

        <div class="signatures">
          <div class="sign-col">
            <div class="sign-line">..................................................................</div>
            <div>ผู้ตรวจนับ / เสนอซื้อ</div>
            <div style="font-size: 10px; color: #666; margin-top: 2px;">วันที่: ...... / ...... / ..........</div>
          </div>
          <div class="sign-col">
            <div class="sign-line">..................................................................</div>
            <div>ผู้จัดซื้อ / รับของเข้าสต็อก</div>
            <div style="font-size: 10px; color: #666; margin-top: 2px;">วันที่: ...... / ...... / ..........</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  const renderStockMovementTable = (data: any) => {
    if (!data) return <EmptyState />;
    if (data.available === false) return <UnavailableState message={data.message} />;

    const isStructured = !Array.isArray(data) && (Array.isArray(data?.summary) || Array.isArray(data?.movements));
    const rawMovements: any[] = isStructured ? (data.movements || []) : (Array.isArray(data) ? data : []);
    const summaryList: any[] = isStructured ? (data.summary || []) : [];
    const totalItemsUsed = isStructured ? (data.totalItemsUsed ?? summaryList.length) : summaryList.length;
    const lowStockCount = isStructured ? (data.lowStockCount ?? summaryList.filter((s: any) => s.status === 'out' || s.status === 'low').length) : 0;
    const totalEstimatedCost = isStructured ? (data.totalEstimatedCost ?? 0) : 0;

    const filteredSummary = summaryList.filter((item: any) => {
      const matchStatus = !stockFilterAlertOnly || (item.status === 'out' || item.status === 'low');
      return matchStatus;
    });

    if (stockViewTab === 'summary') {
      return (
        <div>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-[16px] text-center">
              <span className="block text-[12px] font-bold text-gray-500 uppercase">วัตถุดิบที่ใช้</span>
              <span className="block text-[24px] font-black text-gray-700">{totalItemsUsed}</span>
            </div>
            <button
              type="button"
              onClick={() => setStockFilterAlertOnly(prev => !prev)}
              className={`bg-gray-50 border p-4 rounded-[16px] text-center transition-colors ${
                stockFilterAlertOnly ? 'border-gray-400 bg-gray-100' : 'border-gray-200 hover:bg-gray-100'
              }`}
            >
              <span className="block text-[12px] font-bold text-gray-600 uppercase">ใกล้หมดสต็อก</span>
              <span className="block text-[24px] font-black text-gray-800">{lowStockCount}</span>
            </button>
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-[16px] text-center">
              <span className="block text-[12px] font-bold text-gray-500 uppercase">งบซื้อคืน (ประมาณ)</span>
              <span className="block text-[24px] font-black text-gray-700">฿{Math.round(totalEstimatedCost || 0).toLocaleString()}</span>
            </div>
          </div>

          {filteredSummary.length > 0 ? (
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr>
                    <th className="border-b border-gray-200 px-3 py-3 text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">รายการวัตถุดิบ</th>
                    <th className="border-b border-gray-200 px-3 py-3 text-right text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">จำนวนที่ใช้</th>
                    <th className="border-b border-gray-200 px-3 py-3 text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">หน่วย</th>
                    <th className="border-b border-gray-200 px-3 py-3 text-right text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">คงเหลือ</th>
                    <th className="border-b border-gray-200 px-3 py-3 text-right text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">แนะนำซื้อคืน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.map((item: any, index: number) => {
                    const isOut = item.status === 'out';
                    const isLow = item.status === 'low';
                    const storageUnit = item.mainUnit || item.unit || '';
                    const storageQty = formatStockQuantity(item.currentStockBase);
                    return (
                      <tr key={`${item.name}-${index}`} className="border-b border-dashed border-gray-100 hover:bg-gray-50 last:border-0">
                        <td className="px-3 py-3 text-[13px] font-medium text-gray-800 whitespace-nowrap">{item.name}</td>
                        <td className="px-3 py-3 text-right text-[13px] font-semibold text-gray-800 whitespace-nowrap">
                          {formatStockQuantity(item.totalUsedQuantity)}
                        </td>
                        <td className="px-3 py-3 text-[12px] text-gray-500 whitespace-nowrap">{item.packageUnit || storageUnit}</td>
                        <td className="px-3 py-3 text-right text-[13px] text-gray-800 whitespace-nowrap">
                          <span className="font-semibold">{storageQty} {storageUnit}</span>
                          {isOut && <span className="ml-1 text-[11px] font-medium text-gray-500">(หมด)</span>}
                          {isLow && <span className="ml-1 text-[11px] font-medium text-gray-500">(ใกล้หมด)</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-[13px] font-semibold text-gray-800 whitespace-nowrap">
                          {item.suggestedBuyText}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      );
    }

    return (
      <div>
        {rawMovements.length > 0 ? (
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  {['วันที่', 'รายการวัตถุดิบ', 'ประเภท', 'จำนวนที่เปลี่ยน', 'หน่วย', 'คงเหลือ', 'รายละเอียด'].map((heading) => (
                    <th key={heading} className="border-b border-gray-200 px-3 py-3 text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawMovements.map((movement: any, index: number) => {
                  const rawQuantity = movement['จำนวนที่เปลี่ยน'];
                  const quantityText = formatStockQuantity(rawQuantity);
                  return (
                    <tr key={`${movement['วันที่']}-${movement['รายการวัตถุดิบ']}-${index}`} className="border-b border-dashed border-gray-100 hover:bg-gray-50 last:border-0">
                      <td className="px-3 py-3 text-[12px] text-gray-500 whitespace-nowrap">{movement['วันที่']}</td>
                      <td className="px-3 py-3 text-[13px] font-medium text-gray-800 whitespace-nowrap">{movement['รายการวัตถุดิบ']}</td>
                      <td className="px-3 py-3 text-[12px] text-gray-600 whitespace-nowrap">{movement['ประเภท']}</td>
                      <td className="px-3 py-3 text-right text-[13px] font-semibold text-gray-800 whitespace-nowrap">{quantityText}</td>
                      <td className="px-3 py-3 text-[12px] text-gray-500 whitespace-nowrap">{movement['หน่วย']}</td>
                      <td className="px-3 py-3 text-right text-[13px] text-gray-800 whitespace-nowrap">{formatStockQuantity(movement['คงเหลือหลังรายการ'])}</td>
                      <td className="px-3 py-3 text-[12px] text-gray-500 whitespace-nowrap">{movement['รายละเอียด']}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    );
  };

  return (
 <div className="flex h-screen bg-[#d6d6d6] font-sans overflow-hidden print:h-auto print:overflow-visible print:bg-white">

 {/* 🌟 Main Sidebar (ห้ามเปลี่ยน) 🌟 */}
 <div className="w-[240px] bg-[#4d4d4d] text-white flex flex-col justify-between shrink-0 shadow-lg z-20 print:hidden">
 <div>
 <div className="h-[90px] flex items-center justify-center gap-3 translate-x-3">
 <h1 className="text-[36px] font-black italic tracking-widest text-white">POS</h1>
 <NotificationBell />
 </div>
 <nav className="sidebar-menu flex flex-col text-[16px] border-y border-[#666666]">
 <button onClick={() => router.push('/pos')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">สั่งและชำระเงิน</button>
 <button onClick={() => router.push('/pos/history')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">ประวัติใบเสร็จ</button>
 <button onClick={() => router.push('/pos/inventory')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">สินค้าคงคลัง</button>
 <button onClick={() => router.push('/pos/shifts')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รอบการขาย</button>
 {user && user.role !== 'พนักงาน' && user.role !== 'Cashier' && (
 <button onClick={() => router.push('/pos/menu')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">เมนูและโปรโมชั่น</button>
 )}
 {user && user.role !== 'พนักงาน' && user.role !== 'Cashier' && (
 <button className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">รายงาน</button>
 )}
 {user && user.role !== 'พนักงาน' && user.role !== 'Cashier' && (
 <button onClick={() => router.push('/pos/employees')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">พนักงาน</button>
 )}
 <button onClick={() => router.push('/pos/settings')} className="py-5 px-6 text-left text-gray-300 hover:bg-[#666666] transition-colors">การตั้งค่า</button>
 </nav>
 </div>
 <button onClick={() => {
 if (user?.pin_enabled === false) {
 localStorage.removeItem("userContext");
 router.push('/');
 } else {
 router.push('/pin');
 }
 }} className="py-6 px-6 text-left text-gray-300 border-t border-[#666666] hover:bg-[#666666] transition-colors text-[16px]">
 {user?.pin_enabled === false ? 'ออกจากระบบ' : 'กลับสู่หน้า PIN'}
 </button>
 </div>

 {/* ===================== MAIN DASHBOARD CONTENT ===================== */}
 <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
 
 <div className="z-10 flex w-full shrink-0 flex-col gap-4 border-b border-gray-200 bg-[#f5f6f8] px-4 py-4 shadow-sm print:hidden sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
 <div className="min-w-0">
 <h2 className="text-[20px] font-bold text-gray-900 sm:text-[22px]">แนวโน้มยอดขาย (Sales Analytics)</h2>
 <p className="mt-1 text-[13px] text-gray-500">ภาพรวมยอดขายและสถิติการขายตามช่วงเวลา</p>
 </div>
 
 <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
 <UnifiedDateRangePicker value={dateSelection} onChange={setDateSelection} className="max-w-full" />
 </div>
 </div>

 {/* 🌟 DASHBOARD AREA 🌟 */}
 <div className="relative flex-1 overflow-y-auto overflow-x-hidden bg-[#d6d6d6] p-4 sm:p-6 print:overflow-visible print:bg-white print:p-0">
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
 <select value={chartGranularity} onChange={event => setChartGranularity(event.target.value)} className="min-h-10 rounded-lg border border-gray-200 bg-[#f5f6f8] px-3 text-[13px] font-semibold text-gray-700">
 <option value="day">รายวัน</option>
 <option value="week">รายสัปดาห์</option>
 <option value="month">รายเดือน</option>
 </select>
 </label>
 <label className="flex flex-col gap-1 text-[11px] font-semibold text-gray-500">
 แสดงข้อมูล
 <select value={chartMetric} onChange={event => setChartMetric(event.target.value as typeof chartMetric)} className="min-h-10 rounded-lg border border-gray-200 bg-[#f5f6f8] px-3 text-[13px] font-semibold text-gray-700">
 <option value="value">ยอดขาย</option>
 <option value="orderCount">จำนวนบิล</option>
 <option value="itemCount">จำนวนสินค้าที่ขาย</option>
 </select>
 </label>
 </div>
 </div>
 {salesChart.length > 0 ? (
 <>
 <div className="mb-4 min-h-[126px]">
 <div className={`transition-all duration-300 rounded-2xl border border-white/40 bg-white/70 backdrop-blur-xl px-5 py-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-gray-900/5 ${hoveredSalesBucket ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`} aria-live="polite">
 <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-gray-100/60 pb-3">
 <span className="text-[15px] font-black text-[#684c3f] tracking-tight">
 {hoveredSalesBucket ? formatSalesDate(hoveredSalesBucket.key, chartGranularity, reportTimeZone) : '\u00A0'}
 </span>
 <span className="rounded-full bg-[#7a5c4e]/10 px-3 py-1 text-[11px] font-bold text-[#7a5c4e] tracking-wide">รายละเอียดช่วงเวลา</span>
 </div>
 <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
 <div className="flex flex-col"><span className="text-[11px] font-bold text-gray-500 mb-0.5">ยอดขาย</span><span className="text-[17px] font-black tracking-tight text-gray-900">{hoveredSalesBucket ? formatCurrency(hoveredSalesBucket.value) : '\u00A0'}</span></div>
 <div className="flex flex-col"><span className="text-[11px] font-bold text-gray-500 mb-0.5">จำนวนบิล</span><span className="text-[17px] font-black tracking-tight text-gray-900">{hoveredSalesBucket ? <>{hoveredSalesBucket.orderCount.toLocaleString()} <span className="text-[13px] text-gray-500 font-semibold">บิล</span></> : '\u00A0'}</span></div>
 <div className="flex flex-col"><span className="text-[11px] font-bold text-gray-500 mb-0.5">จำนวนสินค้า</span><span className="text-[17px] font-black tracking-tight text-gray-900">{hoveredSalesBucket ? <>{hoveredSalesBucket.itemCount.toLocaleString()} <span className="text-[13px] text-gray-500 font-semibold">ชิ้น</span></> : '\u00A0'}</span></div>
 <div className="flex flex-col"><span className="text-[11px] font-bold text-gray-500 mb-0.5">เฉลี่ยต่อบิล</span><span className="text-[17px] font-black tracking-tight text-gray-900">{hoveredSalesBucket ? formatCurrency(hoveredSalesBucket.averageBill) : '\u00A0'}</span></div>
 </div>
 </div>
 </div>
 <div className="relative h-[340px] w-full rounded-2xl bg-white px-2 pb-2 pt-6 shadow-sm ring-1 ring-gray-100 sm:px-4 transition-all duration-300 hover:shadow-md">
 <div className="pointer-events-none absolute left-[64px] right-4 top-6 h-[240px] sm:left-[80px] sm:right-6">
 {[0, 25, 50, 75, 100].map(level => {
 const tickValue = maxSalesValue * level / 100;
 const tickLabel = chartMetric === "value"
 ? formatCurrency(tickValue)
 : Math.round(tickValue).toLocaleString();
 return (
 <div key={level} className="absolute inset-x-0 border-t border-dashed border-gray-100" style={{ bottom: `${level}%` }}>
 <span className="absolute -left-[60px] -top-[9px] w-[50px] text-right text-[10px] font-semibold text-gray-400 sm:-left-[76px] sm:w-[64px] sm:text-[11px]">{tickLabel}</span>
 </div>
 );
 })}
 </div>
 <div data-allow-repeat="true" className="absolute left-[64px] right-4 top-6 flex h-[300px] items-stretch sm:left-[80px] sm:right-6">
 {salesChart.map((bucket: any) => {
 const metricValue = Number(bucket[chartMetric]) || 0;
 const height = maxSalesValue > 0 ? Math.max(metricValue / maxSalesValue * 100, metricValue > 0 ? 1 : 0) : 0;
 const axisLabel = formatAxisLabel(bucket.key, chartGranularity, reportTimeZone);
 const isHovered = hoveredSalesBucket?.key === bucket.key;
 return (
 <button key={bucket.key} type="button" onClick={() => setSelectedSalesBucket(bucket)} onMouseEnter={() => setHoveredSalesBucket(bucket)} onMouseLeave={() => setHoveredSalesBucket(null)} onFocus={() => setHoveredSalesBucket(bucket)} onBlur={() => setHoveredSalesBucket(null)} className="group flex min-w-0 flex-1 flex-col items-center rounded-xl px-1 text-center outline-none transition-colors hover:bg-gray-50/50" aria-label={`${formatSalesDate(bucket.key, chartGranularity, reportTimeZone)}: ${chartMetric === "value" ? formatCurrency(metricValue) : metricValue.toLocaleString()}`} title={`${formatSalesDate(bucket.key, chartGranularity, reportTimeZone)} · ${chartMetric === "value" ? formatCurrency(metricValue) : metricValue.toLocaleString()}`}>
 <span className="relative flex h-[240px] w-full items-end justify-center">
 <span className={`absolute -top-10 scale-95 opacity-0 transition-all duration-300 z-10 ${isHovered ? 'scale-100 opacity-100 -translate-y-2' : ''}`}>
 <span className="relative rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg whitespace-nowrap">
 {chartMetric === "value" ? formatCurrency(metricValue) : metricValue.toLocaleString()}
 <svg className="absolute -bottom-1 left-1/2 -ml-1 h-2 w-2 fill-gray-900" viewBox="0 0 8 8"><path d="M0 0l4 4 4-4z"/></svg>
 </span>
 </span>
 <span className={`w-[70%] max-w-[48px] rounded-t-md transition-all duration-500 ease-out ${isHovered ? "bg-gradient-to-t from-[#684c3f] to-[#8c6756] shadow-[0_4px_12px_rgba(104,76,63,0.3)]" : "bg-gradient-to-t from-[#9b806f] to-[#bda697] opacity-80 group-hover:opacity-100"}`} style={{ height: `${height}%` }} />
 </span>
 <span className={`mt-3 w-full whitespace-normal break-words text-[10px] font-semibold leading-tight transition-colors duration-300 sm:text-[11px] ${isHovered ? "text-[#7a5c4e]" : "text-gray-400"}`}>{axisLabel}</span>
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

 {/* 4. OPERATION ANALYTICS & TAX */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <SectionWrapper state={shiftsApi} title="ประสิทธิภาพรอบการขาย" className="lg:col-span-1 h-full" icon={<Clock className="w-5 h-5 text-[#7a5c4e]"/>}>
 {renderShiftsCard(shiftsApi.data)}
 </SectionWrapper>
 
 <SectionWrapper state={employeesApi} title="ประสิทธิภาพพนักงาน" className="lg:col-span-1 h-full" icon={<UserCircle className="w-5 h-5 text-[#7a5c4e]"/>}>
 {renderEmployeesCard(employeesApi.data)}
 </SectionWrapper>

 {!isCashier && (
 <SectionWrapper state={taxApi} title="ภาษี (Tax)" className="lg:col-span-1 h-full" icon={<FileText className="w-5 h-5 text-[#7a5c4e]"/>}>
 {renderTaxCard(taxApi.data)}
 </SectionWrapper>
 )}
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

 <SectionWrapper
 state={stockMovementsApi}
 title="การเคลื่อนไหวของ Stock"
 className="lg:col-span-1"
 icon={<Activity className="w-5 h-5 text-[#7a5c4e]"/>}
          action={
            <div className="flex items-center gap-1.5">
              <div data-allow-repeat="true" className="inline-flex rounded-lg bg-gray-100 p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStockViewTab('summary')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    stockViewTab === 'summary' ? 'bg-white text-gray-800 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  สรุปยอดใช้
                </button>
                <button
                  type="button"
                  onClick={() => setStockViewTab('log')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    stockViewTab === 'log' ? 'bg-white text-gray-800 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  ประวัติ
                </button>
              </div>
              {stockViewTab === 'summary' && (
                <button
                  type="button"
                  onClick={() => handlePrintShoppingList(stockMovementsApi.data?.summary || [])}
                  title="พิมพ์รายการซื้อของ"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          }
        >
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

function SectionWrapper({ state, title, icon, children, className = "", hideTitle = false, action }: any) {
 if (state.loading) {
 return (
 <div className={`flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white/60 p-8 shadow-sm backdrop-blur-sm ${className}`}>
 <RefreshCw className="mb-3 h-6 w-6 animate-spin text-[#7a5c4e]/60" />
 <span className="text-[13px] font-bold tracking-wide text-gray-500">กำลังโหลดข้อมูล...</span>
 </div>
 );
 }

 if (state.error) {
 return (
 <div className={`flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 p-6 text-center shadow-sm ${className}`}>
 <AlertCircle className="mb-3 h-8 w-8 animate-pulse text-red-400" />
 <span className="mb-1 text-[14px] font-bold text-red-800">ไม่สามารถโหลดข้อมูลได้</span>
 <button onClick={state.retry} className="mt-3 rounded-full bg-white px-5 py-2 text-[12px] font-bold text-red-600 shadow-sm ring-1 ring-inset ring-red-200 transition-all hover:bg-red-50 hover:shadow hover:ring-red-300">
 ลองใหม่อีกครั้ง
 </button>
 </div>
 );
 }

 return (
 <div className={`${hideTitle ? "" : "group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:border-gray-200 hover:shadow-md"} ${className}`}>
 {!hideTitle && (
 <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-50 bg-gradient-to-r from-[#fbfaf8] to-white px-5 py-4 sm:px-6">
 <div className="flex items-center gap-3 min-w-0">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#7a5c4e] shadow-sm ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-110 shrink-0">
 {icon}
 </div>
 <h3 className="tracking-tight text-[15px] font-bold text-gray-800 sm:text-[16px] truncate">{title}</h3>
 </div>
 {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
 </div>
 )}
 <div className={`flex flex-1 flex-col ${!hideTitle ? 'p-6' : ''}`}>
 {children}
 </div>
 </div>
 );
}

function KPICard({ title, value, icon, isCurrency = false, hidden = false, description = "", unit = "" }: any) {
 if (hidden) return null;
 return (
 <div className="group relative flex min-h-[152px] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#7a5c4e]/30 hover:shadow-lg">
 <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-[#7a5c4e]/10 to-transparent blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:bg-[#7a5c4e]/20" />
 <div className="relative z-10 flex items-center gap-3 text-gray-500">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f4eee8] to-[#e8ddd4] text-[#7a5c4e] shadow-inner transition-transform duration-300 group-hover:rotate-3 group-hover:scale-110">
 {icon}
 </div>
 <span className="text-[13px] font-bold text-gray-600 transition-colors group-hover:text-gray-900">{title}</span>
 </div>
 <span className="relative z-10 mt-4 break-words tracking-tight text-[26px] font-black leading-tight text-gray-900 sm:text-[30px]">
 {isCurrency ? formatCurrency(Number(value) || 0) : `${Number(value || 0).toLocaleString()}${unit ? ` ${unit}` : ""}`}
 </span>
 <span className="relative z-10 mt-2 text-[11px] font-medium leading-4 text-gray-400">{description}</span>
 </div>
 );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
 return (
 <div className="group min-w-0 rounded-xl border border-gray-100 bg-gradient-to-br from-[#fcfbf9] to-white p-4 transition-all duration-300 hover:border-[#e8ddd4] hover:shadow-sm">
 <span className="block text-[12px] font-bold text-gray-500 transition-colors group-hover:text-[#7a5c4e]">{label}</span>
 <span className="mt-1.5 block break-words tracking-tight text-[17px] font-black leading-6 text-gray-800">{value}</span>
 </div>
 );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
 return <div className="rounded-xl bg-gray-50 p-3"><span className="block text-[11px] font-bold text-gray-500">{label}</span><span className="mt-1 block text-[15px] font-black text-gray-800">{value}</span></div>;
}

function EmptyState() {
 return (
 <div className="flex flex-col items-center justify-center py-10 text-gray-400 transition-all duration-300 hover:text-gray-500">
 <div className="mb-4 rounded-full bg-gray-50 p-4 shadow-sm ring-1 ring-gray-100 transition-transform duration-500 hover:rotate-12">
 <Search className="h-6 w-6 text-gray-300" />
 </div>
 <span className="mb-1 text-[14px] font-bold text-gray-500">ยังไม่มีข้อมูลในช่วงเวลานี้</span>
 <span className="text-[12px] text-gray-400">ลองเปลี่ยนช่วงเวลาเพื่อดูข้อมูลเพิ่มเติม</span>
 </div>
 );
}

function UnavailableState({ message }: { message: string }) {
 return (
 <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
 <div className="mb-4 rounded-full bg-gray-50 p-4 shadow-sm ring-1 ring-gray-100">
 <AlertCircle className="h-6 w-6 text-gray-300" />
 </div>
 <span className="text-[13px] font-bold text-gray-500">{message}</span>
 </div>
 );
}