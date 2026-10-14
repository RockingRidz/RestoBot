const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `} catch (err: any) {
    console.error('Error generating order:', err);
    
    // Fallback if AI quota exceeded or other error
    const priceCreeps = detectSupplierPriceCreeps(dbIngredients, dbMenuItems);`;

const newStr = `} catch (err: any) {
    console.error('Error generating order:', err);
    
    // Fallback if AI quota exceeded or other error
    const priceCreeps = detectSupplierPriceCreeps(dbIngredients, dbMenuItems);
    return res.json({ error: err.message, stack: err.stack, _mode: "error_fallback" });`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('server.ts', code);
