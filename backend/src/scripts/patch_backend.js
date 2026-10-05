const fs = require('fs');
const path = require('path');
let content = fs.readFileSync('server.js', 'utf8');

if(!content.includes('jsonwebtoken')) {
    content = content.replace("const cors = require('cors');", "const cors = require('cors');\nconst jwt = require('jsonwebtoken');\nconst JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pos_key_2026';");
}

const authMiddleware = `
// --- JWT Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: 'ไม่พบ Token ยืนยันตัวตน' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' });
        req.user = user;
        next();
    });
};

app.use('/api', (req, res, next) => {
    if (req.path === '/login' || req.path === '/register') {
        return next();
    }
    authenticateToken(req, res, next);
});
`;

if(!content.includes('authenticateToken')) {
    content = content.replace("app.post('/api/verify-pin'", authMiddleware + "\napp.post('/api/verify-pin'");
}

if(!content.includes('jwt.sign(')) {
    content = content.replace("user: { id: user.id", "token: jwt.sign({ id: user.id, shop_id: user.shop_id, role: user.role }, JWT_SECRET, { expiresIn: '12h' }),\n            user: { id: user.id");
}

// Security: Prevent sending actual DB error messages
content = content.replaceAll("res.status(500).json({ error: err.message })", "res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' })");
content = content.replaceAll("res.status(500).json({ error: e.message })", "res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' })");

fs.writeFileSync('server.js', content, 'utf8');
console.log('Backend updated successfully');
