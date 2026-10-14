const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

const targetStr = `    // Call 2: Task 2 Order Note String
    const task2Prompt = \`\${getDynamicPrompt(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile)}

Using the current state, generate the final Daily Smart Order Note exactly as formatted in TASK 2.`;

const newStr = `    // Call 2: Task 2 Order Note String
    const requestedOrders = req.body.orders || [];
    const task2Prompt = \`\${getDynamicPrompt(typeof currentActiveProfile !== "undefined" ? currentActiveProfile : activeAccountProfile)}

Using the current state, generate the final Daily Smart Order Note exactly as formatted in TASK 2.

CRITICAL INSTRUCTION FOR TASK 2:
Use the exact net calculated quantities provided in the REQUEST PAYLOAD below. Do NOT calculate your own quantities.
REQUEST PAYLOAD (Strict quantities to order):
\${JSON.stringify(requestedOrders, null, 2)}
`;

serverCode = serverCode.replace(targetStr, newStr);

fs.writeFileSync('server.ts', serverCode);
console.log('Fixed generate-order payload injection');
