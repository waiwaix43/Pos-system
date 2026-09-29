const fs = require('fs');
let content = fs.readFileSync('frontend/app/pos/menu/page.tsx', 'utf8');

const regex = /try\s*\{\s*if\s*\(!res\.ok\)[\s\S]*?showToast\(err\.message,\s*"error"\);\s*fetchAllData\(user\?\.shop_id\s*\|\|\s*1\);\s*\}/;

const replacement = `try {
      const orderedIds = newCategories.map(c => c.id);
      const res = await fetch('http://localhost:5000/api/categories/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: user?.shop_id || 1, ordered_ids: orderedIds })
      });
      if (!res.ok) throw new Error("ไม่สามารถบันทึกลำดับได้");
      showToast("บันทึกลำดับเรียบร้อย", "success");
    } catch (err: any) {
      showToast(err.message, "error");
      fetchAllData(user?.shop_id || 1);
    }`;

content = content.replace(regex, replacement);
fs.writeFileSync('frontend/app/pos/menu/page.tsx', content, 'utf8');
