const fs = require('fs');
let content = fs.readFileSync('frontend/app/pos/menu/page.tsx', 'utf8');
content = content.replace(/showToast\("[\s\S]{10,40}", "error"\);\n\s*return;\n\s*\}/, 'showToast("กรุณาล้างการค้นหาและฟิลเตอร์ก่อนจัดเรียง", "error");\n      return;\n    }');
content = content.replace(/if \(!res\.ok\) throw new Error\("[\s\S]{10,40}"\);/, 'if (!res.ok) throw new Error("ไม่สามารถบันทึกลำดับได้");');
content = content.replace(/showToast\("[\s\S]{10,40}", "success"\);/, 'showToast("บันทึกลำดับเรียบร้อย", "success");');
content = content.replace(/title="[\s\S]{1,10}">\n\s*<ArrowUp/g, 'title="เลื่อนขึ้น">\n                                         <ArrowUp');
content = content.replace(/title="[\s\S]{1,10}">\n\s*<ArrowDown/g, 'title="เลื่อนลง">\n                                         <ArrowDown');
fs.writeFileSync('frontend/app/pos/menu/page.tsx', content, 'utf8');
