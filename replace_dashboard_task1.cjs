const fs = require('fs');

let dash = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// The main block to replace is the one rendering `task1Data`
// I will replace `(task1Data && task1Data.detected) ? (` with a mapping logic.

dash = dash.replace(
  /\(task1Data && task1Data\.detected\) \? \(/g,
  `(task1Data && task1Data.length > 0 && task1Data.some(t => t.detected)) ? (\n                  <div className="space-y-4">\n                  {task1Data.filter(t => t.detected).map((alert, idx) => (\n`
);

// We need to replace all instances of `task1Data.` inside this block with `alert.`
// I'll do this carefully.
const blockStartStr = `<div className="space-y-4">\n                  {task1Data.filter(t => t.detected).map((alert, idx) => (\n`;
const splitIndex = dash.indexOf(blockStartStr);
if (splitIndex !== -1) {
  let before = dash.substring(0, splitIndex + blockStartStr.length);
  let after = dash.substring(splitIndex + blockStartStr.length);
  
  // Find the end of the block. It ends with `                  </div>\n                ) : (`
  const endMarker = `                  </div>\n                ) : (`;
  const endIndex = after.indexOf(endMarker);
  
  let blockToModify = after.substring(0, endIndex);
  let rest = after.substring(endIndex);
  
  // Replace task1Data with alert inside the block
  blockToModify = blockToModify.replace(/task1Data\./g, 'alert.');
  // Add key to the outer div
  blockToModify = blockToModify.replace(/<div className="flex flex-col space-y-4">/, `<div key={idx} className="flex flex-col space-y-4 border-b border-gray-100 pb-4 last:border-0 last:pb-0">`);
  
  // Need to close the map
  blockToModify = blockToModify + `                  ))}`;
  
  dash = before + blockToModify + rest;
}


// Now fix the table where it checks `task1Data && substituteStatus !== 'rejected' && task1Data.detected`
// Replace it with map
dash = dash.replace(
  /\{task1Data && substituteStatus !== 'rejected' && task1Data\.detected && \(/g,
  `{task1Data && substituteStatus !== 'rejected' && task1Data.filter(t => t.detected).map((alert, idx) => (`
);
dash = dash.replace(
  /\{task1Data\.recommendedSubstitute\}/g,
  `{alert.recommendedSubstitute}`
);
dash = dash.replace(
  /        \{alert\.recommendedSubstitute\} <span className="ml-2 text-\[10px\] bg-emerald-100 text-emerald-800 px-1\.5 py-0\.5 rounded uppercase tracking-wider">Sub<\/span>\n      <\/td>\n      <td className="px-6 py-4 text-slate-600">--<\/td>\n      <td className="px-6 py-4 font-medium text-rose-600 bg-rose-50\/30 group-hover:bg-rose-50\/60 transition-colors">0\.0<\/td>\n      <td className="px-6 py-4 font-bold text-\[\#2563EB\] bg-slate-50\/50 group-hover:bg-blue-50\/30 transition-colors">Recommended<\/td>\n    <\/tr>\n  \)}/g,
  `        {alert.recommendedSubstitute} <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded uppercase tracking-wider">Sub</span>\n      </td>\n      <td className="px-6 py-4 text-slate-600">--</td>\n      <td className="px-6 py-4 font-medium text-rose-600 bg-rose-50/30 group-hover:bg-rose-50/60 transition-colors">0.0</td>\n      <td className="px-6 py-4 font-bold text-[#2563EB] bg-slate-50/50 group-hover:bg-blue-50/30 transition-colors">Recommended</td>\n    </tr>\n  ))}`
);

// We need to fix the copy paste logic too
dash = dash.replace(
  /if \(substituteStatus === 'accepted' && task1Data\) \{[\s\S]*?return updatedText;/gm,
  `if (substituteStatus === 'accepted' && task1Data && task1Data.length > 0) {
                        let updatedText = task2Text;
                        task1Data.filter(t => t.detected).forEach(alert => {
                          if (alert.originalIngredient === 'Refined Frying Oil') {
                            updatedText = updatedText.replace(/Refined Frying Oil/gi, alert.recommendedSubstitute);
                          } else {
                            updatedText = updatedText.replace(new RegExp(alert.originalIngredient, 'gi'), alert.recommendedSubstitute);
                          }
                        });
                        return updatedText;`
);

dash = dash.replace(
  /if \(substituteStatus === 'accepted' && task1Data\) \{[\s\S]*?textToCopy = textToCopy\.replace\(new RegExp\(task1Data\.originalIngredient, 'gi'\), task1Data\.recommendedSubstitute\);\n        \}\n      \}/gm,
  `if (substituteStatus === 'accepted' && task1Data && task1Data.length > 0) {
        task1Data.filter(t => t.detected).forEach(alert => {
          if (alert.originalIngredient === 'Refined Frying Oil') {
            textToCopy = textToCopy.replace(/Refined Frying Oil/gi, alert.recommendedSubstitute);
          } else {
            textToCopy = textToCopy.replace(new RegExp(alert.originalIngredient, 'gi'), alert.recommendedSubstitute);
          }
        });
      }`
);

// Fix the little label
dash = dash.replace(
  /task1Data\?\.originalIngredient/g,
  `task1Data[0]?.originalIngredient`
);
dash = dash.replace(
  /task1Data\?\.priceIncreasePct/g,
  `task1Data[0]?.priceIncreasePct`
);


fs.writeFileSync('src/components/Dashboard.tsx', dash);
console.log("Dashboard.tsx updated");

