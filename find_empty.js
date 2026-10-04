const fs = require('fs');
const path = require('path');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            if(!file.includes('node_modules') && !file.includes('.next')) {
                results = results.concat(walk(file));
            }
        } else { 
            if(file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
        }
    });
    return results;
}
const files = walk('./frontend');
let results = [];
files.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if(line.replace(/\s/g, '').includes('onClick={()=>{}') || line.replace(/\s/g, '').includes('()=>console.log')) {
            results.push(f + ':' + (i+1) + ' ' + line.trim().substring(0, 100));
        }
    });
});
fs.writeFileSync('audit_results_2.txt', results.join('\n'));
console.log('Found ' + results.length + ' issues');
