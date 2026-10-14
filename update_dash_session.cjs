const fs = require('fs');

let dashCode = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const sessionObj = `    const mockSession = {
      restaurant_id: 'rest_001',
      restaurant_name: 'Troy Grill & Diner',
      zip_code: '48084',
      cuisine_type: 'American Diner',
      user_name: 'Manager Alex',
      is_authenticated: true
    };`;

const oldFetch = `        const res = await fetch('/api/generate-order', { method: 'POST' });`;
const newFetch = `${sessionObj}\n        const res = await fetch('/api/generate-order', { 
          method: 'POST',
          headers: {
            'x-resto-session': JSON.stringify(mockSession)
          }
        });`;

dashCode = dashCode.replace(oldFetch, newFetch);

const oldFetchProfile = `    fetch('/api/account/profile')
      .then(res => res.json())
      .then(data => {
        if (data.accountProfile?.restaurantName) {
          setRestaurantName(data.accountProfile.restaurantName);
        }
      });`;
const newFetchProfile = `    setRestaurantName(mockSession.restaurant_name);`;

dashCode = dashCode.replace(oldFetchProfile, newFetchProfile);

fs.writeFileSync('src/components/Dashboard.tsx', dashCode);
console.log('Updated Dashboard.tsx with session logic');
