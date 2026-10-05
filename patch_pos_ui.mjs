import fs from 'fs';

let content = fs.readFileSync('frontend/src/app/pos/page.tsx', 'utf8');

// 1. Update View state
content = content.replace(
    "const [view, setView] = useState<'pos' | 'payment' | 'success'>('pos');",
    "const [view, setView] = useState<'pos' | 'payment' | 'success' | 'qr_modal' | 'transfer_pending'>('pos');\n  const [qrTransaction, setQrTransaction] = useState<any>(null);\n  const [pollingInterval, setPollingInterval] = useState<any>(null);"
);

// 2. Rewrite confirmPayment
const confirmPaymentStart = content.indexOf("const confirmPayment = async () => {");
const confirmPaymentEnd = content.indexOf("const finishTransaction = () => {");

if (confirmPaymentStart !== -1 && confirmPaymentEnd !== -1) {
    const confirmPaymentReplacement = `
  const startPolling = (txId: string) => {
      if (pollingInterval) clearInterval(pollingInterval);
      const interval = setInterval(async () => {
          try {
              const res = await fetch(\`http://localhost:5000/api/payments/\${txId}/status\`);
              const data = await res.json();
              if (data.success && data.status === 'PAID') {
                  clearInterval(interval);
                  setView('success');
                  if (shopSettings?.auto_print_receipt) {
                      // Note: billNumber state might be stale, use callback or ref if needed
                  }
              } else if (data.success && (data.status === 'FAILED' || data.status === 'EXPIRED' || data.status === 'CANCELLED')) {
                  clearInterval(interval);
                  // alert("การชำระเงินไม่สำเร็จ: " + data.status);
                  setView('payment');
              }
          } catch (e) {
              console.error(e);
          }
      }, 3000);
      setPollingInterval(interval);
  };

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
      
      const data = await response.json();

      if (response.ok && data.success) {
        setBillNumber(data.billNumber || "");
        
        if (data.orderStatus === 'PENDING_PAYMENT') {
            // Call create QR
            const qrRes = await fetch("http://localhost:5000/api/payments/create-qr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shop_id: user.shop_id, order_id: data.orderId, amount: totalPrice })
            });
            const qrData = await qrRes.json();
            if (qrData.success) {
                setQrTransaction(qrData.transaction);
                setView('qr_modal');
                startPolling(qrData.transaction.id);
            } else {
                alert("สร้าง QR ไม่สำเร็จ: " + qrData.error);
            }
        } else if (data.orderStatus === 'PENDING_VERIFICATION') {
            setView('transfer_pending');
        } else {
            setView('success');
            if (shopSettings?.auto_print_receipt) {
                // printReceipt(data.billNumber || "");
            }
        }
      } else {
        alert("เกิดข้อผิดพลาด: " + (data.error || "Unknown Error"));
      }
    } catch (error) { 
        alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); 
    } finally {
      paymentSubmissionRef.current = false;
      setIsSubmittingPayment(false);
    }
  };

  `;
    content = content.slice(0, confirmPaymentStart) + confirmPaymentReplacement + content.slice(confirmPaymentEnd);
}

// 3. Clear interval on unmount or finish
content = content.replace(
    "const finishTransaction = () => {",
    "const finishTransaction = () => {\n      if (pollingInterval) clearInterval(pollingInterval);\n      setQrTransaction(null);"
);

// 4. Inject View rendering at the bottom
const renderPosListStart = content.indexOf("{view === 'success' && (");
if (renderPosListStart !== -1) {
    const qrModalRender = `
          {view === 'qr_modal' && qrTransaction && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col p-6 items-center justify-center">
               <div className="max-w-md w-full bg-gray-50 border border-gray-200 rounded-3xl p-8 flex flex-col items-center text-center">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">ชำระเงิน</h2>
                  <div className="w-full flex justify-between border-b border-gray-200 pb-4 mb-6">
                      <span className="text-gray-500">Invoice</span>
                      <span className="font-bold">{billNumber}</span>
                  </div>
                  <div className="w-full flex justify-between border-b border-gray-200 pb-4 mb-6">
                      <span className="text-gray-500">ยอดชำระ</span>
                      <span className="text-2xl font-bold text-[#7a5c4e]">฿{totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm mb-4 flex justify-center w-full">
                      {qrTransaction.qr_data.startsWith('http') ? (
                          <img src={qrTransaction.qr_data} alt="QR Code" width={200} height={200} />
                      ) : (
                          <QRCodeCanvas value={qrTransaction.qr_data} size={200} />
                      )}
                  </div>
                  <p className="text-lg font-bold text-gray-800">สแกน QR เพื่อชำระเงิน</p>
                  <p className="text-gray-500 mt-2">สถานะ: <span className="text-orange-500 font-bold animate-pulse">รอการชำระเงิน...</span></p>
                  
                  <button onClick={() => { if(pollingInterval) clearInterval(pollingInterval); setView('payment'); }} className="mt-8 w-full py-4 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">ยกเลิก</button>
               </div>
            </div>
          )}

          {view === 'transfer_pending' && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col p-6 items-center justify-center">
               <div className="max-w-md w-full bg-gray-50 border border-gray-200 rounded-3xl p-8 flex flex-col items-center text-center">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">รอตรวจสอบยอดเงิน</h2>
                  <div className="w-full flex justify-between border-b border-gray-200 pb-4 mb-6">
                      <span className="text-gray-500">Invoice</span>
                      <span className="font-bold">{billNumber}</span>
                  </div>
                  <p className="text-gray-600 mb-6">กรุณาตรวจสอบสลิปการโอนเงินของลูกค้า หากยอดเงินเข้าบัญชีถูกต้องแล้ว ให้ดำเนินการอัปเดตสถานะในระบบจัดการหลังบ้าน</p>
                  <button onClick={finishTransaction} className="w-full py-4 rounded-xl bg-[#7a5c4e] text-white font-bold hover:bg-[#684c3f]">ปิดหน้านี้</button>
               </div>
            </div>
          )}
    `;
    content = content.slice(0, renderPosListStart) + qrModalRender + content.slice(renderPosListStart);
}

fs.writeFileSync('frontend/src/app/pos/page.tsx', content);
console.log("Patched UI successfully.");
