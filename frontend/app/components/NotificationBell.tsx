"use client";

import { useEffect, useState } from "react";
import { Bell, PackageX, X } from "lucide-react";

interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  min_threshold?: number;
  unit?: string;
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [notificationSettings, setNotificationSettings] = useState({ alert_low_stock: true, notify_low_stock: true, notify_out_of_stock: true, low_stock_threshold: 0 });

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("userContext") || "null");
    if (!savedUser?.shop_id) return;

    Promise.all([
      fetch(`http://localhost:5000/api/settings?shop_id=${savedUser.shop_id}`),
      fetch(`http://localhost:5000/api/inventory/items?shop_id=${savedUser.shop_id}`)
    ])
      .then(async ([settingsResponse, inventoryResponse]) => [
        settingsResponse.ok ? await settingsResponse.json() : {},
        inventoryResponse.ok ? await inventoryResponse.json() : []
      ])
      .then(([settings, data]) => {
        const nextSettings = {
          alert_low_stock: settings.alert_low_stock !== false,
          notify_low_stock: settings.notify_low_stock !== false,
          notify_out_of_stock: settings.notify_out_of_stock !== false,
          low_stock_threshold: Number(settings.low_stock_threshold || 0)
        };
        setNotificationSettings(nextSettings);
        if (!nextSettings.alert_low_stock || (!nextSettings.notify_low_stock && !nextSettings.notify_out_of_stock)) {
          setItems([]);
          return;
        }
        const lowStockItems = Array.isArray(data)
          ? data.filter((item: InventoryItem) => {
              const threshold = Math.max(Number(item.min_threshold ?? 0), nextSettings.low_stock_threshold);
              const isOutOfStock = Number(item.quantity) <= 0;
              return Number(item.quantity) <= threshold && (isOutOfStock ? nextSettings.notify_out_of_stock : nextSettings.notify_low_stock);
            })
          : [];
        setItems(lowStockItems);
      })
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative w-10 h-10 rounded-full bg-[#666666] text-gray-200 hover:bg-[#7a5c4e] hover:text-white flex items-center justify-center transition-colors"
        title="การแจ้งเตือน"
        aria-label="การแจ้งเตือน"
      >
        <Bell className="w-5 h-5" />
        {items.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-[#4d4d4d]">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setIsOpen(false)} aria-label="ปิดการแจ้งเตือน" />
          <div className="absolute left-0 top-12 z-50 w-[300px] bg-white text-gray-800 rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2 font-bold text-[14px]">
                <Bell className="w-4 h-4 text-[#7a5c4e]" /> การแจ้งเตือน
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-700" aria-label="ปิด">
                <X className="w-4 h-4" />
              </button>
            </div>
            {items.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-[13px]">ไม่มีการแจ้งเตือนใหม่</div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto divide-y divide-gray-100">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-4">
                    <PackageX className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-bold">สินค้าใกล้หมด: {item.name}</p>
                      <p className="text-[12px] text-gray-500 mt-1">เหลือ {item.quantity} {item.unit || "หน่วย"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
