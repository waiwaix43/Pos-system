"use client";
import { useToast } from '@/components/shared/ToastProvider';
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from '@/components/shared/NotificationBell';
import { createClient } from "@supabase/supabase-js";
import {
 Search, Plus, LayoutGrid, List, AlignJustify, RefreshCw, AlertCircle, AlertTriangle, Calendar, X,
 Package, Edit, Save, Upload, ArrowUpDown, Box, Droplets, Filter, Trash2, Minus, Check,
 Maximize2, Minimize2, ChevronUp, ChevronDown
} from "lucide-react";

const ITEMS_PER_PAGE = 50;
const getThaiApiMessage = (message: unknown, fallback: string) => {
 if (
 typeof message !== 'string' ||
 !/[\u0E00-\u0E7F]/.test(message) ||
 /[\u0080-\u009F\uFFFD]/.test(message)
 ) {
 return fallback;
 }
 return message;
};

const getMovementLabel = (reason: unknown, movementType: unknown) => {
 if (typeof reason === 'string' && reason.trim() && !/[\u0080-\u009F\uFFFD]/.test(reason)) {
 return reason;
 }

 switch (movementType) {
 case 'INITIAL_STOCK':
 return 'เพิ่มสินค้าเข้าคลัง';
 case 'STOCK_IN':
 return 'รับสินค้าเข้า';
 case 'STOCK_OUT':
 return 'เบิกสินค้าออก';
 case 'SALE':
 return 'ตัดสต็อกจากการขาย';
 default:
 return 'ปรับปรุงสต็อก';
 }
};

const formatStockQuantity = (qty: any) => {
 return Math.floor(Number(qty || 0)).toLocaleString();
};

const formatTotalPieces = (pieces: any) => {
 return Math.round(Number(pieces || 0)).toLocaleString();
};

const formatThaiDateDisplay = (dateStr?: string | null) => {
 if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) return '-';
 const clean = dateStr.trim().slice(0, 10);
 const parts = clean.split('-');
 if (parts.length !== 3) return clean;
 const [year, month, day] = parts;
 return `${day}/${month}/${year}`;
};

const isoToDmyInput = (iso?: string | null) => {
 if (!iso || typeof iso !== 'string') return '';
 const clean = iso.trim().slice(0, 10);
 const parts = clean.split('-');
 if (parts.length !== 3) return '';
 const [year, month, day] = parts;
 if (!year || !month || !day) return '';
 return `${day}/${month}/${year}`;
};

const dmyInputToIso = (dmy: string): string | null => {
 const trimmed = dmy.trim();
 if (!trimmed) return '';
 const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
 if (!match) return null;
 const day = Number(match[1]);
 const month = Number(match[2]);
 let year = Number(match[3]);
 if (year > 2400) year -= 543;
 if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2200) return null;
 const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
 const parsed = new Date(`${iso}T00:00:00Z`);
 if (
  Number.isNaN(parsed.getTime()) ||
  parsed.getUTCFullYear() !== year ||
  parsed.getUTCMonth() + 1 !== month ||
  parsed.getUTCDate() !== day
 ) {
  return null;
 }
 return iso;
};

interface DateInputDMYProps {
 value?: string | null;
 onChange: (isoDate: string) => void;
 min?: string;
 disabled?: boolean;
 placeholder?: string;
 className?: string;
}

const DateInputDMY = ({
 value,
 onChange,
 min,
 disabled = false,
 placeholder = 'วัน/เดือน/ปี',
 className = '',
}: DateInputDMYProps) => {
 const pickerRef = useRef<HTMLInputElement | null>(null);
 const [text, setText] = useState<string>(() => isoToDmyInput(value));

 useEffect(() => {
  setText(isoToDmyInput(value));
 }, [value]);

 const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const raw = e.target.value;
  if (!raw.trim()) {
   setText('');
   onChange('');
   return;
  }

  const prevLen = text.length;
  const isDeleting = raw.length < prevLen;
  let nextText = raw;

  if (!isDeleting && /^[\d\/]+$/.test(raw)) {
   const digits = raw.replace(/\D/g, '').slice(0, 8);
   if (digits.length <= 2) {
    nextText = digits;
   } else if (digits.length <= 4) {
    nextText = `${digits.slice(0, 2)}/${digits.slice(2)}`;
   } else {
    nextText = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
   }
  }

  setText(nextText);
  const parsedIso = dmyInputToIso(nextText);
  if (parsedIso !== null && parsedIso.length === 10) {
   onChange(parsedIso);
  }
 };

 const handleBlur = () => {
  if (!text.trim()) {
   onChange('');
   return;
  }
  const parsedIso = dmyInputToIso(text);
  if (parsedIso && parsedIso.length === 10) {
   if (min && parsedIso < min) {
    setText(isoToDmyInput(min));
    onChange(min);
    return;
   }
   setText(isoToDmyInput(parsedIso));
   onChange(parsedIso);
  } else {
   setText(isoToDmyInput(value));
  }
 };

 const openCalendarPicker = () => {
  if (disabled) return;
  const el = pickerRef.current;
  if (!el) return;
  try {
   if (typeof (el as any).showPicker === 'function') {
    (el as any).showPicker();
   } else {
    el.focus();
    el.click();
   }
  } catch {
   // ignore if browser blocks programmatic showPicker
  }
 };

 return (
  <div className="relative w-full">
   <input
    type="text"
    inputMode="numeric"
    disabled={disabled}
    placeholder={placeholder}
    value={disabled && !value ? '' : text}
    onChange={handleTextChange}
    onBlur={handleBlur}
    onClick={openCalendarPicker}
    className={`${className} pr-9`}
   />
   <button
    type="button"
    disabled={disabled}
    onClick={openCalendarPicker}
    tabIndex={-1}
    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#7a5c4e] disabled:text-gray-300 disabled:pointer-events-none"
    title="เลือกวัน/เดือน/ปี"
   >
    <Calendar className="w-4 h-4" />
   </button>
   <input
    ref={pickerRef}
    type="date"
    tabIndex={-1}
    disabled={disabled}
    min={min || undefined}
    value={value || ''}
    onChange={(e) => {
     const nextIso = e.target.value;
     setText(isoToDmyInput(nextIso));
     onChange(nextIso);
    }}
    className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
    aria-hidden="true"
   />
  </div>
 );
};

const getBangkokDateKeyClient = () => {
 const parts = new Intl.DateTimeFormat('en-CA', {
 timeZone: 'Asia/Bangkok',
 year: 'numeric',
 month: '2-digit',
 day: '2-digit'
 }).formatToParts(new Date());
 const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
 return `${values.year}-${values.month}-${values.day}`;
};

export type ExpiryStatusType = 'NO_EXPIRY' | 'UNSPECIFIED' | 'EXPIRED' | 'EXPIRES_TODAY' | 'EXPIRING_SOON' | 'NORMAL';

export interface ExpiryBatchMeta {
 id: string;
 quantity: number;
 mfgDate: string | null;
 expDate: string | null;
 noExpiry: boolean;
 status: ExpiryStatusType;
 daysUntilExpiry: number | null;
 badgeLabel: string;
 badgeClass: string;
}

const computeSingleBatchMeta = (
 batch: any,
 idx: number,
 alertDays: number,
 todayKey: string
): ExpiryBatchMeta => {
 const id = String(batch?.id || `lot_${idx}`);
 const quantity = Math.max(0, Number(Number(batch?.quantity || 0).toFixed(6)));
 const mfgDate: string | null = batch?.mfg_date || batch?.mfgDate ? String(batch.mfg_date || batch.mfgDate).slice(0, 10) : null;
 const noExpiry = Boolean(batch?.no_expiry ?? batch?.noExpiry);
 const expDate: string | null = noExpiry
  ? null
  : (batch?.exp_date || batch?.expDate ? String(batch.exp_date || batch.expDate).slice(0, 10) : null);

 if (noExpiry) {
  return {
   id,
   quantity,
   mfgDate,
   expDate: null,
   noExpiry: true,
   status: 'NO_EXPIRY',
   daysUntilExpiry: null,
   badgeLabel: 'ไม่มีวันหมดอายุ',
   badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
  };
 }

 if (!expDate) {
  return {
   id,
   quantity,
   mfgDate,
   expDate: null,
   noExpiry: false,
   status: 'UNSPECIFIED',
   daysUntilExpiry: null,
   badgeLabel: 'ยังไม่ระบุวันหมดอายุ',
   badgeClass: 'bg-gray-100 text-gray-500 border-gray-200'
  };
 }

 const expTime = new Date(`${expDate}T00:00:00Z`).getTime();
 const todayTime = new Date(`${todayKey}T00:00:00Z`).getTime();
 const daysUntilExpiry = Number.isFinite(expTime) && Number.isFinite(todayTime)
  ? Math.round((expTime - todayTime) / 86400000)
  : null;

 if (daysUntilExpiry !== null && daysUntilExpiry < 0) {
  return {
   id,
   quantity,
   mfgDate,
   expDate,
   noExpiry: false,
   status: 'EXPIRED',
   daysUntilExpiry,
   badgeLabel: `หมดอายุแล้ว ${Math.abs(daysUntilExpiry)} วัน`,
   badgeClass: 'bg-red-50 text-red-600 border-red-200'
  };
 }

 if (daysUntilExpiry === 0) {
  return {
   id,
   quantity,
   mfgDate,
   expDate,
   noExpiry: false,
   status: 'EXPIRES_TODAY',
   daysUntilExpiry: 0,
   badgeLabel: 'หมดอายุวันนี้',
   badgeClass: 'bg-red-50 text-red-600 border-red-200'
  };
 }

 if (daysUntilExpiry !== null && alertDays > 0 && daysUntilExpiry <= alertDays) {
  return {
   id,
   quantity,
   mfgDate,
   expDate,
   noExpiry: false,
   status: 'EXPIRING_SOON',
   daysUntilExpiry,
   badgeLabel: `อีก ${daysUntilExpiry} วันหมดอายุ`,
   badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
  };
 }

 return {
  id,
  quantity,
  mfgDate,
  expDate,
  noExpiry: false,
  status: 'NORMAL',
  daysUntilExpiry,
  badgeLabel: daysUntilExpiry !== null ? `เหลืออีก ${daysUntilExpiry} วัน` : 'ปกติ',
  badgeClass: 'bg-green-50 text-green-700 border-green-200'
 };
};

const getItemExpiryMeta = (item: any) => {
 let parsed: any = null;
 if (item && typeof item.barcode === 'string' && item.barcode.trim().startsWith('{')) {
  try {
   parsed = JSON.parse(item.barcode);
  } catch {
   parsed = null;
  }
 }

 const rawAlertDays = item?.expiry_alert_days ?? parsed?.expiry_alert_days;
 const alertDays: number = rawAlertDays !== undefined && rawAlertDays !== null && rawAlertDays !== ''
  ? Math.max(0, Number(rawAlertDays))
  : 7;

 const explicitNoExpiry: boolean = item?.no_expiry !== undefined
  ? Boolean(item.no_expiry)
  : parsed?.no_expiry === true;

 const todayKey = getBangkokDateKeyClient();
 const totalStock = Math.max(0, Number(Number(item?.quantity || 0).toFixed(6)));

 if (explicitNoExpiry) {
  const mfgDate: string | null = (item?.mfg_date ?? parsed?.mfg_date) || null;
  return {
   mfgDate,
   expDate: null as string | null,
   noExpiry: true,
   alertDays,
   status: 'NO_EXPIRY' as ExpiryStatusType,
   daysUntilExpiry: null as number | null,
   badgeLabel: 'ไม่มีวันหมดอายุ',
   badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
   batches: [] as ExpiryBatchMeta[],
   untrackedQuantity: 0
  };
 }

 let rawBatches: any[] = Array.isArray(item?.expiry_batches)
  ? item.expiry_batches
  : Array.isArray(parsed?.batches)
  ? parsed.batches
  : [];

 const fallbackMfg: string | null = (item?.mfg_date ?? parsed?.mfg_date) || null;
 const fallbackExp: string | null = (item?.exp_date ?? parsed?.exp_date) || null;

 if (rawBatches.length === 0 && (fallbackMfg || fallbackExp)) {
  rawBatches = [{
   id: 'lot_legacy_0',
   quantity: totalStock > 0 ? totalStock : 1,
   mfg_date: fallbackMfg,
   exp_date: fallbackExp,
   no_expiry: false
  }];
 }

 const sortedRaw = [...rawBatches].sort((a, b) => {
  const aNoExp = Boolean(a?.no_expiry ?? a?.noExpiry);
  const bNoExp = Boolean(b?.no_expiry ?? b?.noExpiry);
  if (aNoExp !== bNoExp) return aNoExp ? 1 : -1;
  const aExp = String(a?.exp_date || a?.expDate || '');
  const bExp = String(b?.exp_date || b?.expDate || '');
  if (aExp && bExp) return aExp.localeCompare(bExp);
  if (aExp) return -1;
  if (bExp) return 1;
  return 0;
 });

 // Reconcile batch quantities with current total stock (FEFO)
 const rawSum = Number(sortedRaw.reduce((sum, b) => sum + Math.max(0, Number(b?.quantity || 0)), 0).toFixed(6));
 let reconciledRaw = sortedRaw;
 if (totalStock <= 0 && rawSum > 0) {
  reconciledRaw = [];
 } else if (rawSum > totalStock + 0.0001 && totalStock > 0) {
  let excess = Number((rawSum - totalStock).toFixed(6));
  const adjusted: any[] = [];
  for (const b of sortedRaw) {
   const bQty = Math.max(0, Number(b?.quantity || 0));
   if (excess <= 0) {
    adjusted.push(b);
   } else if (bQty <= excess + 0.000001) {
    excess = Number((excess - bQty).toFixed(6));
   } else {
    adjusted.push({ ...b, quantity: Number((bQty - excess).toFixed(6)) });
    excess = 0;
   }
  }
  reconciledRaw = adjusted;
 }

 const batches: ExpiryBatchMeta[] = reconciledRaw.map((b, idx) =>
  computeSingleBatchMeta(b, idx, alertDays, todayKey)
 );

 const trackedSum = Number(batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0).toFixed(6));
 const untrackedQuantity = totalStock > trackedSum + 0.0001
  ? Number((totalStock - trackedSum).toFixed(6))
  : 0;

 if (batches.length === 0) {
  return {
   mfgDate: null as string | null,
   expDate: null as string | null,
   noExpiry: false,
   alertDays,
   status: 'UNSPECIFIED' as ExpiryStatusType,
   daysUntilExpiry: null as number | null,
   badgeLabel: 'ยังไม่ระบุวันหมดอายุ',
   badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
   batches: [] as ExpiryBatchMeta[],
   untrackedQuantity: totalStock
  };
 }

 const datedBatches = batches.filter(b => !b.noExpiry && b.expDate);
 const primaryBatch = datedBatches[0] || batches[0];
 const allNoExpiry = batches.length > 0 && batches.every(b => b.noExpiry) && untrackedQuantity === 0;

 return {
  mfgDate: primaryBatch.mfgDate,
  expDate: primaryBatch.expDate,
  noExpiry: allNoExpiry,
  alertDays,
  status: primaryBatch.status,
  daysUntilExpiry: primaryBatch.daysUntilExpiry,
  badgeLabel: primaryBatch.badgeLabel,
  badgeClass: primaryBatch.badgeClass,
  batches,
  untrackedQuantity
 };
};

// ==========================================
// SUPABASE CLIENT สำหรับอัปโหลดรูปภาพ
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function InventoryPage() {
 const { showToast } = useToast();

 const router = useRouter();
 const [user, setUser] = useState<any>(null);

 // States: Main Data
 const [inventoryItems, setInventoryItems] = useState<any[]>([]);
 const [inventoryImages, setInventoryImages] = useState<Record<string, string | null>>({});
 const [loading, setLoading] = useState<boolean>(true);
 
 // States: Filters & Tabs
 const [viewMode, setViewMode] = useState<"table" | "compact" | "grid">("grid");
 const [searchQuery, setSearchQuery] = useState("");
 const [activeTab, setActiveTab] = useState("วัตถุดิบ"); 
 const [filterStatus, setFilterStatus] = useState("all"); 
 const [filterStock, setFilterStock] = useState("all");
 const [filterType, setFilterType] = useState("all");
 const [filterSubcategory, setFilterSubcategory] = useState("all");
 const [currentPage, setCurrentPage] = useState(1);
 const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
 const [showCategoryModal, setShowCategoryModal] = useState(false);
 const [categoryForm, setCategoryForm] = useState({ id: null as number | null, name: "", type: "raw_material" });
 const [categoryTypeMap, setCategoryTypeMap] = useState<Record<string, string>>({});
 

 // States: Modals (Add / Edit)
 const [showFormModal, setShowFormModal] = useState(false);
 const [formMode, setFormMode] = useState<"add" | "edit">("add");
 const [formData, setFormData] = useState<any>({});
 const [uploadingImage, setUploadingImage] = useState(false);
 const [isSaving, setIsSaving] = useState(false);

 // States: Detail Drawer
 const [selectedItem, setSelectedItem] = useState<any | null>(null);
 const [detailLoading, setDetailLoading] = useState<boolean>(false);
 const [drawerTab, setDrawerTab] = useState<"detail" | "adjustment" | "movement">("detail");
 const [adjustData, setAdjustData] = useState({ qty: "", reason: "นับ Stock ประจำวัน", note: "", no_expiry: false, mfg_date: "", exp_date: "", batch_id: "auto" });
 const [stockDialog, setStockDialog] = useState<{ open: boolean; mode: "in" | "out" }>({ open: false, mode: "in" });
 const [stockForm, setStockForm] = useState({ amount: "1", reason: "รับสินค้าเข้า", note: "", no_expiry: false, mfg_date: "", exp_date: "", batch_id: "auto" });

 // States: Fullscreen Expand on Scroll
 const [isExpanded, setIsExpanded] = useState(false);
 const [tabsHeight, setTabsHeight] = useState(136);
 const tabsRef = useRef<HTMLDivElement>(null);
 const contentScrollRef = useRef<HTMLDivElement>(null);
 const touchStartY = useRef<number | null>(null);

 useEffect(() => {
 const updateTabsHeight = () => {
 if (tabsRef.current) {
 setTabsHeight(tabsRef.current.offsetHeight + 24);
 }
 };
 updateTabsHeight();
 window.addEventListener('resize', updateTabsHeight);
 return () => window.removeEventListener('resize', updateTabsHeight);
 }, []);

 const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
 const scrollTop = e.currentTarget.scrollTop;
 if (scrollTop > 25 && !isExpanded) {
 setIsExpanded(true);
 } else if (scrollTop <= 2 && isExpanded) {
 setIsExpanded(false);
 }
 };

 const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
 if (e.deltaY > 15 && !isExpanded) {
 setIsExpanded(true);
 } else if (e.deltaY < -15 && isExpanded) {
 const el = contentScrollRef.current;
 if (!el || el.scrollTop <= 5) {
 setIsExpanded(false);
 }
 }
 };

 const handleTouchStart = (e: React.TouchEvent) => {
 touchStartY.current = e.touches[0].clientY;
 };

 const handleTouchEnd = (e: React.TouchEvent) => {
 if (touchStartY.current === null) return;
 const deltaY = touchStartY.current - e.changedTouches[0].clientY;
 touchStartY.current = null;

 if (deltaY > 40 && !isExpanded) {
 setIsExpanded(true);
 } else if (deltaY < -40 && isExpanded) {
 const el = contentScrollRef.current;
 if (!el || el.scrollTop <= 5) {
 setIsExpanded(false);
 }
 }
 };

 const toggleExpanded = () => {
 if (isExpanded) {
 setIsExpanded(false);
 if (contentScrollRef.current) {
 contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
 }
 } else {
 setIsExpanded(true);
 }
 };

 useEffect(() => {
 const savedUser = JSON.parse(localStorage.getItem("userContext") || "{}");
 if (!savedUser || Object.keys(savedUser).length === 0) {
 router.push("/pin");
 return;
 }
 setUser(savedUser);

 const params = new URLSearchParams(window.location.search);
 const stockFilter = params.get("stock");
 if (stockFilter && ["low", "out", "expiring", "expired", "no_expiry"].includes(stockFilter)) {
 setFilterStock(stockFilter);
 }
 
 const savedView = localStorage.getItem("inventoryViewMode");
 if (savedView) setViewMode(savedView as any);
 }, [router]);

 const changeViewMode = (mode: "table" | "compact" | "grid") => {
 setViewMode(mode);
 localStorage.setItem("inventoryViewMode", mode);
 };

 // ==========================================
 // FETCH DATA
 // ==========================================
 const fetchData = useCallback(async () => {
 if (!user?.shop_id) return;
 setLoading(true);
 try {
 const [invRes, categoriesRes] = await Promise.all([
 fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/inventory/items?shop_id=${user.shop_id}&include_images=false`),
 fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/inventory/categories?shop_id=${user.shop_id}`)
 ]);
 if (invRes.ok) setInventoryItems(await invRes.json());
 if (categoriesRes.ok) {
 const categories = await categoriesRes.json();
 setInventoryCategories(categories || []);
 setCategoryTypeMap((prev) => {
 const next = { ...prev };
 (categories || []).forEach((category: any) => {
 next[String(category.id)] = category.type || next[String(category.id)] || 'raw_material';
 });
 return next;
 });
 }
 } catch (err: any) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 }, [user]);

 useEffect(() => { fetchData(); }, [fetchData]);
 useEffect(() => { setCurrentPage(1); }, [searchQuery, activeTab, filterStatus, filterStock, filterType, filterSubcategory]);

 const activeTypeValue = activeTab === "วัตถุดิบ" ? "raw_material" : "packaging";
 const activeFilterTypeLabel = activeTab === "วัตถุดิบ" ? 'วัตถุดิบ' : 'บรรจุภัณฑ์';

 const subcategoryOptions = useMemo(() => {
 const filteredByType = inventoryItems.filter(item => {
 const matchesActiveTab = item.type === activeTypeValue || (!item.type && activeTypeValue === 'raw_material');
 return matchesActiveTab;
 });

 const countsByCategory = new Map<string, number>();
 let uncategorizedCount = 0;
 filteredByType.forEach((item) => {
 if (item.category_id !== null && item.category_id !== undefined && item.category_id !== '') {
 const categoryId = String(item.category_id);
 countsByCategory.set(categoryId, (countsByCategory.get(categoryId) || 0) + 1);
 } else {
 uncategorizedCount++;
 }
 });

 const dynamicCategories = inventoryCategories.filter((cat) => {
 const categoryId = String(cat.id);
 const localType = categoryTypeMap[categoryId];
 return countsByCategory.has(categoryId) || localType === activeTypeValue || !localType;
 });

 return [
 { id: 'all', name: 'สินค้าทั้งหมด', count: filteredByType.length },
 { id: 'uncategorized', name: 'ยังไม่ได้จัดหมวดหมู่', count: uncategorizedCount },
 ...dynamicCategories.map((cat) => ({
 id: String(cat.id),
 name: cat.name,
 count: countsByCategory.get(String(cat.id)) || 0
 }))
 ];
 }, [inventoryCategories, inventoryItems, activeTypeValue, categoryTypeMap]);

 const categoryCountMap = useMemo(() => {
 const map: Record<string, number> = {};
 inventoryItems.forEach((item) => {
 if (item.category_id !== null && item.category_id !== undefined && item.category_id !== '') {
 map[String(item.category_id)] = (map[String(item.category_id)] || 0) + 1;
 }
 });
 return map;
 }, [inventoryItems]);

 const formCategoryOptions = useMemo(() => {
 const selectedType = formData.type || (activeTab === 'บรรจุภัณฑ์' ? 'packaging' : 'raw_material');
 return inventoryCategories.filter((category) => category.type === selectedType || !category.type);
 }, [formData.type, inventoryCategories, activeTab]);

 const updateCategoryTypeMap = (categoryId: number | string, type: string) => {
 setCategoryTypeMap((prev) => ({ ...prev, [String(categoryId)]: type }));
 };

 const saveCategory = async () => {
 if (!user?.shop_id || !categoryForm.name.trim()) {
 showToast('กรุณากรอกชื่อหมวดย่อย' , 'error');
 return;
 }
 try {
 const url = categoryForm.id ? `${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/inventory/categories/${categoryForm.id}` : `${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/inventory/categories`;
 const method = categoryForm.id ? 'PUT' : 'POST';
 const res = await fetch(url, {
 method,
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 shop_id: Number(user.shop_id),
 name: categoryForm.name.trim(),
 type: categoryForm.type
 })
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(getThaiApiMessage(data.error, 'บันทึกหมวดย่อยไม่สำเร็จ กรุณาลองใหม่'));

 const savedCategory = data.category || data || { id: Date.now(), name: categoryForm.name.trim(), type: categoryForm.type };
 const resolvedCategoryId = savedCategory.id ?? data.id ?? categoryForm.id ?? Date.now();
 const normalizedCategory = { ...savedCategory, id: resolvedCategoryId, name: savedCategory.name || categoryForm.name.trim(), type: savedCategory.type || categoryForm.type };
 setInventoryCategories((prev) => {
 const existing = prev.find((cat) => Number(cat.id) === Number(normalizedCategory.id));
 if (existing) {
 return prev.map((cat) => Number(cat.id) === Number(normalizedCategory.id) ? { ...cat, name: normalizedCategory.name, type: normalizedCategory.type || categoryForm.type } : cat);
 }
 return [...prev, { ...normalizedCategory, type: normalizedCategory.type || categoryForm.type }];
 });
 setInventoryItems((prev) => prev.map((item) => Number(item.category_id) === Number(normalizedCategory.id)
 ? { ...item, type: normalizedCategory.type || categoryForm.type }
 : item));
 updateCategoryTypeMap(normalizedCategory.id, categoryForm.type);
 if (showFormModal && formData.type === categoryForm.type) {
 setFormData((prev: any) => ({ ...prev, category_id: normalizedCategory.id || prev.category_id }));
 }
 setCategoryForm({ id: null, name: '', type: activeTypeValue });
 setShowCategoryModal(false);
 setFilterSubcategory('all');
 await fetchData();
 showToast(categoryForm.id ? 'แก้ไขหมวดย่อยสำเร็จ' : 'เพิ่มหมวดย่อยสำเร็จ', 'success');
 } catch (err: any) {
 showToast(getThaiApiMessage(err.message, 'บันทึกหมวดย่อยไม่สำเร็จ กรุณาลองใหม่'), 'error');
 }
 };

 const deleteCategory = async (categoryId: number | string) => {
 if (!user?.shop_id) return;
 const category = inventoryCategories.find((cat) => Number(cat.id) === Number(categoryId));
 if (!category) return;
 if (!window.confirm(`ต้องการลบหมวดย่อย "${category.name}" หรือไม่?\nระบบจะย้ายสินค้าในหมวดนี้ให้เป็น "ยังไม่ได้จัดหมวดหมู่" ก่อนลบหมวด`)) return;
 try {
 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/inventory/categories/${Number(categoryId)}?shop_id=${Number(user.shop_id)}`, {
 method: 'DELETE'
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(getThaiApiMessage(data.error, 'ลบหมวดย่อยไม่สำเร็จ กรุณาลองใหม่'));

 setInventoryCategories((prev) => prev.filter((cat) => Number(cat.id) !== Number(categoryId)));
 setInventoryItems((prev) => prev.map((item) => Number(item.category_id) === Number(categoryId)
 ? { ...item, category_id: null }
 : item));
 setCategoryTypeMap((prev) => {
 const next = { ...prev };
 delete next[String(categoryId)];
 return next;
 });
 if (String(filterSubcategory) === String(categoryId)) setFilterSubcategory('all');
 await fetchData();
 showToast('ลบหมวดย่อยสำเร็จ', 'success');
 } catch (err: any) {
 showToast(getThaiApiMessage(err.message, 'ลบหมวดย่อยไม่สำเร็จ กรุณาลองใหม่'), 'error');
 }
 };

 const clearFilters = () => {
 setFilterStatus('all');
 setFilterStock('all');
 setFilterSubcategory('all');
 setFilterType('all');
 setActiveTab('วัตถุดิบ');
 };

 const countRaw = useMemo(() => inventoryItems.filter(i => !i.type || i.type === 'raw_material').length, [inventoryItems]);
 const countPkg = useMemo(() => inventoryItems.filter(i => i.type === 'packaging').length, [inventoryItems]);

 const selectTypeTab = (tab: string) => {
 const nextType = tab === 'วัตถุดิบ' ? 'raw_material' : 'packaging';
 setActiveTab(tab);
 setFilterType(nextType);
 setFilterSubcategory('all');
 setSearchQuery("");
 setFilterStatus("all");
 setFilterStock("all");
 setCurrentPage(1);
 if (contentScrollRef.current) {
 contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
 }
 };

 const effectiveType = filterType === 'all' ? activeTypeValue : filterType;

 const expirySummary = useMemo(() => {
 let expiredCount = 0;
 let expiringCount = 0;
 inventoryItems.forEach((item) => {
 const matchesType = item.type === effectiveType || (!item.type && effectiveType === 'raw_material');
 if (!matchesType || item.status === 'inactive' || Number(item.quantity || 0) <= 0) return;
 const expiry = getItemExpiryMeta(item);
 if (expiry.status === 'EXPIRED' || expiry.status === 'EXPIRES_TODAY') expiredCount++;
 else if (expiry.status === 'EXPIRING_SOON') expiringCount++;
 });
 return { expiredCount, expiringCount };
 }, [inventoryItems, effectiveType]);

 const displayedItems = useMemo(() => {
 const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
 return inventoryItems.filter((item) => {
 const matchesType = item.type === effectiveType || (!item.type && effectiveType === 'raw_material');
 const matchesSearch = !normalizedSearch ||
 item.name?.toLocaleLowerCase().includes(normalizedSearch);
 const matchesSubcategory = filterSubcategory === 'all' ? true : filterSubcategory === 'uncategorized' ? (!item.category_id || String(item.category_id) === 'null') : String(item.category_id) === String(filterSubcategory);
 const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
 const expiry = getItemExpiryMeta(item);
 const matchesStock = filterStock === 'low'
 ? Number(item.min_threshold || 0) > 0 && item.quantity <= Number(item.min_threshold) && item.quantity > 0
 : filterStock === 'out'
 ? item.quantity <= 0
 : filterStock === 'expired'
 ? item.quantity > 0 && (expiry.status === 'EXPIRED' || expiry.status === 'EXPIRES_TODAY')
 : filterStock === 'expiring'
 ? item.quantity > 0 && expiry.status === 'EXPIRING_SOON'
 : filterStock === 'no_expiry'
 ? expiry.status === 'NO_EXPIRY'
 : true;
 return matchesType && matchesSearch && matchesSubcategory && matchesStatus && matchesStock;
 });
 }, [inventoryItems, effectiveType, searchQuery, filterSubcategory, filterStatus, filterStock]);
 const pageCount = Math.max(1, Math.ceil(displayedItems.length / ITEMS_PER_PAGE));
 const paginatedItems = useMemo(
 () => displayedItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
 [displayedItems, currentPage]
 );
 useEffect(() => {
 setCurrentPage((page) => Math.min(page, pageCount));
 }, [pageCount]);
 useEffect(() => {
 if (!user?.shop_id || paginatedItems.length === 0) {
 setInventoryImages({});
 return;
 }

 let isCurrentPage = true;
 const itemIds = paginatedItems.map((item) => item.id).join(',');
 fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/inventory/items?shop_id=${user.shop_id}&images_only=true&item_ids=${itemIds}`)
 .then(async (response) => {
 if (!response.ok) throw new Error('โหลดรูปสินค้าไม่สำเร็จ');
 return response.json();
 })
 .then((items) => {
 if (isCurrentPage) {
 setInventoryImages(Object.fromEntries(items.map((item: any) => [String(item.id), item.image_url || null])));
 }
 })
 .catch((error) => {
 if (isCurrentPage) console.error('Failed to load inventory images:', error);
 });

 return () => { isCurrentPage = false; };
 }, [user?.shop_id, paginatedItems]);

 const activeFilterChips = [
 ...(filterSubcategory !== 'all' ? [{ label: subcategoryOptions.find((item) => String(item.id) === String(filterSubcategory))?.name || 'หมวดย่อย', key: 'subcategory' }] : []),
 ...(filterStatus !== 'all' ? [{ label: filterStatus === 'active' ? 'เปิดใช้งาน' : 'ระงับ', key: 'status' }] : []),
 ...(filterStock !== 'all' ? [{
 label: filterStock === 'low' ? 'ใกล้หมดสต็อก'
 : filterStock === 'out' ? 'หมดสต็อก'
 : filterStock === 'expiring' ? 'ใกล้หมดอายุ'
 : filterStock === 'expired' ? 'หมดอายุแล้ว'
 : 'ไม่มีวันหมดอายุ',
 key: 'stock'
 }] : [])
 ];

 // ==========================================
 // IMAGE UPLOAD 
 // ==========================================
 const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 if (!e.target.files || e.target.files.length === 0) return;
 const file = e.target.files[0];
 if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
 return showToast("รองรับไฟล์ JPG, PNG และ WEBP เท่านั้น", 'error');
 }
 if (file.size > 2 * 1024 * 1024) return showToast("ขนาดรูปต้องไม่เกิน 2MB", 'error');

 setUploadingImage(true);
 try {
 const imageDataUrl = await new Promise<string>((resolve, reject) => {
 const reader = new FileReader();
 reader.onload = () => resolve(String(reader.result));
 reader.onerror = () => reject(new Error("อ่านไฟล์รูปภาพไม่สำเร็จ"));
 reader.readAsDataURL(file);
 });
 setFormData((previous: any) => ({ ...previous, image_url: imageDataUrl }));
 } catch (err: any) {
 showToast('อ่านรูปภาพไม่สำเร็จ กรุณาลองเลือกไฟล์ใหม่', 'error');
 } finally {
 setUploadingImage(false);
 }
 };

 // ==========================================
 // SAVE DATA
 // ==========================================
 const handleSaveData = async () => {
 if (!formData.name) return showToast("กรุณากรอกชื่อรายการ", 'error');
 if (!formData.type) return showToast("กรุณาเลือกประเภทหลัก", 'error');
 const isNoExpiry = Boolean(formData.no_expiry);

 const rawFormBatches: any[] = Array.isArray(formData.expiry_batches) ? formData.expiry_batches : [];
 let cleanedBatches: any[] = [];

 if (!isNoExpiry) {
  cleanedBatches = rawFormBatches
   .map((b, idx) => ({
    id: b?.id || `lot_${Date.now()}_${idx}`,
    quantity: Math.max(0, Number(b?.quantity ?? 0)),
    mfg_date: b?.mfg_date ? String(b.mfg_date).trim() : null,
    exp_date: b?.no_expiry ? null : (b?.exp_date ? String(b.exp_date).trim() : null),
    no_expiry: Boolean(b?.no_expiry)
   }))
   .filter((b) => b.no_expiry || b.exp_date || b.mfg_date);

  if (cleanedBatches.length === 0) {
   return showToast("กรุณาระบุวันหมดอายุอย่างน้อย 1 ล็อต หรือเลือก 'สินค้าไม่มีวันหมดอายุ'", 'error');
  }

  for (let i = 0; i < cleanedBatches.length; i++) {
   const b = cleanedBatches[i];
   if (!b.no_expiry && !b.exp_date) {
    return showToast(`กรุณาระบุวันหมดอายุของล็อตที่ ${i + 1}`, 'error');
   }
   if (!b.no_expiry && b.mfg_date && b.exp_date && b.exp_date < b.mfg_date) {
    return showToast(`ล็อตที่ ${i + 1}: วันหมดอายุต้องไม่น้อยกว่าวันผลิต`, 'error');
   }
  }
 }

 const batchQtySum = cleanedBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
 const finalQuantity = formMode === 'add'
  ? (cleanedBatches.length > 1 ? batchQtySum : Number(formData.quantity ?? batchQtySum ?? 0))
  : Number(formData.quantity ?? 0);

 if (formMode === 'add' && !isNoExpiry && cleanedBatches.length === 1) {
  cleanedBatches[0].quantity = finalQuantity;
 }

 const primaryBatch = cleanedBatches.find((b) => !b.no_expiry && b.exp_date) || cleanedBatches[0] || null;

 setIsSaving(true);
 try {
 let endpoint = `/api/inventory/items${formMode === 'edit' ? `/${formData.id}` : ''}`;
 let payload = { 
 ...formData, 
 quantity: finalQuantity,
 shop_id: user.shop_id,
 user_id: user.id,
 type: formData.type || (activeTab === "บรรจุภัณฑ์" ? 'packaging' : 'raw_material'),
 category_id: formData.category_id ? Number(formData.category_id) : null,
 no_expiry: isNoExpiry,
 mfg_date: isNoExpiry ? (formData.mfg_date || null) : (primaryBatch?.mfg_date || null),
 exp_date: isNoExpiry ? null : (primaryBatch?.exp_date || null),
 expiry_alert_days: formData.expiry_alert_days !== undefined ? Number(formData.expiry_alert_days) : 7,
 expiry_batches: isNoExpiry ? [] : cleanedBatches
 };

 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}${endpoint}`, {
 method: formMode === "edit" ? "PUT" : "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload)
 });

 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(getThaiApiMessage(data.error || data.message, 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่'));
 setShowFormModal(false);
 setFormData({});
 await fetchData();
 window.dispatchEvent(new Event('notifications:refresh'));
 showToast(formMode === 'edit' ? 'แก้ไขข้อมูลสำเร็จ' : 'เพิ่มรายการเข้าคลังสำเร็จ', 'success');
 } catch (err: any) {
 showToast(getThaiApiMessage(err.message, 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่'), 'error');
 } finally {
 setIsSaving(false);
 }
 };

 const handleDeleteItem = async () => {
 if (!selectedItem) return;
 if (!window.confirm(`คุณต้องการลบ "${selectedItem.name}" ใช่หรือไม่? การเปลี่ยนแปลงนี้ไม่สามารถย้อนกลับได้`)) return;

 setIsSaving(true);
 try {
 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/inventory/items/${selectedItem.id}`, {
 method: "DELETE"
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(getThaiApiMessage(data.error, 'ลบรายการไม่สำเร็จ กรุณาลองใหม่'));

 setSelectedItem(null);
 await fetchData();
 window.dispatchEvent(new Event('notifications:refresh'));
 } catch (err: any) {
 showToast(getThaiApiMessage(err.message, 'ลบรายการไม่สำเร็จ กรุณาลองใหม่'), 'error');
 } finally {
 setIsSaving(false);
 }
 };

 // ==========================================
 // ADJUST STOCK
 // ==========================================
 const applyStockAdjustment = (itemId: number, quantity: number, movement?: any, expiryInfo?: any) => {
 setInventoryItems((items) => items.map((item) => Number(item.id) === itemId
 ? {
 ...item,
 quantity,
 total_pieces: quantity * Number(item.package_size || 1),
 ...(expiryInfo ? {
 mfg_date: expiryInfo.mfg_date,
 exp_date: expiryInfo.exp_date,
 no_expiry: expiryInfo.no_expiry,
 expiry_alert_days: expiryInfo.expiry_alert_days,
 expiry_status: expiryInfo.expiry_status,
 days_until_expiry: expiryInfo.days_until_expiry,
 expiry_batches: expiryInfo.expiry_batches || []
 } : {})
 }
 : item));
 setSelectedItem((item: any) => item && Number(item.id) === itemId
 ? {
 ...item,
 quantity,
 total_pieces: quantity * Number(item.package_size || 1),
 ...(expiryInfo ? {
 mfg_date: expiryInfo.mfg_date,
 exp_date: expiryInfo.exp_date,
 no_expiry: expiryInfo.no_expiry,
 expiry_alert_days: expiryInfo.expiry_alert_days,
 expiry_status: expiryInfo.expiry_status,
 days_until_expiry: expiryInfo.days_until_expiry,
 expiry_batches: expiryInfo.expiry_batches || []
 } : {}),
 movements: movement
 ? [movement, ...(item.movements || []).filter((existing: any) => existing.id !== movement.id)]
 : item.movements
 }
 : item);
 };

 const refreshStockQuantity = async (itemId: number) => {
 const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/inventory/${itemId}?shop_id=${user.shop_id}`);
 const data = await response.json();
 if (!response.ok || !Number.isFinite(Number(data.quantity))) {
 throw new Error(getThaiApiMessage(data.error, 'โหลดจำนวนสต็อกล่าสุดไม่สำเร็จ'));
 }
 const quantity = Number(data.quantity);
 applyStockAdjustment(itemId, quantity, undefined, data);
 return quantity;
 };

 const handleAdjustStock = async () => {
 if (!adjustData.qty || isNaN(Number(adjustData.qty))) return showToast("กรุณาระบุจำนวนที่ต้องการปรับ", 'error');
 if (!selectedItem) return;
 const amount = Number(adjustData.qty);
 if (amount > 0) {
 if (!adjustData.no_expiry && !adjustData.exp_date) {
 return showToast("กรุณาระบุวันหมดอายุของล็อตที่รับเข้า หรือเลือก 'สินค้าไม่มีวันหมดอายุ'", 'error');
 }
 if (!adjustData.no_expiry && adjustData.mfg_date && adjustData.exp_date && String(adjustData.exp_date) < String(adjustData.mfg_date)) {
 return showToast("วันหมดอายุต้องไม่น้อยกว่าวันผลิต", 'error');
 }
 }

 const itemId = Number(selectedItem.id);
 const previousQuantity = Number(selectedItem.quantity || 0);
 const optimisticQuantity = previousQuantity + amount;
 applyStockAdjustment(itemId, optimisticQuantity);
 setDrawerTab('detail');
 showToast('กำลังบันทึกการปรับสต็อก...', 'info');
 setIsSaving(true);
 try {
 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/inventory/adjust`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 shop_id: user.shop_id,
 user_id: user.id,
 item_id: itemId,
 adjust_qty: amount,
 expected_quantity: selectedItem.quantity,
 reason: adjustData.reason,
 ...(amount > 0 ? {
 no_expiry: Boolean(adjustData.no_expiry),
 mfg_date: adjustData.mfg_date || null,
 exp_date: adjustData.no_expiry ? null : (adjustData.exp_date || null)
 } : {
 batch_id: adjustData.batch_id && adjustData.batch_id !== 'auto' ? adjustData.batch_id : null
 })
 })
 });
 
 const data = await res.json();
 if (res.status === 409 && Number.isFinite(Number(data.current_stock))) {
 applyStockAdjustment(itemId, Number(data.current_stock));
 showToast('สต็อกถูกเปลี่ยนแปลงแล้ว อัปเดตจำนวนล่าสุดให้แล้ว กรุณาตรวจสอบก่อนปรับอีกครั้ง', 'error');
 return;
 }
 if (data.stock_updated) {
 applyStockAdjustment(itemId, Number(data.new_stock), data.movement, data.expiry_info);
 showToast(getThaiApiMessage(data.error, 'ปรับสต็อกแล้ว แต่บันทึกประวัติไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ'), 'error');
 return;
 }
 if (!res.ok) throw new Error(getThaiApiMessage(data.error, 'ปรับสต็อกไม่สำเร็จ กรุณาลองใหม่'));
 
 applyStockAdjustment(itemId, Number(data.new_stock), data.movement, data.expiry_info);
 window.dispatchEvent(new Event('notifications:refresh'));
 if (data.notification_status?.stock_adjust === 'failed') {
 showToast('ปรับสต็อกสำเร็จ แต่สร้างการแจ้งเตือนไม่สำเร็จ', 'error');
 } else if (data.notification_status?.stock_adjust === 'disabled') {
 showToast('ปรับสต็อกสำเร็จ แต่ปิดการแจ้งเตือนปรับสต็อกอยู่', 'info');
 } else {
 showToast(getThaiApiMessage(data.message, 'ปรับสต็อกสำเร็จ'), 'success');
 }
 setAdjustData({ qty: "", reason: "นับ Stock ประจำวัน", note: "", no_expiry: false, mfg_date: "", exp_date: "", batch_id: "auto" });
 } catch (err: any) {
 try {
 await refreshStockQuantity(itemId);
 } catch (refreshError) {
 console.error('Failed to refresh inventory after adjustment error:', refreshError);
 applyStockAdjustment(itemId, previousQuantity);
 }
 showToast(getThaiApiMessage(err.message, 'ปรับสต็อกไม่สำเร็จ กรุณาลองใหม่'), 'error');
 } finally {
 setIsSaving(false);
 }
 };

 const openStockDialog = (mode: "in" | "out") => {
 const expiry = selectedItem ? getItemExpiryMeta(selectedItem) : null;
 setStockDialog({ open: true, mode });
 setStockForm({
 amount: "1",
 reason: mode === "in" ? "รับสินค้าเข้า" : "สินค้าเสียหาย / หมดอายุ / สูญหาย",
 note: "",
 no_expiry: expiry ? Boolean(expiry.noExpiry) : false,
 mfg_date: "",
 exp_date: "",
 batch_id: "auto"
 });
 };

 const submitStockAdjustment = async () => {
 if (!selectedItem) return;
 const amount = Number(stockForm.amount);
 if (!Number.isFinite(amount) || amount <= 0) return showToast("กรุณาระบุจำนวนที่มากกว่า 0", 'error');
 if (stockDialog.mode === "out" && amount > Number(selectedItem.quantity || 0)) return showToast("จำนวนที่ลดไม่สามารถมากกว่าสต็อกปัจจุบันได้", 'error');
 if (stockDialog.mode === "in") {
 if (!stockForm.no_expiry && !stockForm.exp_date) {
 return showToast("กรุณาระบุวันหมดอายุของล็อตที่รับเข้า หรือเลือก 'สินค้าไม่มีวันหมดอายุ'", 'error');
 }
 if (!stockForm.no_expiry && stockForm.mfg_date && stockForm.exp_date && String(stockForm.exp_date) < String(stockForm.mfg_date)) {
 return showToast("วันหมดอายุต้องไม่น้อยกว่าวันผลิต", 'error');
 }
 }
 const itemId = Number(selectedItem.id);
 const previousQuantity = Number(selectedItem.quantity || 0);
 const adjustment = stockDialog.mode === "in" ? amount : -amount;
 showToast('กำลังบันทึกการปรับสต็อก...', 'info');
 setIsSaving(true);
 try {
 const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/inventory/adjust`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 shop_id: user.shop_id,
 user_id: user.id,
 item_id: itemId,
 adjust_qty: adjustment,
 expected_quantity: selectedItem.quantity,
 reason: stockForm.reason,
 note: stockForm.note,
 ...(stockDialog.mode === "in" ? {
 no_expiry: Boolean(stockForm.no_expiry),
 mfg_date: stockForm.mfg_date || null,
 exp_date: stockForm.no_expiry ? null : (stockForm.exp_date || null)
 } : {
 batch_id: stockForm.batch_id && stockForm.batch_id !== 'auto' ? stockForm.batch_id : null
 })
 })
 });
 const data = await response.json();
 if (response.status === 409 && Number.isFinite(Number(data.current_stock))) {
 applyStockAdjustment(itemId, Number(data.current_stock));
 showToast('สต็อกถูกเปลี่ยนแปลงแล้ว อัปเดตจำนวนล่าสุดให้แล้ว กรุณาตรวจสอบก่อนปรับอีกครั้ง', 'error');
 return;
 }
 if (data.stock_updated) {
 applyStockAdjustment(itemId, Number(data.new_stock), data.movement, data.expiry_info);
 setStockDialog({ open: false, mode: "in" });
 showToast(getThaiApiMessage(data.error, 'ปรับสต็อกแล้ว แต่บันทึกประวัติไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ'), 'error');
 return;
 }
 if (!response.ok) throw new Error(getThaiApiMessage(data.error, 'ปรับสต็อกไม่สำเร็จ กรุณาลองใหม่'));
 applyStockAdjustment(itemId, Number(data.new_stock), data.movement, data.expiry_info);
 window.dispatchEvent(new Event('notifications:refresh'));
 setStockDialog({ open: false, mode: "in" });
 setStockForm({ amount: "1", reason: "รับสินค้าเข้า", note: "", no_expiry: false, mfg_date: "", exp_date: "", batch_id: "auto" });
 if (data.notification_status?.stock_adjust === 'failed') {
 showToast('ปรับสต็อกสำเร็จ แต่สร้างการแจ้งเตือนไม่สำเร็จ', 'error');
 } else if (data.notification_status?.stock_adjust === 'disabled') {
 showToast('ปรับสต็อกสำเร็จ แต่ปิดการแจ้งเตือนปรับสต็อกอยู่', 'info');
 } else {
 showToast(getThaiApiMessage(data.message, 'ปรับสต็อกสำเร็จ'), 'success');
 }
 } catch (error: any) {
 try {
 const latestQuantity = await refreshStockQuantity(itemId);
 if (latestQuantity !== previousQuantity) {
 setStockDialog({ open: false, mode: "in" });
 showToast('ยอดสต็อกมีการเปลี่ยนแปลงแล้ว โหลดข้อมูลล่าสุดให้แล้ว กรุณาตรวจสอบก่อนปรับซ้ำ', 'info');
 return;
 }
 } catch (refreshError) {
 console.error('Failed to refresh inventory after adjustment error:', refreshError);
 }
 showToast(getThaiApiMessage(error.message, 'ปรับสต็อกไม่สำเร็จ กรุณาลองใหม่'), 'error');
 } finally {
 setIsSaving(false);
 }
 };

 const handleOpenDetail = useCallback(async (id: string) => {
 if (!user?.shop_id) return;
 setDetailLoading(true);
 setDrawerTab("detail");
 try {
 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/inventory/${id}?shop_id=${user.shop_id}`);
 const data = await res.json();
 if (!res.ok || data.error) throw new Error(getThaiApiMessage(data.error, 'โหลดรายละเอียดสินค้าไม่สำเร็จ'));
 
 let itemMovs = [];
 try {
 const movRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "")}/api/stock-movements?shop_id=${user.shop_id}&item_id=${id}`);
 const movData = await movRes.json();
 
 if (Array.isArray(movData)) {
 itemMovs = movData.filter((m:any) => m.inventory_item_id === Number(id));
 } else if (movData && Array.isArray(movData.data)) {
 itemMovs = movData.data.filter((m:any) => m.inventory_item_id === Number(id));
 } else {
 console.warn("ไม่สามารถดึงประวัติการเคลื่อนไหวได้", movData);
 }
 } catch(e) {
 console.error("Failed to load movements:", e);
 }

 setSelectedItem({...data, type: data.type || 'material', movements: itemMovs});
 } catch (err: any) {
 showToast(getThaiApiMessage(err.message, 'โหลดรายละเอียดสินค้าไม่สำเร็จ กรุณาลองใหม่'), 'error');
 } finally {
 setDetailLoading(false);
 }
 }, [user?.shop_id, showToast]);

 useEffect(() => {
 if (!user?.shop_id) return;
 const itemIdParam = new URLSearchParams(window.location.search).get("item_id");
 if (itemIdParam) {
 void handleOpenDetail(itemIdParam);
 }
 }, [user?.shop_id, handleOpenDetail]);

 const openAddForm = () => {
 setFormMode("add");
 setFormData({ 
 status: 'active',
 type: activeTab === "บรรจุภัณฑ์" ? 'packaging' : 'raw_material',
 category_id: "",
 quantity: 1,
 no_expiry: false,
 mfg_date: "",
 exp_date: "",
 expiry_alert_days: 7,
 expiry_batches: [
  { id: `lot_${Date.now()}_0`, quantity: 1, mfg_date: "", exp_date: "", no_expiry: false }
 ]
 });
 setShowFormModal(true);
 };

 const openEditForm = (item: any) => {
 const expiry = getItemExpiryMeta(item);
 const existingBatches = expiry.batches.map((b) => ({
  id: b.id,
  quantity: b.quantity,
  mfg_date: b.mfgDate || '',
  exp_date: b.expDate || '',
  no_expiry: b.noExpiry
 }));
 if (!expiry.noExpiry && expiry.untrackedQuantity > 0) {
  existingBatches.push({
   id: `lot_${Date.now()}_untracked`,
   quantity: expiry.untrackedQuantity,
   mfg_date: '',
   exp_date: '',
   no_expiry: false
  });
 }
 if (existingBatches.length === 0) {
  existingBatches.push({
   id: `lot_${Date.now()}_0`,
   quantity: Math.max(1, Number(item.quantity || 1)),
   mfg_date: expiry.mfgDate || '',
   exp_date: expiry.expDate || '',
   no_expiry: false
  });
 }

 setFormMode("edit");
 setFormData({
 ...item,
 category_id: item.category_id ?? '',
 type: item.type || (activeTab === "บรรจุภัณฑ์" ? 'packaging' : 'raw_material'),
 no_expiry: expiry.noExpiry,
 mfg_date: expiry.mfgDate || '',
 exp_date: expiry.expDate || '',
 expiry_alert_days: expiry.alertDays,
 expiry_batches: existingBatches
 });
 setSelectedItem(null); 
 setShowFormModal(true);
 };

 return (
 <>
 

 <div className="flex h-screen bg-[#d6d6d6] font-sans overflow-hidden text-gray-800">
 
 {/* Sidebar POS */}
 <div className="w-[240px] bg-[#4d4d4d] text-white flex flex-col justify-between shrink-0 shadow-lg z-20">
 <div>
 <div className="h-[90px] flex items-center justify-center gap-3 translate-x-3">
 <h1 className="text-[36px] font-black italic tracking-widest text-white">POS</h1>
 <NotificationBell />
 </div>
 <nav className="sidebar-menu flex flex-col text-[16px] border-y border-[#666666]">
 <button onClick={() => router.push('/pos')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">สั่งและชำระเงิน</button>
 <button onClick={() => router.push('/pos/history')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">ประวัติใบเสร็จ</button>
 <button className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">สินค้าคงคลัง</button>
 <button onClick={() => router.push('/pos/shifts')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รอบการขาย</button>
 {user && user.role !== 'พนักงาน' && user.role !== 'Cashier' && (
 <button onClick={() => router.push('/pos/menu')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">เมนูและโปรโมชั่น</button>
 )}
 {user && user.role !== 'พนักงาน' && user.role !== 'Cashier' && (
 <button onClick={() => router.push('/pos/reports')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รายงาน</button>
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

 {/* Main Area */}
 <div className="flex-1 flex flex-col min-w-0">
 
 {/* Header */}
 <div className="h-[90px] bg-[#f5f6f8] flex items-center justify-between z-10 shrink-0 w-full px-8 border-b border-gray-200 shadow-sm">
 <div>
 <h2 className="text-[22px] font-bold text-gray-800">จัดการวัตถุดิบและบรรจุภัณฑ์ (Inventory)</h2>
 <p className="text-[14px] text-gray-500">จัดการปริมาณวัตถุดิบ บรรจุภัณฑ์ และการเบิกจ่ายสต็อก</p>
 </div>
 
 <div className="flex items-center gap-4">
 <div className="relative flex items-center h-[48px]">
 <Search className="w-5 h-5 text-gray-400 absolute left-4" />
 <input 
 type="text" 
 placeholder={
 activeTab === 'วัตถุดิบ' ? 'ค้นหาวัตถุดิบ...' : 'ค้นหาบรรจุภัณฑ์...'
 } 
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="h-full pl-12 pr-4 rounded-full border border-gray-200 outline-none focus:border-[#7a5c4e] text-[15px] w-[300px] shadow-sm"
 />
 </div>
 
 <button onClick={openAddForm} className="h-[48px] px-6 bg-[#7a5c4e] text-white rounded-full font-bold text-[15px] hover:bg-[#684c3f] transition-colors flex items-center gap-2 shadow-sm">
 <Plus className="w-5 h-5" /> เพิ่ม{activeTab}
 </button>
 </div>
 </div>

 <div onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="flex-1 overflow-hidden p-8 flex flex-col relative">
 
 {/* Main Navigation Tabs */}
 <div
  ref={tabsRef}
  className={`grid grid-cols-2 gap-6 shrink-0 mb-6 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
   isExpanded
    ? "opacity-0 scale-[0.98] pointer-events-none"
    : "opacity-100 scale-100 pointer-events-auto"
  }`}
 >
 {[
 { id: 'วัตถุดิบ', icon: <Droplets className="w-6 h-6" />, count: countRaw, title: 'วัตถุดิบ' },
 { id: 'บรรจุภัณฑ์', icon: <Box className="w-6 h-6" />, count: countPkg, title: 'บรรจุภัณฑ์' }
 ].map(tab => (
 <div 
 key={tab.id} 
 onClick={() => selectTypeTab(tab.id)}
 className={`p-5 rounded-[20px] border-2 cursor-pointer transition-all flex flex-col justify-between ${
 activeTab === tab.id 
 ? 'border-[#7a5c4e] bg-[#7a5c4e] text-white shadow-md transform -translate-y-1' 
 : 'border-transparent bg-white hover:border-[#7a5c4e]/30 shadow-sm text-gray-800 hover:-translate-y-1'
 }`}
 >
 <div className="flex items-center gap-3 mb-3">
 <div className={`p-2 rounded-xl ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#7a5c4e]'}`}>
 {tab.icon}
 </div>
 <h3 className="font-bold text-[18px]">{tab.title}</h3>
 </div>
 <p className={`text-[14px] font-medium ${activeTab === tab.id ? 'text-white/90' : 'text-gray-500'}`}>
 {tab.count} รายการ
 </p>
 </div>
 ))}
 </div>

 {/* Main Content Area */}
 <div
  style={{ marginTop: isExpanded ? `-${tabsHeight}px` : "0px" }}
  className={`bg-white rounded-[24px] border border-gray-200 flex-1 flex flex-col overflow-hidden relative z-10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
   isExpanded ? "shadow-2xl" : "shadow-sm"
  }`}
 >
  {/* Pull / Expand Handle Bar */}
  <div
   onClick={toggleExpanded}
   className="w-full flex items-center justify-center py-1.5 cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors group select-none shrink-0"
   title={isExpanded ? "คลิกเพื่อย่อมุมมอง" : "เลื่อนลงหรือคลิกเพื่อขยายเต็มจอ"}
  >
   <div className="flex items-center gap-2 text-gray-400 group-hover:text-[#7a5c4e] transition-colors">
    <div className="w-10 h-1 rounded-full bg-gray-300 group-hover:bg-[#7a5c4e] transition-colors" />
    <span className="text-[11px] font-medium hidden group-hover:inline transition-all">
     {isExpanded ? "ย่อมุมมอง" : "ขยายเต็มจอ"}
    </span>
   </div>
  </div>
 
 {/* Toolbar: Filters & View Modes */}
 <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
 <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
   {/* Mini Tabs when Expanded */}
   {isExpanded && (
    <div className="flex items-center bg-gray-200/80 p-1 rounded-xl shrink-0 mr-1 animate-fade-in">
     <button
      type="button"
      onClick={() => selectTypeTab("วัตถุดิบ")}
      className={`px-3 py-1.5 rounded-lg text-[13px] font-bold flex items-center gap-1.5 transition-all ${
       activeTab === "วัตถุดิบ"
        ? "bg-white text-[#7a5c4e] shadow-sm"
        : "text-gray-600 hover:text-gray-900"
      }`}
     >
      <Droplets className="w-3.5 h-3.5" />
      วัตถุดิบ ({countRaw})
     </button>
     <button
      type="button"
      onClick={() => selectTypeTab("บรรจุภัณฑ์")}
      className={`px-3 py-1.5 rounded-lg text-[13px] font-bold flex items-center gap-1.5 transition-all ${
       activeTab === "บรรจุภัณฑ์"
        ? "bg-white text-[#7a5c4e] shadow-sm"
        : "text-gray-600 hover:text-gray-900"
      }`}
     >
      <Box className="w-3.5 h-3.5" />
      บรรจุภัณฑ์ ({countPkg})
     </button>
    </div>
   )}

 <div className="flex items-center gap-2 text-gray-500 mr-2">
 <Filter className="w-4 h-4" />
 <span className="text-[13px] font-bold uppercase tracking-wider">ตัวกรอง</span>
 </div>

 <select
 value={filterSubcategory}
 onChange={(e) => setFilterSubcategory(e.target.value)}
 className="h-[38px] shrink-0 px-3 pr-8 rounded-lg border border-gray-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-[13px] font-medium text-gray-700 focus:border-[#7a5c4e] bg-white cursor-pointer shadow-sm"
 >
 {subcategoryOptions.map((option) => (
 <option key={option.id} value={option.id}>{option.name} {option.count > 0 ? `(${option.count})` : ''}</option>
 ))}
 </select>
 
 <select 
 value={filterStatus}
 onChange={(e) => setFilterStatus(e.target.value)}
 className="h-[38px] shrink-0 px-3 pr-8 rounded-lg border border-gray-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-[13px] font-medium text-gray-700 focus:border-[#7a5c4e] bg-white cursor-pointer shadow-sm"
 >
 <option value="all">สถานะทั้งหมด</option>
 <option value="active">เปิดใช้งาน</option>
 <option value="inactive">ระงับการใช้งาน</option>
 </select>
 
 <select 
 value={filterStock}
 onChange={(e) => setFilterStock(e.target.value)}
 className="h-[38px] shrink-0 px-3 pr-8 rounded-lg border border-gray-200 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-[13px] font-medium text-gray-700 focus:border-[#7a5c4e] bg-white cursor-pointer shadow-sm"
 >
 <option value="all">สต็อกและวันหมดอายุทั้งหมด</option>
 <option value="low">ใกล้หมดสต็อก</option>
 <option value="out">หมดสต็อก</option>
 <option value="expiring">ใกล้หมดอายุ {expirySummary.expiringCount > 0 ? `(${expirySummary.expiringCount})` : ''}</option>
 <option value="expired">หมดอายุแล้ว {expirySummary.expiredCount > 0 ? `(${expirySummary.expiredCount})` : ''}</option>
 <option value="no_expiry">สินค้าไม่มีวันหมดอายุ</option>
 </select>

 <button
 type="button"
 onClick={clearFilters}
 className="h-[38px] shrink-0 whitespace-nowrap px-3 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:border-[#7a5c4e] hover:text-[#7a5c4e]"
 >
 ล้างตัวกรอง
 </button>

 <button
 type="button"
 onClick={() => setShowCategoryModal(true)}
 className="h-[38px] shrink-0 whitespace-nowrap px-3 rounded-lg bg-[#7a5c4e] text-white text-[13px] font-medium hover:bg-[#684c3f]"
 >
 จัดการหมวดย่อย
 </button>
 </div>

<div className="flex shrink-0 items-center gap-2">
 <div className="flex shrink-0 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
 <button onClick={() => changeViewMode("table")} className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-gray-100 text-[#7a5c4e]' : 'text-gray-400 hover:text-gray-600'}`}><List className="w-4 h-4" /></button>
 <button onClick={() => changeViewMode("grid")} className={`p-2 border-l border-gray-200 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-[#7a5c4e]' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid className="w-4 h-4" /></button>
 </div>
  {/* Toggle Expand Button */}
  <button
   type="button"
   onClick={toggleExpanded}
   className="h-[38px] px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-[13px] font-medium transition-colors shadow-sm"
   title={isExpanded ? "ย่อหน้าจอ" : "ขยายเต็มจอ"}
  >
   {isExpanded ? (
    <>
     <Minimize2 className="w-4 h-4 text-[#7a5c4e]" />
     <span className="hidden sm:inline">ย่อมุมมอง</span>
    </>
   ) : (
    <>
     <Maximize2 className="w-4 h-4 text-gray-600" />
     <span className="hidden sm:inline">ขยายเต็มจอ</span>
    </>
   )}
  </button>
 </div>
 <div className="flex shrink-0 items-center gap-2 text-[12px] text-gray-500">
 <span>
 {displayedItems.length === 0
 ? '0 รายการ'
 : `${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, displayedItems.length)} จาก ${displayedItems.length} รายการ`}
 </span>
 <button
 type="button"
 onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
 disabled={currentPage <= 1}
 className="rounded-md border border-gray-200 bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
 >
 ก่อนหน้า
 </button>
 <span>{currentPage}/{pageCount}</span>
 <button
 type="button"
 onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
 disabled={currentPage >= pageCount}
 className="rounded-md border border-gray-200 bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
 >
 ถัดไป
 </button>
 </div>
 </div>

 {/* Expiration Alert Banner */}
 {(expirySummary.expiredCount > 0 || expirySummary.expiringCount > 0) && (
 <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
  expirySummary.expiredCount > 0
   ? 'bg-red-50 border-red-200 text-red-900'
   : 'bg-amber-50 border-amber-200 text-amber-900'
 }`}>
  <div className="flex items-center gap-2.5 text-[13px] font-bold">
   <AlertTriangle className={`w-4 h-4 shrink-0 ${expirySummary.expiredCount > 0 ? 'text-red-600' : 'text-amber-600'}`} />
   <span>
    แจ้งเตือนวันหมดอายุ ({activeTab}):
    {expirySummary.expiredCount > 0 && (
     <span className="ml-1.5 inline-flex items-center rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
      หมดอายุแล้ว {expirySummary.expiredCount} รายการ
     </span>
    )}
    {expirySummary.expiringCount > 0 && (
     <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
      ใกล้หมดอายุ {expirySummary.expiringCount} รายการ
     </span>
    )}
   </span>
  </div>
  <div className="flex items-center gap-2">
   {expirySummary.expiredCount > 0 && (
    <button
     type="button"
     onClick={() => setFilterStock(filterStock === 'expired' ? 'all' : 'expired')}
     className={`px-3 py-1 rounded-lg text-[12px] font-bold transition-colors border ${
      filterStock === 'expired'
       ? 'bg-red-600 text-white border-red-600'
       : 'bg-white text-red-700 border-red-300 hover:bg-red-100'
     }`}
    >
     {filterStock === 'expired' ? 'แสดงทั้งหมด' : 'ดูที่หมดอายุ'}
    </button>
   )}
   {expirySummary.expiringCount > 0 && (
    <button
     type="button"
     onClick={() => setFilterStock(filterStock === 'expiring' ? 'all' : 'expiring')}
     className={`px-3 py-1 rounded-lg text-[12px] font-bold transition-colors border ${
      filterStock === 'expiring'
       ? 'bg-amber-600 text-white border-amber-600'
       : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
     }`}
    >
     {filterStock === 'expiring' ? 'แสดงทั้งหมด' : 'ดูที่ใกล้หมดอายุ'}
    </button>
   )}
  </div>
 </div>
 )}

 {loading ? (
 <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
 <RefreshCw className="w-10 h-10 animate-spin mb-4 text-[#7a5c4e]" />
 </div>
 ) : displayedItems.length === 0 ? (
 <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
 <Package className="w-12 h-12 mb-4 text-gray-300" />
 <h3 className="text-xl font-bold text-gray-600 mb-1">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</h3>
 <p className="text-[14px]">ลองปรับเปลี่ยนคำค้นหา หรือเคลียร์ตัวกรองข้อมูลใหม่</p>
 </div>
 ) : (
 <div ref={contentScrollRef} onScroll={handleScroll} className="flex-1 overflow-auto rounded-b-[24px]">
 
 {/* ---------------- TABLE VIEW ---------------- */}
 {viewMode === "table" && (
 <table className="w-full text-left border-collapse min-w-[800px]">
 <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
 <tr>
 <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase border-b border-gray-200">ชื่อรายการ</th>
 <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase border-b border-gray-200">วันผลิต / วันหมดอายุ (แยกตามล็อต)</th>
 <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase border-b border-gray-200 text-right">ต้นทุนเฉลี่ย</th>
 <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase border-b border-gray-200 text-right">Stock คงเหลือ</th>
 <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase border-b border-gray-200 text-center">สถานะ</th>
 </tr>
 </thead>
 <tbody>
 {paginatedItems.map((item) => {
  const expiry = getItemExpiryMeta(item);
  const isExpired = expiry.status === 'EXPIRED' || expiry.status === 'EXPIRES_TODAY';
  const isExpiringSoon = expiry.status === 'EXPIRING_SOON';
  return (
 <tr key={item.id} onClick={() => handleOpenDetail(item.id)} className="hover:bg-gray-50/80 transition-colors cursor-pointer border-b border-gray-100 bg-white">
 <td className="px-6 py-4 flex items-center gap-3">
 <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-gray-200">
 {inventoryImages[String(item.id)] ? <img src={inventoryImages[String(item.id)] ?? ''} alt="img" loading="lazy" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-gray-400" />}
 </div>
 <div>
  <span className="text-[15px] font-bold text-gray-800 block">{item.name}</span>
  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
   {isExpired && (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
     <AlertTriangle className="w-3 h-3" />
     {expiry.daysUntilExpiry === 0 ? 'หมดอายุวันนี้' : `หมดอายุแล้ว ${Math.abs(Number(expiry.daysUntilExpiry || 0))} วัน`}
    </span>
   )}
   {isExpiringSoon && (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
     <AlertTriangle className="w-3 h-3" />
     อีก {expiry.daysUntilExpiry} วันหมดอายุ
    </span>
   )}
   {expiry.batches.length > 1 && (
    <span className="inline-flex items-center rounded-full bg-[#7a5c4e]/10 px-2 py-0.5 text-[11px] font-bold text-[#7a5c4e]">
     {expiry.batches.length} ล็อตวันหมดอายุ
    </span>
   )}
  </div>
 </div>
 </td>
 <td className="px-6 py-4 text-[13px] text-gray-600">
  {expiry.noExpiry ? (
   <div>
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
     สินค้าไม่มีวันหมดอายุ
    </span>
    {expiry.mfgDate && (
     <div className="text-[11px] text-gray-400 mt-1">ผลิต: {formatThaiDateDisplay(expiry.mfgDate)}</div>
    )}
   </div>
  ) : expiry.batches.length > 0 ? (
   <div className="space-y-1.5">
    {expiry.batches.slice(0, 3).map((batch, idx) => {
     const batchExpired = batch.status === 'EXPIRED' || batch.status === 'EXPIRES_TODAY';
     const batchSoon = batch.status === 'EXPIRING_SOON';
     return (
      <div key={batch.id || idx} className="rounded-lg border border-gray-100 bg-gray-50/70 px-2.5 py-1.5">
       <div className="flex items-center justify-between gap-2">
        <span className={`text-[12px] font-bold ${batchExpired ? 'text-red-600' : batchSoon ? 'text-amber-700' : 'text-gray-800'}`}>
         {batch.noExpiry
          ? 'ไม่มีวันหมดอายุ'
          : batch.expDate
          ? `EXP: ${formatThaiDateDisplay(batch.expDate)}`
          : 'ยังไม่ระบุวันหมดอายุ'}
        </span>
        <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold text-[#7a5c4e] border border-gray-200 shrink-0">
         {formatStockQuantity(batch.quantity)} {item.unit}
        </span>
       </div>
       {batch.mfgDate && (
        <div className="text-[11px] text-gray-400">ผลิต: {formatThaiDateDisplay(batch.mfgDate)}</div>
       )}
      </div>
     );
    })}
    {expiry.batches.length > 3 && (
     <div className="text-[11px] font-bold text-[#7a5c4e]">
      + ดูเพิ่มอีก {expiry.batches.length - 3} ล็อต
     </div>
    )}
    {expiry.untrackedQuantity > 0 && (
     <div className="text-[11px] text-amber-700 font-medium">
      * ยังไม่ระบุวันหมดอายุอีก {formatStockQuantity(expiry.untrackedQuantity)} {item.unit}
     </div>
    )}
   </div>
  ) : (expiry.expDate || expiry.mfgDate) ? (
   <div className="space-y-0.5">
    <div className={`font-bold ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-700' : 'text-gray-800'}`}>
     หมดอายุ: {expiry.expDate ? formatThaiDateDisplay(expiry.expDate) : '-'}
    </div>
    <div className="text-[11px] text-gray-400">
     ผลิต: {expiry.mfgDate ? formatThaiDateDisplay(expiry.mfgDate) : '-'}
    </div>
   </div>
  ) : (
   <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-500">
    ยังไม่ระบุวันหมดอายุ
   </span>
  )}
 </td>
 <td className="px-6 py-4 text-[14px] font-bold text-gray-800 text-right">฿{Number(item.cost || 0).toLocaleString()}<div className="text-[11px] font-normal text-gray-500">฿{Number(item.cost_per_piece || item.cost || 0).toFixed(2)}/{item.package_unit || item.unit}</div></td>
 <td className={`px-6 py-4 text-[15px] font-black text-right ${item.quantity <= 0 ? 'text-red-500' : 'text-gray-800'}`}>
 {formatStockQuantity(item.quantity)} <span className="text-[12px] font-normal text-gray-500">{item.unit}</span><div className="text-[11px] font-normal text-gray-500">รวม {formatTotalPieces(item.total_pieces ?? item.quantity)} {item.package_unit || item.unit}</div>
 </td>
 <td className="px-6 py-4 text-center">
 <span className={`px-3 py-1 rounded-full text-[12px] font-bold border ${
 item.status === 'active' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-300'
 }`}>{item.status === 'active' ? 'ใช้งาน' : 'ระงับ'}</span>
 </td>
 </tr>
  );
 })}
 </tbody>
 </table>
 )}

 {/* ---------------- GRID VIEW ---------------- */}
 {viewMode === "grid" && (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-6">
 {paginatedItems.map((item) => {
  const expiry = getItemExpiryMeta(item);
  const isExpired = expiry.status === 'EXPIRED' || expiry.status === 'EXPIRES_TODAY';
  const isExpiringSoon = expiry.status === 'EXPIRING_SOON';
  return (
 <div key={item.id} onClick={() => handleOpenDetail(item.id)} className="border border-gray-200 rounded-[20px] overflow-hidden hover:shadow-md transition-all cursor-pointer bg-white group hover:-translate-y-1 flex flex-col">
 <div className="h-[150px] bg-gray-100 flex items-center justify-center relative shrink-0">
 {inventoryImages[String(item.id)] ? <img src={inventoryImages[String(item.id)] ?? ''} alt="img" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Package className="w-8 h-8 text-gray-300" />}
 {item.quantity <= 0 && <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">หมดสต็อก</span>}
 {isExpired && (
  <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
   {expiry.daysUntilExpiry === 0 ? 'หมดอายุวันนี้' : 'หมดอายุแล้ว'}
  </span>
 )}
 {isExpiringSoon && (
  <span className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
   อีก {expiry.daysUntilExpiry} วันหมดอายุ
  </span>
 )}
 </div>
 <div className="p-4 flex flex-col flex-1 justify-between">
 <div>
 <h4 className="font-bold text-gray-800 text-[15px] line-clamp-2 leading-tight">{item.name}</h4>
 <p className={`text-[11px] mt-1 font-medium ${isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-amber-700 font-bold' : 'text-gray-400'}`}>
  {expiry.noExpiry
   ? 'สินค้าไม่มีวันหมดอายุ'
   : expiry.expDate
   ? `หมดอายุเร็วสุด: ${formatThaiDateDisplay(expiry.expDate)}`
   : 'ยังไม่ระบุวันหมดอายุ'}
 </p>
 {expiry.batches.length > 1 && (
  <span className="mt-1 inline-block rounded-full bg-[#7a5c4e]/10 px-2 py-0.5 text-[10px] font-bold text-[#7a5c4e]">
   มี {expiry.batches.length} ล็อตวันหมดอายุ
  </span>
 )}
 </div>
 <div className="flex justify-between items-end mt-3 border-t border-gray-100 pt-2">
 <div className="flex flex-col">
 <span className="text-[11px] text-gray-400 font-medium">Stock คงเหลือ</span>
 <span className="text-[18px] font-black text-[#7a5c4e] leading-none">{formatStockQuantity(item.quantity)} <span className="text-[12px] text-gray-500 font-normal">{item.unit}</span></span>
 <span className="text-[11px] text-gray-500">รวม {formatTotalPieces(item.total_pieces ?? item.quantity)} {item.package_unit || item.unit}</span>
 </div>
 </div>
 </div>
 </div>
  );
 })}
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 </div>

 {/* ==========================================
 MODAL: ADD / EDIT FORM (วัตถุดิบ, บรรจุภัณฑ์)
 ========================================== */}
 {showFormModal && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
 <div className="bg-white w-full max-w-[680px] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[92vh]">
 <div className="h-[76px] border-b border-gray-200 flex items-center justify-between px-7 shrink-0 bg-[#f5f6f8]">
 <div><h2 className="text-[20px] font-bold text-gray-800">{formMode === 'add' ? 'เพิ่มวัตถุดิบ' : 'แก้ไขวัตถุดิบ'}</h2><p className="mt-1 text-[12px] text-gray-500">{formMode === 'edit' ? formData.name : 'กรอกข้อมูลพื้นฐานที่จำเป็น แล้วบันทึกได้ทันที'}</p></div>
 <button onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
 </div>
 
 <div className="flex-1 overflow-y-auto p-7 space-y-6">
 <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
 <h3 className="mb-4 text-[16px] font-bold text-gray-800">ข้อมูลวัตถุดิบ</h3>
 <div className="flex flex-col items-center mb-6">
 <div className="w-24 h-24 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden mb-3 relative group">
 {formData.image_url ? <img src={formData.image_url} alt="preview" className="w-full h-full object-cover" /> : <Upload className="w-8 h-8 text-gray-400" />}
 {uploadingImage && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin text-[#7a5c4e]" /></div>}
 </div>
 <div className="w-full flex flex-col items-center gap-3">
 <label className="cursor-pointer text-[13px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-full transition-colors text-center inline-block">
 อัปโหลดรูปภาพ
 <input type="file" className="hidden" accept="image/jpeg, image/png, image/webp" onChange={handleImageUpload} disabled={uploadingImage} />
 </label>
 <div className="w-full flex items-center gap-3 px-2">
 <div className="h-[1px] bg-gray-200 flex-1"></div>
 <span className="text-[12px] text-gray-400">หรือใส่ URL</span>
 <div className="h-[1px] bg-gray-200 flex-1"></div>
 </div>
 <input 
 type="text" 
 placeholder="วาง URL รูปภาพที่นี่..." 
 value={formData.image_url || ''} 
 onChange={(e) => setFormData({...formData, image_url: e.target.value})} 
 className="w-full text-[13px] p-2.5 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] text-center"
 />
 </div>
 </div>

 <input type="hidden" value={formData.type || (activeTab === "บรรจุภัณฑ์" ? 'packaging' : 'raw_material')} />
 <div><label className="block text-[13px] font-bold text-gray-600 mb-1">ชื่อวัตถุดิบ <span className="text-red-500">*</span></label><input type="text" value={formData.name || ''} onChange={(e)=>setFormData({...formData, name: e.target.value})} className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]" /></div>
 <div className="mt-4">
 <label className="block text-[13px] font-bold text-gray-600 mb-1">หน่วยที่เก็บในสต๊อก <span className="text-red-500">*</span></label>
 <input type="text" value={formData.unit || ''} onChange={(e)=>setFormData({...formData, unit: e.target.value})} placeholder="เช่น ขวด, ถุง, กล่อง, ชิ้น" className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]" />
 </div>
 <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mt-4">
 <h4 className="text-[14px] font-bold text-gray-800 mb-3">หมวดหมู่</h4>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-[12px] font-bold text-gray-600 mb-1">ประเภทหลัก</label>
 <select
 value={formData.type || (activeTab === "บรรจุภัณฑ์" ? 'packaging' : 'raw_material')}
 onChange={(e) => {
 const nextType = e.target.value;
 setFormData((prev: any) => ({ ...prev, type: nextType, category_id: '' }));
 }}
 className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] bg-white"
 >
 <option value="raw_material">วัตถุดิบ</option>
 <option value="packaging">บรรจุภัณฑ์</option>
 </select>
 </div>
 <div>
 <label className="block text-[12px] font-bold text-gray-600 mb-1">หมวดย่อย</label>
 <div className="flex min-w-0 flex-col gap-2">
 <select
 value={formData.category_id ?? ''}
 onChange={(e) => setFormData((prev: any) => ({ ...prev, category_id: e.target.value }))}
 className="w-full min-w-0 p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] bg-white"
 >
 <option value="">เลือกหมวดย่อย</option>
 {formCategoryOptions.map((category: any) => (
 <option key={category.id} value={category.id}>{category.name}</option>
 ))}
 </select>
 <button
 type="button"
 onClick={() => {
 setCategoryForm({ id: null, name: '', type: formData.type || (activeTab === 'บรรจุภัณฑ์' ? 'packaging' : 'raw_material') });
 setShowCategoryModal(true);
 }}
 className="w-full px-3 py-3 rounded-xl border border-[#7a5c4e] bg-[#7a5c4e] text-white text-[12px] font-bold whitespace-nowrap hover:bg-[#684c3f]"
 >
 + เพิ่มหมวดย่อย
 </button>
 </div>
 </div>
 </div>
 </div>
 <div className="mt-4"><label className="block text-[13px] font-bold text-gray-600 mb-1">ต้นทุนต่อ 1 {formData.unit || 'หน่วย'} (฿) <span className="text-red-500">*</span></label><input type="number" min="0" value={formData.cost ?? ''} onChange={(e)=>setFormData({...formData, cost: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]" /></div>
 </div>

 {/* วันผลิตและวันหมดอายุ (รองรับหลายล็อต) */}
 <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
 <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
  <div className="flex items-center gap-2">
   <Calendar className="w-5 h-5 text-[#7a5c4e]" />
   <div>
    <h3 className="text-[16px] font-bold text-gray-800">วันผลิตและวันหมดอายุ</h3>
    <p className="text-[11px] text-gray-500">สามารถเพิ่มได้หลายล็อตหากสินค้าที่นำเข้ามีวันหมดอายุไม่ตรงกัน</p>
   </div>
  </div>
  <label className="flex items-center gap-2 cursor-pointer select-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-gray-100">
   <input
    type="checkbox"
    checked={Boolean(formData.no_expiry)}
    onChange={(e) => {
     const checked = e.target.checked;
     const existingBatches = Array.isArray(formData.expiry_batches) && formData.expiry_batches.length > 0
      ? formData.expiry_batches
      : [{ id: `batch-${Date.now()}`, quantity: Math.max(1, Number(formData.quantity || 1)), mfg_date: formData.mfg_date || '', exp_date: formData.exp_date || '', no_expiry: false }];
     setFormData({
      ...formData,
      no_expiry: checked,
      exp_date: checked ? '' : (formData.exp_date || ''),
      expiry_batches: existingBatches
     });
    }}
    className="h-4 w-4 accent-[#7a5c4e]"
   />
   <span className="text-[13px] font-bold text-gray-700">สินค้าไม่มีวันหมดอายุ</span>
  </label>
 </div>

 {formData.no_expiry ? (
  <div className="space-y-3">
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
     <label className="block text-[13px] font-bold text-gray-600 mb-1">วันผลิต (MFG) <span className="font-normal text-gray-400">(ถ้ามี)</span></label>
     <DateInputDMY
      value={formData.mfg_date || ''}
      onChange={(val) => setFormData({ ...formData, mfg_date: val })}
      placeholder="วัน/เดือน/ปี"
      className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] bg-white text-[13px]"
     />
    </div>
    <div>
     <label className="block text-[13px] font-bold text-gray-600 mb-1">
      วันหมดอายุ (EXP) <span className="text-blue-600 font-normal">(ไม่มีวันหมดอายุ)</span>
     </label>
     <input
      type="text"
      disabled
      value="สินค้าไม่มีวันหมดอายุ"
      className="w-full p-3 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 font-medium"
     />
    </div>
   </div>
   <p className="text-[12px] text-blue-600 font-medium">รายการนี้ถูกตั้งค่าเป็นสินค้าที่ไม่มีวันหมดอายุ ระบบจะไม่แจ้งเตือนวันหมดอายุ</p>
  </div>
 ) : (
  <div className="space-y-3">
   {(() => {
    const batches = Array.isArray(formData.expiry_batches) && formData.expiry_batches.length > 0
     ? formData.expiry_batches
     : [{ id: 'batch-init', quantity: Math.max(1, Number(formData.quantity || 1)), mfg_date: formData.mfg_date || '', exp_date: formData.exp_date || '', no_expiry: false }];
    const updateBatchRow = (index: number, patch: Record<string, any>) => {
     const nextBatches = batches.map((b: any, i: number) => (i === index ? { ...b, ...patch } : b));
     const totalBatchQty = nextBatches.reduce((sum: number, b: any) => sum + Math.max(0, Number(b.quantity || 0)), 0);
     setFormData({
      ...formData,
      expiry_batches: nextBatches,
      ...(formMode === 'add' ? { quantity: totalBatchQty } : {}),
     });
    };
    const addBatchRow = () => {
     const nextBatches = [
      ...batches,
      {
       id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
       quantity: 1,
       mfg_date: '',
       exp_date: '',
       no_expiry: false,
      },
     ];
     const totalBatchQty = nextBatches.reduce((sum: number, b: any) => sum + Math.max(0, Number(b.quantity || 0)), 0);
     setFormData({
      ...formData,
      expiry_batches: nextBatches,
      ...(formMode === 'add' ? { quantity: totalBatchQty } : {}),
     });
    };
    const removeBatchRow = (index: number) => {
     if (batches.length <= 1) {
      updateBatchRow(0, { mfg_date: '', exp_date: '', no_expiry: false });
      return;
     }
     const nextBatches = batches.filter((_: any, i: number) => i !== index);
     const totalBatchQty = nextBatches.reduce((sum: number, b: any) => sum + Math.max(0, Number(b.quantity || 0)), 0);
     setFormData({
      ...formData,
      expiry_batches: nextBatches,
      ...(formMode === 'add' ? { quantity: totalBatchQty } : {}),
     });
    };
    return (
     <>
      <div className="space-y-3">
       {batches.map((batch: any, idx: number) => (
        <div key={batch.id || idx} className="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-3">
         <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#7a5c4e]">
           ล็อตที่ {idx + 1}
          </span>
          <button
           type="button"
           onClick={() => removeBatchRow(idx)}
           className="text-[12px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1"
          >
           <Trash2 className="w-3.5 h-3.5" />
           {batches.length > 1 ? 'ลบล็อตนี้' : 'ล้างวันที่'}
          </button>
         </div>
         <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
           <label className="block text-[12px] font-bold text-gray-600 mb-1">
            จำนวนในล็อตนี้ ({formData.unit || 'หน่วย'})
           </label>
           <input
            type="number"
            min="0.01"
            step="any"
            value={batch.quantity ?? ''}
            onChange={(e) => updateBatchRow(idx, { quantity: e.target.value === '' ? '' : Number(e.target.value) })}
            className="w-full p-2.5 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] bg-white font-bold text-gray-800"
           />
          </div>
          <div>
           <label className="block text-[12px] font-bold text-gray-600 mb-1">วันผลิต (MFG)</label>
           <DateInputDMY
            value={batch.mfg_date || ''}
            onChange={(val) => updateBatchRow(idx, { mfg_date: val })}
            placeholder="วัน/เดือน/ปี"
            className="w-full p-2.5 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] bg-white text-[13px]"
           />
          </div>
          <div>
           <label className="block text-[12px] font-bold text-gray-600 mb-1">วันหมดอายุ (EXP)</label>
           <DateInputDMY
            min={batch.mfg_date || undefined}
            value={batch.exp_date || ''}
            onChange={(val) => updateBatchRow(idx, { exp_date: val, no_expiry: false })}
            placeholder="วัน/เดือน/ปี"
            className="w-full p-2.5 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] bg-white text-[13px]"
           />
          </div>
         </div>
        </div>
       ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
       <button
        type="button"
        onClick={addBatchRow}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#7a5c4e] bg-[#7a5c4e]/10 px-3.5 py-2 text-[13px] font-bold text-[#7a5c4e] hover:bg-[#7a5c4e]/20 transition-colors"
       >
        <Plus className="w-4 h-4" /> เพิ่มล็อตวันหมดอายุ
       </button>
       <span className="text-[12px] text-gray-500">
        รวมจำนวนที่ระบุล็อต: <strong className="text-gray-800">{formatStockQuantity(batches.reduce((s: number, b: any) => s + Math.max(0, Number(b.quantity || 0)), 0))} {formData.unit || 'หน่วย'}</strong>
       </span>
      </div>
     </>
    );
   })()}
   <p className="text-[12px] text-gray-500">ระบุวันผลิตและวันหมดอายุแยกตามล็อต เพื่อให้ระบบติดตามและแจ้งเตือนก่อนสินค้าแต่ละล็อตหมดอายุ</p>
  </div>
 )}
 </div>

 <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
 <h3 className="mb-4 text-[16px] font-bold text-gray-800">การตั้งค่าการแจ้งเตือน</h3>
 <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
 <div><p className="text-[14px] font-bold text-gray-800">แจ้งเตือนเมื่อสต็อกต่ำ</p><p className="mt-1 text-[12px] text-gray-500">ปิดได้ถ้าไม่ต้องการติดตามขั้นต่ำ</p></div>
 <input type="checkbox" checked={Number(formData.min_threshold || 0) > 0} onChange={(e)=>setFormData({...formData, min_threshold: e.target.checked ? (formData.min_threshold || 1) : 0})} className="h-5 w-5 accent-[#7a5c4e]" />
 </div>
 <div className="mt-4"><label className="block text-[13px] font-bold text-gray-600 mb-1">จำนวนขั้นต่ำที่ต้องการให้แจ้งเตือน</label><input type="number" min="0" disabled={Number(formData.min_threshold || 0) === 0} value={formData.min_threshold ?? ''} onChange={(e)=>setFormData({...formData, min_threshold: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full p-3 rounded-xl border border-gray-300 outline-none disabled:bg-gray-100" /></div>
 {Number(formData.min_threshold || 0) > 0 && <p className="mt-3 text-[12px] text-gray-500">แจ้งเตือนเมื่อเหลือต่ำกว่า {formData.min_threshold} {formData.unit || 'หน่วย'}</p>}

 {!formData.no_expiry && (
  <div className="mt-4 pt-4 border-t border-gray-100">
   <label className="block text-[13px] font-bold text-gray-600 mb-1">แจ้งเตือนล่วงหน้าก่อนวันหมดอายุ (วัน)</label>
   <input
    type="number"
    min="1"
    max="365"
    value={formData.expiry_alert_days ?? 7}
    onChange={(e) => setFormData({ ...formData, expiry_alert_days: e.target.value === '' ? '' : Math.max(1, Number(e.target.value)) })}
    className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]"
   />
   <p className="mt-2 text-[12px] text-gray-500">ระบบจะแจ้งเตือนเมื่อมีล็อตสินค้าที่เหลือเวลาอีกไม่เกิน {formData.expiry_alert_days || 7} วันก่อนถึงวันหมดอายุ</p>
  </div>
 )}
 </div>

 <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
 <h3 className="mb-3 text-[16px] font-bold text-gray-800">หน่วยและปริมาณ</h3>
 <p className="mb-3 text-[13px] font-bold text-gray-700">ขนาดบรรจุและต้นทุนต่อชิ้น</p>
 <div className="grid grid-cols-2 gap-4">
 <div><label className="block text-[12px] font-bold text-gray-600 mb-1">ปริมาณต่อ 1 {formData.unit || 'หน่วย'}</label><input type="number" min="0.01" step="0.01" value={formData.package_size ?? ''} onChange={(e)=>setFormData({...formData, package_size: e.target.value === '' ? '' : Math.max(0.01, Number(e.target.value))})} placeholder="เช่น 1000" className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]" /></div>
 <div><label className="block text-[12px] font-bold text-gray-600 mb-1">หน่วยย่อยของปริมาณ</label><input type="text" value={formData.package_unit ?? ''} onChange={(e)=>setFormData({...formData, package_unit: e.target.value})} placeholder="เช่น ml, g, kg, ชิ้น" className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]" /></div>
 </div>
 <p className="mt-3 text-[12px] text-gray-500">ตัวอย่าง: 1 {formData.unit || 'ขวด'} = {Number(formData.package_size || 1).toLocaleString()} {formData.package_unit || 'หน่วยย่อย'} | ต้นทุนต่อ {formData.package_unit || 'หน่วยย่อย'}: ฿{(Number(formData.cost || 0) / Math.max(0.01, Number(formData.package_size || 1))).toFixed(2)} | Stock รวม: {(Number(formData.quantity || 0) * Math.max(0.01, Number(formData.package_size || 1))).toLocaleString()} {formData.package_unit || 'หน่วยย่อย'}</p>
 </div>
 {formMode === 'add' && (
 <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
 <h3 className="mb-3 text-[16px] font-bold text-gray-800">สต็อกเริ่มต้น</h3>
 <p className="mb-3 text-[12px] text-gray-500">ระบุจำนวนที่มีอยู่ตอนเริ่มต้น ระบบจะสร้างรายการรับเข้าให้อัตโนมัติ</p>
 <div className="flex items-center gap-3">
 <button
  type="button"
  onClick={() => {
   const nextQty = Math.max(0, Number(formData.quantity || 0) - 1);
   const nextBatches = Array.isArray(formData.expiry_batches) && formData.expiry_batches.length === 1
    ? [{ ...formData.expiry_batches[0], quantity: Math.max(1, nextQty) }]
    : formData.expiry_batches;
   setFormData({ ...formData, quantity: nextQty, expiry_batches: nextBatches });
  }}
  className="h-11 w-11 rounded-xl border border-gray-300 bg-white text-gray-700"
 >
  <Minus className="mx-auto h-4 w-4" />
 </button>
 <input
  type="number"
  min="0"
  value={formData.quantity ?? 0}
  onChange={(e) => {
   const nextQty = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
   const nextBatches = Array.isArray(formData.expiry_batches) && formData.expiry_batches.length === 1 && nextQty !== ''
    ? [{ ...formData.expiry_batches[0], quantity: Math.max(1, Number(nextQty)) }]
    : formData.expiry_batches;
   setFormData({ ...formData, quantity: nextQty, expiry_batches: nextBatches });
  }}
  className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 text-center text-[18px] font-bold outline-none"
 />
 <button
  type="button"
  onClick={() => {
   const nextQty = Number(formData.quantity || 0) + 1;
   const nextBatches = Array.isArray(formData.expiry_batches) && formData.expiry_batches.length === 1
    ? [{ ...formData.expiry_batches[0], quantity: Math.max(1, nextQty) }]
    : formData.expiry_batches;
   setFormData({ ...formData, quantity: nextQty, expiry_batches: nextBatches });
  }}
  className="h-11 w-11 rounded-xl bg-[#7a5c4e] text-white"
 >
  <Plus className="mx-auto h-4 w-4" />
 </button>
 <span className="min-w-[70px] text-[13px] font-bold text-gray-500">{formData.unit || 'หน่วย'}</span>
 </div>
 </div>
 )}
 <div>
 <label className="block text-[13px] font-bold text-gray-600 mb-1">สถานะ</label>
 <select value={formData.status || 'active'} onChange={(e)=>setFormData({...formData, status: e.target.value})} className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]">
 <option value="active">เปิดใช้งาน</option>
 <option value="inactive">ระงับ (ซ่อน)</option>
 </select>
 </div>
 </div>

 <div className="p-6 bg-gray-50 border-t border-gray-200 grid grid-cols-2 gap-3 shrink-0">
 <button onClick={() => setShowFormModal(false)} className="py-3.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors">ยกเลิก</button>
 <button onClick={handleSaveData} disabled={isSaving} className="py-3.5 bg-[#7a5c4e] text-white rounded-xl font-bold hover:bg-[#684c3f] transition-colors flex items-center justify-center gap-2 shadow-sm">
 {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} บันทึกข้อมูล
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ==========================================
 DETAIL DRAWER
 ========================================== */}
 {selectedItem && (
 <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
 <div className="w-[500px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right">
 
 <div className="h-[90px] border-b border-gray-200 flex items-center justify-between px-6 shrink-0 bg-white">
 <h2 className="text-[20px] font-bold text-gray-800">รายละเอียดคลังสินค้า</h2>
 <button onClick={() => setSelectedItem(null)} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors">
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="flex border-b border-gray-200 px-6 shrink-0 overflow-x-auto no-scrollbar">
 <button onClick={() => setDrawerTab("detail")} className={`py-4 text-[14px] font-bold border-b-2 mr-6 shrink-0 ${drawerTab === 'detail' ? 'border-[#7a5c4e] text-[#7a5c4e]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>รายละเอียด</button>
 <button onClick={() => setDrawerTab("movement")} className={`py-4 text-[14px] font-bold border-b-2 shrink-0 ${drawerTab === 'movement' ? 'border-[#7a5c4e] text-[#7a5c4e]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>ประวัติ Movement</button>
 </div>

 <div className="flex-1 overflow-y-auto p-6 bg-gray-50 relative">
 {detailLoading ? (
 <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-white/50"><RefreshCw className="w-8 h-8 animate-spin" /></div>
 ) : (
 <>
 {drawerTab === "detail" && (
 <div className="mb-4 rounded-[20px] border border-[#7a5c4e]/20 bg-[#7a5c4e]/5 p-5 shadow-sm">
 <div className="flex items-start justify-between gap-4">
 <div>
 <p className="text-[12px] font-bold text-gray-500">สต็อกปัจจุบัน</p>
 <p className="mt-1 text-[30px] font-black text-gray-900">{formatStockQuantity(selectedItem.quantity)} <span className="text-[15px] font-bold text-gray-500">{selectedItem.unit}</span></p>
 <p className="text-[12px] text-gray-500">รวม {formatTotalPieces(selectedItem.total_pieces ?? selectedItem.quantity)} {selectedItem.package_unit || selectedItem.unit}</p>
 </div>
 <span className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-gray-700 shadow-sm">{Number(selectedItem.quantity || 0) > Number(selectedItem.min_threshold || 0) ? "มีสินค้าเพียงพอ" : "ควรสั่งเพิ่ม"}</span>
 </div>
 <div className="mt-4 grid grid-cols-2 gap-3">
 <button type="button" onClick={() => openStockDialog("in")} className="flex items-center justify-center gap-2 rounded-xl bg-[#7a5c4e] py-3 text-[14px] font-bold text-white hover:bg-[#684c3f]"><Plus className="h-4 w-4" /> เพิ่มสต็อก</button>
 <button type="button" onClick={() => openStockDialog("out")} className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3 text-[14px] font-bold text-gray-700 hover:bg-gray-50"><Minus className="h-4 w-4" /> ลดสต็อก</button>
 </div>
 </div>
 )}

 {drawerTab === "detail" && (() => {
  const expiry = getItemExpiryMeta(selectedItem);
  const isExpired = expiry.status === 'EXPIRED' || expiry.status === 'EXPIRES_TODAY';
  const isExpiringSoon = expiry.status === 'EXPIRING_SOON';
  return (
 <div className="space-y-4">
 {isExpired && (
  <div className="rounded-[16px] border border-red-200 bg-red-50 p-4 flex items-start gap-3">
   <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
   <div>
    <p className="text-[14px] font-bold text-red-800">
     {expiry.daysUntilExpiry === 0 ? 'มีล็อตสินค้าที่หมดอายุวันนี้!' : `มีล็อตสินค้าที่หมดอายุแล้ว ${Math.abs(Number(expiry.daysUntilExpiry || 0))} วัน`}
    </p>
    <p className="text-[12px] text-red-700 mt-0.5">
     วันหมดอายุเร็วสุด: {formatThaiDateDisplay(expiry.expDate)} กรุณาตรวจสอบและคัดแยกสต็อกล็อตที่หมดอายุออก
    </p>
   </div>
  </div>
 )}
 {isExpiringSoon && (
  <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
   <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
   <div>
    <p className="text-[14px] font-bold text-amber-900">
     มีล็อตสินค้าใกล้หมดอายุ (เหลืออีก {expiry.daysUntilExpiry} วัน)
    </p>
    <p className="text-[12px] text-amber-800 mt-0.5">
     วันหมดอายุเร็วสุด: {formatThaiDateDisplay(expiry.expDate)} แนะนำให้เร่งใช้งานล็อตนี้ก่อนหมดอายุ
    </p>
   </div>
  </div>
 )}

 <div className="bg-white p-5 rounded-[16px] border border-gray-200 shadow-sm flex gap-5 items-center">
 <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-gray-200">
 {selectedItem.image_url ? <img src={selectedItem.image_url} alt="pic" className="w-full h-full object-cover"/> : <Package className="w-8 h-8 text-gray-300" />}
 </div>
 <div className="flex-1">
 <h3 className="text-[18px] font-bold text-gray-800 mb-1">{selectedItem.name}</h3>
 <div className="flex flex-wrap items-center gap-2 mt-2">
  <span className={`inline-block px-3 py-1 rounded-full text-[12px] font-bold ${selectedItem.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
   {selectedItem.status === 'active' ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'}
  </span>
  {expiry.noExpiry ? (
   <span className="inline-block px-3 py-1 rounded-full text-[12px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
    สินค้าไม่มีวันหมดอายุ
   </span>
  ) : expiry.batches.length > 0 ? (
   <span className="inline-block px-3 py-1 rounded-full text-[12px] font-bold bg-[#7a5c4e]/10 text-[#7a5c4e]">
    {expiry.batches.length} ล็อตวันหมดอายุ
   </span>
  ) : (
   <span className="inline-block px-3 py-1 rounded-full text-[12px] font-bold bg-gray-100 text-gray-600">
    ยังไม่ระบุวันหมดอายุ
   </span>
  )}
 </div>
 </div>
 </div>

 <div className="bg-white p-5 rounded-[16px] border border-gray-200 shadow-sm">
 <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><AlignJustify className="w-4 h-4"/> ข้อมูลทั่วไป</h4>
 
 <div className="space-y-3 text-[14px]">
 <div className="flex justify-between items-center py-2 border-b border-gray-100"><span className="text-gray-500">ประเภท</span><span className="font-medium text-gray-800">{selectedItem.type === 'packaging' ? 'บรรจุภัณฑ์' : 'วัตถุดิบ'}</span></div>
 <div className="flex justify-between items-center py-2 border-b border-gray-100"><span className="text-gray-500">หมวดย่อย</span><span className="font-medium text-gray-800">{inventoryCategories.find((cat) => Number(cat.id) === Number(selectedItem.category_id))?.name || 'ยังไม่ได้เลือก'}</span></div>
 <div className="flex justify-between items-center py-2 border-b border-gray-100"><span className="text-gray-500">Stock ในคลัง</span><span className="text-right font-black text-[18px] text-[#7a5c4e]">{formatStockQuantity(selectedItem.quantity)} {selectedItem.unit}<small className="block text-[12px] font-normal text-gray-500">รวม {formatTotalPieces(selectedItem.total_pieces ?? selectedItem.quantity)} {selectedItem.package_unit || selectedItem.unit}</small></span></div>

 {/* แสดงวันผลิตและวันหมดอายุแยกตามล็อต */}
 <div className="py-2.5 border-b border-gray-100">
  <div className="flex items-center justify-between mb-2.5">
   <span className="text-gray-700 font-bold flex items-center gap-1.5">
    <Calendar className="w-4 h-4 text-[#7a5c4e]" />
    รายการวันผลิต / วันหมดอายุ (แยกตามล็อต)
   </span>
   {!expiry.noExpiry && expiry.batches.length > 0 && (
    <span className="text-[11px] font-bold text-[#7a5c4e] bg-[#7a5c4e]/10 px-2 py-0.5 rounded-full">
     {expiry.batches.length} ล็อต
    </span>
   )}
  </div>

  {expiry.noExpiry ? (
   <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 flex items-center justify-between">
    <div>
     <span className="text-[13px] font-bold text-blue-700">สินค้าไม่มีวันหมดอายุ</span>
     {expiry.mfgDate && (
      <p className="text-[12px] text-blue-600 mt-0.5">วันผลิต (MFG): {formatThaiDateDisplay(expiry.mfgDate)}</p>
     )}
    </div>
    <span className="text-[12px] font-bold text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200">
     {formatStockQuantity(selectedItem.quantity)} {selectedItem.unit}
    </span>
   </div>
  ) : expiry.batches.length > 0 ? (
   <div className="space-y-2.5">
    {expiry.batches.map((batch, idx) => {
     const bExpired = batch.status === 'EXPIRED' || batch.status === 'EXPIRES_TODAY';
     const bSoon = batch.status === 'EXPIRING_SOON';
     return (
      <div
       key={batch.id || idx}
       className={`rounded-xl border p-3 ${
        bExpired
         ? 'border-red-200 bg-red-50/60'
         : bSoon
         ? 'border-amber-200 bg-amber-50/60'
         : 'border-gray-200 bg-gray-50/70'
       }`}
      >
       <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
         <span className="rounded-md bg-[#7a5c4e] px-2 py-0.5 text-[11px] font-bold text-white">
          ล็อตที่ {idx + 1}
         </span>
         <span className="text-[13px] font-black text-gray-800">
          {formatStockQuantity(batch.quantity)} {selectedItem.unit}
         </span>
        </div>
        {batch.noExpiry ? (
         <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
          ไม่มีวันหมดอายุ
         </span>
        ) : batch.daysUntilExpiry !== null ? (
         <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
           bExpired
            ? 'bg-red-100 text-red-700'
            : bSoon
            ? 'bg-amber-100 text-amber-800'
            : 'bg-green-100 text-green-700'
          }`}
         >
          {batch.daysUntilExpiry < 0
           ? `หมดอายุแล้ว ${Math.abs(batch.daysUntilExpiry)} วัน`
           : batch.daysUntilExpiry === 0
           ? 'หมดอายุวันนี้'
           : `เหลืออีก ${batch.daysUntilExpiry} วัน`}
         </span>
        ) : (
         <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-[11px] font-bold text-gray-600">
          ยังไม่ระบุวันหมดอายุ
         </span>
        )}
       </div>
       <div className="grid grid-cols-2 gap-2 text-[12px] pt-1 border-t border-gray-200/60">
        <div>
         <span className="text-gray-500">วันผลิต (MFG): </span>
         <span className="font-bold text-gray-700">{batch.mfgDate ? formatThaiDateDisplay(batch.mfgDate) : '-'}</span>
        </div>
        <div className="text-right">
         <span className="text-gray-500">วันหมดอายุ (EXP): </span>
         <span className={`font-bold ${bExpired ? 'text-red-600' : bSoon ? 'text-amber-700' : 'text-gray-800'}`}>
          {batch.noExpiry ? 'ไม่มีวันหมดอายุ' : (batch.expDate ? formatThaiDateDisplay(batch.expDate) : '-')}
         </span>
        </div>
       </div>
      </div>
     );
    })}

    {expiry.untrackedQuantity > 0 && (
     <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 flex items-center justify-between gap-2">
      <div>
       <p className="text-[12px] font-bold text-amber-900">
        สต็อกที่ยังไม่ระบุวันหมดอายุ: {formatStockQuantity(expiry.untrackedQuantity)} {selectedItem.unit}
       </p>
       <p className="text-[11px] text-amber-700">สามารถกดแก้ไขข้อมูลเพื่อระบุวันผลิต/วันหมดอายุให้ครบทุกถุงได้</p>
      </div>
      <button
       type="button"
       onClick={() => openEditForm(selectedItem)}
       className="shrink-0 rounded-lg bg-white border border-amber-300 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
      >
       ระบุวันหมดอายุ
      </button>
     </div>
    )}
   </div>
  ) : (
   <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3.5 flex items-center justify-between gap-3">
    <div>
     <p className="text-[13px] font-bold text-gray-700">ยังไม่ระบุวันผลิตและวันหมดอายุ</p>
     <p className="text-[11px] text-gray-500">กดปุ่ม &quot;ระบุวันหมดอายุ&quot; หรือ &quot;เพิ่มสต็อก&quot; เพื่อบันทึกวันหมดอายุแยกตามล็อต</p>
    </div>
    <button
     type="button"
     onClick={() => openEditForm(selectedItem)}
     className="shrink-0 rounded-xl bg-[#7a5c4e] px-3 py-2 text-[12px] font-bold text-white hover:bg-[#684c3f]"
    >
     ระบุวันหมดอายุ
    </button>
   </div>
  )}
 </div>

 <div className="flex justify-between items-center py-2 border-b border-gray-100"><span className="text-gray-500">แจ้งเตือนเมื่อสต็อกต่ำกว่า</span><span className="font-medium text-gray-800">{selectedItem.min_threshold} {selectedItem.unit}</span></div>
 <div className="flex justify-between items-center py-2 border-b border-gray-100"><span className="text-gray-500">ต้นทุนต่อ {selectedItem.package_unit || selectedItem.unit}</span><span className="font-medium text-gray-800">฿{Number(selectedItem.cost_per_piece || selectedItem.cost || 0).toFixed(2)}<small className="block text-right text-[11px] text-gray-500">ต่อ {selectedItem.unit}: ฿{Number(selectedItem.cost || 0).toFixed(2)}</small></span></div>
 </div>
 </div>

 <button onClick={() => openEditForm(selectedItem)} className="w-full py-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-[15px] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
 <Edit className="w-4 h-4" /> แก้ไขข้อมูล / จัดการล็อตวันหมดอายุ
 </button>
 <button onClick={handleDeleteItem} disabled={isSaving} className="w-full py-4 bg-red-50 border border-red-200 text-red-600 rounded-xl font-bold text-[15px] hover:bg-red-100 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
 <Trash2 className="w-4 h-4" /> ลบรายการนี้
 </button>
 </div>
  );
 })()}

 {drawerTab === "adjustment" && (
 <div className="bg-white p-6 rounded-[16px] border border-gray-200 shadow-sm">
 <div className="flex items-center gap-3 mb-6 bg-orange-50 p-4 rounded-xl border border-orange-100">
 <AlertCircle className="w-6 h-6 text-orange-500 shrink-0" />
 <p className="text-[13px] text-orange-800 font-medium">การปรับสต็อกจะถูกบันทึกลงในประวัติ (Audit Log) ทันที และไม่สามารถย้อนกลับได้ กรุณาตรวจสอบให้ถูกต้อง</p>
 </div>

 <div className="space-y-4 text-[14px]">
 <div>
 <label className="block text-gray-500 mb-1 font-bold">Stock ในคลังปัจจุบัน</label>
 <input type="text" disabled value={`${formatStockQuantity(selectedItem.quantity)} ${selectedItem.unit}`} className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 font-black outline-none" />
 </div>
 <div>
 <label className="block text-gray-800 font-bold mb-1">จำนวนที่ต้องการปรับเพิ่ม/ลด</label>
 <div className="relative">
 <ArrowUpDown className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
 <input type="number" value={adjustData.qty} onChange={(e)=>setAdjustData({...adjustData, qty: e.target.value})} placeholder="เช่น -2 หรือ 15" className="w-full h-12 pl-12 pr-4 rounded-xl border border-gray-300 focus:border-[#7a5c4e] outline-none font-bold text-[16px]" />
 </div>
 <p className="text-gray-400 text-[11px] mt-1">ใส่เครื่องหมายลบ (-) เพื่อนำออก, ไม่ใส่เพื่อรับเข้า</p>
 </div>
 {Number(adjustData.qty) > 0 && (
  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
   <div className="flex items-center justify-between">
    <span className="text-[13px] font-bold text-gray-800">ระบุวันผลิตและวันหมดอายุ (ล็อตที่รับเข้า)</span>
    <label className="flex items-center gap-2 cursor-pointer select-none">
     <input
      type="checkbox"
      checked={Boolean(adjustData.no_expiry)}
      onChange={(e) => setAdjustData({ ...adjustData, no_expiry: e.target.checked, exp_date: e.target.checked ? '' : adjustData.exp_date })}
      className="h-4 w-4 accent-[#7a5c4e]"
     />
     <span className="text-[12px] font-bold text-gray-700">ไม่มีวันหมดอายุ</span>
    </label>
   </div>
   <div className="grid grid-cols-2 gap-3">
    <div>
     <label className="block text-[12px] font-bold text-gray-600 mb-1">วันผลิต</label>
     <DateInputDMY
      value={adjustData.mfg_date}
      onChange={(val) => setAdjustData({ ...adjustData, mfg_date: val })}
      placeholder="วัน/เดือน/ปี"
      className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-[13px] outline-none focus:border-[#7a5c4e]"
     />
    </div>
    <div>
     <label className="block text-[12px] font-bold text-gray-600 mb-1">วันหมดอายุ</label>
     <DateInputDMY
      disabled={Boolean(adjustData.no_expiry)}
      min={adjustData.mfg_date || undefined}
      value={adjustData.no_expiry ? '' : adjustData.exp_date}
      onChange={(val) => setAdjustData({ ...adjustData, exp_date: val, no_expiry: false })}
      placeholder="วัน/เดือน/ปี"
      className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-[13px] outline-none focus:border-[#7a5c4e] disabled:bg-gray-100 disabled:text-gray-400"
     />
    </div>
   </div>
  </div>
 )}
 {Number(adjustData.qty) < 0 && (() => {
  const expiry = getItemExpiryMeta(selectedItem);
  if (expiry.batches.length === 0) return null;
  return (
   <div>
    <label className="block text-gray-800 font-bold mb-1">เลือกล็อตวันหมดอายุที่ต้องการตัดสต็อก</label>
    <select
     value={adjustData.batch_id || 'auto'}
     onChange={(e) => setAdjustData({ ...adjustData, batch_id: e.target.value })}
     className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:border-[#7a5c4e] outline-none font-medium bg-white"
    >
     <option value="auto">ตัดอัตโนมัติตามวันหมดอายุเร็วสุดก่อน (FEFO)</option>
     {expiry.batches.map((b, idx) => (
      <option key={b.id || idx} value={b.id}>
       ล็อตที่ {idx + 1}: EXP {b.noExpiry ? 'ไม่มีวันหมดอายุ' : (b.expDate ? formatThaiDateDisplay(b.expDate) : 'ไม่ระบุ')} (คงเหลือ {formatStockQuantity(b.quantity)} {selectedItem.unit})
      </option>
     ))}
    </select>
   </div>
  );
 })()}
 <div>
 <label className="block text-gray-800 font-bold mb-1">เหตุผลในการปรับ</label>
 <select value={adjustData.reason} onChange={(e)=>setAdjustData({...adjustData, reason: e.target.value})} className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:border-[#7a5c4e] outline-none font-medium bg-white">
 <option value="นับ Stock ประจำวัน">นับ Stock ประจำวัน</option>
 <option value="สินค้าเสียหาย / หมดอายุ / สูญหาย">สินค้าเสียหาย / หมดอายุ / สูญหาย</option>
 <option value="รับสินค้าเข้า (ซื้อ)">รับสินค้าเข้า (สั่งซื้อ)</option>
 <option value="ปรับลดยอดเคลม">ปรับลดยอดเคลม</option>
 <option value="อื่นๆ">อื่นๆ</option>
 </select>
 </div>
 <button onClick={handleAdjustStock} disabled={isSaving} className="w-full py-4 bg-[#7a5c4e] text-white rounded-xl font-bold text-[16px] hover:bg-[#684c3f] transition-colors flex items-center justify-center gap-2 mt-4 shadow-sm">
 {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} ยืนยันการปรับ Stock
 </button>
 </div>
 </div>
 )}

 {drawerTab === "movement" && (
 <div className="bg-white rounded-[16px] border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
 <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex justify-between items-center shrink-0">
 <span className="font-bold text-gray-700 text-[14px]">ประวัติการเคลื่อนไหว</span>
 <span className="text-[12px] bg-white border border-gray-200 px-2 py-1 rounded-md text-gray-500">{selectedItem.movements?.length || 0} รายการ</span>
 </div>
 <div className="flex-1 overflow-auto">
 <table className="w-full text-left">
 <thead className="bg-white sticky top-0 shadow-sm">
 <tr>
 <th className="px-4 py-3 text-[12px] font-bold text-gray-500 border-b border-gray-200">วันที่และเหตุผล</th>
 <th className="px-4 py-3 text-[12px] font-bold text-gray-500 border-b border-gray-200 text-right">จำนวน</th>
 <th className="px-4 py-3 text-[12px] font-bold text-gray-500 border-b border-gray-200 text-right">คงเหลือ</th>
 </tr>
 </thead>
 <tbody>
 {(!selectedItem.movements || selectedItem.movements.length === 0) ? (
 <tr><td colSpan={3} className="text-center py-8 text-gray-400 text-[13px]">ยังไม่มีประวัติการเคลื่อนไหว</td></tr>
 ) : (
 selectedItem.movements.map((mov: any) => (
 <tr key={mov.id} className="border-b border-dashed border-gray-100 last:border-0 hover:bg-gray-50">
 <td className="px-4 py-3 text-[13px]">
 <div className="text-gray-500 text-[11px] mb-1">{new Date(mov.created_at).toLocaleString('th-TH')}</div>
 <div className="font-bold text-gray-800">{getMovementLabel(mov.reason, mov.movement_type)}</div>
 </td>
 <td className={`px-4 py-3 text-[14px] font-black text-right ${mov.quantity < 0 ? 'text-red-500' : 'text-green-600'}`}>
 {mov.quantity > 0 ? '+' : ''}{Number(Number(mov.quantity || 0).toFixed(6))}
 </td>
 <td className="px-4 py-3 text-[14px] font-bold text-gray-600 text-right">
 {Number(Number(mov.balance_after || 0).toFixed(6))}
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </div>
 )}

 </>
 )}
 </div>
 </div>
 </div>
 )}

 {showCategoryModal && (
 <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
 <div className="bg-white w-full max-w-[560px] rounded-[24px] shadow-2xl overflow-hidden">
 <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5 bg-[#f5f6f8]">
 <div>
 <h2 className="text-[20px] font-bold text-gray-800">จัดการหมวดย่อย</h2>
 <p className="mt-1 text-[12px] text-gray-500">เพิ่ม/แก้ไข/ลบหมวดย่อยแบบเรียลไทม์</p>
 </div>
 <button onClick={() => setShowCategoryModal(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-200"><X className="w-5 h-5" /></button>
 </div>

 <div className="p-6 space-y-5">
 <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
 <label className="block text-[13px] font-bold text-gray-700 mb-2">ชื่อหมวดย่อย</label>
 <input
 type="text"
 value={categoryForm.name}
 onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
 placeholder="เช่น ชา, เมล็ดกาแฟ"
 className="w-full rounded-xl border border-gray-300 bg-white p-3 outline-none focus:border-[#7a5c4e]"
 />
 <div className="mt-3">
 <label className="block text-[13px] font-bold text-gray-700 mb-2">ประเภท</label>
 <select
 value={categoryForm.type}
 onChange={(e) => setCategoryForm((prev) => ({ ...prev, type: e.target.value }))}
 className="w-full rounded-xl border border-gray-300 bg-white p-3 outline-none focus:border-[#7a5c4e]"
 >
 <option value="raw_material">วัตถุดิบ</option>
 <option value="packaging">บรรจุภัณฑ์</option>
 </select>
 </div>
 <div className="mt-4 flex gap-3">
 <button type="button" onClick={saveCategory} className="flex-1 rounded-xl bg-[#7a5c4e] px-4 py-3 font-bold text-white hover:bg-[#684c3f]">
 {categoryForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มหมวดย่อย'}
 </button>
 {categoryForm.id && (
 <button type="button" onClick={() => setCategoryForm({ id: null, name: '', type: activeTypeValue })} className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700 hover:bg-gray-100">
 ยกเลิก
 </button>
 )}
 </div>
 </div>

 <div>
 <div className="mb-3 flex items-center justify-between">
 <h3 className="text-[14px] font-bold text-gray-700">หมวดย่อยปัจจุบัน</h3>
 <span className="text-[12px] text-gray-500">{inventoryCategories.length} รายการ</span>
 </div>
 <div className="max-h-[300px] overflow-auto rounded-2xl border border-gray-200 bg-white">
 {inventoryCategories.length === 0 ? (
 <div className="p-6 text-center text-[13px] text-gray-400">ยังไม่มีหมวดย่อย</div>
 ) : (
 inventoryCategories.map((category) => (
 <div key={category.id} className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0">
 <div>
 <div className="font-bold text-gray-800">{category.name}</div>
 <div className="text-[11px] text-gray-500">{categoryCountMap[String(category.id)] || 0} รายการ</div>
 </div>
 <div className="flex items-center gap-2">
 <button type="button" onClick={() => setCategoryForm({ id: Number(category.id), name: category.name, type: category.type || categoryTypeMap[String(category.id)] || activeTypeValue })} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-bold text-gray-700 hover:bg-gray-50">แก้ไข</button>
 <button type="button" onClick={() => deleteCategory(category.id)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-600 hover:bg-red-100">ลบ</button>
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {stockDialog.open && selectedItem && (() => {
  const expiry = getItemExpiryMeta(selectedItem);
  return (
 <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
 <div className="w-full max-w-[500px] max-h-[92vh] flex flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl">
 <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5 shrink-0">
 <div><h2 className="text-[20px] font-bold text-gray-800">{stockDialog.mode === 'in' ? 'เพิ่มสต็อก (รับเข้าล็อตใหม่)' : 'ลดสต็อก'}</h2><p className="mt-1 text-[12px] text-gray-500">{selectedItem.name}</p></div>
 <button type="button" onClick={() => setStockDialog({ open: false, mode: 'in' })} className="rounded-full p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
 </div>
 <div className="space-y-5 p-6 overflow-y-auto flex-1">
 <div>
 <label className="mb-2 block text-[13px] font-bold text-gray-700">จำนวนที่ต้องการ{stockDialog.mode === 'in' ? 'เพิ่มในล็อตนี้' : 'ลด'}</label>
 <div className="flex items-center gap-3">
 <button type="button" onClick={() => setStockForm({...stockForm, amount: String(Math.max(1, Number(stockForm.amount || 1) - 1))})} className="h-12 w-12 rounded-xl border border-gray-300 bg-white"><Minus className="mx-auto h-4 w-4" /></button>
 <input type="number" min="1" max={stockDialog.mode === 'out' ? Number(selectedItem.quantity || 0) : undefined} value={stockForm.amount} onChange={(e) => setStockForm({...stockForm, amount: e.target.value})} className="h-12 min-w-0 flex-1 rounded-xl border border-gray-300 text-center text-[20px] font-bold outline-none" />
 <button type="button" onClick={() => setStockForm({...stockForm, amount: String(Number(stockForm.amount || 0) + 1)})} className="h-12 w-12 rounded-xl bg-[#7a5c4e] text-white"><Plus className="mx-auto h-4 w-4" /></button>
 </div>
 <p className="mt-2 text-[12px] text-gray-500">หน่วย: {selectedItem.unit}</p>
 </div>

 {stockDialog.mode === 'in' && (
  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
   <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-1.5">
     <Calendar className="w-4 h-4 text-[#7a5c4e]" />
     <span className="text-[13px] font-bold text-gray-800">วันผลิตและวันหมดอายุของล็อตที่รับเข้า</span>
    </div>
    <label className="flex items-center gap-2 cursor-pointer select-none rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 hover:bg-gray-50">
     <input
      type="checkbox"
      checked={Boolean(stockForm.no_expiry)}
      onChange={(e) => setStockForm({
       ...stockForm,
       no_expiry: e.target.checked,
       exp_date: e.target.checked ? '' : stockForm.exp_date
      })}
      className="h-4 w-4 accent-[#7a5c4e]"
     />
     <span className="text-[12px] font-bold text-gray-700">สินค้าไม่มีวันหมดอายุ</span>
    </label>
   </div>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
     <label className="mb-1 block text-[12px] font-bold text-gray-600">วันผลิต (MFG)</label>
     <DateInputDMY
      value={stockForm.mfg_date}
      onChange={(val) => setStockForm({ ...stockForm, mfg_date: val })}
      placeholder="วัน/เดือน/ปี"
      className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-[13px] outline-none focus:border-[#7a5c4e]"
     />
    </div>
    <div>
     <label className="mb-1 block text-[12px] font-bold text-gray-600">
      วันหมดอายุ (EXP)
     </label>
     <DateInputDMY
      disabled={Boolean(stockForm.no_expiry)}
      min={stockForm.mfg_date || undefined}
      value={stockForm.no_expiry ? '' : stockForm.exp_date}
      onChange={(val) => setStockForm({ ...stockForm, exp_date: val, no_expiry: false })}
      placeholder="วัน/เดือน/ปี"
      className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-[13px] outline-none focus:border-[#7a5c4e] disabled:bg-gray-100 disabled:text-gray-400"
     />
    </div>
   </div>
   {stockForm.no_expiry ? (
    <p className="text-[11px] text-blue-600 font-medium">สินค้านี้ไม่มีวันหมดอายุ ระบบจะไม่สร้างการแจ้งเตือนวันหมดอายุ</p>
   ) : (
    <p className="text-[11px] text-gray-500">หากวันหมดอายุไม่ตรงกับล็อตเดิมในคลัง ระบบจะแยกเก็บเป็นล็อตวันหมดอายุใหม่ให้อัตโนมัติ</p>
   )}

   {expiry.batches.length > 0 && (
    <div className="pt-2 border-t border-gray-200/80">
     <p className="text-[11px] font-bold text-gray-500 mb-1.5">ล็อตวันหมดอายุที่มีอยู่ในคลังปัจจุบัน ({expiry.batches.length} ล็อต):</p>
     <div className="max-h-[110px] overflow-y-auto space-y-1 pr-1">
      {expiry.batches.map((b, idx) => (
       <div key={b.id || idx} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1 text-[11px] border border-gray-200">
        <span className="font-medium text-gray-700">
         ล็อตที่ {idx + 1}: EXP {b.noExpiry ? 'ไม่มีวันหมดอายุ' : (b.expDate ? formatThaiDateDisplay(b.expDate) : 'ไม่ระบุ')}
        </span>
        <span className="font-bold text-[#7a5c4e]">{formatStockQuantity(b.quantity)} {selectedItem.unit}</span>
       </div>
      ))}
     </div>
    </div>
   )}
  </div>
 )}

 {stockDialog.mode === 'out' && expiry.batches.length > 0 && (
  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 space-y-2">
   <label className="block text-[13px] font-bold text-gray-800">เลือกล็อตวันหมดอายุที่ต้องการตัดสต็อก</label>
   <select
    value={stockForm.batch_id || 'auto'}
    onChange={(e) => setStockForm({ ...stockForm, batch_id: e.target.value })}
    className="w-full rounded-xl border border-gray-300 bg-white p-3 text-[13px] font-medium outline-none focus:border-[#7a5c4e]"
   >
    <option value="auto">ตัดอัตโนมัติตามวันหมดอายุเร็วสุดก่อน (FEFO)</option>
    {expiry.batches.map((b, idx) => (
     <option key={b.id || idx} value={b.id}>
      ล็อตที่ {idx + 1}: EXP {b.noExpiry ? 'ไม่มีวันหมดอายุ' : (b.expDate ? formatThaiDateDisplay(b.expDate) : 'ไม่ระบุ')} (คงเหลือ {formatStockQuantity(b.quantity)} {selectedItem.unit})
     </option>
    ))}
   </select>
   <p className="text-[11px] text-gray-500">หากเลือกตัดอัตโนมัติ ระบบจะตัดจากล็อตที่ใกล้หมดอายุที่สุดก่อน (First Expired, First Out)</p>
  </div>
 )}

 <div><label className="mb-2 block text-[13px] font-bold text-gray-700">เหตุผล</label><select value={stockForm.reason} onChange={(e) => setStockForm({...stockForm, reason: e.target.value})} className="w-full rounded-xl border border-gray-300 p-3"><option value="รับสินค้าเข้า">รับสินค้าเข้า</option><option value="สินค้าเสียหาย / หมดอายุ / สูญหาย">สินค้าเสียหาย / หมดอายุ / สูญหาย</option><option value="นับ Stock ประจำวัน">นับ Stock ประจำวัน</option><option value="อื่นๆ">อื่นๆ</option></select></div>
 <div><label className="mb-2 block text-[13px] font-bold text-gray-700">หมายเหตุ <span className="font-normal text-gray-400">(ไม่บังคับ)</span></label><textarea value={stockForm.note} onChange={(e) => setStockForm({...stockForm, note: e.target.value})} rows={2} className="w-full rounded-xl border border-gray-300 p-3" /></div>
 <div className="rounded-xl bg-gray-50 p-4 text-center"><span className="text-[13px] text-gray-500">สต็อกหลังรายการ</span><p className={`mt-1 text-[20px] font-black ${stockDialog.mode === 'out' && Number(stockForm.amount || 0) > Number(selectedItem.quantity || 0) ? 'text-red-600' : 'text-gray-800'}`}>{Number(selectedItem.quantity || 0).toLocaleString()} → {(Number(selectedItem.quantity || 0) + (stockDialog.mode === 'in' ? Number(stockForm.amount || 0) : -Number(stockForm.amount || 0))).toLocaleString()} {selectedItem.unit}</p>{stockDialog.mode === 'out' && Number(stockForm.amount || 0) > Number(selectedItem.quantity || 0) && <p className="mt-1 text-[12px] font-medium text-red-600">จำนวนที่ลดเกินสต็อกคงเหลือ</p>}</div>
 </div>
 <div className="grid grid-cols-2 gap-3 border-t border-gray-200 bg-gray-50 p-5 shrink-0"><button type="button" onClick={() => setStockDialog({ open: false, mode: 'in' })} disabled={isSaving} className="rounded-xl border border-gray-300 bg-white py-3 font-bold text-gray-700 disabled:opacity-50">ยกเลิก</button><button type="button" onClick={submitStockAdjustment} disabled={isSaving || !Number.isFinite(Number(stockForm.amount)) || Number(stockForm.amount) <= 0 || (stockDialog.mode === 'out' && Number(stockForm.amount) > Number(selectedItem.quantity || 0))} className="flex items-center justify-center gap-2 rounded-xl bg-[#7a5c4e] py-3 font-bold text-white disabled:opacity-50">{isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {stockDialog.mode === 'in' ? 'เพิ่มสต็อก' : 'ลดสต็อก'}</button></div>
 </div>
 </div>
  );
 })()}

 </div>
 </>
 );
}