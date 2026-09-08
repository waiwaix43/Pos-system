"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

type PickerView = "range" | "month" | "monthRange" | "year" | "yearRange";

export interface DateRangeValue {
  mode: PickerView;
  startDate: string;
  endDate: string;
  period: string;
}

interface UnifiedDateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}

const TIME_ZONE = "Asia/Bangkok";
const pad = (value: number) => String(value).padStart(2, "0");
const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromIso = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};
const endOfMonth = (year: number, month: number) => new Date(year, month + 1, 0);
const formatDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const todayDate = () => fromIso(formatDateKey(new Date()));
export const getTodayIso = () => formatDateKey(new Date());
const formatThaiDate = (value: string) => value ? fromIso(value).toLocaleDateString("th-TH", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" }) : "เลือกช่วงเวลา";
const formatDisplay = (value: DateRangeValue) => value.startDate && value.endDate && value.startDate === value.endDate ? formatThaiDate(value.startDate) : value.startDate && value.endDate ? `${formatThaiDate(value.startDate)} - ${formatThaiDate(value.endDate)}` : "เลือกช่วงเวลา";
const makeRange = (start: Date, end: Date, period: string, mode: PickerView = "range"): DateRangeValue => ({ mode, startDate: toIso(start), endDate: toIso(end), period });
export const getCurrentMonthToDate = (): DateRangeValue => {
  const today = todayDate();
  return makeRange(new Date(today.getFullYear(), today.getMonth(), 1), today, "กำหนดเอง");
};

const presets = [
  { label: "วันนี้", get: () => { const date = todayDate(); return makeRange(date, date, "วันนี้"); } },
  { label: "เมื่อวาน", get: () => { const date = todayDate(); date.setDate(date.getDate() - 1); return makeRange(date, date, "เมื่อวาน"); } },
  { label: "7 วันที่ผ่านมา", get: () => { const end = todayDate(); const start = todayDate(); start.setDate(start.getDate() - 6); return makeRange(start, end, "7 วันที่ผ่านมา"); } },
  { label: "30 วันที่ผ่านมา", get: () => { const end = todayDate(); const start = todayDate(); start.setDate(start.getDate() - 29); return makeRange(start, end, "30 วันที่ผ่านมา"); } },
  { label: "เดือนนี้", get: () => { const date = todayDate(); return makeRange(new Date(date.getFullYear(), date.getMonth(), 1), endOfMonth(date.getFullYear(), date.getMonth()), "เดือนนี้", "month"); } },
  { label: "เดือนที่แล้ว", get: () => { const date = todayDate(); const month = new Date(date.getFullYear(), date.getMonth() - 1, 1); return makeRange(month, endOfMonth(month.getFullYear(), month.getMonth()), "เดือนที่แล้ว", "month"); } },
  { label: "ปีนี้", get: () => { const year = todayDate().getFullYear(); return makeRange(new Date(year, 0, 1), new Date(year, 11, 31), "ปีนี้", "year"); } },
  { label: "ปีที่แล้ว", get: () => { const year = todayDate().getFullYear() - 1; return makeRange(new Date(year, 0, 1), new Date(year, 11, 31), "ปีที่แล้ว", "year"); } },
  { label: "กำหนดเอง", get: () => null }
];

export default function UnifiedDateRangePicker({ value, onChange, className = "" }: UnifiedDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [view, setView] = useState<PickerView>("range");
  const [calendarMonth, setCalendarMonth] = useState(() => value.startDate ? fromIso(value.startDate) : todayDate());
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePopoverPosition = () => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 16;
      const maxLeft = Math.max(viewportPadding, window.innerWidth - popoverRect.width - viewportPadding);
      const left = Math.min(Math.max(viewportPadding, triggerRect.right - popoverRect.width), maxLeft);
      const spaceBelow = window.innerHeight - triggerRect.bottom - gap - viewportPadding;
      const spaceAbove = triggerRect.top - gap - viewportPadding;
      const top = spaceBelow >= popoverRect.height || spaceBelow >= spaceAbove
        ? Math.min(triggerRect.bottom + gap, window.innerHeight - popoverRect.height - viewportPadding)
        : Math.max(viewportPadding, triggerRect.top - popoverRect.height - gap);

      setPopoverPosition({ top, left });
    };

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, view, calendarMonth, draft.startDate, draft.endDate, draft.period]);

  const openPicker = () => {
    setDraft(value);
    setView(value.mode === "month" || value.mode === "year" ? value.mode : "range");
    setCalendarMonth(value.startDate ? fromIso(value.startDate) : todayDate());
    setOpen(!open);
  };
  const selectPreset = (label: string) => {
    if (["เลือกเดือน", "ช่วงเดือน", "เลือกปี", "ช่วงปี"].includes(label)) {
      const nextView = label === "เลือกเดือน" ? "month" : label === "ช่วงเดือน" ? "monthRange" : label === "เลือกปี" ? "year" : "yearRange";
      setView(nextView);
      setDraft({ ...value, mode: nextView, period: "กำหนดเอง" });
      return;
    }
    const preset = presets.find(item => item.label === label);
    if (!preset) return;
    const next = preset.get();
    if (next) {
      setDraft(next);
      onChange(next);
      setOpen(false);
    } else {
      setDraft({ ...value, mode: "range", startDate: "", endDate: "", period: "กำหนดเอง" });
      setView("range");
    }
  };
  const selectDay = (iso: string) => {
    if (!draft.startDate || draft.endDate) {
      setDraft({ ...draft, mode: "range", startDate: iso, endDate: "", period: "กำหนดเอง" });
      return;
    }
    setDraft({ ...draft, mode: "range", startDate: iso < draft.startDate ? iso : draft.startDate, endDate: iso < draft.startDate ? draft.startDate : iso, period: "กำหนดเอง" });
  };
  const selectMonth = (month: string, key: "startDate" | "endDate") => {
    const [year, monthNumber] = month.split("-").map(Number);
    if (!year || !monthNumber) return;
    const start = new Date(year, monthNumber - 1, 1);
    const end = endOfMonth(year, monthNumber - 1);
    setDraft(view === "month" ? makeRange(start, end, "กำหนดเอง", "month") : { ...draft, [key]: key === "startDate" ? toIso(start) : toIso(end), period: "กำหนดเอง" });
  };
  const selectYear = (yearValue: string, key: "startDate" | "endDate") => {
    const year = Number(yearValue);
    if (!year) return;
    setDraft(view === "year" ? makeRange(new Date(year, 0, 1), new Date(year, 11, 31), "กำหนดเอง", "year") : { ...draft, [key]: key === "startDate" ? `${year}-01-01` : `${year}-12-31`, period: "กำหนดเอง" });
  };
  const apply = () => {
    const endDate = draft.endDate || draft.startDate;
    if (!draft.startDate || !endDate) return;
    onChange({ ...draft, endDate, period: draft.period || "กำหนดเอง" });
    setOpen(false);
  };
  const years = Array.from({ length: 21 }, (_, index) => todayDate().getFullYear() - 10 + index);
  const months = Array.from({ length: 12 }, (_, index) => index);
  const monthValue = (date: string) => date.slice(0, 7);
  const yearValue = (date: string) => date.slice(0, 4);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button ref={triggerRef} type="button" onClick={openPicker} className="flex items-center border border-gray-200 rounded-full bg-white overflow-hidden shadow-sm h-[48px] px-4 text-[14px] text-gray-700 font-bold whitespace-nowrap">
        <Calendar className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
        <span>{formatDisplay(value)}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 ml-2" />
      </button>
      {open && typeof document !== "undefined" && createPortal((
        <div ref={popoverRef} style={{ top: popoverPosition.top, left: popoverPosition.left }} className="fixed z-[200] w-[min(420px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-y-auto pointer-events-auto bg-white border border-gray-200 rounded-2xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[15px] font-bold text-gray-800">ช่วงเวลา</span>
            <select value={draft.period === "กำหนดเอง" ? (view === "range" ? "กำหนดเอง" : view === "month" ? "เลือกเดือน" : view === "monthRange" ? "ช่วงเดือน" : view === "year" ? "เลือกปี" : "ช่วงปี") : draft.period} onChange={e => selectPreset(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-[13px] font-bold text-gray-700 outline-none">
              {presets.map(preset => <option key={preset.label} value={preset.label}>{preset.label}</option>)}
              <option value="เลือกเดือน">เลือกเดือน</option>
              <option value="ช่วงเดือน">ช่วงเดือน</option>
              <option value="เลือกปี">เลือกปี</option>
              <option value="ช่วงปี">ช่วงปี</option>
            </select>
          </div>

          {view === "range" ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
                <span className="font-bold text-gray-800">{calendarMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</span>
                <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><ChevronRight className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[12px]">
                {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map(day => <span key={day} className="py-1 font-bold text-gray-400">{day}</span>)}
                {Array.from({ length: (calendarMonth.getDay() + 6) % 7 }, (_, index) => <span key={`empty-${index}`} />)}
                {Array.from({ length: endOfMonth(calendarMonth.getFullYear(), calendarMonth.getMonth()).getDate() }, (_, index) => {
                  const iso = toIso(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1));
                  const selected = iso === draft.startDate || iso === draft.endDate;
                  const inRange = draft.startDate && draft.endDate && iso > draft.startDate && iso < draft.endDate;
                  return <button key={iso} type="button" onClick={() => selectDay(iso)} className={`py-2 rounded-lg ${selected ? "bg-[#7a5c4e] text-white" : inRange ? "bg-[#7a5c4e]/15 text-[#7a5c4e]" : "text-gray-700 hover:bg-gray-100"}`}>{index + 1}</button>;
                })}
              </div>
              <p className="text-[12px] text-gray-500 mt-3">{draft.startDate && !draft.endDate ? "เลือกวันสิ้นสุด" : "คลิกวันแรกและวันสุดท้ายเพื่อเลือกช่วง"}</p>
            </>
          ) : view === "month" || view === "monthRange" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[12px] font-bold text-gray-500">{view === "month" ? "เลือกเดือน" : "เดือนเริ่มต้น"}<select value={monthValue(draft.startDate)} onChange={e => selectMonth(e.target.value, "startDate")} className="block w-full mt-1 border border-gray-200 rounded-lg px-2 py-2 text-[13px]"><option value="">เลือกเดือน</option>{years.flatMap(year => months.map(month => <option key={`${year}-${month}`} value={`${year}-${pad(month + 1)}`}>{new Date(year, month, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</option>))}</select></label>
              {view === "monthRange" && <label className="text-[12px] font-bold text-gray-500">เดือนสิ้นสุด<select value={monthValue(draft.endDate)} onChange={e => selectMonth(e.target.value, "endDate")} className="block w-full mt-1 border border-gray-200 rounded-lg px-2 py-2 text-[13px]"><option value="">เลือกเดือน</option>{years.flatMap(year => months.map(month => <option key={`${year}-${month}`} value={`${year}-${pad(month + 1)}`}>{new Date(year, month, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</option>))}</select></label>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[12px] font-bold text-gray-500">{view === "year" ? "เลือกปี" : "ปีเริ่มต้น"}<select value={yearValue(draft.startDate)} onChange={e => selectYear(e.target.value, "startDate")} className="block w-full mt-1 border border-gray-200 rounded-lg px-2 py-2 text-[13px]"><option value="">เลือกปี</option>{years.map(year => <option key={year} value={year}>{year + 543}</option>)}</select></label>
              {view === "yearRange" && <label className="text-[12px] font-bold text-gray-500">ปีสิ้นสุด<select value={yearValue(draft.endDate)} onChange={e => selectYear(e.target.value, "endDate")} className="block w-full mt-1 border border-gray-200 rounded-lg px-2 py-2 text-[13px]"><option value="">เลือกปี</option>{years.map(year => <option key={year} value={year}>{year + 543}</option>)}</select></label>}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-gray-100 mt-3 pt-3"><span className="text-[12px] font-bold text-gray-600">{draft.startDate && draft.endDate ? formatDisplay(draft) : "เลือกวันเริ่มต้นแล้ว"}</span><div className="flex gap-2"><button type="button" onClick={() => { setDraft(value); setOpen(false); }} className="px-3 py-2 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600">ยกเลิก</button><button type="button" onClick={apply} className="px-3 py-2 rounded-lg bg-[#7a5c4e] text-white text-[12px] font-bold">ใช้ช่วงเวลา</button></div></div>
        </div>
      ), document.body)}
    </div>
  );
}
