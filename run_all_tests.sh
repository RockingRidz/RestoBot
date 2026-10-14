echo "=== TEST 1 ==="
curl -s -X POST http://localhost:3000/api/generate-order \
  -H 'Content-Type: application/json' \
  -H 'x-resto-session: {"restaurant_name":"Pure Govinda Foods","cuisine_type":"Sattvik Indian","user_name":"Radha Sharma","is_authenticated":true,"isPureVegetarian":true}' \
  -d '{
    "orders": [
      { "ingredient": "Pure Desi Ghee (80% Fat)", "quantity": "2 x 35 lb Tubs", "baselinePrice": 120.00, "currentPrice": 148.00 }
    ]
  }'

echo -e "\n\n=== TEST 2 ==="
curl -s -X POST http://localhost:3000/api/generate-order \
  -H 'Content-Type: application/json' \
  -H 'x-resto-session: {"restaurant_name":"Urban Bistro","cuisine_type":"American Casual","user_name":"John Doe","is_authenticated":true}' \
  -d '{
    "orders": [
      { "ingredient": "Extra Virgin Olive Oil (Cold Pressed)", "quantity": "4 x 1 gal Jugs", "baselinePrice": 45.00, "currentPrice": 62.00 }
    ]
  }'

echo -e "\n\n=== TEST 3 ==="
curl -s -X POST http://localhost:3000/api/generate-order \
  -H 'Content-Type: application/json' \
  -H 'x-resto-session: {"restaurant_name":"Artisan Bakery","cuisine_type":"French Pastry","user_name":"Pierre Laurent","is_authenticated":true}' \
  -d '{
    "orders": [
      { "ingredient": "AOP French Charentes-Poitou Butter (84% Fat)", "quantity": "5 x 10 lb Blocks", "baselinePrice": 90.00, "currentPrice": 115.00 }
    ]
  }'

echo -e "\n\n=== TEST 4 ==="
curl -s -X POST http://localhost:3000/api/generate-order \
  -H 'Content-Type: application/json' \
  -H 'x-resto-session: {"restaurant_name":"Tuscan Table","cuisine_type":"Italian","user_name":"Marco Rossi","is_authenticated":true,"isPureVegetarian":false}' \
  -d '{
    "orders": [
      { "ingredient": "Shredded Mozzarella Cheese 100%", "quantity": "10 x 5 lb Bags", "baselinePrice": 12.00, "currentPrice": 16.00 }
    ]
  }'
