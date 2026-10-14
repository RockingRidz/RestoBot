const fs = require('fs');

let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(/<span className="text-2xl font-extrabold text-slate-900">145 Burgers<\/span>/g, '<span className="text-2xl font-extrabold text-slate-900">145 {recipes.length > 0 ? recipes[0].name : "Items"}</span>');

// For the table:
const tableStartRegex = /<tbody className="text-sm text-slate-700 divide-y divide-gray-100">[\s\S]*?<\/tbody>/;

const newTable = `
<tbody className="text-sm text-slate-700 divide-y divide-gray-100">
  {ingredients.length > 0 ? ingredients.slice(0, 3).map((ing, i) => (
    <tr key={i} className="hover:bg-slate-50 transition-colors group">
      <td className="px-6 py-4 font-semibold text-slate-900">{ing.name}</td>
      <td className="px-6 py-4 text-slate-600">{Number(ing.current_stock || 0).toFixed(1)} {ing.unit}</td>
      <td className="px-6 py-4 font-medium text-[#D97706] bg-amber-50/30 group-hover:bg-amber-50/60 transition-colors">{(Number(ing.current_stock || 0) * 0.3).toFixed(1)} {ing.unit}</td>
      <td className="px-6 py-4 font-bold text-[#2563EB] bg-slate-50/50 group-hover:bg-blue-50/30 transition-colors">1 x {ing.unit}</td>
    </tr>
  )) : (
    <tr className="hover:bg-slate-50 transition-colors group">
      <td colSpan={4} className="px-6 py-4 text-center text-slate-500">No ingredients configured.</td>
    </tr>
  )}
  {task1Data && substituteStatus !== 'rejected' && task1Data.detected && (
    <tr className="bg-[#ECFDF5]/40 hover:bg-[#ECFDF5]/70 transition-colors border-l-2 border-l-[#059669] group">
      <td className="px-6 py-4 font-bold text-[#059669] flex items-center">
        {task1Data.recommendedSubstitute} <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded uppercase tracking-wider">Sub</span>
      </td>
      <td className="px-6 py-4 text-slate-600">--</td>
      <td className="px-6 py-4 font-medium text-rose-600 bg-rose-50/30 group-hover:bg-rose-50/60 transition-colors">0.0</td>
      <td className="px-6 py-4 font-bold text-[#2563EB] bg-slate-50/50 group-hover:bg-blue-50/30 transition-colors">Recommended</td>
    </tr>
  )}
</tbody>
`;

code = code.replace(tableStartRegex, newTable.trim());

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Fixed burgers and table');
