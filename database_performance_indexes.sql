-- =========================================================================
-- ดัชนีเพิ่มความเร็วฐานข้อมูล (Database Performance Indexes) สำหรับระบบ POS
-- รันไฟล์นี้ใน Supabase SQL Editor เพื่อเร่งความเร็วการค้นหาและตัดสต็อก
-- =========================================================================

-- 1. ตาราง orders (มีข้อมูลแล้ว 14,000+ แถว)
-- ช่วยให้การนับเลขบิลในกะ, การดึงประวัติการขาย, และการทำรายงานสรุปยอดขายเร็วขึ้นทันที
CREATE INDEX IF NOT EXISTS idx_orders_shop_shift ON orders(shop_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_created ON orders(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON orders(shop_id, status);

-- 2. ตาราง order_items (มีข้อมูลแล้ว 35,000+ แถว)
-- ช่วยให้การดึงรายการสินค้าในบิลตอนชำระเงินและตอนพิมพ์ใบเสร็จเร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- 3. ตาราง recipes (สูตรสินค้าสำหรับตัดสต็อก)
-- ช่วยให้การดึงสูตรตัดสต็อกตอนชำระเงินเสร็จสิ้นเร็วขึ้นแบบไม่ต้อง Full Scan
CREATE INDEX IF NOT EXISTS idx_recipes_product_id ON recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_recipes_inventory_id ON recipes(inventory_item_id);

-- 4. ตาราง inventory_items (วัตถุดิบและสต็อก)
CREATE INDEX IF NOT EXISTS idx_inventory_items_shop ON inventory_items(shop_id);

-- 5. ตาราง stock_movements (ประวัติการตัดสต็อก)
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_inv ON stock_movements(shop_id, inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements(reference_id);

-- 6. ตาราง payment_transactions (ประวัติธุรกรรมชำระเงิน QR / Gateway)
-- ช่วยให้การ Polling สถานะ และ Webhook ยืนยันการจ่ายเงินค้นพบรายการในหลักหน่วยมิลลิวินาที
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_tx ON payment_transactions(provider_transaction_id);

-- 7. ตาราง notifications (การแจ้งเตือน)
-- ป้องกันการค้นหา Dedupe ช้าตอนแจ้งเตือนสินค้าใกล้หมด
CREATE INDEX IF NOT EXISTS idx_notifications_lookup ON notifications(shop_id, dedupe_key, is_active);
