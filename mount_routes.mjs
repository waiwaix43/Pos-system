import fs from 'fs';

let content = fs.readFileSync('backend/src/server.js', 'utf8');
let lines = content.split('\n');

const routerMountLine = lines.findIndex(l => l.includes("app.use('/api',"));
if (routerMountLine !== -1) {
    const importStr = `const paymentRoutes = require('./routes/paymentRoutes');\napp.use('/api/payments', paymentRoutes);\n`;
    lines.splice(routerMountLine, 0, importStr);
    fs.writeFileSync('backend/src/server.js', lines.join('\n'));
    console.log("Mounted paymentRoutes.");
} else {
    // If not found, just put it before module.exports or near the bottom
    lines.splice(lines.length - 2, 0, `const paymentRoutes = require('./routes/paymentRoutes');\napp.use('/api/payments', paymentRoutes);\n`);
    fs.writeFileSync('backend/src/server.js', lines.join('\n'));
    console.log("Mounted paymentRoutes at bottom.");
}
