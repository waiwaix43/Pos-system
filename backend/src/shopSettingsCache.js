const db = require('./db');

// แคช shop_settings ร่วมกันทั้งระบบ (settings_data อาจมี Base64 logo/qr_image ขนาดหลาย MB
// จึงต้องหลีกเลี่ยงการดึงจาก Supabase ซ้ำๆ)
const TTL_MS = 60000;
const cache = new Map(); // shopId -> { data, timestamp }
const inflight = new Map(); // shopId -> Promise (กันยิงซ้ำพร้อมกัน)

const parseSettings = (raw) => {
    if (!raw) return {};
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch (e) { return {}; }
    }
    return raw;
};

// หมายเหตุ: object ที่คืนไปถูกแชร์ร่วมกัน ห้ามแก้ไขค่าข้างใน (read-only)
async function getCachedShopSettings(shopId) {
    const key = String(shopId);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < TTL_MS) return cached.data;

    if (inflight.has(key)) return inflight.get(key);

    const promise = (async () => {
        try {
            const { data } = await db.from('shop_settings').select('settings_data').eq('shop_id', shopId).single();
            const parsed = parseSettings(data?.settings_data);
            cache.set(key, { data: parsed, timestamp: Date.now() });
            return parsed;
        } finally {
            inflight.delete(key);
        }
    })();
    inflight.set(key, promise);
    return promise;
}

function invalidateShopSettings(shopId) {
    cache.delete(String(shopId));
    inflight.delete(String(shopId));
}

module.exports = { getCachedShopSettings, invalidateShopSettings };
