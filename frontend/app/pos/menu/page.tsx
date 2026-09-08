"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from "../../components/NotificationBell";
import { createClient } from "@supabase/supabase-js";
import { 
  Package, 
  Tag, 
  ListTree,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  X,
  Save,
  Image as ImageIcon,
  BookOpen,
  List,
  Grid2X2,
  Settings2,
  Droplets,
  Box,
  Settings,
  Upload,
  ChevronRight
} from "lucide-react";

// ==========================================
// SUPABASE CLIENT (ใช้สำหรับ Upload รูปภาพจริง)
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
}

interface Category {
  id: number;
  name: string;
  item_count?: number;
  status: "active" | "inactive";
}

interface Product {
  id: number;
  category_id: number;
  category_name?: string;
  name: string;
  price: number;
  image_url?: string;
  status: "active" | "inactive";
}

interface Promotion {
  id: number;
  name: string;
  discount_type: "percent" | "amount";
  discount_value: number;
  start_date: string;
  end_date: string;
  status: "active" | "inactive";
}

export default function MenuPromotionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  
  const [activeTab, setActiveTab] = useState<string>("categories");
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [options, setOptions] = useState<any[]>([]); 
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({ category: "", status: "", price: "" });

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [gridSize, setGridSize] = useState<"small" | "medium" | "large">("medium");

  const [toast, setToast] = useState<{ show: boolean; msg: string; type: "success" | "error" }>({ show: false, msg: "", type: "success" });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // States สำหรับ Recipe Modal
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState<any>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [editingRecipeItems, setEditingRecipeItems] = useState<any[]>([]);
  const [originalRecipeItems, setOriginalRecipeItems] = useState<any[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [isRecipeSaving, setIsRecipeSaving] = useState(false);

  // States สำหรับผูกตัวเลือกสินค้ากับ Product (Product Options Modal)
  const [isProductOptionsModalOpen, setIsProductOptionsModalOpen] = useState(false);
  const [selectedProductForOptions, setSelectedProductForOptions] = useState<any>(null);
  const [productSelectedOptions, setProductSelectedOptions] = useState<number[]>([]);

  // ==========================================
  // FETCH ALL DATA
  // ==========================================
  const fetchAllData = async (shopId: number) => {
    setIsLoading(true);
    try {
      const [catRes, prodRes, optRes, promoRes] = await Promise.all([
        fetch(`http://localhost:5000/api/categories?shop_id=${shopId}`),
        fetch(`http://localhost:5000/api/products?shop_id=${shopId}&category_id=all`),
        fetch(`http://localhost:5000/api/options?shop_id=${shopId}`),
        fetch(`http://localhost:5000/api/promotions?shop_id=${shopId}`)
      ]);

      if (catRes.ok) setCategories(await catRes.json() || []);
      if (prodRes.ok) setProducts(await prodRes.json() || []);
      if (optRes.ok) setOptions(await optRes.json() || []);
      if (promoRes.ok) setPromotions(await promoRes.json() || []);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("userContext") || "null");
    if (!savedUser) {
      router.push("/pin");
      return;
    }
    setUser(savedUser);
    fetchAllData(savedUser.shop_id || 1);
  }, [router]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: "", type: "success" }), 4000);
  };

  const handleOpenModal = (item: any = null) => {
    if (!item && activeTab === 'options') {
      setEditingItem({ 
        items: [],
        type: 'single', 
        is_required: false,
        status: 'active'
      });
    } else if (!item) {
      setEditingItem({ status: 'active' });
    } else {
      setEditingItem(item);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // ==========================================
  // IMAGE UPLOAD 
  // ==========================================
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) return showToast("ขนาดรูปต้องไม่เกิน 2MB", "error");

    setIsUploading(true);
    try {
      if (!supabaseUrl || !supabaseAnonKey) {
         throw new Error("ยังไม่ได้เชื่อมต่อ Supabase Storage");
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.shop_id || 1}-product-${Date.now()}.${fileExt}`;
      
      const { error: uploadErr } = await supabase.storage.from('products').upload(fileName, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
      setEditingItem({ ...editingItem, image_url: publicUrl });
      showToast("อัปโหลดรูปภาพสำเร็จ", "success");
    } catch (err: any) {
      showToast("อัปโหลดรูปไม่สำเร็จ: " + err.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  // ==========================================
  // SAVE DATA
  // ==========================================
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const method = editingItem.id ? 'PUT' : 'POST';
      let endpoint = `http://localhost:5000/api/${activeTab}`;
      
      if (editingItem.id) {
         endpoint += `/${editingItem.id}`;
      }

      const payload = { ...editingItem, shop_id: user?.shop_id || 1 };

      const res = await fetch(endpoint, { 
        method, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) 
      });

      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
         throw new Error(data.error || data.message || `HTTP Error ${res.status}`);
      }

      showToast("บันทึกข้อมูลเรียบร้อยแล้ว", "success");
      handleCloseModal();
      fetchAllData(user?.shop_id || 1); 
    } catch (error: any) {
      showToast(error.message || "เกิดข้อผิดพลาดในการบันทึก", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // DELETE DATA
  // ==========================================
  const handleDelete = async (id: number) => {
    if(!confirm("คุณต้องการลบรายการนี้ใช่หรือไม่? การเปลี่ยนแปลงนี้ไม่สามารถย้อนกลับได้")) return;
    try {
       const res = await fetch(`http://localhost:5000/api/${activeTab}/${id}`, { method: 'DELETE' });
       const data = await res.json().catch(() => ({}));
       
       if (!res.ok) throw new Error(data.error || data.message || `HTTP Error ${res.status}`);

       showToast("ลบข้อมูลเรียบร้อยแล้ว", "success");
       fetchAllData(user?.shop_id || 1);
    } catch (error: any) {
       showToast(error.message || "ลบข้อมูลไม่สำเร็จ", "error");
    }
  };

  // ==========================================
  // OPTION ITEMS FUNCTIONS
  // ==========================================
  const handleAddOptionItem = () => {
    const newItems = [...(editingItem?.items || []), { name: '', price: 0, status: 'active' }];
    setEditingItem({...editingItem, items: newItems});
  };

  const handleOptionItemChange = (index: number, field: string, value: any) => {
    const newItems = [...(editingItem?.items || [])];
    newItems[index][field] = value;
    setEditingItem({...editingItem, items: newItems});
  };

  const handleRemoveOptionItem = (index: number) => {
    const newItems = [...(editingItem?.items || [])];
    newItems.splice(index, 1);
    setEditingItem({...editingItem, items: newItems});
  };

  // ==========================================
  // PRODUCT OPTIONS BINDING 
  // ==========================================
  const handleOpenProductOptionsModal = async (product: any) => {
    setSelectedProductForOptions(product);
    try {
      const res = await fetch(`http://localhost:5000/api/product_options?product_id=${product.id}`);
      if (res.ok) {
        const data = await res.json();
        setProductSelectedOptions(data.map((d: any) => Number(d.option_group_id)));
      } else {
        setProductSelectedOptions([]);
      }
    } catch (err) {
      setProductSelectedOptions([]);
    }
    setIsProductOptionsModalOpen(true);
  };

  const handleSaveProductOptions = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`http://localhost:5000/api/product_options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: user?.shop_id || 1,
          product_id: selectedProductForOptions.id,
          option_group_ids: productSelectedOptions
        })
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการผูกตัวเลือก");

      showToast("ผูกตัวเลือกสินค้าเรียบร้อยแล้ว", "success");
      setIsProductOptionsModalOpen(false);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // RECIPE FUNCTIONS 
  // ==========================================
  const loadInventoryForRecipe = async (shopId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/inventory/items?shop_id=${shopId}`);
      if(res.ok) {
        setInventoryItems(await res.json());
      }
    } catch(err) { console.error("Load Inventory Error:", err); }
  };

  const fetchRecipeItems = async (productId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/recipes?product_id=${productId}`);
      if(res.ok) {
        const data = await res.json();
        setOriginalRecipeItems(data);
        setEditingRecipeItems(data.map((d: any) => ({...d}))); 
      } else {
        setOriginalRecipeItems([]);
        setEditingRecipeItems([]);
      }
    } catch(err) { 
      setOriginalRecipeItems([]);
      setEditingRecipeItems([]);
    }
  };

  const handleOpenRecipeModal = (product: any) => {
    setSelectedProductForRecipe(product);
    setRecipeSearch("");
    loadInventoryForRecipe(user?.shop_id || 1);
    fetchRecipeItems(product.id);
  };

  const handleSelectIngredientForRecipe = (ing: any) => {
    if (!editingRecipeItems.find(i => i.inventory_item_id === ing.id)) {
       setEditingRecipeItems([...editingRecipeItems, {
          inventory_item_id: ing.id,
          inventory_items: ing,
          quantity: "",
          unit: ing.unit
       }]);
    }
  };

  const handleUpdateRecipeItemQty = (id: number, qty: string) => {
      setEditingRecipeItems(prev => prev.map(item => item.inventory_item_id === id ? { ...item, quantity: qty } : item));
  };

  const handleRemoveRecipeItemLocal = (id: number) => {
      setEditingRecipeItems(prev => prev.filter(item => item.inventory_item_id !== id));
  };

  const handleSaveRecipeBatch = async () => {
    if (!selectedProductForRecipe) return;
    setIsRecipeSaving(true);
    try {
       const payload = {
          shop_id: user?.shop_id || 1,
          items: editingRecipeItems.map(item => ({
             inventory_item_id: item.inventory_item_id,
             quantity: Number(item.quantity),
             unit: item.unit
          }))
       };

       const res = await fetch(`http://localhost:5000/api/products/${selectedProductForRecipe.id}/recipe`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
       });

       const data = await res.json().catch(() => ({}));
       if (!res.ok) throw new Error(data.error || data.message || "เกิดข้อผิดพลาดในการบันทึกสูตร");

       showToast("บันทึกสูตรสินค้าเรียบร้อยแล้ว", "success");
       setSelectedProductForRecipe(null);
    } catch (e: any) {
       showToast(e.message, "error");
    } finally {
       setIsRecipeSaving(false);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  const TABS = [
    { id: "categories", name: "หมวดหมู่สินค้า", icon: ListTree },
    { id: "products", name: "รายการสินค้า", icon: Package },
    { id: "options", name: "ตัวเลือกสินค้า", icon: Settings2 },
    { id: "promotions", name: "โปรโมชั่น", icon: Tag },
  ];

  const getFilteredData = () => {
    let data: any[] = [];
    if (activeTab === "categories") data = categories;
    else if (activeTab === "products") data = products;
    else if (activeTab === "options") data = options;
    else if (activeTab === "promotions") data = promotions;

    data = data.filter(item => {
      const matchSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filters.category ? (item.category_id?.toString() === filters.category) : true;
      const matchStatus = filters.status ? (item.status === filters.status || (!item.status && filters.status === 'active')) : true;
      return matchSearch && matchCat && matchStatus;
    });

    if (activeTab === "products" && filters.price) {
      data = [...data].sort((a, b) => filters.price === 'asc' ? a.price - b.price : b.price - a.price);
    }
    
    return data;
  };

  const filteredData = getFilteredData();

  // Dynamic Add Button Text
  const getAddButtonText = () => {
    if (activeTab === "categories") return "+ เพิ่มหมวดหมู่";
    if (activeTab === "products") return "+ เพิ่มสินค้า";
    if (activeTab === "options") return "+ เพิ่มกลุ่มตัวเลือก";
    if (activeTab === "promotions") return "+ เพิ่มโปรโมชั่น";
    return "+ เพิ่มรายการใหม่";
  };

  // Dynamic Empty State
  const getEmptyStateContent = () => {
    const currentTab = TABS.find(t => t.id === activeTab);
    const Icon = currentTab?.icon || Package;
    
    let title = "";
    if (activeTab === "categories") title = "ยังไม่มีหมวดหมู่";
    else if (activeTab === "products") title = "ยังไม่มีสินค้า";
    else if (activeTab === "options") title = "ยังไม่มีกลุ่มตัวเลือก";
    else if (activeTab === "promotions") title = "ยังไม่มีโปรโมชั่น";

    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-400 font-medium">
         <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Icon className="w-8 h-8 text-gray-400" />
         </div>
         <span className="text-[16px] text-gray-600 mb-1">{title}</span>
         <span className="text-[14px]">กดปุ่มเพิ่มด้านบนเพื่อเริ่มต้น</span>
      </div>
    );
  };

  // Dynamic Modal Title
  const getModalTitle = () => {
    const isEdit = !!editingItem?.id;
    if (activeTab === "categories") return isEdit ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่";
    if (activeTab === "products") return isEdit ? "แก้ไขสินค้า" : "เพิ่มสินค้า";
    if (activeTab === "options") return isEdit ? "แก้ไขกลุ่มตัวเลือก" : "เพิ่มกลุ่มตัวเลือก";
    if (activeTab === "promotions") return isEdit ? "แก้ไขโปรโมชั่น" : "เพิ่มโปรโมชั่น";
    return isEdit ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล";
  };

  return (
    <div className="flex h-screen bg-[#d6d6d6] font-sans overflow-hidden text-gray-800">
      
      {/* 🌟 Sidebar 🌟 */}
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
            <button className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">เมนูและโปรโมชั่น</button>
            <button onClick={() => router.push('/pos/reports')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รายงาน</button>
            <button onClick={() => router.push('/pos/employees')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">พนักงาน</button>
            <button onClick={() => router.push('/pos/settings')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">การตั้งค่า</button>
          </nav>
        </div>
        <button onClick={() => { localStorage.removeItem("userContext"); router.push('/pin'); }} className="py-6 px-6 text-left text-gray-300 border-t border-[#666666] hover:bg-[#666666] transition-colors text-[16px]">กลับสู่หน้า PIN</button>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header */}
        <div className="h-[90px] bg-[#f5f6f8] flex items-center justify-between z-10 shrink-0 w-full px-8 border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-[22px] font-bold text-gray-800">จัดการเมนูและโปรโมชั่น</h2>
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

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6">
          
          <div className="w-[260px] bg-white rounded-[20px] shadow-sm border border-gray-200 p-2 shrink-0 flex flex-col overflow-y-auto no-scrollbar">
             {TABS.map((tab) => {
               const Icon = tab.icon;
               const isActive = activeTab === tab.id;
               return (
                 <button
                   key={tab.id}
                   onClick={() => {
                     setActiveTab(tab.id);
                     setSearchTerm(""); // Reset Search
                     setFilters({ category: "", status: "", price: "" }); // Reset Filters
                   }}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 mb-1 rounded-[12px] text-[15px] font-medium transition-colors ${
                     isActive ? "bg-[#7a5c4e] text-white shadow-sm" : "text-slate-600 hover:bg-gray-50 hover:text-slate-900"
                   }`}
                 >
                   <Icon className="w-5 h-5" />
                   <span>{tab.name}</span>
                 </button>
               );
             })}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
               <div className="flex items-center justify-center h-full">
                 <div className="flex flex-col items-center text-gray-400">
                   <RefreshCw className="w-10 h-10 animate-spin mb-4 text-[#7a5c4e]" />
                   <p className="text-[18px] font-medium">กำลังดึงข้อมูลจากระบบ...</p>
                 </div>
               </div>
            ) : (
              <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
                  
                  {/* Action Header */}
                  <div className="bg-gray-50 border-b border-gray-100 px-8 py-5 flex justify-between items-center shrink-0 flex-wrap gap-4">
                    <div className="flex items-center gap-4 flex-wrap flex-1">
                      <h3 className="text-[18px] font-bold text-gray-800 whitespace-nowrap">
                        {TABS.find(t => t.id === activeTab)?.name}
                      </h3>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Search */}
                        <div className="relative">
                          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                          <input 
                            type="text" 
                            placeholder="ค้นหา..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-gray-300 rounded-full text-[13px] outline-none focus:border-[#7a5c4e] w-48"
                          />
                        </div>

                        {/* Filter หมวดหมู่ (เฉพาะ Tab Products) */}
                        {activeTab === "products" && (
                          <select 
                            value={filters.category} 
                            onChange={e => setFilters({...filters, category: e.target.value})}
                            className="px-4 py-2 border border-gray-300 rounded-full text-[13px] outline-none focus:border-[#7a5c4e] bg-white text-gray-600 h-[38px] cursor-pointer"
                          >
                            <option value="">หมวดหมู่ทั้งหมด</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                        
                        {/* Filter สถานะ */}
                        <select 
                          value={filters.status} 
                          onChange={e => setFilters({...filters, status: e.target.value})}
                          className="px-4 py-2 border border-gray-300 rounded-full text-[13px] outline-none focus:border-[#7a5c4e] bg-white text-gray-600 h-[38px] cursor-pointer"
                        >
                          <option value="">สถานะทั้งหมด</option>
                          <option value="active">เปิดใช้งาน</option>
                          <option value="inactive">ปิดใช้งาน</option>
                        </select>

                        {/* Filter ราคา (เฉพาะ Tab Products) */}
                        {activeTab === "products" && (
                          <select 
                            value={filters.price} 
                            onChange={e => setFilters({...filters, price: e.target.value})}
                            className="px-4 py-2 border border-gray-300 rounded-full text-[13px] outline-none focus:border-[#7a5c4e] bg-white text-gray-600 h-[38px] cursor-pointer"
                          >
                            <option value="">เรียงราคา</option>
                            <option value="asc">น้อยไปมาก</option>
                            <option value="desc">มากไปน้อย</option>
                          </select>
                        )}

                        {activeFiltersCount > 0 && (
                          <button 
                            onClick={() => setFilters({category: '', status: '', price: ''})} 
                            className="text-[12px] font-bold text-red-500 hover:text-red-700 px-2 flex items-center transition-colors"
                          >
                            รีเซ็ต ({activeFiltersCount})
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      {/* View Switch (เฉพาะเมนูรายการสินค้า) */}
                      {activeTab === "products" && (
                        <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                           <button 
                             onClick={() => setViewMode('list')} 
                             className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-[#7a5c4e] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                             title="List View"
                           >
                             <List className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => setViewMode('grid')} 
                             className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-[#7a5c4e] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                             title="Grid View"
                           >
                             <Grid2X2 className="w-4 h-4" />
                           </button>
                           
                           {viewMode === 'grid' && (
                             <div className="flex items-center border-l border-gray-200 ml-1 pl-1 gap-1">
                               <button onClick={() => setGridSize('small')} className={`text-[11px] px-2 py-1 rounded-md transition-colors ${gridSize === 'small' ? 'bg-gray-100 font-bold text-[#7a5c4e]' : 'text-gray-500 hover:bg-gray-50'}`}>เล็ก</button>
                               <button onClick={() => setGridSize('medium')} className={`text-[11px] px-2 py-1 rounded-md transition-colors ${gridSize === 'medium' ? 'bg-gray-100 font-bold text-[#7a5c4e]' : 'text-gray-500 hover:bg-gray-50'}`}>กลาง</button>
                               <button onClick={() => setGridSize('large')} className={`text-[11px] px-2 py-1 rounded-md transition-colors ${gridSize === 'large' ? 'bg-gray-100 font-bold text-[#7a5c4e]' : 'text-gray-500 hover:bg-gray-50'}`}>ใหญ่</button>
                             </div>
                           )}
                        </div>
                      )}

                      <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-6 py-2 bg-[#7a5c4e] text-white rounded-xl font-bold text-[15px] hover:bg-[#684c3f] shadow-sm transition-all whitespace-nowrap">
                         {getAddButtonText()}
                      </button>
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 overflow-y-auto p-4 bg-white">
                    {filteredData.length === 0 ? (
                        getEmptyStateContent()
                    ) : activeTab === 'products' && viewMode === 'grid' ? (
                      <div className={`grid gap-4 ${
                        gridSize === 'small' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' : 
                        gridSize === 'large' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 
                        'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                      }`}>
                        {filteredData.map((item: any) => (
                          <div key={item.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-4 flex flex-col group">
                            <div className="w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 overflow-hidden mb-3 relative shrink-0">
                               {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <ImageIcon className="w-8 h-8 text-gray-300" />}
                               <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border bg-white shadow-sm ${item.status === 'active' || !item.status ? 'text-emerald-600 border-emerald-100' : 'text-gray-400 border-gray-200'}`}>
                                 {item.status === 'active' || !item.status ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                               </span>
                            </div>
                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <h4 className="font-bold text-[15px] text-gray-800 line-clamp-2 leading-tight">{item.name}</h4>
                                <p className="text-[12px] text-gray-400 mt-1">{item.category_name || "-"}</p>
                              </div>
                              <p className="text-[16px] font-black text-[#7a5c4e] mt-2">฿{item.price?.toLocaleString()}</p>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-gray-100 gap-1 mt-3">
                               <div className="flex space-x-1">
                                 <button onClick={() => handleOpenRecipeModal(item)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="จัดการสูตร">
                                   <BookOpen className="w-4 h-4" />
                                 </button>
                                 <button onClick={() => handleOpenProductOptionsModal(item)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="จัดการตัวเลือก">
                                   <Settings2 className="w-4 h-4" />
                                 </button>
                               </div>
                               <div className="flex space-x-1">
                                 <button onClick={() => handleOpenModal(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข">
                                   <Edit3 className="w-4 h-4" />
                                 </button>
                                 <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // ---------------- TABLE VIEW ----------------
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-white sticky top-0 z-10">
                          <tr>
                            {activeTab === "products" && <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200 w-20">รูปภาพ</th>}
                            
                            {activeTab === "options" ? (
                              <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200">ชื่อกลุ่มตัวเลือก</th>
                            ) : (
                              <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200">ชื่อรายการ</th>
                            )}
                            
                            {activeTab === "products" && <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200">หมวดหมู่</th>}
                            {activeTab === "products" && <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200 text-right">ราคา</th>}
                            
                            {activeTab === "categories" && <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200 text-right">จำนวนสินค้า</th>}
                            
                            {activeTab === "options" && <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200">ประเภท</th>}
                            {activeTab === "options" && <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200 text-right">จำนวนรายการ</th>}
                            
                            {activeTab === "promotions" && <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200">รูปแบบส่วนลด</th>}
                            {activeTab === "promotions" && <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200">ระยะเวลา</th>}
                            
                            <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200 text-center">สถานะ</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-gray-400 uppercase border-b border-gray-200 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredData.map((item: any) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                              {activeTab === "products" && (
                                <td className="px-4 py-3">
                                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 overflow-hidden">
                                    {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-gray-400" />}
                                  </div>
                                </td>
                              )}
                              
                              <td className="px-4 py-3 font-bold text-[14px] text-gray-800">{item.name}</td>
                              
                              {activeTab === "products" && <td className="px-4 py-3 text-[14px] text-gray-500">{item.category_name || "-"}</td>}
                              {activeTab === "products" && <td className="px-4 py-3 text-[14px] font-bold text-[#7a5c4e] text-right">฿{item.price?.toLocaleString()}</td>}
                              
                              {activeTab === "categories" && <td className="px-4 py-3 text-[14px] text-gray-500 text-right">{item.item_count || 0} รายการ</td>}
                              
                              {activeTab === "options" && (
                                <td className="px-4 py-3 text-[14px] text-gray-500">
                                  {item.type === 'single' ? 'เลือก 1 รายการ' : item.type === 'multiple' ? 'เลือกหลายรายการ' : 'เพิ่มจำนวน'}
                                </td>
                              )}
                              {activeTab === "options" && (
                                <td className="px-4 py-3 text-[14px] text-gray-500 text-right">{item.items?.length || 0} รายการ</td>
                              )}

                              {activeTab === "promotions" && (
                                <td className="px-4 py-3 text-[14px] font-bold text-[#7a5c4e]">
                                  {item.discount_type === 'percent' ? `ลด ${item.discount_value}%` : `ลด ฿${item.discount_value}`}
                                </td>
                              )}
                              {activeTab === "promotions" && (
                                <td className="px-4 py-3 text-[13px] text-gray-500">
                                  {item.start_date || "-"} ถึง {item.end_date || "-"}
                                </td>
                              )}

                              <td className="px-4 py-3 text-center">
                                 <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase border ${item.status === 'active' || !item.status ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                    {item.status === 'active' || !item.status ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                 </span>
                              </td>

                              <td className="px-4 py-3 text-right">
                                 <div className="flex justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                   {activeTab === "products" && (
                                     <>
                                      <button onClick={() => handleOpenRecipeModal(item)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors" title="จัดการสูตร (Recipe)">
                                        <BookOpen className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => handleOpenProductOptionsModal(item)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors" title="จัดการตัวเลือก">
                                        <Settings2 className="w-4 h-4" />
                                      </button>
                                     </>
                                   )}
                                   <button onClick={() => handleOpenModal(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="แก้ไข">
                                     <Edit3 className="w-4 h-4" />
                                   </button>
                                   <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="ลบ">
                                     <Trash2 className="w-4 h-4" />
                                   </button>
                                 </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================== TOAST ===================== */}
      {toast.show && (
        <div className={`fixed top-10 right-10 px-6 py-4 rounded-xl shadow-lg font-bold text-[15px] text-white transition-all z-[100] animate-in fade-in slide-in-from-top-5 ${toast.type === 'success' ? 'bg-[#7a5c4e]' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* ===================== MODAL (ADD / EDIT) ===================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <h3 className="text-[20px] font-bold text-gray-800">
                {getModalTitle()}
              </h3>
              <button onClick={handleCloseModal} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
               <div>
                 <label className="block text-[14px] font-bold text-gray-700 mb-1.5">
                   {activeTab === 'options' ? 'ชื่อกลุ่มตัวเลือก' : 'ชื่อรายการ'}
                 </label>
                 <input type="text" value={editingItem?.name || ''} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px]" placeholder="ระบุชื่อ..." />
               </div>

               {activeTab === "products" && (
                 <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[14px] font-bold text-gray-700 mb-1.5">หมวดหมู่</label>
                      <select value={editingItem?.category_id || ''} onChange={(e) => setEditingItem({...editingItem, category_id: Number(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px] bg-white">
                        <option value="">เลือกหมวดหมู่</option>
                        {/* ป้องกันการเพิ่มสินค้าในหมวดหมู่ที่ปิดใช้งาน */}
                        {categories.filter(c => c.status === 'active' || c.id === editingItem?.category_id).map(c => <option key={c.id} value={c.id}>{c.name} {c.status !== 'active' ? '(ปิดใช้งาน)' : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[14px] font-bold text-gray-700 mb-1.5">ราคา (บาท)</label>
                      <input type="number" value={editingItem?.price || ''} onChange={(e) => setEditingItem({...editingItem, price: Number(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px]" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[14px] font-bold text-gray-700 mb-1.5">รูปภาพสินค้า</label>
                    <div className="flex gap-4 items-center p-3 border border-gray-200 rounded-xl bg-gray-50/50">
                       {editingItem?.image_url ? (
                          <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden shrink-0 bg-white">
                             <img src={editingItem.image_url} className="w-full h-full object-cover" />
                          </div>
                       ) : (
                          <div className="w-20 h-20 rounded-lg border border-gray-200 flex items-center justify-center bg-white shrink-0">
                             <ImageIcon className="w-6 h-6 text-gray-300" />
                          </div>
                       )}
                       <div className="flex-1 flex flex-col justify-center">
                         <div className="relative inline-block w-fit">
                            <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium shadow-sm">
                               {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                               {isUploading ? 'กำลังอัปโหลด...' : 'เลือกรูปภาพใหม่'}
                            </div>
                         </div>
                         <div className="flex items-center gap-2 mt-3">
                           <input type="text" value={editingItem?.image_url || ''} onChange={(e) => setEditingItem({...editingItem, image_url: e.target.value})} className="flex-1 px-3 py-1.5 rounded-md border border-gray-200 outline-none focus:border-[#7a5c4e] text-[12px] bg-white" placeholder="หรือวาง URL รูปภาพ" />
                         </div>
                       </div>
                    </div>
                  </div>
                 </>
               )}

               {activeTab === "options" && (
                 <>
                  <div>
                    <label className="block text-[14px] font-bold text-gray-700 mb-1.5">คำอธิบาย (ถ้ามี)</label>
                    <input type="text" value={editingItem?.description || ''} onChange={(e) => setEditingItem({...editingItem, description: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px]" placeholder="เช่น เลือกระดับความหวานที่ต้องการ" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[14px] font-bold text-gray-700 mb-1.5">ประเภท</label>
                      <select value={editingItem?.type || 'single'} onChange={(e) => setEditingItem({...editingItem, type: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px] bg-white">
                        <option value="single">เลือก 1 รายการ</option>
                        <option value="multiple">เลือกหลายรายการ</option>
                        <option value="quantity">เพิ่มจำนวน</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[14px] font-bold text-gray-700 mb-1.5">บังคับเลือก (Required)</label>
                      <select value={editingItem?.is_required ? 'yes' : 'no'} onChange={(e) => setEditingItem({...editingItem, is_required: e.target.value === 'yes'})} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px] bg-white">
                        <option value="yes">ใช่ (บังคับเลือก)</option>
                        <option value="no">ไม่ใช่ (ไม่บังคับ)</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Option Items List (Redesigned as Table) */}
                  <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <div className="flex justify-between items-center p-3 bg-gray-50 border-b border-gray-200">
                      <label className="block text-[14px] font-bold text-gray-700">รายการตัวเลือก</label>
                      <button type="button" onClick={handleAddOptionItem} className="text-[12px] text-[#7a5c4e] font-bold flex items-center gap-1 bg-white border border-[#7a5c4e] px-3 py-1.5 rounded-lg hover:bg-[#7a5c4e] hover:text-white transition-colors">
                        <Plus className="w-3 h-3"/> เพิ่มตัวเลือก
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-white border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-[12px] font-bold text-gray-500">ชื่อตัวเลือก</th>
                            <th className="px-3 py-2 text-[12px] font-bold text-gray-500 w-[100px]">ราคาเพิ่ม</th>
                            <th className="px-3 py-2 text-[12px] font-bold text-gray-500 w-[100px]">สถานะ</th>
                            <th className="px-3 py-2 text-[12px] font-bold text-gray-500 w-[50px] text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(editingItem?.items || []).map((optItem: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-2 py-2">
                                <input type="text" placeholder="ชื่อ..." value={optItem.name} onChange={(e) => handleOptionItemChange(idx, 'name', e.target.value)} className="w-full px-2 py-1.5 rounded-md border border-gray-200 outline-none focus:border-[#7a5c4e] text-[13px]" />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" placeholder="+0" value={optItem.price} onChange={(e) => handleOptionItemChange(idx, 'price', Number(e.target.value))} className="w-full px-2 py-1.5 rounded-md border border-gray-200 outline-none focus:border-[#7a5c4e] text-[13px] text-center" />
                              </td>
                              <td className="px-2 py-2">
                                <select value={optItem.status} onChange={(e) => handleOptionItemChange(idx, 'status', e.target.value)} className="w-full px-1 py-1.5 rounded-md border border-gray-200 outline-none focus:border-[#7a5c4e] text-[13px] bg-white">
                                  <option value="active">เปิด</option>
                                  <option value="inactive">ปิด</option>
                                </select>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <button type="button" onClick={() => handleRemoveOptionItem(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {!(editingItem?.items?.length) && (
                            <tr>
                              <td colSpan={4} className="text-center py-6 text-gray-400 text-[13px]">
                                ยังไม่มีรายการตัวเลือก
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                 </>
               )}

               {activeTab === "promotions" && (
                 <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[14px] font-bold text-gray-700 mb-1.5">รูปแบบส่วนลด</label>
                      <select value={editingItem?.discount_type || 'percent'} onChange={(e) => setEditingItem({...editingItem, discount_type: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px] bg-white">
                        <option value="percent">เปอร์เซ็นต์ (%)</option>
                        <option value="amount">จำนวนเงิน (บาท)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[14px] font-bold text-gray-700 mb-1.5">มูลค่าที่ลด</label>
                      <input type="number" value={editingItem?.discount_value || ''} onChange={(e) => setEditingItem({...editingItem, discount_value: Number(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[14px] font-bold text-gray-700 mb-1.5">วันที่เริ่มต้น</label>
                      <input type="date" value={editingItem?.start_date || ''} onChange={(e) => setEditingItem({...editingItem, start_date: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px]" />
                    </div>
                    <div>
                      <label className="block text-[14px] font-bold text-gray-700 mb-1.5">วันที่สิ้นสุด</label>
                      <input type="date" value={editingItem?.end_date || ''} onChange={(e) => setEditingItem({...editingItem, end_date: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px]" />
                    </div>
                  </div>
                 </>
               )}

               <div>
                 <label className="block text-[14px] font-bold text-gray-700 mb-1.5">สถานะการใช้งาน</label>
                 <select value={editingItem?.status || 'active'} onChange={(e) => setEditingItem({...editingItem, status: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-[#7a5c4e] text-[14px] bg-white">
                   <option value="active">เปิดใช้งาน</option>
                   <option value="inactive">ปิดใช้งาน</option>
                 </select>
               </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end bg-gray-50 rounded-b-[24px] shrink-0">
              <button onClick={handleCloseModal} className="px-6 py-2.5 bg-white border border-gray-300 rounded-xl font-bold text-[14px] text-gray-700 hover:bg-gray-100 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={isSaving || isUploading || !editingItem?.name} className="flex items-center gap-2 px-6 py-2.5 bg-[#7a5c4e] text-white rounded-xl font-bold text-[14px] hover:bg-[#684c3f] transition-colors shadow-sm disabled:opacity-50">
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PRODUCT OPTIONS MODAL ===================== */}
      {isProductOptionsModalOpen && selectedProductForOptions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-[500px] rounded-[24px] shadow-2xl flex flex-col max-h-[85vh]">
            <div className="bg-white px-6 py-5 border-b border-gray-100 flex justify-between items-center rounded-t-[24px] shrink-0">
              <div>
                <h3 className="text-[18px] font-bold text-gray-800 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-[#7a5c4e]"/> จัดการตัวเลือกสินค้า
                </h3>
                <div className="text-[13px] text-gray-500 mt-1 flex items-center gap-1">
                  เมนู: <span className="font-bold text-[#7a5c4e]">{selectedProductForOptions.name}</span>
                </div>
              </div>
              <button onClick={() => setIsProductOptionsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
              <label className="block text-[14px] font-bold text-gray-700 mb-3">เลือกกลุ่มตัวเลือกที่ต้องการใช้งานกับสินค้านี้</label>
              <div className="space-y-3">
                {(() => {
                  // กรองเฉพาะ Option ที่เปิดใช้งานอยู่ หรือ เป็นตัวเลือกที่เคยถูกผูกไว้แล้ว
                  const visibleOptions = options.filter(opt => opt.status === 'active' || productSelectedOptions.includes(Number(opt.id)));
                  
                  if (visibleOptions.length === 0) {
                    return (
                      <div className="text-center text-gray-400 py-8 bg-white rounded-xl border border-dashed border-gray-200">
                         <Settings2 className="w-8 h-8 mx-auto mb-2 text-gray-300"/>
                         <span className="text-[13px]">ยังไม่มีกลุ่มตัวเลือกในระบบ<br/>เพิ่มที่เมนู "ตัวเลือกสินค้า" ก่อน</span>
                      </div>
                    );
                  }

                  return visibleOptions.map((opt: any) => {
                    const isActive = opt.status === 'active';
                    return (
                    <label key={opt.id} className={`flex items-start p-4 border rounded-xl transition-all shadow-sm group ${isActive ? 'bg-white border-gray-200 cursor-pointer hover:border-[#7a5c4e]/50' : 'bg-gray-100 border-gray-200 opacity-70'}`}>
                      <div className="pt-0.5 mr-3">
                        <input 
                          type="checkbox" 
                          disabled={!isActive && !productSelectedOptions.includes(Number(opt.id))} // ป้องกันการเลือกใหม่ถ้ามันปิดใช้งานแล้ว
                          className={`w-4 h-4 rounded border-gray-300 focus:ring-[#7a5c4e] ${isActive ? 'text-[#7a5c4e] cursor-pointer' : 'text-gray-400 cursor-not-allowed'}`}
                          checked={productSelectedOptions.includes(Number(opt.id))}
                          onChange={(e) => {
                            if (e.target.checked) setProductSelectedOptions([...productSelectedOptions, Number(opt.id)]);
                            else setProductSelectedOptions(productSelectedOptions.filter(id => id !== Number(opt.id)));
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold text-[14px] ${isActive ? 'text-gray-800 group-hover:text-[#7a5c4e]' : 'text-gray-500'} transition-colors`}>{opt.name}</span>
                          {opt.is_required && <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-bold uppercase border border-red-100">บังคับ</span>}
                          {!isActive && <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 text-[10px] font-bold uppercase border border-gray-300">ปิดใช้งาน</span>}
                        </div>
                        <div className="text-[12px] text-gray-500 flex items-center gap-2">
                          <span>{opt.type === 'single' ? 'เลือก 1 รายการ' : opt.type === 'multiple' ? 'เลือกหลายรายการ' : 'เพิ่มจำนวน'}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                          <span>{opt.items?.length || 0} ตัวเลือก</span>
                        </div>
                      </div>
                    </label>
                  )});
                })()}
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex gap-3 justify-end bg-white rounded-b-[24px] shrink-0">
              <button onClick={() => setIsProductOptionsModalOpen(false)} className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-[14px] text-gray-600 hover:bg-gray-50 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleSaveProductOptions} disabled={isSaving} className="flex items-center gap-2 px-6 py-2.5 bg-[#7a5c4e] text-white rounded-xl font-bold text-[14px] hover:bg-[#684c3f] transition-colors shadow-sm disabled:opacity-50">
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกการผูกตัวเลือก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: ผูกสูตรสินค้า (Recipe แบบ Atomic)
      ========================================== */}
      {selectedProductForRecipe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-[1000px] h-[85vh] rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            
            <div className="h-[80px] px-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-50 overflow-hidden border border-gray-200 flex items-center justify-center shrink-0">
                  {selectedProductForRecipe.image_url ? <img src={selectedProductForRecipe.image_url} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-gray-300" />}
                </div>
                <div>
                  <h2 className="text-[18px] font-bold text-gray-800 flex items-center gap-2">จัดการสูตรสินค้า <ChevronRight className="w-4 h-4 text-gray-400"/> <span className="text-[#7a5c4e]">{selectedProductForRecipe.name}</span></h2>
                  <p className="text-[13px] text-gray-500 mt-0.5">กำหนดวัตถุดิบและบรรจุภัณฑ์ที่ใช้ต่อ 1 หน่วยขาย</p>
                </div>
              </div>
              <button onClick={() => setSelectedProductForRecipe(null)} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              <div className="w-[40%] border-r border-gray-200 bg-gray-50 flex flex-col">
                <div className="p-4 border-b border-gray-200 shrink-0 bg-white">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="ค้นหาวัตถุดิบหรือบรรจุภัณฑ์..." 
                      value={recipeSearch} 
                      onChange={(e) => setRecipeSearch(e.target.value)} 
                      className="w-full h-[42px] pl-9 pr-4 rounded-xl border border-gray-300 outline-none focus:border-[#7a5c4e] text-[13px]" 
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  <div>
                    <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Droplets className="w-4 h-4"/> วัตถุดิบ</h3>
                    <div className="space-y-2">
                      {/* ป้องกันเพิ่มวัตถุดิบที่ปิดใช้งานเข้าไปในสูตรใหม่ */}
                      {inventoryItems.filter(i => (!i.type || i.type === 'raw_material') && i.status === 'active' && i.name.toLowerCase().includes(recipeSearch.toLowerCase())).map(ing => (
                        <div key={ing.id} onClick={() => handleSelectIngredientForRecipe(ing)} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 cursor-pointer hover:border-[#7a5c4e] hover:shadow-sm transition-all group">
                          <div>
                            <div className="font-bold text-[13px] text-gray-800 group-hover:text-[#7a5c4e] transition-colors">{ing.name}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">ต้นทุน ฿{ing.cost} / {ing.unit}</div>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-[#7a5c4e] group-hover:bg-[#7a5c4e]/10 transition-colors"><Plus className="w-4 h-4" /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Box className="w-4 h-4"/> บรรจุภัณฑ์</h3>
                    <div className="space-y-2">
                      {/* ป้องกันเพิ่มบรรจุภัณฑ์ที่ปิดใช้งานเข้าไปในสูตรใหม่ */}
                      {inventoryItems.filter(i => i.type === 'packaging' && i.status === 'active' && i.name.toLowerCase().includes(recipeSearch.toLowerCase())).map(ing => (
                        <div key={ing.id} onClick={() => handleSelectIngredientForRecipe(ing)} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 cursor-pointer hover:border-[#7a5c4e] hover:shadow-sm transition-all group">
                          <div>
                            <div className="font-bold text-[13px] text-gray-800 group-hover:text-[#7a5c4e] transition-colors">{ing.name}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">ต้นทุน ฿{ing.cost} / {ing.unit}</div>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-[#7a5c4e] group-hover:bg-[#7a5c4e]/10 transition-colors"><Plus className="w-4 h-4" /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col bg-white">
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                     <h3 className="text-[15px] font-bold text-gray-800">รายการในสูตร ({editingRecipeItems.length})</h3>
                  </div>
                  
                  {editingRecipeItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
                      <BookOpen className="w-10 h-10 mb-3 text-gray-200" />
                      <p className="font-bold text-[14px] text-gray-500 mb-1">ยังไม่มีรายการในสูตร</p>
                      <p className="text-[12px]">คลิกเลือกวัตถุดิบหรือบรรจุภัณฑ์จากด้านซ้ายเพื่อเพิ่ม</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr>
                             <th className="pb-2 text-[12px] font-bold text-gray-400 uppercase">ชื่อรายการ</th>
                             <th className="pb-2 text-[12px] font-bold text-gray-400 uppercase text-center w-[120px]">ปริมาณ/หน่วยขาย</th>
                             <th className="pb-2 text-[12px] font-bold text-gray-400 uppercase text-right w-[80px]">รวม (฿)</th>
                             <th className="pb-2 text-[12px] font-bold text-gray-400 uppercase text-center w-[40px]"></th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                          {editingRecipeItems.map((item, idx) => (
                             <tr key={idx} className="group">
                                <td className="py-3 pr-2">
                                   <div className="font-bold text-[14px] text-gray-800">{item.inventory_items?.name}</div>
                                   <div className="text-[11px] text-gray-500">฿{item.inventory_items?.cost}/{item.inventory_items?.unit}</div>
                                </td>
                                <td className="py-3 px-2">
                                   <div className="flex items-center justify-center gap-1.5">
                                      <input 
                                         type="number" 
                                         value={item.quantity} 
                                         onChange={(e) => handleUpdateRecipeItemQty(item.inventory_item_id, e.target.value)} 
                                         className="w-16 h-8 text-center border border-gray-300 rounded-md outline-none focus:border-[#7a5c4e] font-bold text-[13px] bg-gray-50" 
                                         placeholder="0"
                                      />
                                      <span className="text-[12px] text-gray-500 w-8">{item.unit}</span>
                                   </div>
                                </td>
                                <td className="py-3 pl-2 text-right font-bold text-gray-800 text-[14px]">
                                   {(Number(item.quantity || 0) * Number(item.inventory_items?.cost || 0)).toFixed(2)}
                                </td>
                                <td className="py-3 text-center">
                                   <button onClick={() => handleRemoveRecipeItemLocal(item.inventory_item_id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                                      <Trash2 className="w-4 h-4" />
                                   </button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                  )}
                </div>

                {/* Recipe Summary */}
                <div className="p-6 bg-gray-50 border-t border-gray-200 shrink-0">
                  <div className="grid grid-cols-3 gap-4">
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">ต้นทุนสูตร</span>
                        <span className="text-[20px] font-black text-gray-800">฿{editingRecipeItems.reduce((s, i) => s + (Number(i.quantity||0) * Number(i.inventory_items?.cost||0)), 0).toFixed(2)}</span>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">ราคาขาย</span>
                        <span className="text-[20px] font-black text-green-600">฿{selectedProductForRecipe.price || 0}</span>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Margin</span>
                        <span className={`text-[20px] font-black ${selectedProductForRecipe.price > 0 && (((selectedProductForRecipe.price - editingRecipeItems.reduce((s, i) => s + (Number(i.quantity||0) * Number(i.inventory_items?.cost||0)), 0)) / selectedProductForRecipe.price) * 100) > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                           {selectedProductForRecipe.price > 0 ? (((selectedProductForRecipe.price - editingRecipeItems.reduce((s, i) => s + (Number(i.quantity||0) * Number(i.inventory_items?.cost||0)), 0)) / selectedProductForRecipe.price) * 100).toFixed(1) : 0}%
                        </span>
                     </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setSelectedProductForRecipe(null)} className="flex-1 py-3.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-[14px] hover:bg-gray-100 transition-colors shadow-sm">ยกเลิก</button>
                    <button onClick={handleSaveRecipeBatch} disabled={isRecipeSaving} className="flex-1 py-3.5 bg-[#7a5c4e] text-white rounded-xl font-bold text-[14px] hover:bg-[#684c3f] transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
                      {isRecipeSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึกสูตร
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}