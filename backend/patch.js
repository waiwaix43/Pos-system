const fs = require('fs');
let code = fs.readFileSync('src/server.js', 'utf8');

const fetchAllStr = `const fetchAll = async (qFn) => {
    let all = [], from = 0, limit = 1000;
    while(true) {
        const {data, error} = await qFn().range(from, from + limit - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < limit) break;
        from += limit;
    }
    return all;
};

app.get('/api/reports/summary',`;

code = code.replace(`app.get('/api/reports/summary',`, fetchAllStr);
code = code.replace(/const { data: orders } = await db\.from\('orders'\)(.*);/g, 'const orders = await fetchAll(() => db.from(\'orders\')$1);');

fs.writeFileSync('src/server.js', code);
console.log('patched');
