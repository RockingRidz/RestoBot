import {describe,it,expect} from 'vitest';
import {buildExport} from '../lib/orderExport';
import type {OrderHistoryRow} from '../lib/dataStore';
const approval={id:'approval',restaurant_id:'r',note_text:'Approved soup',supplier_name:'Supplier',total_amount:10,lines:[{id:'line',approved_by:'owner',approved_qty:5,forecast_id:'f'}]} as OrderHistoryRow;
const request='10000000-0000-4000-8000-000000000001';
describe('Export audit',()=>{
 it('reuses a stable request identity and retains approved quantities and actors',()=>{
  const a=buildExport(approval,'clipboard','owner',request,'2026-09-28T12:00:00Z');
  const b=buildExport(approval,'clipboard','owner',request,'2026-09-28T12:01:00Z');
  expect(a.id).toBe(b.id);expect(a.noteText).toBe(approval.note_text);
  expect(a.lines[0]).toMatchObject({approved_by:'owner',approved_qty:5,export_requested_by:'owner',export_requested_at:'2026-09-28T12:00:00Z'});
  expect(a.status).toBe('Copy requested');
  expect(buildExport(approval,'print','owner',request).status).toBe('Print requested');
 });
 it('isolates identities across tenants, users and export actions',()=>{
  const values=[buildExport(approval,'clipboard','owner',request),buildExport({...approval,restaurant_id:'other'},'clipboard','owner',request),buildExport(approval,'clipboard','other',request),buildExport(approval,'print','owner',request)];
  expect(new Set(values.map(v=>v.id)).size).toBe(4);
 });
 it('rejects unsupported delivery claims and invalid retry identifiers',()=>{
  expect(()=>buildExport(approval,'email','owner',request)).toThrow();
  expect(()=>buildExport(approval,'print','owner','not-a-request')).toThrow();
 });
});
