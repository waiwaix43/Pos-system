const fs = require('fs');
const lines = fs.readFileSync('server.js', 'utf8').split('\n');
let newLines = [];
let skip = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('if (error) throw error; res.json(data);')) {
        // skip this and next 2 lines
        i += 2;
        continue;
    }
    newLines.push(lines[i]);
}
fs.writeFileSync('server.js', newLines.join('\n'), 'utf8');
