const db = require('./db');

const getState = (quantity, minimum) => {
    if (Number(quantity) <= 0) return 'OUT_OF_STOCK';
    if (Number(quantity) <= Number(minimum || 0)) return 'LOW_STOCK';
    return 'NORMAL';
};

const createNotification = async ({ shopId, type, priority, title, message, entityType, entityId, actionTarget, metadata = {}, userId = null }) => {
    // Check shop settings first
    let allowNotify = true;
    try {
        const { data: settingsRow } = await db.from('shop_settings').select('settings_data').eq('shop_id', shopId).single();
        if (settingsRow && settingsRow.settings_data) {
            const settings = typeof settingsRow.settings_data === 'string' ? JSON.parse(settingsRow.settings_data) : settingsRow.settings_data;
            if (type === 'STOCK_LOW' && settings.notify_low_stock === false) allowNotify = false;
            if (type === 'STOCK_OUT' && settings.notify_out_of_stock === false) allowNotify = false;
            if (type === 'REFUND' && settings.notify_refund === false) allowNotify = false;
            if (type === 'CANCEL_BILL' && settings.notify_cancel_bill === false) allowNotify = false;
            if (type === 'STOCK_ADJUST' && settings.notify_stock_adjust === false) allowNotify = false;
        }
    } catch (e) { console.error("Fetch Error: ", e); }

    if (!allowNotify) return null;

    const eventState = metadata.eventState || type;
    const dedupeKey = `${type}:${entityType || 'system'}:${entityId || '0'}:${eventState}`;
    const { data: existing, error: lookupError } = await db.from('notifications')
        .select('id')
        .eq('shop_id', shopId)
        .eq('dedupe_key', dedupeKey)
        .eq('is_active', true)
        .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return existing;

    const { data, error } = await db.from('notifications').insert([{
        shop_id: shopId, user_id: userId, type, priority, title, message,
        entity_type: entityType || null, entity_id: entityId || null,
        action_target: actionTarget || null, metadata, dedupe_key: dedupeKey,
        is_read: false, is_active: true
    }]).select('id').single();
    if (error) throw error;
    return data;
};

const syncInventoryNotification = async ({ shopId, itemId, userId = null }) => {
    const { data: item, error } = await db.from('inventory_items')
        .select('id, name, quantity, unit, min_threshold')
        .eq('id', itemId).eq('shop_id', shopId).single();
    if (error) throw error;
    if (!item) return null;

    const minimum = Number(item.min_threshold || 0);
    const state = getState(item.quantity, minimum);
    if (state === 'NORMAL') {
        await db.from('notifications').update({ is_active: false })
            .eq('shop_id', shopId).eq('entity_type', 'inventory_item').eq('entity_id', item.id).in('type', ['STOCK_LOW', 'STOCK_OUT']);
        return null;
    }

    const isOut = state === 'OUT_OF_STOCK';
    return createNotification({
        shopId,
        userId,
        type: isOut ? 'STOCK_OUT' : 'STOCK_LOW',
        priority: isOut ? 'CRITICAL' : 'WARNING',
        title: isOut ? 'สินค้าหมด' : 'สินค้าใกล้หมด',
        message: isOut ? `${item.name} หมดสต็อกแล้ว` : `${item.name} เหลือ ${item.quantity} ${item.unit || 'หน่วย'} (ขั้นต่ำคือ ${minimum} ${item.unit || 'หน่วย'})`,
        entityType: 'inventory_item',
        entityId: item.id,
        actionTarget: `/pos/inventory?item_id=${item.id}`,
        metadata: { quantity: item.quantity, minimum, unit: item.unit, eventState: state }
    });
};

module.exports = { createNotification, syncInventoryNotification, getState };
