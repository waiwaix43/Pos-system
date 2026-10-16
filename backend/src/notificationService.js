const db = require('./db');

const getState = (quantity, minimum) => {
    if (Number(quantity) <= 0) return 'OUT_OF_STOCK';
    if (Number(quantity) <= Number(minimum || 0)) return 'LOW_STOCK';
    return 'NORMAL';
};

const getBangkokDateKey = (value = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(value instanceof Date ? value : new Date(value));
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const formatThaiDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return '-';
    const clean = dateStr.trim().slice(0, 10);
    const parts = clean.split('-');
    if (parts.length !== 3) return clean;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
};

const encodeInventoryExpiry = ({ mfg_date, exp_date, no_expiry, expiry_alert_days, batches, total_quantity }) => {
    const isNoExpiry = Boolean(no_expiry);
    const normalizedMfgDate = mfg_date && String(mfg_date).trim() ? String(mfg_date).trim().slice(0, 10) : null;
    const normalizedExpDate = isNoExpiry || !(exp_date && String(exp_date).trim())
        ? null
        : String(exp_date).trim().slice(0, 10);
    const alertDays = expiry_alert_days !== undefined && expiry_alert_days !== null && expiry_alert_days !== ''
        ? Math.max(0, Number(expiry_alert_days))
        : 7;

    let normalizedBatches = [];
    if (!isNoExpiry && Array.isArray(batches)) {
        const mergedMap = new Map();
        batches.forEach((b, idx) => {
            if (!b) return;
            const qty = Number(Number(b.quantity || 0).toFixed(6));
            const bMfg = b.mfg_date && String(b.mfg_date).trim() ? String(b.mfg_date).trim().slice(0, 10) : null;
            const bNoExp = Boolean(b.no_expiry);
            const bExp = bNoExp || !(b.exp_date && String(b.exp_date).trim())
                ? null
                : String(b.exp_date).trim().slice(0, 10);
            if (qty <= 0 && !bMfg && !bExp && !bNoExp) return;
            const key = `${bMfg || ''}|${bExp || ''}|${bNoExp ? '1' : '0'}`;
            if (mergedMap.has(key)) {
                const existing = mergedMap.get(key);
                existing.quantity = Number((existing.quantity + Math.max(0, qty)).toFixed(6));
            } else {
                mergedMap.set(key, {
                    id: b.id || `lot_${Date.now()}_${idx}`,
                    quantity: Math.max(0, qty),
                    mfg_date: bMfg,
                    exp_date: bExp,
                    no_expiry: bNoExp,
                    added_at: b.added_at || new Date().toISOString()
                });
            }
        });
        normalizedBatches = Array.from(mergedMap.values());
    } else if (!isNoExpiry && (normalizedMfgDate || normalizedExpDate)) {
        const fallbackQty = total_quantity !== undefined && total_quantity !== null
            ? Math.max(0, Number(Number(total_quantity).toFixed(6)))
            : 0;
        normalizedBatches = [{
            id: `lot_${Date.now()}_0`,
            quantity: fallbackQty,
            mfg_date: normalizedMfgDate,
            exp_date: normalizedExpDate,
            no_expiry: false,
            added_at: new Date().toISOString()
        }];
    }

    normalizedBatches.sort((a, b) => {
        if (a.no_expiry !== b.no_expiry) return a.no_expiry ? 1 : -1;
        if (a.exp_date && b.exp_date) return a.exp_date.localeCompare(b.exp_date);
        if (a.exp_date) return -1;
        if (b.exp_date) return 1;
        return String(a.added_at || '').localeCompare(String(b.added_at || ''));
    });

    const primaryBatch = normalizedBatches.find(b => !b.no_expiry && b.exp_date) || normalizedBatches[0] || null;

    return JSON.stringify({
        mfg_date: primaryBatch ? primaryBatch.mfg_date : normalizedMfgDate,
        exp_date: isNoExpiry ? null : (primaryBatch ? primaryBatch.exp_date : normalizedExpDate),
        no_expiry: isNoExpiry,
        expiry_alert_days: Number.isFinite(alertDays) ? alertDays : 7,
        batches: isNoExpiry ? [] : normalizedBatches
    });
};

const computeSingleExpiryStatus = ({ exp_date, no_expiry, expiry_alert_days, todayKey }) => {
    if (no_expiry) {
        return { expiry_status: 'NO_EXPIRY', days_until_expiry: null };
    }
    if (!exp_date || !String(exp_date).trim()) {
        return { expiry_status: 'UNSPECIFIED', days_until_expiry: null };
    }
    const cleanExp = String(exp_date).trim().slice(0, 10);
    const expTime = new Date(`${cleanExp}T00:00:00Z`).getTime();
    const todayTime = new Date(`${todayKey}T00:00:00Z`).getTime();
    const days_until_expiry = Number.isFinite(expTime) && Number.isFinite(todayTime)
        ? Math.round((expTime - todayTime) / 86400000)
        : null;

    let expiry_status = 'NORMAL';
    if (days_until_expiry !== null) {
        if (days_until_expiry < 0) {
            expiry_status = 'EXPIRED';
        } else if (days_until_expiry === 0) {
            expiry_status = 'EXPIRES_TODAY';
        } else if (expiry_alert_days > 0 && days_until_expiry <= expiry_alert_days) {
            expiry_status = 'EXPIRING_SOON';
        }
    }
    return { expiry_status, days_until_expiry };
};

const reconcileBatchesWithStock = (rawBatches, itemQuantity) => {
    const list = (Array.isArray(rawBatches) ? rawBatches : []).map((b, idx) => ({
        id: b.id || `lot_${idx}`,
        quantity: Math.max(0, Number(Number(b.quantity || 0).toFixed(6))),
        mfg_date: b.mfg_date ? String(b.mfg_date).slice(0, 10) : null,
        exp_date: b.no_expiry ? null : (b.exp_date ? String(b.exp_date).slice(0, 10) : null),
        no_expiry: Boolean(b.no_expiry),
        added_at: b.added_at || null
    }));

    list.sort((a, b) => {
        if (a.no_expiry !== b.no_expiry) return a.no_expiry ? 1 : -1;
        if (a.exp_date && b.exp_date) return a.exp_date.localeCompare(b.exp_date);
        if (a.exp_date) return -1;
        if (b.exp_date) return 1;
        return String(a.added_at || '').localeCompare(String(b.added_at || ''));
    });

    if (itemQuantity === undefined || itemQuantity === null || list.length === 0) {
        return list;
    }

    const totalStock = Math.max(0, Number(Number(itemQuantity || 0).toFixed(6)));
    if (totalStock <= 0) {
        return list.map(b => ({ ...b, quantity: 0 })).filter((_, idx) => idx === 0 ? false : false);
    }

    const batchSum = Number(list.reduce((sum, b) => sum + Number(b.quantity || 0), 0).toFixed(6));
    if (batchSum > totalStock + 0.0001) {
        // Deduct excess from earliest expiring batches first (FEFO)
        let excess = Number((batchSum - totalStock).toFixed(6));
        const adjusted = [];
        for (const batch of list) {
            if (excess <= 0) {
                if (batch.quantity > 0 || batch.exp_date || batch.mfg_date) adjusted.push(batch);
                continue;
            }
            if (batch.quantity <= excess + 0.000001) {
                excess = Number((excess - batch.quantity).toFixed(6));
            } else {
                adjusted.push({
                    ...batch,
                    quantity: Number((batch.quantity - excess).toFixed(6))
                });
                excess = 0;
            }
        }
        return adjusted;
    }

    if (list.length === 1 && list[0].quantity === 0 && totalStock > 0) {
        return [{ ...list[0], quantity: totalStock }];
    }

    return list;
};

const decodeInventoryExpiry = (item) => {
    let parsed = null;
    if (item && typeof item.barcode === 'string' && item.barcode.trim().startsWith('{')) {
        try {
            parsed = JSON.parse(item.barcode);
        } catch (e) {
            parsed = null;
        }
    }

    const rawAlertDays = item?.expiry_alert_days ?? parsed?.expiry_alert_days;
    const expiry_alert_days = rawAlertDays !== undefined && rawAlertDays !== null && rawAlertDays !== ''
        ? Math.max(0, Number(rawAlertDays))
        : 7;

    // Only mark no_expiry = true when explicitly set to true
    const explicitNoExpiry = item?.no_expiry !== undefined
        ? Boolean(item.no_expiry)
        : parsed?.no_expiry === true;

    const todayKey = getBangkokDateKey(new Date());

    if (explicitNoExpiry) {
        const mfg_date = (item?.mfg_date ?? parsed?.mfg_date) || null;
        return {
            mfg_date,
            exp_date: null,
            no_expiry: true,
            expiry_alert_days,
            expiry_status: 'NO_EXPIRY',
            days_until_expiry: null,
            expiry_batches: []
        };
    }

    let rawBatches = Array.isArray(item?.expiry_batches)
        ? item.expiry_batches
        : Array.isArray(parsed?.batches)
            ? parsed.batches
            : [];

    const fallbackMfg = (item?.mfg_date ?? parsed?.mfg_date) || null;
    const fallbackExp = (item?.exp_date ?? parsed?.exp_date) || null;

    if (rawBatches.length === 0 && (fallbackMfg || fallbackExp)) {
        rawBatches = [{
            id: 'lot_legacy_0',
            quantity: Math.max(0, Number(item?.quantity || 0)),
            mfg_date: fallbackMfg,
            exp_date: fallbackExp,
            no_expiry: false,
            added_at: null
        }];
    }

    const reconciled = reconcileBatchesWithStock(rawBatches, item?.quantity);
    const enrichedBatches = reconciled.map((batch) => {
        const statusInfo = computeSingleExpiryStatus({
            exp_date: batch.exp_date,
            no_expiry: batch.no_expiry,
            expiry_alert_days,
            todayKey
        });
        return {
            ...batch,
            expiry_status: statusInfo.expiry_status,
            days_until_expiry: statusInfo.days_until_expiry
        };
    });

    if (enrichedBatches.length === 0) {
        return {
            mfg_date: null,
            exp_date: null,
            no_expiry: false,
            expiry_alert_days,
            expiry_status: 'UNSPECIFIED',
            days_until_expiry: null,
            expiry_batches: []
        };
    }

    // Determine primary/most urgent batch (earliest expiry date among batches with exp_date)
    const datedBatches = enrichedBatches.filter(b => !b.no_expiry && b.exp_date);
    const primaryBatch = datedBatches[0] || enrichedBatches[0];

    const allBatchesNoExpiry = enrichedBatches.length > 0 && enrichedBatches.every(b => b.no_expiry);

    return {
        mfg_date: primaryBatch?.mfg_date || null,
        exp_date: primaryBatch?.exp_date || null,
        no_expiry: allBatchesNoExpiry,
        expiry_alert_days,
        expiry_status: primaryBatch?.expiry_status || 'UNSPECIFIED',
        days_until_expiry: primaryBatch?.days_until_expiry ?? null,
        expiry_batches: enrichedBatches
    };
};

const addInventoryExpiryBatch = (item, { quantity, mfg_date, exp_date, no_expiry }) => {
    const decoded = decodeInventoryExpiry(item);
    const addQty = Math.max(0, Number(Number(quantity || 0).toFixed(6)));
    const cleanMfg = mfg_date && String(mfg_date).trim() ? String(mfg_date).trim().slice(0, 10) : null;
    const isBatchNoExpiry = Boolean(no_expiry);
    const cleanExp = isBatchNoExpiry || !(exp_date && String(exp_date).trim())
        ? null
        : String(exp_date).trim().slice(0, 10);

    const nextBatches = [...(decoded.expiry_batches || [])];

    if (addQty > 0 && (cleanMfg || cleanExp || isBatchNoExpiry)) {
        const existingIdx = nextBatches.findIndex(b =>
            (b.mfg_date || null) === cleanMfg &&
            (b.exp_date || null) === cleanExp &&
            Boolean(b.no_expiry) === isBatchNoExpiry
        );
        if (existingIdx >= 0) {
            nextBatches[existingIdx] = {
                ...nextBatches[existingIdx],
                quantity: Number((Number(nextBatches[existingIdx].quantity || 0) + addQty).toFixed(6))
            };
        } else {
            nextBatches.push({
                id: `lot_${Date.now()}_${nextBatches.length}`,
                quantity: addQty,
                mfg_date: cleanMfg,
                exp_date: cleanExp,
                no_expiry: isBatchNoExpiry,
                added_at: new Date().toISOString()
            });
        }
    }

    const itemLevelNoExpiry = decoded.no_expiry && isBatchNoExpiry && nextBatches.every(b => b.no_expiry);

    return encodeInventoryExpiry({
        no_expiry: itemLevelNoExpiry,
        expiry_alert_days: decoded.expiry_alert_days,
        batches: nextBatches
    });
};

const deductInventoryExpiryBatch = (item, { deduct_qty, batch_id, new_total_quantity }) => {
    const decoded = decodeInventoryExpiry(item);
    let remainingToDeduct = Math.max(0, Number(Number(deduct_qty || 0).toFixed(6)));
    let nextBatches = (decoded.expiry_batches || []).map(b => ({ ...b }));

    if (batch_id && remainingToDeduct > 0) {
        const targetIdx = nextBatches.findIndex(b => String(b.id) === String(batch_id));
        if (targetIdx >= 0) {
            const available = Number(nextBatches[targetIdx].quantity || 0);
            if (available <= remainingToDeduct + 0.000001) {
                remainingToDeduct = Number((remainingToDeduct - available).toFixed(6));
                nextBatches.splice(targetIdx, 1);
            } else {
                nextBatches[targetIdx].quantity = Number((available - remainingToDeduct).toFixed(6));
                remainingToDeduct = 0;
            }
        }
    }

    if (remainingToDeduct > 0 && nextBatches.length > 0) {
        const afterFefo = [];
        for (const batch of nextBatches) {
            if (remainingToDeduct <= 0) {
                afterFefo.push(batch);
                continue;
            }
            const available = Number(batch.quantity || 0);
            if (available <= remainingToDeduct + 0.000001) {
                remainingToDeduct = Number((remainingToDeduct - available).toFixed(6));
            } else {
                afterFefo.push({
                    ...batch,
                    quantity: Number((available - remainingToDeduct).toFixed(6))
                });
                remainingToDeduct = 0;
            }
        }
        nextBatches = afterFefo;
    }

    if (new_total_quantity !== undefined && Number(new_total_quantity) <= 0) {
        nextBatches = [];
    }

    return encodeInventoryExpiry({
        no_expiry: decoded.no_expiry,
        expiry_alert_days: decoded.expiry_alert_days,
        batches: nextBatches
    });
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
            if ((type === 'STOCK_EXPIRING' || type === 'STOCK_EXPIRED') && settings.notify_expiry === false) allowNotify = false;
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
        .select('id, name, quantity, unit, min_threshold, barcode, status')
        .eq('id', itemId).eq('shop_id', shopId).single();
    if (error) throw error;
    if (!item) return null;

    const baseUnit = String(item.unit || 'หน่วย').split('|')[0] || 'หน่วย';
    const minimum = Number(item.min_threshold || 0);
    const state = getState(item.quantity, minimum);

    let stockNotif = null;
    if (state === 'NORMAL' || item.status === 'inactive') {
        await db.from('notifications').update({ is_active: false })
            .eq('shop_id', shopId).eq('entity_type', 'inventory_item').eq('entity_id', item.id).in('type', ['STOCK_LOW', 'STOCK_OUT']);
    } else {
        const isOut = state === 'OUT_OF_STOCK';
        await db.from('notifications').update({ is_active: false })
            .eq('shop_id', shopId)
            .eq('entity_type', 'inventory_item')
            .eq('entity_id', item.id)
            .eq('type', isOut ? 'STOCK_LOW' : 'STOCK_OUT');

        stockNotif = await createNotification({
            shopId,
            userId,
            type: isOut ? 'STOCK_OUT' : 'STOCK_LOW',
            priority: isOut ? 'CRITICAL' : 'WARNING',
            title: isOut ? 'สินค้าหมด' : 'สินค้าใกล้หมด',
            message: isOut ? `${item.name} หมดสต็อกแล้ว` : `${item.name} เหลือ ${item.quantity} ${baseUnit} (ขั้นต่ำคือ ${minimum} ${baseUnit})`,
            entityType: 'inventory_item',
            entityId: item.id,
            actionTarget: `/pos/inventory?item_id=${item.id}`,
            metadata: { quantity: item.quantity, minimum, unit: baseUnit, eventState: state }
        });
    }

    // Sync Expiration Notifications across all active batches
    const expiryInfo = decodeInventoryExpiry(item);
    const hasStock = Number(item.quantity || 0) > 0 && item.status !== 'inactive';
    const alertBatches = (expiryInfo.expiry_batches || []).filter(b =>
        !b.no_expiry &&
        b.exp_date &&
        Number(b.quantity || 0) > 0 &&
        (b.expiry_status === 'EXPIRED' || b.expiry_status === 'EXPIRES_TODAY' || b.expiry_status === 'EXPIRING_SOON')
    );

    const shouldAlertExpiry = hasStock && !expiryInfo.no_expiry && expiryInfo.expiry_alert_days > 0 && alertBatches.length > 0;

    if (!shouldAlertExpiry) {
        await db.from('notifications').update({ is_active: false })
            .eq('shop_id', shopId)
            .eq('entity_type', 'inventory_item')
            .eq('entity_id', item.id)
            .in('type', ['STOCK_EXPIRING', 'STOCK_EXPIRED']);
        return stockNotif;
    }

    const mostUrgentBatch = alertBatches[0];
    const isExpired = mostUrgentBatch.expiry_status === 'EXPIRED' || mostUrgentBatch.expiry_status === 'EXPIRES_TODAY';
    const notifType = isExpired ? 'STOCK_EXPIRED' : 'STOCK_EXPIRING';
    const batchSummaryKey = alertBatches.map(b => `${b.expiry_status}:${b.exp_date}:${b.quantity}`).join('|');
    const eventState = batchSummaryKey;
    const expectedDedupeKey = `${notifType}:inventory_item:${item.id}:${eventState}`;

    await db.from('notifications').update({ is_active: false })
        .eq('shop_id', shopId)
        .eq('entity_type', 'inventory_item')
        .eq('entity_id', item.id)
        .in('type', ['STOCK_EXPIRING', 'STOCK_EXPIRED'])
        .neq('dedupe_key', expectedDedupeKey);

    const formattedExp = formatThaiDate(mostUrgentBatch.exp_date);
    const extraLotsSuffix = alertBatches.length > 1 ? ` (และอีก ${alertBatches.length - 1} ล็อต)` : '';
    const batchQtyText = `${mostUrgentBatch.quantity} ${baseUnit}`;

    let title = 'สินค้าใกล้หมดอายุ';
    let message = `${item.name} ล็อตจำนวน ${batchQtyText} จะหมดอายุในอีก ${mostUrgentBatch.days_until_expiry} วัน (หมดอายุ: ${formattedExp})${extraLotsSuffix}`;

    if (mostUrgentBatch.expiry_status === 'EXPIRES_TODAY') {
        title = 'สินค้าหมดอายุวันนี้';
        message = `${item.name} ล็อตจำนวน ${batchQtyText} หมดอายุวันนี้ (${formattedExp})${extraLotsSuffix}`;
    } else if (mostUrgentBatch.expiry_status === 'EXPIRED') {
        title = 'สินค้าหมดอายุแล้ว';
        message = `${item.name} ล็อตจำนวน ${batchQtyText} หมดอายุแล้วเมื่อ ${formattedExp} (เลยกำหนด ${Math.abs(mostUrgentBatch.days_until_expiry || 0)} วัน)${extraLotsSuffix}`;
    }

    await createNotification({
        shopId,
        userId,
        type: notifType,
        priority: isExpired ? 'CRITICAL' : 'WARNING',
        title,
        message,
        entityType: 'inventory_item',
        entityId: item.id,
        actionTarget: `/pos/inventory?item_id=${item.id}`,
        metadata: {
            mfg_date: mostUrgentBatch.mfg_date,
            exp_date: mostUrgentBatch.exp_date,
            days_until_expiry: mostUrgentBatch.days_until_expiry,
            expiry_status: mostUrgentBatch.expiry_status,
            batches_count: alertBatches.length,
            eventState
        }
    });

    return stockNotif;
};

module.exports = {
    createNotification,
    syncInventoryNotification,
    getState,
    encodeInventoryExpiry,
    decodeInventoryExpiry,
    addInventoryExpiryBatch,
    deductInventoryExpiryBatch,
    formatThaiDate
};


