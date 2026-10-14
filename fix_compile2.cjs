const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

serverCode = serverCode.replace(/getDynamicPrompt\(currentActiveProfile\)/g, 'getDynamicPrompt(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile)');

serverCode = serverCode.replace(/currentActiveProfile\.restaurantName/g, '(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).restaurantName');

serverCode = serverCode.replace(/currentActiveProfile\.location/g, '(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).location');

serverCode = serverCode.replace(/currentActiveProfile\.cuisineType/g, '(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).cuisineType');

serverCode = serverCode.replace(/currentActiveProfile\.userName/g, '(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).userName');

serverCode = serverCode.replace(/currentActiveProfile\.wholesaler/g, '(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile).wholesaler');

// Oh wait, `activeAccountProfile` is defined at the bottom of the file!
// Let's move the declaration of `activeAccountProfile` to the top of the file, right after db definitions.
const activeAccountRegex = /let activeAccountProfile = {[\s\S]*?};/;
const match = serverCode.match(activeAccountRegex);
if (match) {
  serverCode = serverCode.replace(activeAccountRegex, '');
  const dbEndRegex = /let dbWasteEntries: any\[\] = \[\];/;
  serverCode = serverCode.replace(dbEndRegex, `let dbWasteEntries: any[] = [];\n\n${match[0]}\n`);
}

fs.writeFileSync('server.ts', serverCode);
console.log('Fixed undefined variables');
