const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

const danglingCode = `}/g, profile.restaurantName || "Troy Grill & Diner");
  prompt = prompt.replace(/{{RESTO_LOC}}/g, profile.location || "48084");
  prompt = prompt.replace(/{{RESTO_CUISINE}}/g, profile.cuisineType || "American Diner");
  prompt = prompt.replace(/{{RESTO_USER}}/g, profile.userName || "Manager Alex");
  return prompt;
}`;

serverCode = serverCode.replace(danglingCode, '');
fs.writeFileSync('server.ts', serverCode);
console.log('Fixed dangling code.');
