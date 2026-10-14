const fs = require('fs');
let dashCode = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const oldBuns = `<td className="px-6 py-4 text-slate-600">156 units</td>`;
const newBuns = `<td className="px-6 py-4 text-slate-600">328 units</td>`;

dashCode = dashCode.replace(oldBuns, newBuns);

fs.writeFileSync('src/components/Dashboard.tsx', dashCode);
console.log('Updated Dashboard.tsx table values');
