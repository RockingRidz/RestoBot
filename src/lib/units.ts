const units: Record<string, [string, number]> = {
  g:['mass',1], kg:['mass',1000], lb:['mass',453.59237], lbs:['mass',453.59237], oz:['mass',28.349523125],
  ml:['volume',1], l:['volume',1000], liter:['volume',1000], liters:['volume',1000], gal:['volume',3785.411784],
  fl_oz:['volume',29.5735295625], 'fl oz':['volume',29.5735295625], tsp:['volume',4.92892159375], tbsp:['volume',14.78676478125], cup:['volume',236.5882365],
  unit:['count',1], units:['count',1], pcs:['count',1], piece:['count',1], pieces:['count',1],
};
export function convertQuantity(quantity:number,from:string,to:string):number {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Quantity must be finite and non-negative');
  const a=from.trim().toLowerCase(),b=to.trim().toLowerCase();
  if (a===b && a) return quantity;
  if (!units[a] || !units[b] || units[a][0]!==units[b][0]) throw new Error(`Cannot convert ${from} to ${to}; configure matching recipe and stock units`);
  return quantity*units[a][1]/units[b][1];
}
