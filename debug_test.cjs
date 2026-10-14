const fetch = require('node-fetch');
(async () => {
  const res = await fetch('http://127.0.0.1:3000/api/generate-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-resto-session': JSON.stringify({}) },
    body: JSON.stringify({ orders: [] })
  });
  console.log(res.status);
  console.log(await res.text());
})();
