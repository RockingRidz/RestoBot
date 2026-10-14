const fs = require('fs');

let server = fs.readFileSync('server.ts', 'utf8');

// 1. Update the system prompt to use priceSpikeAlerts
server = server.replace(
  /"priceSpikeAlert": \{/g,
  `"priceSpikeAlerts": [\n    {`
);
server = server.replace(
  /    "kitchenPrepTip": "String"\n  \},/g,
  `    "kitchenPrepTip": "String"\n    }\n  ],`
);

server = server.replace(
  /Set "priceSpikeAlert": \{ "detected": false/g,
  `Set "priceSpikeAlerts": [ { "detected": false`
);

server = server.replace(
  /Proceed with baseline vendors." \}/g,
  `Proceed with baseline vendors." } ]`
);

// 2. Update the fallback logic
server = server.replace(
  /priceSpikeAlert: \{/g,
  `priceSpikeAlerts: [{\n`
);
server = server.replace(
  /    return res.json\(\{ error: err\.message, stack: err\.stack, _mode: "error_fallback" \}\);/g,
  `    // Removed early return to allow fallback data`
);

// 3. Update the parsed data return
server = server.replace(
  /const alert = combinedJson\.priceSpikeAlert \|\| \{\};/g,
  `const alert = combinedJson.priceSpikeAlerts || combinedJson.priceSpikeAlert || {};\n    const alertsArray = Array.isArray(alert) ? alert : [alert];`
);
server = server.replace(
  /priceSpikeAlert: combinedJson\.priceSpikeAlert,/g,
  `priceSpikeAlerts: alertsArray,`
);

// Make sure fallback returns array closure
server = server.replace(
  /kitchen_action_tip: "Maintain standard frying temps as Canola Oil handles high heat identically to Refined Frying Oil."\n      \},/g,
  `kitchenPrepTip: "Maintain standard frying temps as Canola Oil handles high heat identically to Refined Frying Oil."\n      }],`
);


// Also update the instructions in prompt
server = server.replace(
  /evaluate the highest risk ingredient to generate the priceSpikeAlert/g,
  `evaluate EVERY ingredient and generate a priceSpikeAlerts array item for each ingredient that has a price spike, or a cost saving substitute, or out of stock risk`
);

fs.writeFileSync('server.ts', server);
console.log("server.ts updated");

