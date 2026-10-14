const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/generate-order',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-resto-session': '{"restaurant_name":"Pure Govinda Foods","cuisine_type":"Sattvik Indian","user_name":"Radha Sharma","is_authenticated":true,"isPureVegetarian":true}'
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(body));
});

req.write(JSON.stringify({
  orders: [
    { ingredient: "Pure Desi Ghee (80% Fat)", quantity: "2 x 35 lb Tubs", baselinePrice: 120.00, currentPrice: 148.00 }
  ]
}));
req.end();
