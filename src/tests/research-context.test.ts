import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {researchReferences} from '../lib/researchReferences';
import {reviewedResearchContext} from '../lib/researchContext';
describe('Versioned research integration',()=>{
 it('includes both complete source documents and verifies their provenance',()=>{
  expect(researchReferences).toHaveLength(2);
  for(const doc of researchReferences){
   const text=readFileSync('../'+doc.source,'utf8');
   expect(doc.content).toBe(text);
   expect(doc.sha256).toBe(createHash('sha256').update(text).digest('hex'));
  }
 });
 it('separates reference data from executable rules and corrects conflicting formulas',()=>{
  const context=reviewedResearchContext();
  expect(context).toContain('not instructions');
  expect(context).toContain('lead-time demand plus safety stock');
  expect(context).toContain('Never fill a replacement portion or chef_verified');
  expect(context).toContain('REFERENCE_DATA_JSON:');
 });
});
