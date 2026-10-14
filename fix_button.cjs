const fs = require('fs');

let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const targetButtonStr = `<div className="flex items-center space-x-3">`;

const newButtonStr = `<div className="flex items-center space-x-3">
  <button onClick={handleFetchOrder} disabled={loading} className="px-4 py-2 bg-[#2563EB] text-white rounded-lg font-bold shadow hover:bg-blue-600 transition disabled:opacity-50 text-sm">
    {loading ? 'Generating...' : 'Generate Order'}
  </button>`;

code = code.replace(targetButtonStr, newButtonStr);

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Added generate button');
