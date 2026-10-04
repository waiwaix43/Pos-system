const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const roleMiddleware = `
// Role-based Authorization Middleware
const authorizeRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ error: '\\u0E44\\u0E21\\u0E48\\u0E1E\\u0E1A\\u0E2A\\u0E34\\u0E17\\u0E18\\u0E34\\u0E4C\\u0E01\\u0E32\\u0E23\\u0E43\\u0E0A\\u0E49\\u0E07\\u0E32\\u0E19' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: '\\u0E04\\u0E38\\u0E13\\u0E44\\u0E21\\u0E48\\u0E21\\u0E35\\u0E2A\\u0E34\\u0E17\\u0E18\\u0E34\\u0E4C\\u0E43\\u0E0A\\u0E49\\u0E07\\u0E32\\u0E19\\u0E2A\\u0E48\\u0E27\\u0E19\\u0E19\\u0E35\\u0E49' });
        }
        next();
    };
};
`;

if(!content.includes('authorizeRole')) {
    content = content.replace("app.use('/api', (req, res, next) => {", roleMiddleware + "\napp.use('/api', (req, res, next) => {");
}

const criticalRoutes = [
    { method: 'delete', path: '/api/categories/:id' },
    { method: 'delete', path: '/api/products/:id' },
    { method: 'delete', path: '/api/recipes/:id' },
    { method: 'post', path: '/api/orders/:id/void' },
    { method: 'delete', path: '/api/inventory/categories/:id' },
    { method: 'delete', path: '/api/inventory/items/:id' },
    { method: 'delete', path: '/api/payment-methods/:id' },
    { method: 'delete', path: '/api/promotions/:id' },
    { method: 'delete', path: '/api/staff/:id' }
];

criticalRoutes.forEach(route => {
    const searchStr = `app.${route.method}('${route.path}', async (req, res) => {`;
    const replaceStr = `app.${route.method}('${route.path}', authorizeRole(['\\u0E40\\u0E08\\u0E49\\u0E32\\u0E02\\u0E2D\\u0E07\\u0E23\\u0E49\\u0E32\\u0E19', '\\u0E1C\\u0E39\\u0E49\\u0E08\\u0E31\\u0E14\\u0E01\\u0E32\\u0E23', 'Admin', 'Owner', 'Manager', 'admin']), async (req, res) => {`;
    content = content.replace(searchStr, replaceStr);
});

fs.writeFileSync('server.js', content, 'utf8');
console.log('Role authorization added');
