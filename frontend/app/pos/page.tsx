"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import NotificationBell from "../components/NotificationBell";
import { Search, Plus, Trash2, ArrowLeft, X, AlertCircle } from "lucide-react"; 

export default function POSPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isShiftChecking, setIsShiftChecking] = useState(true);
  const [view, setView] = useState<'pos' | 'payment' | 'success'>('pos');

  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  // Option Group ของเมนู
  const [allOptions, setAllOptions] = useState<any[]>([]);
  const [currentProductOptions, setCurrentProductOptions] = useState<any[]>([]);
  const [selectedDynamicOptions, setSelectedDynamicOptions] = useState<any>({});

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [billNumber, setBillNumber] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [orderType, setOrderType] = useState("ทานที่ร้าน");

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [itemDetails, setItemDetails] = useState({ quantity: 1, note: "" });

  const [paymentMethod, setPaymentMethod] = useState("");
  const [paidAmountStr, setPaidAmountStr] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const paymentSubmissionRef = useRef(false);

  // ==========================================
  // Helper: ฟังก์ชันป้องกัน Error JSON เวลา API ล่ม/หาไม่เจอ
  // ==========================================
  const safeFetchJson = async (url: string, options?: any) => {
    try {
      const res = await fetch(url, options);
      if (!res.ok) return null;
      const text = await res.text();
      try {
        return text ? JSON.parse(text) : null;
      } catch (e) {
        return null;
      }
    } catch (error) {
      console.error(`Fetch Error [${url}]:`, error);
      return null;
    }
  };

  const fetchNextBillNumber = async (shopId: number, shiftId: number) => {
    const data = await safeFetchJson(`http://localhost:5000/api/next-bill-number?shop_id=${shopId}&shift_id=${shiftId}`);
    if (data) setBillNumber(data.billCode || "");
  };

  useEffect(() => {
    const savedUserRaw = localStorage.getItem("userContext");
    if (!savedUserRaw || savedUserRaw === "undefined" || savedUserRaw === "null") {
      router.push("/pin");
      return;
    }
    const savedUser = JSON.parse(savedUserRaw);
    setUser(savedUser);
    const currentShopId = savedUser.shop_id;

    if (!currentShopId) {
      alert("ไม่พบข้อมูลร้านของบัญชีนี้");
      router.push("/pin");
      return;
    }

    // ตรวจสอบกะการขาย (Active Shift)
    safeFetchJson(`http://localhost:5000/api/shifts/active?shop_id=${currentShopId}`)
      .then(data => {
        if (data && data.shift) {
          setActiveShift(data.shift);
          fetchNextBillNumber(currentShopId, data.shift.id);
          
          safeFetchJson(`http://localhost:5000/api/settings?shop_id=${currentShopId}`)
            .then(res => { if (res) setShopSettings(res); });

          safeFetchJson(`http://localhost:5000/api/payment-methods?shop_id=${currentShopId}`)
            .then(res => {
              if (Array.isArray(res)) {
                const enabledMethods = res.filter(m => m.is_enabled).sort((a, b) => a.display_order - b.display_order);
                setPaymentMethods(enabledMethods);
                if (enabledMethods.length > 0) setPaymentMethod(enabledMethods[0].name); 
              }
            });

          safeFetchJson(`http://localhost:5000/api/categories?shop_id=${currentShopId}`)
            .then(res => {
              if (Array.isArray(res)) {
                setCategories(res);
                if (res.length > 0) setSelectedCategory(res[0].id);
              }
            });
            
          // โหลด Option Groups ทั้งหมด
          safeFetchJson(`http://localhost:5000/api/options?shop_id=${currentShopId}`)
            .then(res => { if (Array.isArray(res)) setAllOptions(res); });
        }
      })
      .finally(() => setIsShiftChecking(false));
  }, [router]);

  useEffect(() => {
    if (!user?.shop_id || !selectedCategory || !activeShift || view !== 'pos') return;
    safeFetchJson(`http://localhost:5000/api/products?shop_id=${user.shop_id}&category_id=${selectedCategory}`)
      .then(data => {
        if (Array.isArray(data)) setProducts(data);
      });
  }, [selectedCategory, user, activeShift, view]);

  // ==========================================
  // ดึง Options เฉพาะของสินค้านั้นขึ้นมาแสดง (แก้ไข Type Mismatch แล้ว)
  // ==========================================
  const openItemModal = async (product: any) => {
    setSelectedProduct(product);
    setItemDetails({ quantity: 1, note: "" });
    setCurrentProductOptions([]);
    setSelectedDynamicOptions({});

    // ดึง Option Groups ทั้งหมดมาเผื่อไว้ก่อน (กรณีตอนโหลดหน้าเว็บแล้ว AllOptions โหลดไม่ทัน)
    let currentAllOpts = allOptions;
    if (currentAllOpts.length === 0) {
      const optsData = await safeFetchJson(`http://localhost:5000/api/options?shop_id=${user.shop_id}`);
      if (optsData && Array.isArray(optsData)) {
        setAllOptions(optsData);
        currentAllOpts = optsData;
      }
    }

    // ดึงข้อมูลการผูก (Binding)
    const data = await safeFetchJson(`http://localhost:5000/api/product_options?product_id=${product.id}`);
    
    if (data && Array.isArray(data)) {
      // แปลง ID ให้เป็น String ทั้งหมด ป้องกันปัญหา 1 !== "1"
      const mappedGroupIds = data.map((d: any) => String(d.option_group_id));
      
      const productOpts = currentAllOpts.filter(opt => mappedGroupIds.includes(String(opt.id)));
      
      const initialSelections: any = {};
      productOpts.forEach(group => {
         // Auto-select รายการแรก สำหรับตัวเลือกแบบ single
         if (group.type === 'single' && group.items && group.items.length > 0) {
             initialSelections[group.id] = [group.items[0]];
         } else {
             initialSelections[group.id] = [];
         }
      });

      setCurrentProductOptions(productOpts);
      setSelectedDynamicOptions(initialSelections);
    }
  };

  const handleOptionSelect = (group: any, item: any, isChecked: boolean) => {
    setSelectedDynamicOptions((prev: any) => {
       const current = prev[group.id] || [];
       if (group.type === 'single') {
           return { ...prev, [group.id]: [item] };
       } else if (group.type === 'multiple') {
           if (isChecked) {
               return { ...prev, [group.id]: [...current, item] };
           } else {
               return { ...prev, [group.id]: current.filter((i: any) => i.name !== item.name) };
           }
       }
       return prev;
    });
  };

  const addToCart = () => {
    let optionsPrice = 0;
    let optionsTextArr: string[] = [];

    Object.keys(selectedDynamicOptions).forEach(groupId => {
       const items = selectedDynamicOptions[groupId];
       items.forEach((item: any) => {
          optionsPrice += Number(item.price || 0);
          optionsTextArr.push(`${item.name}${Number(item.price) > 0 ? '(+'+item.price+')' : ''}`);
       });
    });

    const finalPrice = Number(selectedProduct.price) + optionsPrice;
    const optionsText = optionsTextArr.join(', ');

    setCart((prev) => {
      const existingItem = prev.find(item =>
        item.id === selectedProduct.id && 
        item.optionsText === optionsText && 
        item.note === itemDetails.note
      );
      
      if (existingItem) {
        return prev.map(item => item === existingItem ? { ...item, quantity: item.quantity + itemDetails.quantity } : item);
      }
      
      return [...prev, {
        ...selectedProduct, 
        cartId: Date.now(), 
        quantity: itemDetails.quantity, 
        price: finalPrice,
        optionsText: optionsText,
        note: itemDetails.note
      }];
    });
    setSelectedProduct(null);
  };

  const removeItemFromCart = (cartId: number) => {
    if (shopSettings?.require_reason_delete_item) {
      const reason = prompt("กรุณาระบุเหตุผลที่ลบรายการนี้:");
      if (!reason) return; 
    }
    setCart((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  const calculateTotal = () => {
    let subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
    if (shopSettings?.vat_enabled && shopSettings?.prices_include_vat === false) {
      const vatAmount = subtotal * (Number(shopSettings.vat_rate) / 100);
      return subtotal + vatAmount;
    }
    return subtotal;
  };

  const totalPrice = calculateTotal();

  const handleKeypad = (val: string) => {
    if (val === "C") setPaidAmountStr("");
    else if (val === "<") setPaidAmountStr(paidAmountStr.slice(0, -1));
    else if (val === ".") {
      if (!paidAmountStr.includes(".")) setPaidAmountStr(prev => prev === "" ? "0." : prev + val);
    }
    else setPaidAmountStr(prev => prev === "0" ? val : prev + val);
  };

  const paidAmountInput = parseFloat(paidAmountStr || "0");
  const selectedPaymentConfig = paymentMethods.find(m => m.name === paymentMethod);
  const isCash = selectedPaymentConfig?.type === 'CASH' || paymentMethod === 'เงินสด';
  const displayPaidAmount = isCash ? paidAmountInput : Math.max(paidAmountInput, totalPrice);
  const changeAmount = Math.max(0, displayPaidAmount - totalPrice);
  const remainingAmount = Math.max(0, totalPrice - displayPaidAmount);

  const confirmPayment = async () => {
    if (paymentSubmissionRef.current) return;
    if (!activeShift) return alert("ไม่พบรอบการขายที่ใช้งานอยู่");
    if (displayPaidAmount < totalPrice && isCash) {
        return alert("จำนวนเงินไม่เพียงพอ!");
    }

    paymentSubmissionRef.current = true;
    setIsSubmittingPayment(true);
    
    try {
      const response = await fetch("http://localhost:5000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            shop_id: user.shop_id, 
            staff_id: user.id, 
            shift_id: activeShift.id,
            order_type: orderType, 
            total_amount: totalPrice, 
            payment_method: paymentMethod, 
            received_amount: displayPaidAmount,
            change_amount: changeAmount,
            cart: cart 
        })
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { success: false, error: "ระบบขัดข้อง (Response ไม่ใช่ JSON)" };
      }

      if (response.ok && data.success) {
        setBillNumber(data.billNumber || "");
        setView('success');
      } else {
        alert("เกิดข้อผิดพลาด: " + (data.error || "Unknown Error"));
        if (data.error && data.error.includes("รอบการขายนี้ถูกปิดแล้ว")) router.push('/pos/shifts');
      }
    } catch (error) { 
        alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); 
    } finally {
      paymentSubmissionRef.current = false;
      setIsSubmittingPayment(false);
    }
  };

  const finishTransaction = () => {
    setCart([]); 
    setPaidAmountStr(""); 
    if (paymentMethods.length > 0) setPaymentMethod(paymentMethods[0].name);
    fetchNextBillNumber(user.shop_id, activeShift?.id); 
    setView('pos');
  };

  return (
    <div className="flex h-screen bg-[#d6d6d6] font-sans overflow-hidden">

      <div className="w-[240px] bg-[#4d4d4d] text-white flex flex-col justify-between shrink-0 shadow-lg z-20">
      <div>
        <div className="h-[90px] flex items-center justify-center gap-3 translate-x-3">
          <h1 className="text-[36px] font-black italic tracking-widest text-white">POS</h1>
          <NotificationBell />
        </div>
        <nav className="sidebar-menu flex flex-col text-[16px]">
          <button className="py-5 px-6 text-left font-medium border-b border-[#666666] transition-colors bg-[#666666] border-l-4 border-l-white">สั่งและชำระเงิน</button>
          <button onClick={() => router.push('/pos/history')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">ประวัติใบเสร็จ</button>
          <button onClick={() => router.push('/pos/inventory')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">สินค้าคงคลัง</button>
          <button onClick={() => router.push('/pos/shifts')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รอบการขาย</button>
          <button onClick={() => router.push('/pos/menu')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">เมนูและโปรโมชั่น</button>
          <button onClick={() => router.push('/pos/reports')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">รายงาน</button>
          <button onClick={() => router.push('/pos/employees')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">พนักงาน</button>
          <button onClick={() => router.push('/pos/settings')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">การตั้งค่า</button>
        </nav>
      </div>
      <button onClick={() => router.push('/pin')} className="py-6 px-6 text-left text-gray-300 border-t border-[#666666] hover:bg-[#666666] transition-colors text-[16px]">กลับสู่หน้า PIN</button>
    </div>

      {isShiftChecking ? (
        <div className="flex-1 bg-[#f5f6f8] flex items-center justify-center">
            <span className="text-gray-400 font-bold text-lg">กำลังตรวจสอบสถานะการขาย...</span>
        </div>
      ) : !activeShift ? (
        <div className="flex-1 bg-[#f5f6f8] flex flex-col items-center justify-center p-6">
             <div className="bg-white rounded-[32px] shadow-sm border border-gray-200 p-12 text-center flex flex-col items-center w-[480px]">
                 <AlertCircle className="w-20 h-20 text-gray-300 mb-6"/>
                 <h2 className="text-2xl font-bold text-gray-800 mb-2">ยังไม่ได้เปิดรอบการขาย</h2>
                 <p className="text-gray-500 mb-8">กรุณาเปิดกะก่อนเริ่มต้นทำรายการสั่งซื้อ เพื่อให้ระบบบันทึกยอดขายได้อย่างถูกต้อง</p>
                 <button onClick={()=>router.push('/pos/shifts')} className="w-full py-4 bg-[#7a5c4e] text-white rounded-xl font-bold text-lg hover:bg-[#684c3f] transition-all shadow-sm">
                   ไปที่หน้ารอบการขาย
                 </button>
             </div>
        </div>
      ) : (
        <>
          {view === 'pos' && (
            <div className="flex-1 flex flex-col min-w-0">
              <div className="h-[90px] bg-[#f5f6f8] flex items-center z-10 shrink-0 w-full px-6 gap-6 border-b border-gray-200 shadow-sm">
                <div className="flex-1 flex items-center overflow-hidden">
                  <div className="flex w-full gap-3 overflow-x-auto no-scrollbar items-center">
                    <button onClick={() => setSelectedCategory("promo")} className={`shrink-0 px-6 py-2.5 rounded-full text-[15px] font-bold border-2 ${selectedCategory === "promo" ? "bg-[#e74c3c] text-white border-[#e74c3c]" : "bg-white text-[#e74c3c] border-[#e74c3c]"}`}>โปรโมชั่น</button>
                    <div className="w-[2px] h-8 bg-gray-300 rounded-full mx-1 shrink-0"></div>
                    {categories.map((cat) => (
                      <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-7 py-2.5 rounded-full text-[15px] font-medium border ${selectedCategory === cat.id ? "bg-[#4d4d4d] text-white" : "bg-white text-gray-600 border-gray-200"}`}>{cat.name}</button>
                    ))}
                  </div>
                </div>
                <div className="w-[380px] flex items-center justify-center shrink-0">
                  <div className="flex w-full items-center border border-gray-200 rounded-full bg-white overflow-hidden shadow-sm h-[48px]">
                    <div className="flex-1 flex items-center justify-center gap-1.5 px-2">
                      <span className="text-red-500 font-medium text-[15px]">{billNumber}</span>
                      <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="bg-transparent outline-none text-[15px] text-gray-700 cursor-pointer">
                        <option value="ทานที่ร้าน">ทานที่ร้าน</option>
                        <option value="กลับบ้าน">กลับบ้าน</option>
                      </select>
                    </div>
                    <div className="w-[1px] h-6 bg-gray-200 shrink-0"></div>
                    <button onClick={() => {
                      if (cart.length > 0 && shopSettings?.require_reason_cancel_bill) {
                        const reason = prompt("กรุณาระบุเหตุผลที่ยกเลิกบิล:");
                        if (!reason) return;
                      }
                      setCart([]);
                    }} className="w-[100px] h-full flex items-center justify-center bg-white text-gray-700 hover:bg-gray-50 transition-colors">ยกเลิกบิล</button>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex p-6 pt-2 overflow-hidden gap-6">

                <div className="flex-1 overflow-y-auto pr-2 pb-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {products.map((product) => (
                      <div key={product.id} onClick={() => openItemModal(product)} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-md active:scale-[0.98] cursor-pointer flex flex-col aspect-square">
                        <div className="flex-1 min-h-0 bg-[#d9d9d9] flex items-center justify-center relative">
                          {product.image_url ? <img src={product.image_url} className="w-full h-full object-cover" /> : <div className="text-gray-400 font-bold">ไม่มีรูปภาพ</div>}
                        </div>
                        <div className="h-[45px] shrink-0 bg-[#a6a6a6] flex items-center justify-center px-4 border-t border-gray-200">
                          <span className="text-black font-medium text-[15px] truncate w-full text-center">{product.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-[380px] flex flex-col shrink-0">
                  <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 mb-4 overflow-hidden flex flex-col">
                    <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex justify-between text-[13px] font-bold text-gray-500">
                      <span>รายการสินค้า</span><span>ราคา (฿)</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      {cart.map((item) => (
                        <div key={item.cartId} className="flex flex-col px-3 py-3 hover:bg-gray-50 rounded-lg border-b border-dashed border-gray-100 last:border-0 relative group">
                          <div className="flex justify-between items-start mb-1 pr-6">
                            <div className="flex flex-col">
                              <span className="text-[15px] font-bold text-gray-800">{item.name} x {item.quantity}</span>
                              {item.optionsText && <span className="text-[12px] text-gray-500">{item.optionsText}</span>}
                              {item.note && <span className="text-[12px] text-orange-500">หมายเหตุ: {item.note}</span>}
                            </div>
                            <span className="text-[15px] font-bold text-gray-800">{(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <button onClick={() => removeItemFromCart(item.cartId)} className="absolute right-3 top-3 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      {cart.length === 0 && <div className="flex items-center justify-center h-full text-gray-400">ยังไม่มีรายการสั่งซื้อ</div>}
                    </div>
                    {shopSettings?.vat_enabled && cart.length > 0 && (
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-between text-[13px] text-gray-600">
                        <span>{shopSettings.prices_include_vat ? 'ราคารวม VAT แล้ว' : 'ภาษีมูลค่าเพิ่ม (' + shopSettings.vat_rate + '%)'}</span>
                        <span>{shopSettings.prices_include_vat ? '' : '+'}{(totalPrice - cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 mb-3">
                    <button className="flex-1 py-3 bg-white border border-gray-200 rounded-xl font-bold shadow-sm">สั่งค้างไว้</button>
                    <button disabled={!shopSettings?.allow_discounts} className="flex-1 py-3 bg-white border border-gray-200 rounded-xl font-bold shadow-sm disabled:opacity-50 disabled:bg-gray-100">โปรโมชั่น</button>
                  </div>
                  <button onClick={() => { if (cart.length === 0) return alert('กรุณาเลือกสินค้าก่อน'); setView('payment'); }} className="w-full py-4 bg-[#7a5c4e] text-white rounded-xl text-[18px] font-bold hover:bg-[#684c3f] shadow-md transition-all">
                    ชำระเงิน {totalPrice > 0 ? totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedProduct && view === 'pos' && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[24px] w-full max-w-md p-6 relative shadow-2xl animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                
                <div className="flex justify-between items-start mb-4 shrink-0">
                  <h3 className="text-[20px] font-bold text-gray-800">{selectedProduct.name}</h3>
                  <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-black">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex justify-between items-center text-[18px] border-b border-gray-200 pb-4 mb-4 shrink-0">
                  <span className="font-bold text-black">{Number(selectedProduct.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[14px] text-gray-500">จำนวน:</span>
                    <input type="number" min="1" value={itemDetails.quantity} onChange={(e) => setItemDetails({ ...itemDetails, quantity: parseInt(e.target.value) || 1 })} className="w-14 text-center border rounded-lg py-1 outline-none font-bold bg-gray-50" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {currentProductOptions.length === 0 ? (
                     <div className="text-gray-400 text-center py-4 text-[14px]">ไม่มีตัวเลือกเพิ่มเติมสำหรับสินค้านี้</div>
                  ) : (
                     currentProductOptions.map(group => (
                       <div key={group.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <p className="font-bold text-[14px] mb-2 text-gray-800 flex justify-between">
                            <span>{group.name} {group.is_required && <span className="text-red-500">*</span>}</span>
                            <span className="text-[11px] text-gray-400 font-normal">{group.type === 'single' ? 'เลือกได้ 1 อย่าง' : 'เลือกได้หลายอย่าง'}</span>
                          </p>
                          <div className="space-y-1">
                            {group.items?.map((item: any, idx: number) => {
                               const isSelected = (selectedDynamicOptions[group.id] || []).some((i: any) => i.name === item.name);
                               return (
                                 <label key={idx} className="flex justify-between items-center cursor-pointer py-2 hover:bg-gray-200/50 px-3 rounded-lg -mx-1 transition-colors">
                                   <span className="text-[14px] text-gray-700">
                                     {item.name} {Number(item.price) > 0 && <span className="text-green-600 font-medium ml-1">+{item.price}฿</span>}
                                   </span>
                                   <input
                                     type={group.type === 'single' ? "radio" : "checkbox"}
                                     name={`group-${group.id}`}
                                     checked={isSelected}
                                     onChange={(e) => handleOptionSelect(group, item, e.target.checked)}
                                     className="w-4 h-4 accent-[#7a5c4e] cursor-pointer"
                                   />
                                 </label>
                               );
                            })}
                          </div>
                       </div>
                     ))
                  )}

                  <div className="pt-2">
                    <p className="text-[14px] text-gray-600 mb-2 font-bold">หมายเหตุ (เพิ่มเติม)</p>
                    <input type="text" placeholder="เช่น หวานน้อยมาก, ไม่ใส่ผัก..." value={itemDetails.note} onChange={(e) => setItemDetails({ ...itemDetails, note: e.target.value })} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none text-[14px] focus:border-[#7a5c4e] transition-colors" />
                  </div>
                </div>

                <button onClick={addToCart} className="w-full bg-[#7a5c4e] text-white py-3.5 rounded-xl mt-4 font-bold text-[16px] hover:bg-[#684c3f] active:scale-[0.98] transition-all shrink-0 shadow-md">
                  เพิ่มลงบิล
                </button>
              </div>
            </div>
          )}

          {view === 'success' && (
            <div className="flex-1 h-screen bg-[#f5f6f8] flex items-center justify-center font-sans">
              <div className="bg-white rounded-3xl w-full max-w-sm p-10 text-center shadow-2xl animate-in zoom-in duration-300 border">
                <button onClick={finishTransaction} className="absolute top-4 right-5 text-gray-400 hover:text-black text-2xl">&times;</button>
                <h2 className="text-2xl font-bold mb-6 text-black border-b pb-4">ชำระเงินสำเร็จ</h2>
                <div className="w-24 h-24 bg-[#4CAF50] rounded-full flex items-center justify-center mx-auto mb-6 shadow-md"><svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg></div>
                <p className="text-gray-600 mb-1 text-sm">ช่องทางการชำระ: {paymentMethod}</p>
                <p className="text-[18px] font-bold mb-8 text-black">ยอดรวม: {totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <button onClick={finishTransaction} className="w-full bg-[#7a5c4e] text-white py-3.5 rounded-full font-bold hover:bg-[#684c3f] transition-all">ชำระเงินสำเร็จ</button>
              </div>
            </div>
          )}

          {view === 'payment' && (
            <div className="flex-1 flex gap-8 p-8 overflow-hidden bg-[#f5f6f8]">
              <div className="w-[420px] flex flex-col gap-6">
                <button onClick={() => setView('pos')} className="text-xl font-bold text-gray-800 text-left w-fit flex items-center gap-2 hover:text-gray-500"><ArrowLeft className="w-5 h-5"/> ชำระเงิน</button>
                <div className="bg-white p-6 rounded-[24px] border border-gray-200 shadow-sm space-y-4">
                  <div className="flex justify-between font-bold text-lg border-b pb-3"><span>บิล: {billNumber}</span><span className="font-normal text-gray-500">{orderType}</span></div>
                  <div className="flex justify-between text-gray-500 font-medium"><span>ยอดรวม:</span><span>{totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between text-gray-500 font-medium"><span>ชำระแล้ว:</span><span>{displayPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between text-2xl font-bold border-t pt-4 text-black"><span>ค้างชำระ:</span><span>{remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>
                <div className="bg-white p-6 rounded-[24px] border border-gray-200 shadow-sm flex-1 overflow-y-auto">
                  <h3 className="text-gray-500 text-sm font-bold mb-4 border-b pb-2">รายการเมนู ({cart.length})</h3>
                  {cart.map(item => (
                    <div key={item.cartId} className="flex justify-between py-3 border-b border-dashed border-gray-100">
                      <div className="flex flex-col">
                        <span className="font-bold text-[15px]">{item.name} x {item.quantity}</span>
                        {item.optionsText && <span className="text-[12px] text-gray-500">{item.optionsText}</span>}
                        {item.note && <span className="text-[12px] text-orange-500">หมายเหตุ: {item.note}</span>}
                      </div>
                      <span className="font-bold text-[15px]">{(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 bg-white p-8 rounded-[32px] border border-gray-200 shadow-sm flex flex-col">
                
                <div className="flex justify-start gap-4 border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar">
                  {paymentMethods.length > 0 ? paymentMethods.map(m => (
                    <button key={m.id} onClick={() => setPaymentMethod(m.name)} className={`pb-4 px-4 text-[18px] font-bold whitespace-nowrap border-b-4 transition-all ${paymentMethod === m.name ? "border-[#7a5c4e] text-[#7a5c4e]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>{m.name}</button>
                  )) : (
                    <span className="pb-4 px-4 text-[16px] text-red-500">ไม่ได้ตั้งค่าช่องทางชำระเงินไว้ในระบบ</span>
                  )}
                </div>

                <div className="bg-[#d6d6d6] p-6 rounded-[20px] mb-8 space-y-3">
                  <div className="flex justify-between items-center text-gray-500 font-bold"><span>ชำระแล้ว</span><span className="text-3xl font-bold text-black">{displayPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between items-center text-gray-500 font-bold border-t border-gray-300 pt-3"><span>เงินทอน</span><span className="text-3xl font-bold text-black">{changeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>
                
                {isCash ? (
                  <div className="flex flex-col gap-4 flex-1">
                    <div className="flex gap-4">
                      {[100, 500, 1000].map(val => (
                        <button key={val} onClick={() => setPaidAmountStr(val.toString())} className="flex-1 py-4 border rounded-xl text-xl font-bold hover:bg-gray-50 text-black">{val}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-4 flex-1">
                      {["7", "8", "9", "<", "4", "5", "6", "C", "1", "2", "3", "", "00", "0", ".", ""].map((b, i) => (
                        b === "" ? <div key={i}></div> :
                          <button key={i} onClick={() => handleKeypad(b)} className={`border rounded-xl text-2xl font-bold hover:bg-gray-50 active:bg-gray-100 ${b === "<" || b === "C" ? "text-red-500" : "text-black"}`}>{b}</button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                    <span className="text-[20px] font-bold text-gray-600 mb-2">ช่องทาง: {paymentMethod}</span>
                    <span className="text-[14px] text-gray-500">ยอดชำระถูกกำหนดให้เต็มจำนวนโดยอัตโนมัติ</span>
                  </div>
                )}

                <button onClick={confirmPayment} disabled={paymentMethods.length === 0 || isSubmittingPayment} className={`w-full py-5 rounded-2xl mt-6 text-[20px] font-bold transition-all ${displayPaidAmount >= totalPrice && !isSubmittingPayment ? "bg-[#7a5c4e] text-white hover:bg-[#684c3f]" : "bg-gray-300 text-gray-500"}`}>
                  {isSubmittingPayment ? "กำลังบันทึกการชำระ..." : "ยืนยันการชำระ"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}