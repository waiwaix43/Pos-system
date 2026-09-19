const db = require('./db');

const getState = (quantity, minimum) => {
    if (Number(quantity) <= 0) return 'OUT_OF_STOCK';
    if (Number(quantity) <= Number(minimum || 0)) return 'LOW_STOCK';
    return 'NORMAL';
};

const createNotification = async ({ shopId, type, priority, title, message, entityType, entityId, actionTarget, metadata = {}, userId = null }) => {
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
    if (error || !item) return null;

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
        title: isOut ? 'วัตถุดิบหมด' : 'วัตถุดิบใกล้หมด',
        message: isOut ? `${item.name} หมดแล้ว` : `${item.name} เหลือ ${item.quantity} ${item.unit || 'หน่วย'} ต่ำกว่าขั้นต่ำ ${minimum} ${item.unit || 'หน่วย'}`,
        entityType: 'inventory_item',
        entityId: item.id,
        actionTarget: `/pos/inventory?item_id=${item.id}`,
        metadata: { quantity: item.quantity, minimum, unit: item.unit, eventState: state }
    });
};

module.exports = { createNotification, syncInventoryNotification, getState };
