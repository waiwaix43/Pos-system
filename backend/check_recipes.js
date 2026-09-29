const fs = require('fs');
let c = fs.readFileSync('seed.js', 'utf8');

const pStart = c.indexOf('const prodData = [');
const pEnd = c.indexOf('];', pStart);
const pData = c.substring(pStart, pEnd);

const rStart = c.indexOf('const addRecipe = (prodName, items) => {');
const rEnd = c.indexOf('if(recipeData.length > 0) {', rStart);
const rData = c.substring(rStart, rEnd);

let missing = 0;
const pMatches = pData.match(/name:\s*'([^']+)'/g);
if (pMatches) {
  pMatches.forEach(m => {
    const name = m.split("'")[1];
    if (!rData.includes("'" + name + "'")) {
      console.log('Missing recipe for:', name);
      missing++;
    }
  });
}
console.log('Total missing:', missing);
