import { describe, expect, it } from 'vitest';
import { ownerError, ownerText, unitLabel } from '../lib/displayText';

describe('Owner-facing text', () => {
  it.each(['{"error":"internal"}', '```js\nconst a = 1;\n```', '<html>Server failed</html>', ':hnhnjh', 'TypeError: failed at handler (server.ts:42)', '["raw", "data"]'])('does not display technical output: %s', text => {
    expect(ownerText(text, 'Please retry.')).toBe('Please retry.');
  });
  it('preserves operational quantities, caveats and names while removing markup', () => {
    expect(ownerText('**Black Truffle** rose 62.5%. Extra cost: $3/dish. Savings unavailable.')).toBe('Black Truffle rose 62.5%. Extra cost: $3/dish. Savings unavailable.');
    expect(ownerText('## Portion\nUse `0.4 oz`; do not substitute automatically.')).toBe('Portion\nUse 0.4 oz; do not substitute automatically.');
  });
  it('makes units readable without changing conversion values', () => {
    expect(unitLabel('fl_oz')).toBe('fl oz');
    expect(unitLabel('pcs')).toBe('pieces');
    expect(unitLabel('kg')).toBe('kg');
  });
  it('gives useful error recovery without database or credential details', () => {
    expect(ownerError('Invalid login credentials')).toContain('email and password');
    expect(ownerError('column ingredients.procurement does not exist')).toContain('needs an update');
    expect(ownerError('configure GEMINI_API_KEY')).not.toContain('GEMINI');
    expect(ownerError('internal detail', 401)).toContain('sign in');
    expect(ownerError('Sales history is over 14 days old. Refresh POS data before approving purchases.')).toContain('14 days');
  });
});
