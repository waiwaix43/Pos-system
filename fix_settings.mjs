import fs from 'fs';
let content = fs.readFileSync('frontend/src/app/pos/settings/page.tsx', 'utf8');

const badBlock = `                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    
                                <div className="col-span-1 md:col-span-2 mb-2 p-4 border border-blue-100 bg-blue-50 rounded-xl">`;

const goodBlock = `                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-1 md:col-span-2 mb-2 p-4 border border-blue-100 bg-blue-50 rounded-xl">`;

content = content.replace(badBlock, goodBlock);
fs.writeFileSync('frontend/src/app/pos/settings/page.tsx', content);
console.log("Fixed unbalanced div");
