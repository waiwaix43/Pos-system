"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from "../../components/NotificationBell";
import { createClient } from "@supabase/supabase-js";
import { 
  Search, Plus, LayoutGrid, List, AlignJustify, RefreshCw, AlertCircle, X, 
  Package, Edit, Save, Upload, ArrowUpDown, Box, Droplets, Filter, Trash2
} from "lucide-react";

// ==========================================
// SUPABASE CLIENT สำหรับอัปโหลดรูปภาพ
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function InventoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  // States: Main Data
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // States: Filters & Tabs
  const [viewMode, setViewMode] = useState<"table" | "compact" | "grid">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("วัตถุดิบ"); 
  const [filterStatus, setFilterStatus] = useState("all"); 
  const [filterStock, setFilterStock] = useState("all"); 

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
  const [adjustData, setAdjustData] = useState({ qty: "", reason: "นับ Stock ประจำวัน", note: "" });

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("userContext") || "{}");
    if (!savedUser || Object.keys(savedUser).length === 0) {
      router.push("/pin");
      return;
    }
    setUser(savedUser);

    const stockFilter = new URLSearchParams(window.location.search).get("stock");
    if (stockFilter === "low" || stockFilter === "out") setFilterStock(stockFilter);
    
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
      const invRes = await fetch(`http://localhost:5000/api/inventory/items?shop_id=${user.shop_id}`);
      if (invRes.ok) setInventoryItems(await invRes.json());
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived counts for Main Navigation
  const countRaw = inventoryItems.filter(i => !i.type || i.type === 'raw_material').length;
  const countPkg = inventoryItems.filter(i => i.type === 'packaging').length;

  // Compute Displayed Items based on active tab, search, and filters
  let displayedItems: any[] = [];
  if (activeTab === "วัตถุดิบ") {
      displayedItems = inventoryItems.filter(i => (!i.type || i.type === 'raw_material') && (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku?.toLowerCase().includes(searchQuery.toLowerCase())));
  } else if (activeTab === "บรรจุภัณฑ์") {
      displayedItems = inventoryItems.filter(i => i.type === 'packaging' && (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku?.toLowerCase().includes(searchQuery.toLowerCase())));
  }

  // ใช้งานตัวกรอง (Filters)
  if (filterStatus !== "all") {
    displayedItems = displayedItems.filter(i => i.status === filterStatus);
  }
  if (filterStock === "low") {
    displayedItems = displayedItems.filter(i => i.quantity <= (i.min_threshold || 0) && i.quantity > 0);
  } else if (filterStock === "out") {
    displayedItems = displayedItems.filter(i => i.quantity <= 0);
  }

  // ==========================================
  // IMAGE UPLOAD 
  // ==========================================
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) return alert("ขนาดรูปต้องไม่เกิน 2MB");

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.shop_id}-${Date.now()}.${fileExt}`;
      const bucketName = "shop_assets";

      const { error: uploadErr } = await supabase.storage.from(bucketName).upload(fileName, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(fileName);
      setFormData({ ...formData, image_url: publicUrl });
    } catch (err: any) {
      alert("อัปโหลดรูปไม่สำเร็จ: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // ==========================================
  // SAVE DATA
  // ==========================================
  const handleSaveData = async () => {
    if (!formData.name) return alert("กรุณากรอกชื่อรายการ");
    setIsSaving(true);
    try {
      let endpoint = `/api/inventory/items${formMode === 'edit' ? `/${formData.id}` : ''}`;
      let payload = { 
        ...formData, 
        shop_id: user.shop_id,
        type: formData.type || (activeTab === "บรรจุภัณฑ์" ? 'packaging' : 'raw_material')
      };

      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: formMode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "บันทึกข้อมูลไม่สำเร็จ");
      setShowFormModal(false);
      setFormData({});
      fetchData(); 
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    if (!window.confirm(`คุณต้องการลบ "${selectedItem.name}" ใช่หรือไม่? การเปลี่ยนแปลงนี้ไม่สามารถย้อนกลับได้`)) return;

    setIsSaving(true);
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/items/${selectedItem.id}`, {
        method: "DELETE"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ลบรายการไม่สำเร็จ");

      setSelectedItem(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // ADJUST STOCK
  // ==========================================
  const handleAdjustStock = async () => {
    if (!adjustData.qty || isNaN(Number(adjustData.qty))) return alert("กรุณาระบุจำนวนที่ต้องการปรับ");
    
    setIsSaving(true);
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: user.shop_id,
          user_id: user.id,
          item_id: selectedItem.id,
          adjust_qty: Number(adjustData.qty),
          reason: adjustData.reason
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      
      alert(data.message);
      setAdjustData({ qty: "", reason: "นับ Stock ประจำวัน", note: "" });
      handleOpenDetail(selectedItem.id); 
      fetchData(); 
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDetail = async (id: string) => {
    setDetailLoading(true);
    setDrawerTab("detail");
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/${id}`);
      const data = await res.json();
      
      let itemMovs = [];
      try {
         const movRes = await fetch(`http://localhost:5000/api/stock-movements?shop_id=${user.shop_id}`);
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
      alert("โหลดรายละเอียดไม่ได้: " + err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const openAddForm = () => {
    setFormMode("add");
    setFormData({ 
      status: 'active',
      type: activeTab === "บรรจุภัณฑ์" ? 'packaging' : 'raw_material'
    });
    setShowFormModal(true);
  };

  const openEditForm = (item: any) => {
    setFormMode("edit");
    setFormData({ ...item });
    setSelectedItem(null); 
    setShowFormModal(true);
  };

  return (
    <div className="flex h-screen bg-[#d6d6d6] font-sans overflow-hidden text-gray-800">
      
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
            <button className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">สินค้าคงคลัง</button>
            <button onClick={() => router.push('/pos/shifts')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รอบการขาย</button>
            <button onClick={() => router.push('/pos/menu')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">เมนูและโปรโมชั่น</button>
            <button onClick={() => router.push('/pos/reports')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รายงาน</button>
            <button onClick={() => router.push('/pos/employees')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">พนักงาน</button>
            <button onClick={() => router.push('/pos/settings')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">การตั้งค่า</button>
          </nav>
         </div>
      <button onClick={() => router.push('/pin')} className="py-6 px-6 text-left text-gray-300 border-t border-[#666666] hover:bg-[#666666] transition-colors text-[16px]">กลับสู่หน้า PIN</button>
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
                  activeTab === 'วัตถุดิบ' ? 'ค้นหาวัตถุดิบ / SKU...' : 'ค้นหาบรรจุภัณฑ์ / SKU...'
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

        <div className="flex-1 overflow-y-auto p-8 flex flex-col">
          
          {/* Main Navigation Tabs */}
          <div className="grid grid-cols-2 gap-6 shrink-0 mb-6">
            {[
              { id: 'วัตถุดิบ', icon: <Droplets className="w-6 h-6" />, count: countRaw, title: 'วัตถุดิบ' },
              { id: 'บรรจุภัณฑ์', icon: <Box className="w-6 h-6" />, count: countPkg, title: 'บรรจุภัณฑ์' }
            ].map(tab => (
              <div 
                key={tab.id} 
                onClick={() => { 
                  setActiveTab(tab.id); 
                  setSearchQuery(""); 
                  setFilterStatus("all"); 
                  setFilterStock("all"); 
                }}
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
          <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
            
            {/* Toolbar: Filters & View Modes */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-gray-500 mr-2">
                  <Filter className="w-4 h-4" />
                  <span className="text-[13px] font-bold uppercase tracking-wider">ตัวกรอง</span>
                </div>
                
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-[38px] px-3 pr-8 rounded-lg border border-gray-200 outline-none text-[13px] font-medium text-gray-700 focus:border-[#7a5c4e] bg-white cursor-pointer shadow-sm"
                >
                  <option value="all">สถานะทั้งหมด</option>
                  <option value="active">เปิดใช้งาน</option>
                  <option value="inactive">ระงับการใช้งาน</option>
                </select>
                
                <select 
                  value={filterStock}
                  onChange={(e) => setFilterStock(e.target.value)}
                  className="h-[38px] px-3 pr-8 rounded-lg border border-gray-200 outline-none text-[13px] font-medium text-gray-700 focus:border-[#7a5c4e] bg-white cursor-pointer shadow-sm"
                >
                  <option value="all">สต็อกทั้งหมด</option>
                  <option value="low">ใกล้หมดสต็อก</option>
                  <option value="out">หมดสต็อก</option>
                </select>
              </div>

              <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <button onClick={() => changeViewMode("table")} className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-gray-100 text-[#7a5c4e]' : 'text-gray-400 hover:text-gray-600'}`}><List className="w-4 h-4" /></button>
                <button onClick={() => changeViewMode("grid")} className={`p-2 border-l border-gray-200 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-[#7a5c4e]' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid className="w-4 h-4" /></button>
              </div>
            </div>

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
              <div className="flex-1 overflow-auto rounded-b-[24px]">
                
                {/* ---------------- TABLE VIEW ---------------- */}
                {viewMode === "table" && (
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase border-b border-gray-200">ชื่อรายการ</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase border-b border-gray-200">SKU</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase border-b border-gray-200 text-right">ต้นทุนเฉลี่ย</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase border-b border-gray-200 text-right">Stock คงเหลือ</th>
                        <th className="px-6 py-4 text-[13px] font-bold text-gray-500 uppercase border-b border-gray-200 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedItems.map((item) => (
                        <tr key={item.id} onClick={() => handleOpenDetail(item.id)} className="hover:bg-gray-50/80 transition-colors cursor-pointer border-b border-gray-100 bg-white">
                          <td className="px-6 py-4 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-gray-200">
                              {item.image_url ? <img src={item.image_url} alt="img" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-gray-400" />}
                            </div>
                            <span className="text-[15px] font-bold text-gray-800">{item.name}</span>
                          </td>
                          <td className="px-6 py-4 text-[14px] text-gray-500">{item.sku || '-'}</td>
                          <td className="px-6 py-4 text-[14px] font-bold text-gray-800 text-right">฿{Number(item.cost || 0).toLocaleString()}</td>
                          <td className={`px-6 py-4 text-[15px] font-black text-right ${item.quantity <= 0 ? 'text-red-500' : 'text-gray-800'}`}>
                            {Number(item.quantity || 0).toLocaleString()} <span className="text-[12px] font-normal text-gray-500">{item.unit}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-[12px] font-bold border ${
                              item.status === 'active' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-300'
                            }`}>{item.status === 'active' ? 'ใช้งาน' : 'ระงับ'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* ---------------- GRID VIEW ---------------- */}
                {viewMode === "grid" && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-6">
                    {displayedItems.map((item) => (
                      <div key={item.id} onClick={() => handleOpenDetail(item.id)} className="border border-gray-200 rounded-[20px] overflow-hidden hover:shadow-md transition-all cursor-pointer bg-white group hover:-translate-y-1 flex flex-col">
                        <div className="h-[150px] bg-gray-100 flex items-center justify-center relative shrink-0">
                          {item.image_url ? <img src={item.image_url} alt="img" className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <Package className="w-8 h-8 text-gray-300" />}
                          {item.quantity <= 0 && <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">หมดสต็อก</span>}
                        </div>
                        <div className="p-4 flex flex-col flex-1 justify-between">
                          <div>
                            <h4 className="font-bold text-gray-800 text-[15px] line-clamp-2 leading-tight">{item.name}</h4>
                            <p className="text-gray-400 text-[12px] mt-1">SKU: {item.sku || '-'}</p>
                          </div>
                          <div className="flex justify-between items-end mt-3 border-t border-gray-100 pt-2">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-gray-400 font-medium">Stock คงเหลือ</span>
                              <span className="text-[18px] font-black text-[#7a5c4e] leading-none">{Number(item.quantity||0).toLocaleString()} <span className="text-[12px] text-gray-500 font-normal">{item.unit}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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
          <div className="bg-white w-[500px] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]">
            <div className="h-[70px] border-b border-gray-200 flex items-center justify-between px-6 shrink-0 bg-[#f5f6f8]">
              <h2 className="text-[18px] font-bold text-gray-800">{formMode === 'add' ? 'เพิ่มข้อมูล' : 'แก้ไขข้อมูล'} ({activeTab})</h2>
              <button onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden mb-3 relative group">
                  {formData.image_url ? <img src={formData.image_url} alt="preview" className="w-full h-full object-cover" /> : <Upload className="w-8 h-8 text-gray-400" />}
                  {uploadingImage && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin text-[#7a5c4e]" /></div>}
                </div>
                <label className="cursor-pointer text-[13px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-full transition-colors">
                  อัปโหลดรูปภาพ
                  <input type="file" className="hidden" accept="image/jpeg, image/png, image/webp" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
              </div>

              <input type="hidden" value={formData.type || (activeTab === "บรรจุภัณฑ์" ? 'packaging' : 'raw_material')} />
              <div><label className="block text-[13px] font-bold text-gray-600 mb-1">ชื่อรายการ</label><input type="text" value={formData.name || ''} onChange={(e)=>setFormData({...formData, name: e.target.value})} className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[13px] font-bold text-gray-600 mb-1">SKU</label><input type="text" value={formData.sku || ''} onChange={(e)=>setFormData({...formData, sku: e.target.value})} className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]" /></div>
                <div><label className="block text-[13px] font-bold text-gray-600 mb-1">หน่วย (เช่น g, ml, ชิ้น)</label><input type="text" value={formData.unit || ''} onChange={(e)=>setFormData({...formData, unit: e.target.value})} className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[13px] font-bold text-gray-600 mb-1">ต้นทุน / หน่วย (฿)</label><input type="number" value={formData.cost || ''} onChange={(e)=>setFormData({...formData, cost: Number(e.target.value)})} className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]" /></div>
                <div><label className="block text-[13px] font-bold text-gray-600 mb-1">แจ้งเตือน Stock ต่ำกว่า</label><input type="number" value={formData.min_threshold || ''} onChange={(e)=>setFormData({...formData, min_threshold: Number(e.target.value)})} className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]" /></div>
              </div>
              {formMode === 'add' && (
                <div><label className="block text-[13px] font-bold text-gray-600 mb-1">Stock เริ่มต้น</label><input type="number" value={formData.quantity || ''} onChange={(e)=>setFormData({...formData, quantity: Number(e.target.value)})} className="w-full p-3 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e]" /></div>
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
              <button onClick={() => setDrawerTab("adjustment")} className={`py-4 text-[14px] font-bold border-b-2 mr-6 shrink-0 ${drawerTab === 'adjustment' ? 'border-[#7a5c4e] text-[#7a5c4e]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>ปรับ Stock ทันที</button>
              <button onClick={() => setDrawerTab("movement")} className={`py-4 text-[14px] font-bold border-b-2 shrink-0 ${drawerTab === 'movement' ? 'border-[#7a5c4e] text-[#7a5c4e]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>ประวัติ Movement</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 relative">
              {detailLoading ? (
                 <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-white/50"><RefreshCw className="w-8 h-8 animate-spin" /></div>
              ) : (
                <>
                  {drawerTab === "detail" && (
                    <div className="space-y-4">
                      <div className="bg-white p-5 rounded-[16px] border border-gray-200 shadow-sm flex gap-5 items-center">
                        <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-gray-200">
                          {selectedItem.image_url ? <img src={selectedItem.image_url} alt="pic" className="w-full h-full object-cover"/> : <Package className="w-8 h-8 text-gray-300" />}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-[18px] font-bold text-gray-800 mb-1">{selectedItem.name}</h3>
                          {selectedItem.sku && <p className="text-gray-500 text-[13px] font-medium">SKU: {selectedItem.sku}</p>}
                          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[12px] font-bold ${selectedItem.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                            {selectedItem.status === 'active' ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-[16px] border border-gray-200 shadow-sm">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><AlignJustify className="w-4 h-4"/> ข้อมูลทั่วไป</h4>
                        
                        <div className="space-y-3 text-[14px]">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100"><span className="text-gray-500">ประเภท</span><span className="font-medium text-gray-800">{selectedItem.type === 'packaging' ? 'บรรจุภัณฑ์' : 'วัตถุดิบ'}</span></div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100"><span className="text-gray-500">Stock ในคลัง</span><span className="font-black text-[18px] text-[#7a5c4e]">{Number(selectedItem.quantity||0).toLocaleString()} {selectedItem.unit}</span></div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100"><span className="text-gray-500">แจ้งเตือนเมื่อต่ำกว่า</span><span className="font-medium text-gray-800">{selectedItem.min_threshold} {selectedItem.unit}</span></div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100"><span className="text-gray-500">ต้นทุนต่อหน่วย</span><span className="font-medium text-gray-800">฿{Number(selectedItem.cost||0).toLocaleString()}</span></div>
                        </div>
                      </div>

                      <button onClick={() => openEditForm(selectedItem)} className="w-full py-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-[15px] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
                        <Edit className="w-4 h-4" /> แก้ไขข้อมูล
                      </button>
                      <button onClick={handleDeleteItem} disabled={isSaving} className="w-full py-4 bg-red-50 border border-red-200 text-red-600 rounded-xl font-bold text-[15px] hover:bg-red-100 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
                        <Trash2 className="w-4 h-4" /> ลบรายการนี้
                      </button>
                    </div>
                  )}

                  {drawerTab === "adjustment" && (
                    <div className="bg-white p-6 rounded-[16px] border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-6 bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <AlertCircle className="w-6 h-6 text-orange-500 shrink-0" />
                        <p className="text-[13px] text-orange-800 font-medium">การปรับสต็อกจะถูกบันทึกลงในประวัติ (Audit Log) ทันที และไม่สามารถย้อนกลับได้ กรุณาตรวจสอบให้ถูกต้อง</p>
                      </div>

                      <div className="space-y-4 text-[14px]">
                        <div>
                          <label className="block text-gray-500 mb-1 font-bold">Stock ในคลังปัจจุบัน</label>
                          <input type="text" disabled value={`${selectedItem.quantity} ${selectedItem.unit}`} className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 font-black outline-none" />
                        </div>
                        <div>
                          <label className="block text-gray-800 font-bold mb-1">จำนวนที่ต้องการปรับเพิ่ม/ลด</label>
                          <div className="relative">
                            <ArrowUpDown className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="number" value={adjustData.qty} onChange={(e)=>setAdjustData({...adjustData, qty: e.target.value})} placeholder="เช่น -2 หรือ 15" className="w-full h-12 pl-12 pr-4 rounded-xl border border-gray-300 focus:border-[#7a5c4e] outline-none font-bold text-[16px]" />
                          </div>
                          <p className="text-gray-400 text-[11px] mt-1">ใส่เครื่องหมายลบ (-) เพื่อนำออก, ไม่ใส่เพื่อรับเข้า</p>
                        </div>
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
                                    <div className="font-bold text-gray-800">{mov.reason || mov.movement_type}</div>
                                  </td>
                                  <td className={`px-4 py-3 text-[14px] font-black text-right ${mov.quantity < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                                  </td>
                                  <td className="px-4 py-3 text-[14px] font-bold text-gray-600 text-right">
                                    {mov.balance_after}
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

    </div>
  );
}