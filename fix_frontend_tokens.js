const fs = require('fs');

// Fix pin/page.tsx
let pinContent = fs.readFileSync('frontend/app/pin/page.tsx', 'utf8');
pinContent = pinContent.replace('localStorage.setItem("userContext", JSON.stringify(data.user));', 'localStorage.setItem("userContext", JSON.stringify({ ...data.user, token: data.token || (JSON.parse(localStorage.getItem("userContext") || "{}")).token }));');
fs.writeFileSync('frontend/app/pin/page.tsx', pinContent, 'utf8');

// Fix page.tsx (Login)
let loginContent = fs.readFileSync('frontend/app/page.tsx', 'utf8');
loginContent = loginContent.replace('shop_name: data.user.shop_name,', 'shop_name: data.user.shop_name,\n          token: data.token,');
fs.writeFileSync('frontend/app/page.tsx', loginContent, 'utf8');
