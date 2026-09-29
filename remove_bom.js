const fs = require('fs');
function removeBOM(file) {
  const buf = fs.readFileSync(file);
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    fs.writeFileSync(file, buf.slice(3));
    console.log('Removed BOM from', file);
  }
}
removeBOM('frontend/app/pos/menu/page.tsx');
removeBOM('frontend/app/pos/page.tsx');
removeBOM('frontend/app/pos/settings/page.tsx');
removeBOM('frontend/app/components/InteractiveShopMap.tsx');
