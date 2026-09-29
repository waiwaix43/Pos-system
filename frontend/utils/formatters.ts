export const formatCurrency = (amount: number, currencyCode: string = 'THB') => {
    try {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2
        }).format(amount);
    } catch (e) {
        return amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' ' + currencyCode;
    }
};

export const formatDate = (dateString: string | Date, formatStr: string = 'DD/MM/YYYY', timezone: string = 'auto') => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    
    // Simple timezone adjustment for basic rendering if not auto
    let opts: Intl.DateTimeFormatOptions = { 
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    };
    if (timezone && timezone !== 'auto') {
        opts.timeZone = timezone;
    }
    
    try {
        const parts = new Intl.DateTimeFormat('en-GB', opts).formatToParts(d);
        const map: any = {};
        parts.forEach(p => map[p.type] = p.value);
        
        let out = formatStr;
        out = out.replace('DD', map.day);
        out = out.replace('MM', map.month);
        out = out.replace('YYYY', map.year);
        
        // Return date + time
        return `${out} ${map.hour}:${map.minute}:${map.second}`;
    } catch(e) {
        return d.toLocaleString('th-TH');
    }
};
