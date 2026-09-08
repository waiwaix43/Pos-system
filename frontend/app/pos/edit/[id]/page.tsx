"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import NotificationBell from "../../../components/NotificationBell";

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const orderId = params.id;
  
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'pos' | 'payment' | 'success'>('pos');
  
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sweetnessOptions, setSweetnessOptions] = useState<any[]>([]);
  const [addonOptions, setAddonOptions] = useState<any[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<string>(""); 
  const [billNumber, setBillNumber] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [orderType, setOrderType] = useState("ทานที่ร้าน");

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [itemDetails, setItemDetails] = useState({ quantity: 1, sweetness: "100", addon: null as any, note: "" });

  const [paymentMethod, setPaymentMethod] = useState("เงินสด");
  const [paidAmountStr, setPaidAmountStr] = useState("");

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("userContext") || "{}");
    setUser(savedUser);
    const currentShopId = savedUser.shop_id || 1;

    fetch(`http://localhost:5000/api/categories?shop_id=${currentShopId}`).then(res => res.json()).then(data => {
        setCategories(data);
        if (data.length > 0) setSelectedCategory(data[0].id);
    });
    fetch(`http://localhost:5000/api/sweetness`).then(res => res.json()).then(data => setSweetnessOptions(data));
    fetch(`http://localhost:5000/api/addons`).then(res => res.json()).then(data => setAddonOptions(data));
    
    // ดึงข้อมูลบิลเดิมมาใส่หน้าจอ
    if (orderId) {
        fetch(`http://localhost:5000/api/orders/single/${orderId}`)
          .then(res => res.json())
          .then(orderData => {
             if (orderData) {
                 setBillNumber(orderData.bill_number.replace('INV-', ''));
                 setOrderType(orderData.order_type);
             }
          });

        fetch(`http://localhost:5000/api/orders/${orderId}/items`)
          .then(res => res.json())
          .then(itemsData => {
             const mappedCart = itemsData.map((item: any, index: number) => ({
                 ...item,
                 cartId: Date.now() + index, 
                 id: item.product_id 
             }));
             setCart(mappedCart);
          });
    }
  }, [orderId]);

  useEffect(() => {
    const currentShopId = user?.shop_id || 1;
    if (!selectedCategory || view !== 'pos') return;
    fetch(`http://localhost:5000/api/products?shop_id=${currentShopId}&category_id=${selectedCategory}`)
      .then(res => res.json()).then(data => setProducts(data));
  }, [selectedCategory, user, view]);

  const openItemModal = (product: any) => {
    setSelectedProduct(product);
    setItemDetails({ quantity: 1, sweetness: "100", addon: null, note: "" });
  };

  const addToCart = () => {
    const addonPrice = itemDetails.addon ? Number(itemDetails.addon.price) : 0;
    const finalPrice = Number(selectedProduct.price) + addonPrice;

    setCart((prev) => {
      const existingItem = prev.find(item => 
        item.id === selectedProduct.id && item.sweetness === itemDetails.sweetness && 
        item.addon_name === (itemDetails.addon?.name || "") && item.note === itemDetails.note
      );
      if (existingItem) {
        return prev.map(item => item === existingItem ? { ...item, quantity: item.quantity + itemDetails.quantity } : item);
      }
      return [...prev, {
        ...selectedProduct, cartId: Date.now(), quantity: itemDetails.quantity, price: finalPrice,
        sweetness: itemDetails.sweetness, addon_name: itemDetails.addon?.name || "", addon_price: addonPrice, note: itemDetails.note
      }];
    });
    setSelectedProduct(null);
  };

  const removeItemFromCart = (cartId: number) => setCart((prev) => prev.filter((item) => item.cartId !== cartId));
  const totalPrice = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

  const handleKeypad = (val: string) => {
    if (val === "C") setPaidAmountStr("");
    else if (val === "<") setPaidAmountStr(paidAmountStr.slice(0, -1));
    else setPaidAmountStr(prev => prev === "0" ? val : prev + val);
  };

  const paidAmount = parseFloat(paidAmountStr || "0");
  const changeAmount = Math.max(0, paidAmount - totalPrice);
  const remainingAmount = Math.max(0, totalPrice - paidAmount);

  const confirmEdit = async () => {
    if (paidAmount < totalPrice && paymentMethod === "เงินสด") return alert("จำนวนเงินไม่เพียงพอ!");
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_type: orderType, total_amount: totalPrice, cart: cart })
      });
      const data = await response.json();
      if (data.success) {
        setView('success');
      } else alert("เกิดข้อผิดพลาด: " + data.error);
    } catch (error) { alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); }
  };

  return (
    <div className="flex h-screen bg-[#d6d6d6] font-sans overflow-hidden">
      
      {/* Sidebar (ดีไซน์เดียวกับหน้าหลักเป๊ะๆ) */}
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
          <button onClick={() => router.push('/pos/settings')} className="py-5 px-6 text-left text-gray-300 border-b border-[#666666] hover:bg-[#666666] transition-colors">การตั้งค่า</button>
        </nav>
      </div>
      <button onClick={() => router.push('/pin')} className="py-6 px-6 text-left text-gray-300 border-t border-[#666666] hover:bg-[#666666] transition-colors text-[16px]">กลับสู่หน้า PIN</button>
    </div>

      {/* POS EDIT VIEW */}
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
            {/* โชว์สถานะโหมดแก้ไข */}
            <div className="w-[380px] flex items-center justify-center shrink-0">
              <div className="flex w-full items-center border border-orange-300 rounded-full bg-orange-50 overflow-hidden shadow-sm h-[48px]">
                <div className="flex-1 flex items-center justify-center gap-1.5 px-2">
                  <span className="text-orange-600 font-bold text-[15px]">โหมดแก้ไข: ORD-{billNumber}</span>
                  <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="bg-transparent outline-none text-[15px] text-gray-700 cursor-pointer border-l border-orange-300 pl-2 ml-2">
                    <option value="ทานที่ร้าน">ทานที่ร้าน</option>
                    <option value="กลับบ้าน">กลับบ้าน</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex p-6 pt-2 overflow-hidden gap-6">
            {/* 🌟 🌟 แยก Scroll กับ Grid ออกจากกันเหมือนหน้าหลัก 🌟 🌟 */}
            <div className="flex-1 overflow-y-auto pr-2 pb-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <div key={product.id} onClick={() => openItemModal(product)} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-md active:scale-[0.98] cursor-pointer flex flex-col aspect-square">
                    <div className="flex-1 min-h-0 bg-[#d9d9d9] flex items-center justify-center relative">
                      {product.image_url && <img src={product.image_url} className="w-full h-full object-cover" />}
                    </div>
                    <div className="h-[45px] shrink-0 bg-[#a6a6a6] flex items-center justify-center px-4 border-t border-gray-200">
                      <span className="text-black font-medium text-[15px] truncate w-full text-center">{product.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-[380px] flex flex-col shrink-0">
              <div className="flex-1 bg-white rounded-2xl shadow-sm border border-orange-300 mb-4 overflow-hidden flex flex-col">
                <div className="bg-orange-50 border-b border-orange-200 px-5 py-3 flex justify-between text-[13px] font-bold text-orange-700">
                  <span>รายการสินค้า (กำลังแก้ไข)</span><span>ราคา (฿)</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {cart.map((item) => (
                    <div key={item.cartId} className="flex flex-col px-3 py-3 hover:bg-gray-50 rounded-lg border-b border-dashed border-gray-100 last:border-0 relative group">
                      <div className="flex justify-between items-start mb-1 pr-6">
                        <div className="flex flex-col">
                           <span className="text-[15px] font-bold text-gray-800">{item.name} x {item.quantity}</span>
                           {item.sweetness && item.sweetness !== "100" && <span className="text-[12px] text-gray-500">หวาน {item.sweetness}%</span>}
                           {item.addon_name && <span className="text-[12px] text-gray-500">{item.addon_name}</span>}
                        </div>
                        <span className="text-[15px] font-bold text-gray-800">{(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <button onClick={() => removeItemFromCart(item.cartId)} className="absolute right-3 top-3 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                  {cart.length === 0 && <div className="flex items-center justify-center h-full text-gray-400">ยังไม่มีรายการสั่งซื้อ</div>}
                </div>
              </div>
              <button onClick={() => { if(cart.length === 0) return alert('กรุณาเลือกสินค้าก่อน'); setView('payment'); }} className="w-full py-4 bg-orange-500 text-white rounded-xl text-[18px] font-bold hover:bg-orange-600 shadow-md transition-all">
                อัปเดตยอดชำระ {totalPrice > 0 ? totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL เลือกรายละเอียดสินค้า ===================== */}
      {selectedProduct && view === 'pos' && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-sm p-6 relative shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-6">
               <h3 className="text-[20px] font-bold text-gray-800">{selectedProduct.name}</h3>
               <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-black">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
               </button>
            </div>
            
            <div className="flex justify-between items-center text-[18px] border-b border-gray-300 pb-2 mb-4">
              <span className="font-bold text-black">{Number(selectedProduct.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <input type="number" min="1" value={itemDetails.quantity} onChange={(e) => setItemDetails({...itemDetails, quantity: parseInt(e.target.value) || 1})} className="w-12 text-right outline-none font-bold bg-transparent" />
            </div>

            <div className="space-y-4">
              <div>
                <p className="font-bold text-[14px] mb-2 text-black">ระดับความหวาน</p>
                {sweetnessOptions.map(opt => (
                  <label key={opt.id} className="flex justify-between items-center cursor-pointer py-1.5">
                    <span className="text-[14px] text-gray-700">{opt.level}</span>
                    <input type="radio" name="sweetness" checked={itemDetails.sweetness === opt.level} onChange={() => setItemDetails({...itemDetails, sweetness: opt.level})} className="w-4 h-4 accent-gray-500" />
                  </label>
                ))}
              </div>

              <div className="pt-2">
                <p className="font-bold text-[14px] mb-2 text-black">เพิ่มช็อตกาแฟ</p>
                {addonOptions.map(addon => (
                  <label key={addon.id} className="flex justify-between items-center cursor-pointer py-1.5">
                    <span className="text-[14px] text-gray-700">+{Number(addon.price)}฿</span>
                    <input type="checkbox" checked={itemDetails.addon?.id === addon.id} onChange={(e) => setItemDetails({...itemDetails, addon: e.target.checked ? addon : null})} className="w-4 h-4 accent-gray-500 rounded-sm" />
                  </label>
                ))}
              </div>

              <div className="pt-2">
                <p className="text-[14px] text-gray-500 mb-1">หมายเหตุ</p>
                <input type="text" value={itemDetails.note} onChange={(e) => setItemDetails({...itemDetails, note: e.target.value})} className="w-full border-b border-gray-300 py-1 outline-none text-[14px] focus:border-gray-500 transition-colors" />
              </div>
            </div>

            <button onClick={addToCart} className="w-full bg-[#7a5c4e] text-white py-3.5 rounded-xl mt-6 font-bold text-[16px] hover:bg-[#684c3f] active:scale-95 transition-all">
              เพิ่มลงบิล
            </button>
          </div>
        </div>
      )}

      {/* ===================== PAYMENT & SUCCESS VIEW ===================== */}
      {view === 'success' && (
        <div className="flex-1 h-screen bg-[#f5f6f8] flex items-center justify-center font-sans">
          <div className="bg-white rounded-3xl w-full max-w-sm p-10 text-center shadow-2xl animate-in zoom-in duration-300 border border-orange-200">
             <button onClick={() => router.push('/pos/history')} className="absolute top-4 right-5 text-gray-400 hover:text-black text-2xl">&times;</button>
             <h2 className="text-2xl font-bold mb-6 text-black border-b pb-4">บันทึกการแก้ไขสำเร็จ</h2>
             <div className="w-24 h-24 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md"><svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg></div>
             <p className="text-gray-600 mb-1 text-sm">ช่องทางการชำระ: {paymentMethod}</p>
             <p className="text-[18px] font-bold mb-8 text-black">ยอดรวมใหม่: {totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
             <button onClick={() => router.push('/pos/history')} className="w-full bg-[#7a5c4e] text-white py-3.5 rounded-full font-bold hover:bg-[#684c3f] transition-all">กลับสู่หน้าประวัติบิล</button>
          </div>
        </div>
      )}

      {view === 'payment' && (
        <div className="flex-1 flex gap-8 p-8 overflow-hidden bg-[#f5f6f8]">
             <div className="w-[420px] flex flex-col gap-6">
                <button onClick={() => setView('pos')} className="text-xl font-bold text-gray-800 text-left w-fit flex items-center gap-2 hover:text-gray-500">← กลับไปแก้บิล</button>
                <div className="bg-white p-6 rounded-[24px] border border-orange-300 shadow-sm space-y-4">
                    <div className="flex justify-between font-bold text-lg border-b pb-3 text-orange-600"><span>บิลที่กำลังแก้: ORD-{billNumber}</span><span className="font-normal text-gray-500">{orderType}</span></div>
                    <div className="flex justify-between text-gray-500 font-medium"><span>ยอดรวมใหม่:</span><span>{totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between text-gray-500 font-medium"><span>ชำระแล้ว:</span><span>{paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between text-2xl font-bold border-t pt-4 text-black"><span>ค้างชำระ:</span><span>{remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>
                <div className="bg-white p-6 rounded-[24px] border border-gray-200 shadow-sm flex-1 overflow-y-auto">
                    <h3 className="text-gray-500 text-sm font-bold mb-4 border-b pb-2">รายการเมนู ({cart.length})</h3>
                    {cart.map(item => (
                       <div key={item.cartId} className="flex justify-between py-3 border-b border-dashed border-gray-100">
                          <div className="flex flex-col">
                             <span className="font-bold text-[15px]">{item.name} x {item.quantity}</span>
                             {item.sweetness && item.sweetness !== "100" && <span className="text-[12px] text-gray-500">หวาน {item.sweetness}%</span>}
                          </div>
                          <span className="font-bold text-[15px]">{(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                       </div>
                    ))}
                </div>
             </div>
             <div className="flex-1 bg-white p-8 rounded-[32px] border border-gray-200 shadow-sm flex flex-col">
                <div className="flex justify-around border-b border-gray-200 mb-8 text-[20px] font-bold text-gray-400">
                   {["เงินสด", "เงินโอน", "เครดิต"].map(m => (
                     <button key={m} onClick={() => setPaymentMethod(m)} className={`pb-4 px-4 border-b-4 transition-all ${paymentMethod === m ? "border-[#7a5c4e] text-[#7a5c4e]" : "border-transparent"}`}>{m}</button>
                   ))}
                </div>
                <div className="bg-[#d6d6d6] p-6 rounded-[20px] mb-8 space-y-3">
                    <div className="flex justify-between items-center text-gray-500 font-bold"><span>ชำระแล้ว</span><span className="text-3xl font-bold text-black">{paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between items-center text-gray-500 font-bold border-t border-gray-300 pt-3"><span>เงินทอน</span><span className="text-3xl font-bold text-black">{changeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>
                <div className="flex flex-col gap-4 flex-1">
                    <div className="flex gap-4">
                       {[100, 500, 1000].map(val => (
                         <button key={val} onClick={() => setPaidAmountStr(val.toString())} className="flex-1 py-4 border rounded-xl text-xl font-bold hover:bg-gray-50 text-black">{val}</button>
                       ))}
                    </div>
                    <div className="grid grid-cols-4 gap-4 flex-1">
                       {["7", "8", "9", "<", "4", "5", "6", "C", "1", "2", "3", "", "00", "0", ".", ""].map((b, i) => (
                         b === "" ? <div key={i}></div> :
                         <button key={i} onClick={() => handleKeypad(b)} className={`border rounded-xl text-2xl font-bold hover:bg-gray-50 active:bg-gray-100 ${b==="<"||b==="C"?"text-red-500":"text-black"}`}>{b}</button>
                       ))}
                    </div>
                </div>
                <button onClick={confirmEdit} className={`w-full py-5 rounded-2xl mt-6 text-[20px] font-bold transition-all ${paidAmount >= totalPrice ? "bg-orange-500 text-white hover:bg-orange-600" : "bg-gray-300 text-gray-500"}`}>บันทึกการอัปเดตบิล</button>
             </div>
        </div>
      )}
    </div>
  );
}