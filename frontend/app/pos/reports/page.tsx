"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from "../../components/NotificationBell";
import UnifiedDateRangePicker, { DateRangeValue, getCurrentMonthToDate } from "../../components/UnifiedDateRangePicker";
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
  ListTree,
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
  return new Date(`${dateKey}T00:00:00+07:00`).toLocaleDateString("th-TH", { timeZone, day: "numeric", month: "short" });
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
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  // Date Filter State
  const [dateSelection, setDateSelection] = useState<DateRangeValue>(getInitialReportDateRange);
  const [queryParams, setQueryParams] = useState<string>("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedSalesBucket, setSelectedSalesBucket] = useState<any | null>(null);
  const [reportTimeZone, setReportTimeZone] = useState("Asia/Bangkok");

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("userContext") || "{}");
    if (!savedUser || Object.keys(savedUser).length === 0) {
      router.push("/pin");
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
  const salesChart = Array.isArray(salesApi.data?.chart)
    ? salesApi.data.chart
    : Array.isArray(salesApi.data?.trend)
      ? salesApi.data.trend
      : [];
  const salesGranularity = salesApi.data?.granularity || "day";
  const maxSalesValue = Math.max(...salesChart.map((item: any) => Number(item.value ?? item.amount) || 0), 1);

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

  return (
    <div className="flex h-screen bg-[#d6d6d6] font-sans overflow-hidden print:bg-white print:h-auto print:overflow-visible">

      {/* 🌟 Main Sidebar (ห้ามเปลี่ยน) 🌟 */}
      <div className="w-[240px] bg-[#4d4d4d] text-white flex flex-col justify-between shrink-0 shadow-lg z-20 print:hidden">
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
            <button className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">รายงาน</button>
            <button onClick={() => router.push('/pos/employees')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">พนักงาน</button>
            <button onClick={() => router.push('/pos/settings')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">การตั้งค่า</button>
          </nav>
        </div>
        <button onClick={() => { localStorage.removeItem("userContext"); router.push('/pin'); }} className="py-6 px-6 text-left text-gray-300 border-t border-[#666666] hover:bg-[#666666] transition-colors text-[16px]">กลับสู่หน้า PIN</button>
      </div>

      {/* ===================== MAIN DASHBOARD CONTENT ===================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden print:overflow-visible">
        
        {/* Header - (ห้ามเปลี่ยนตำแหน่งหลัก) */}
        <div className="h-[90px] bg-[#f5f6f8] flex items-center justify-between z-10 shrink-0 w-full px-8 border-b border-gray-200 shadow-sm print:hidden">
          <div>
            <h2 className="text-[22px] font-bold text-gray-800">รายงาน (Reports)</h2>
            <p className="text-[13px] text-gray-500 mt-1">ศูนย์กลางวิเคราะห์ธุรกิจ POS</p>
          </div>
          
          {/* Global Date Filter & Actions */}
          <div className="flex items-center shrink-0 gap-3">
            <UnifiedDateRangePicker value={dateSelection} onChange={setDateSelection} />

            {/* Export Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)} 
                className="h-[48px] px-5 flex items-center justify-center border border-gray-200 rounded-full bg-white hover:bg-gray-50 shadow-sm text-gray-700 font-bold text-[14px] transition-colors gap-2"
              >
                <Download className="w-4 h-4" /> Export <ChevronDown className="w-4 h-4 text-gray-400"/>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-14 w-[180px] bg-white border border-gray-200 rounded-[16px] shadow-xl py-2 z-50 overflow-hidden">
                  <button onClick={() => handleExport("csv")} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-[14px] font-bold text-gray-700"><FileText className="w-4 h-4 text-[#7a5c4e]"/> Export CSV</button>
                  <button onClick={() => handleExport("excel")} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-[14px] font-bold text-gray-700"><FileSpreadsheet className="w-4 h-4 text-green-600"/> Export Excel</button>
                  <button onClick={() => handleExport("pdf")} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-[14px] font-bold text-gray-700"><FileIcon className="w-4 h-4 text-red-500"/> Export PDF</button>
                </div>
              )}
            </div>

            <button onClick={() => window.print()} className="w-[48px] h-[48px] flex items-center justify-center border border-gray-200 rounded-full bg-[#7a5c4e] text-white hover:bg-[#684c3f] shadow-sm transition-colors" title="พิมพ์ Dashboard">
              <Printer className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 🌟 DASHBOARD AREA 🌟 */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#d6d6d6] print:p-0 print:bg-white relative">
          <div className="w-full flex flex-col gap-6">
            
            {/* 1. KPI CARDS */}
            <SectionWrapper state={summaryApi} title="" hideTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                  <KPICard title="ยอดขายสุทธิ" value={summaryApi.data?.summary?.netSales || summaryApi.data?.netSales || 0} icon={<DollarSign/>} isCurrency />
                  <KPICard title="กำไรขั้นต้น" value={profitApi.data?.cogsAvailable ? Number(profitApi.data.revenue) - Number(profitApi.data.cogs) : null} icon={<TrendingUp/>} isCurrency hidden={isCashier} />
                  <KPICard title="จำนวนบิล" value={summaryApi.data?.summary?.totalBills || summaryApi.data?.totalBills || 0} icon={<FileText/>} />
                  <KPICard title="ยอดเฉลี่ย / บิล" value={summaryApi.data?.summary?.avgBill || summaryApi.data?.avgBill || 0} icon={<Activity/>} isCurrency />
               </div>
            </SectionWrapper>

            {/* 2. SALES & PAYMENTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <SectionWrapper state={salesApi} title="แนวโน้มยอดขาย (Sales Analytics)" className="lg:col-span-2 min-h-[300px]" icon={<BarChart3 className="w-5 h-5 text-[#7a5c4e]"/>}>
                  {salesChart.length > 0 ? (
                   <div className="mt-4 border-t border-gray-100 pt-4 overflow-x-auto">
                     <div className="relative h-[250px] min-w-[520px]" style={{ width: `${Math.max(520, salesChart.length * 42)}px` }}>
                       {[0, 25, 50, 75, 100].map(level => (
                         <div key={level} className="absolute left-10 right-0 border-t border-dashed border-gray-100" style={{ bottom: `${level}%` }}>
                           <span className="absolute -left-10 -top-2 text-[10px] text-gray-400">{formatCurrency((maxSalesValue * level) / 100).replace(".00", "")}</span>
                         </div>
                       ))}
                       <div className="absolute inset-x-0 bottom-0 top-0 left-10 flex items-end gap-1.5 px-1">
                         {salesChart.map((d: any) => {
                           const amount = Number(d.value ?? d.amount) || 0;
                           const height = amount > 0 ? Math.max((amount / maxSalesValue) * 100, 4) : 0;
                           return (
                            <button key={d.key || d.label} type="button" onClick={() => setSelectedSalesBucket(d)} className="group relative flex h-full min-w-8 flex-1 flex-col items-center justify-end focus:outline-none" aria-label={`ดูรายละเอียด ${formatSalesDate(d.key || d.label, salesGranularity, reportTimeZone)}`}>
                               <span className="pointer-events-none absolute bottom-[calc(var(--bar-height)+8px)] z-10 hidden w-52 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-xl group-hover:block group-focus:block" style={{ left: "50%", "--bar-height": `${height}%` } as React.CSSProperties}>
                                 <span className="block text-[12px] font-bold text-gray-800">{formatSalesDate(d.key || d.label, salesGranularity, reportTimeZone)}</span>
                                 <span className="mt-1 block text-[12px] text-gray-600">ยอดขาย {formatCurrency(amount)}</span>
                                 {d.orderCount !== undefined && <span className="block text-[12px] text-gray-600">จำนวนบิล {d.orderCount.toLocaleString()} บิล</span>}
                                 {d.itemCount !== undefined && <span className="block text-[12px] text-gray-600">จำนวนสินค้า {d.itemCount.toLocaleString()} ชิ้น</span>}
                                 {d.averageBill !== undefined && d.orderCount > 0 && <span className="block text-[12px] text-gray-600">ยอดเฉลี่ย / บิล {formatCurrency(Number(d.averageBill))}</span>}
                               </span>
                               <span className="w-full rounded-t-sm bg-[#7a5c4e]/80 transition-colors group-hover:bg-[#7a5c4e]" style={{ height: `${height}%` }} />
                               <span className="mt-2 w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[10px] text-gray-500">{formatAxisLabel(d.key || d.label, salesGranularity, reportTimeZone)}</span>
                             </button>
                           );
                         })}
                       </div>
                     </div>
                   </div>
                 ) : (
                    renderGenericTable(salesApi.data)
                 )}
              </SectionWrapper>

              <SectionWrapper state={paymentsApi} title="ช่องทางการชำระเงิน" className="lg:col-span-1" icon={<CreditCard className="w-5 h-5 text-[#7a5c4e]"/>}>
                 {renderGenericTable(paymentsApi.data)}
              </SectionWrapper>
            </div>

            {/* 3. PRODUCT ANALYTICS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <SectionWrapper state={productsApi} title="สินค้าขายดี (Top Products)" className="lg:col-span-2" icon={<Package className="w-5 h-5 text-[#7a5c4e]"/>}>
                 {renderGenericTable(productsApi.data)}
              </SectionWrapper>
              
              <SectionWrapper state={productsApi} title="ยอดขายตามหมวดหมู่" className="lg:col-span-1" icon={<ListTree className="w-5 h-5 text-[#7a5c4e]"/>}>
                 {productsApi.data?.categories ? renderGenericTable(productsApi.data.categories) : (
                   <div className="flex items-center justify-center py-10 text-[14px] text-gray-400">ระบุรายละเอียดหมวดหมู่ไม่ได้จากข้อมูลปัจจุบัน</div>
                 )}
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
                    <button type="button" onClick={() => router.push('/pos/inventory?stock=out')} className="bg-red-50 border border-red-100 p-4 rounded-[16px] text-center hover:bg-red-100 transition-colors">
                        <span className="block text-[12px] font-bold text-red-500 uppercase">สินค้าหมด</span>
                        <span className="block text-[24px] font-black text-red-600">{inventoryApi.data?.outOfStock || 0}</span>
                    </button>
                    <button type="button" onClick={() => router.push('/pos/inventory?stock=low')} className="bg-orange-50 border border-orange-100 p-4 rounded-[16px] text-center hover:bg-orange-100 transition-colors">
                        <span className="block text-[12px] font-bold text-orange-500 uppercase">ใกล้หมดสต็อก</span>
                        <span className="block text-[24px] font-black text-orange-600">{inventoryApi.data?.lowStock || 0}</span>
                    </button>
                  </div>
                  {renderGenericTable(inventoryApi.data?.table || inventoryApi.data?.alertItems || inventoryApi.data)}
               </SectionWrapper>

               <SectionWrapper state={stockMovementsApi} title="การเคลื่อนไหวของ Stock" className="lg:col-span-1" icon={<Activity className="w-5 h-5 text-[#7a5c4e]"/>}>
                  {renderGenericTable(stockMovementsApi.data)}
               </SectionWrapper>
            </div>

            {/* 6. FINANCIAL & ACCOUNTING */}
            {!isCashier && (
              <>
                <SectionWrapper state={profitApi} title="ภาพรวมทางการเงิน" icon={<Wallet className="w-5 h-5 text-[#7a5c4e]"/>}>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="bg-green-50/50 border border-green-100 p-5 rounded-[16px] flex flex-col justify-center">
                       <span className="text-[13px] font-bold text-gray-500 mb-1">รายรับรวม</span>
                       <span className="text-[22px] font-black text-green-600">฿{Number(profitApi.data?.revenue || 0).toLocaleString()}</span>
                     </div>
                     <div className="bg-red-50/50 border border-red-100 p-5 rounded-[16px] flex flex-col justify-center">
                       <span className="text-[13px] font-bold text-gray-500 mb-1">รายจ่ายรวม</span>
                       <span className="text-[22px] font-black text-red-500">฿{Number(profitApi.data?.expenses || 0).toLocaleString()}</span>
                     </div>
                     <div className="bg-orange-50/50 border border-orange-100 p-5 rounded-[16px] flex flex-col justify-center">
                       <span className="text-[13px] font-bold text-gray-500 mb-1">ต้นทุนสินค้า (COGS)</span>
                       <span className="text-[18px] font-black text-orange-600">{profitApi.data?.cogsAvailable ? `฿${Number(profitApi.data.cogs).toLocaleString()}` : "ยังคำนวณไม่ได้"}</span>
                     </div>
                     <div className="bg-[#7a5c4e]/5 border border-[#7a5c4e]/20 p-5 rounded-[16px] flex flex-col justify-center">
                       <span className="text-[13px] font-bold text-gray-500 mb-1">กำไรสุทธิ (Net Profit)</span>
                       <span className="text-[18px] font-black text-[#7a5c4e]">{profitApi.data?.cogsAvailable ? `฿${Number(profitApi.data.netProfit).toLocaleString()}` : "ยังคำนวณไม่ได้"}</span>
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
                <p className="mt-1 text-[13px] text-gray-500">{formatSalesDate(selectedSalesBucket.key || selectedSalesBucket.label, salesGranularity, reportTimeZone)}</p>
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
      <div className={`bg-white rounded-[24px] border border-gray-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[150px] ${className}`}>
        <RefreshCw className="w-6 h-6 animate-spin text-gray-300 mb-2" />
        <span className="text-[13px] font-medium text-gray-400">กำลังโหลด...</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`bg-white rounded-[24px] border border-red-100 shadow-sm p-6 flex flex-col items-center justify-center min-h-[150px] text-center ${className}`}>
        <AlertCircle className="w-8 h-8 text-red-300 mb-2" />
        <span className="text-[14px] font-bold text-gray-700 mb-1">ไม่สามารถโหลดข้อมูลได้</span>
        <button onClick={state.retry} className="text-[12px] font-bold text-red-500 bg-red-50 px-4 py-1.5 rounded-full hover:bg-red-100 transition-colors mt-2">
          ลองใหม่อีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className={`${hideTitle ? "" : "bg-white rounded-[24px] border border-gray-200 shadow-sm flex flex-col overflow-hidden"} ${className}`}>
      {!hideTitle && (
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3 shrink-0">
          {icon}
          <h3 className="text-[16px] font-bold text-gray-800">{title}</h3>
        </div>
      )}
      <div className={`flex-1 flex flex-col ${!hideTitle ? 'p-6' : ''}`}>
        {children}
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, isCurrency = false, hidden = false }: any) {
  if (hidden) return null;
  return (
    <div className="bg-white p-6 rounded-[20px] border border-gray-300 shadow-md flex flex-col justify-between h-[140px] relative overflow-hidden group hover:border-[#7a5c4e]/50 transition-colors">
      <div className="absolute right-0 top-0 w-24 h-24 bg-gray-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 -z-0"></div>
      <div className="flex items-center gap-2 text-gray-500 relative z-10">
         <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[#7a5c4e]">
           {icon}
         </div>
         <span className="text-[14px] font-bold uppercase tracking-wide">{title}</span>
      </div>
      <span className="text-[32px] font-black text-gray-800 truncate relative z-10 mt-auto">
        {value === null || value === undefined ? "ยังคำนวณไม่ได้" : <>{isCurrency && "฿"}{value.toLocaleString(undefined, { minimumFractionDigits: isCurrency ? 2 : 0 })}</>}
      </span>
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