const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

// The easiest way to fix TS complaining about currentActiveProfile is to define it globally as undefined,
// then override it inside the route where it is used.
serverCode = serverCode.replace(/let activeAccountProfile = \{[\s\S]*?\};\n/, '$&\nlet currentActiveProfile: any = undefined;\n');

// Inside app.post('/api/generate-order'
serverCode = serverCode.replace(/const currentActiveProfile = \{/g, 'currentActiveProfile = {');

fs.writeFileSync('server.ts', serverCode);
console.log('Fixed TS variable scope');
