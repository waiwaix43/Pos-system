# Happy POS Test Environment Data

ชุดข้อมูลทดสอบร้าน "Happy POS Demo Cafe" ได้ถูกสร้างเรียบร้อยแล้วในฐานข้อมูล Supabase ปัจจุบัน

## 🏢 ข้อมูลร้านค้า (Store)
- **ชื่อร้าน:** Happy POS Demo Cafe
- **สาขา:** Main Demo Branch
- **สกุลเงิน:** THB
- **Timezone:** Asia/Bangkok
- **VAT:** 7% (รวมในราคา)

## 👤 บัญชีสำหรับทดสอบ (Test Accounts)
รหัสผ่านสำหรับทุกบัญชี: `HappyPOS_Test_2026!`

| Role | Email | PIN |
|---|---|---|
| **Owner** | owner@happypostest.local | `1234` |
| **Manager** | manager1@happypostest.local | `2345` |
| **Cashier** | cashier1@happypostest.local | `3456` |
| **Staff** | staff@happypostest.local | `4567` |

## ☕ ตัวอย่างข้อมูล (Sample Data IDs)
- **Products:** สร้างข้อมูลแล้ว 42 รายการ (ครบทุกหมวดหมู่ Coffee, Tea, Non-Coffee, Cocoa, Smoothie, Soda, Bakery, Cake)
- **Inventory/Raw Materials:** สร้างข้อมูลแล้ว 35 รายการ (เช่น วัตถุดิบ, ไซรัปต่างๆ, แก้ว, หลอด, กล่อง)
- **Suppliers:** 5 รายการ
- **Recipes:** ผูกสูตรกาแฟ เครื่องดื่ม และเบเกอรี่ตัดสต็อกอัตโนมัติครบทั้ง 42 รายการ
- **Promotions:** 2 รายการ (ส่วนลด 10% และ 15 บาท)
- **Sales Round (Shifts):** มีรอบที่ปิดไปแล้ว 1 รอบเมื่อวาน และรอบที่เปิดอยู่ (Active) สำหรับวันนี้
- **Orders & Receipts:** บิลจำลองจำนวน 35 ใบ (DEMO-10001 ถึง DEMO-10035) โดยมีการหักสต็อกและคำนวณเงินแล้ว

## 🚀 การจัดการข้อมูล (Data Management)

### 1. วิธีเพิ่มตารางที่ขาดหาย (Migrations)
โปรเจกต์ปัจจุบันยังขาดตารางบางส่วนที่เกี่ยวข้องกับระบบเต็มรูปแบบ (เช่น ลูกค้า, รายจ่าย, บันทึกการซื้อเข้า, ประวัติการทำงาน)
ให้ Copy โค้ดจาก `backend/seed_migration.sql` ไปรันใน **Supabase SQL Editor** เพื่อสร้างตาราง

### 2. คำสั่งสร้างชุดข้อมูลใหม่ (Seed Command)
รันคำสั่งต่อไปนี้ในโฟลเดอร์ `backend`:
```bash
npm run db:seed
```

### 3. คำสั่งล้างและสร้างใหม่ (Reset Command)
หากต้องการล้างข้อมูลเดิมและสร้างใหม่ทั้งหมด:
```bash
npm run db:reset
```

## ✅ สิ่งที่ผ่านการทดสอบและรองรับ (Test Coverage)
- [x] Login ด้วย Test Account และ Password Hashing (bcrypt)
- [x] ทดสอบสร้างและจัดการ Roles & PIN (PIN Hashing)
- [x] ระบบ Products พร้อม Options และ Categories
- [x] ระบบวัตถุดิบ (Raw Materials), Packaging และ Suppliers
- [x] สูตรสินค้า (Recipes) - ขายสินค้าแล้ว Stock Movement ขยับอัตโนมัติ
- [x] ยอดขาย, การชำระเงิน, เงินทอน และออกบิล
- [x] การสร้างการแจ้งเตือน (Notifications - Low Stock / Out of Stock)
- [x] Seed แบบ Idempotent รันซ้ำได้ผ่าน `db:reset`

> หมายเหตุ: ข้อมูลนี้จะเชื่อมตรงเข้ากับ Supabase ตัวจริงของระบบทันที ทำให้สามารถใช้แอปพลิเคชันที่มีอยู่ Login เข้าไปทดสอบ Flow ได้ตามปกติโดยไม่มี Mock Data ใน Frontend
