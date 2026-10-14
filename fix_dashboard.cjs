const fs = require('fs');

let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// Replace the mockSession and hardcoded payload inside useEffect
const fetchLogic = `
  const [profile, setProfile] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);

  const handleFetchOrder = async () => {
    setLoading(true);
    setTask1Data(null);
    setTask2Text('');
    setSubstituteStatus('pending');
    try {
      // 1. Fetch Profile
      const profRes = await fetch('/api/account/profile');
      const profData = await profRes.json();
      const p = profData.accountProfile || {};
      setProfile(p);
      setRestaurantName(p.restaurantName || 'Troy Grill & Diner');
      
      const mockSession = {
        restaurant_id: 'rest_001',
        restaurant_name: p.restaurantName || 'Troy Grill & Diner',
        zip_code: p.location || '48084',
        cuisine_type: p.cuisineType || 'American Diner',
        user_name: 'Manager',
        is_authenticated: true
      };

      // 2. Fetch Ingredients & Recipes
      const [ingRes, recRes] = await Promise.all([
        fetch('/api/ingredients').then(r => r.json()),
        fetch('/api/recipes').then(r => r.json())
      ]);
      const fetchedIngredients = ingRes.data || [];
      setIngredients(fetchedIngredients);
      setRecipes(recRes.data || []);

      // 3. Build orders payload mapping from ingredients (simulate needing order for low stock items)
      // If stock is below 10, we order. Or just order everything for test
      const orders = fetchedIngredients.map((i: any) => ({
        ingredient: i.name,
        quantity: \`1 x \${i.unit}\`,
        baselinePrice: i.normal_price || i.cost_per_unit || 10,
        currentPrice: i.cost_per_unit || 10
      }));

      const requestPayload = {
        forecast: {
          targetCovers: 150,
          safetyBufferPct: 0.10
        },
        orders: orders
      };

      const res = await fetch('/api/generate-order', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-resto-session': JSON.stringify(mockSession)
        },
        body: JSON.stringify(requestPayload)
      });
      const data = await res.json();
      setTask1Data(data.priceSpikeAlert);
      setTask2Text(data.formattedSmsText);
    } catch (err) {
      console.error("Failed to generate order", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleFetchOrder();
  }, []);
`;

code = code.replace(/useEffect\(\(\) => \{[\s\S]*?fetchOrderData\(\);\n  \}, \[\]\);/, fetchLogic);

fs.writeFileSync('src/components/Dashboard.tsx', code);
