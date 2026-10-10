"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, Check, CircleAlert, Info, PackageX, RefreshCw, X } from "lucide-react";

interface NotificationItem {
  id: number;
  type: string;
  priority: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  message: string;
  action_target?: string;
  is_read: boolean;
  created_at: string;
}

const relativeTime = (value: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "เมื่อสักครู่";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
};

const iconFor = (item: NotificationItem) => {
  if (item.type === "STOCK_OUT") return <PackageX className="h-5 w-5" />;
  if (item.priority === "CRITICAL") return <CircleAlert className="h-5 w-5" />;
  if (item.priority === "WARNING") return <AlertTriangle className="h-5 w-5" />;
  return <Info className="h-5 w-5" />;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "");

export default function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "important">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bellRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadNotifications = async () => {
    const user = JSON.parse(localStorage.getItem("userContext") || "null");
    if (!user?.shop_id) {
      setError("กรุณาเข้าสู่ระบบก่อนใช้งานการแจ้งเตือน");
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ shop_id: String(user.shop_id), user_id: String(user.id), limit: "50" });
      if (filter === "unread") params.set("unread_only", "true");
      if (filter === "important") params.set("priority", "CRITICAL");

      const token = localStorage.getItem("token");
      const response = await fetch(`${apiBaseUrl}/api/notifications?${params}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          throw new Error(data.error || data.message || "ไม่สามารถโหลดการแจ้งเตือนได้");
        }
        throw new Error(`Notification API failed: ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Notification API did not return JSON");
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "ไม่สามารถโหลดการแจ้งเตือนได้");
      }

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: any) {
      setError(err.message || "ไม่สามารถโหลดการแจ้งเตือนได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadNotifications();
    }, 5000);
    const refreshNotifications = () => void loadNotifications();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadNotifications();
    };

    window.addEventListener("notifications:refresh", refreshNotifications);
    window.addEventListener("focus", refreshNotifications);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("notifications:refresh", refreshNotifications);
      window.removeEventListener("focus", refreshNotifications);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [filter]);

  const markRead = async (item: NotificationItem) => {
    const user = JSON.parse(localStorage.getItem("userContext") || "null");
    if (!item.is_read && user?.shop_id) {
      const token = localStorage.getItem("token");
      const response = await fetch(`${apiBaseUrl}/api/notifications/${item.id}/read`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ shop_id: user.shop_id })
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Notification markRead API did not return JSON");
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "ไม่สามารถอัปเดตสถานะการแจ้งเตือนได้");
      }

      setNotifications(current => current.map(notification => notification.id === item.id ? { ...notification, is_read: true } : notification));
      setUnreadCount(count => Math.max(0, count - 1));
    }
    setIsOpen(false);
    if (item.action_target) router.push(item.action_target);
  };

  const markAllRead = async () => {
    const user = JSON.parse(localStorage.getItem("userContext") || "null");
    if (!user?.shop_id) return;
    const token = localStorage.getItem("token");
    const response = await fetch(`${apiBaseUrl}/api/notifications/read-all`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ shop_id: user.shop_id })
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Notification markAllRead API did not return JSON");
    }

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "ไม่สามารถอ่านการแจ้งเตือนทั้งหมดได้");
    }

    setNotifications(current => current.map(item => ({ ...item, is_read: true })));
    setUnreadCount(0);
  };

  const toggleDropdown = () => {
    if (!isOpen && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      const leftPos = window.innerWidth < 450 ? 16 : rect.left - 100;
      setDropdownPos({ top: rect.bottom + 12, left: Math.max(16, leftPos) });
    }
    setIsOpen(open => !open);
  };

  return (
    <div className="relative">
      <button ref={bellRef} type="button" onClick={toggleDropdown} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200" title="การแจ้งเตือน" aria-label="การแจ้งเตือน">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#007aff] px-1 text-[10px] font-black text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {mounted && isOpen && createPortal(
        <>
          <button className="fixed inset-0 z-[9998] cursor-default" onClick={() => setIsOpen(false)} aria-label="ปิดการแจ้งเตือน" />
          <div style={{ top: dropdownPos.top, left: dropdownPos.left }} className="absolute z-[9999] w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3"><div><p className="font-bold">การแจ้งเตือน</p><p className="text-[11px] text-gray-500">{unreadCount} รายการยังไม่ได้อ่าน</p></div><div className="flex items-center gap-2"><button type="button" onClick={markAllRead} className="text-[11px] font-bold text-[#007aff]">อ่านทั้งหมด</button><button type="button" onClick={() => setIsOpen(false)} aria-label="ปิด"><X className="h-4 w-4 text-gray-400" /></button></div></div>
            <div className="flex gap-1 border-b border-gray-100 px-3 py-2"><button onClick={() => setFilter("all")} className={`rounded-full px-3 py-1 text-[11px] font-bold ${filter === "all" ? "bg-gray-900 text-white" : "text-gray-500"}`}>ทั้งหมด</button><button onClick={() => setFilter("unread")} className={`rounded-full px-3 py-1 text-[11px] font-bold ${filter === "unread" ? "bg-gray-900 text-white" : "text-gray-500"}`}>ยังไม่อ่าน</button><button onClick={() => setFilter("important")} className={`rounded-full px-3 py-1 text-[11px] font-bold ${filter === "important" ? "bg-gray-900 text-white" : "text-gray-500"}`}>สำคัญ</button></div>
            <div className="max-h-[390px] overflow-y-auto">
              {loading ? <div className="flex items-center justify-center gap-2 p-8 text-[13px] text-gray-500"><RefreshCw className="h-4 w-4 animate-spin" /> กำลังโหลด...</div> : error ? <div className="p-6 text-center text-[12px] text-red-500"><p>{error}</p><button onClick={loadNotifications} className="mt-3 rounded-lg bg-gray-100 px-3 py-2 font-bold text-gray-700">ลองอีกครั้ง</button></div> : notifications.length === 0 ? <div className="p-8 text-center"><Check className="mx-auto mb-2 h-8 w-8 text-gray-300" /><p className="text-[13px] font-bold text-gray-600">ไม่มีการแจ้งเตือน</p><p className="mt-1 text-[11px] text-gray-400">ขณะนี้ไม่มีรายการที่ต้องดำเนินการ</p></div> : notifications.map(item => <button type="button" key={item.id} onClick={() => markRead(item)} className={`flex w-full gap-3 border-b border-gray-100 p-4 text-left hover:bg-gray-50 ${item.is_read ? "bg-white" : "bg-blue-50/50"}`}><span className={`mt-0.5 shrink-0 ${item.priority === "CRITICAL" ? "text-red-500" : item.priority === "WARNING" ? "text-orange-500" : "text-gray-500"}`}>{iconFor(item)}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="text-[13px]">{item.title}</strong>{!item.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-[#007aff]" />}</span><span className="mt-1 block text-[12px] text-gray-600">{item.message}</span><span className="mt-1 block text-[10px] text-gray-400">{relativeTime(item.created_at)}</span></span></button>)}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
