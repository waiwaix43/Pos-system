const fs = require('fs');
let content = fs.readFileSync('frontend/app/pos/page.tsx', 'utf8');
content = content.replace(
  'setCategories(res);\n                if (res.length > 0) setSelectedCategory(res[0].id);',
  'setCategories(res.filter((c: any) => c.status === \'active\' || !c.status));\n                const activeCats = res.filter((c: any) => c.status === \'active\' || !c.status);\n                if (activeCats.length > 0) setSelectedCategory(activeCats[0].id);'
);
content = content.replace(
  '.then(res => { if (Array.isArray(res)) setAllOptions(res); });',
  '.then(res => { if (Array.isArray(res)) setAllOptions(res.filter((o: any) => o.status === \'active\' || !o.status)); });'
);
content = content.replace(
  'if (Array.isArray(data)) setProducts(data);',
  'if (Array.isArray(data)) setProducts(data.filter((p: any) => p.status === \'active\' || !p.status));'
);
content = content.replace(
  'setAllOptions(optsData);\n        currentAllOpts = optsData;',
  'const activeOpts = optsData.filter((o: any) => o.status === \'active\' || !o.status); setAllOptions(activeOpts);\n        currentAllOpts = activeOpts;'
);
fs.writeFileSync('frontend/app/pos/page.tsx', content, 'utf8');
