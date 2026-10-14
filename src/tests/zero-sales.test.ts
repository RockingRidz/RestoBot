import {describe,it,expect} from 'vitest';
import {zeroSalesRecords} from '../lib/zeroSales';
import type {MenuItem} from '../types';
const menus=[{id:'m',name:'Soup',selling_price:10,is_active:true}] as MenuItem[];
const now=new Date('2026-09-28T12:00:00Z');
describe('Confirmed zero observations',()=>{
 it('records explicit zeroes once, preserving the completed date and menu price',()=>{
  const rows=zeroSalesRecords('2026-09-27',['m'],'r',menus,[],now);
  expect(rows[0]).toMatchObject({quantity_sold:0,total_amount:0,unit_price:10,transaction_type:'zero_sales'});
  expect(zeroSalesRecords('2026-09-27',['m'],'r',menus,rows,now)).toEqual([]);
 });
 it.each(['2026-02-30','2026-09-28','2026-09-29','bad'])('rejects invalid or incomplete day %s',date=>{
  expect(()=>zeroSalesRecords(date,['m'],'r',menus,[],now)).toThrow();
 });
 it('rejects foreign, duplicate or empty selections and dates with positive sales',()=>{
  for(const ids of [[],['other'],['m','m']])expect(()=>zeroSalesRecords('2026-09-27',ids,'r',menus,[],now)).toThrow();
  const sold=zeroSalesRecords('2026-09-27',['m'],'r',menus,[],now).map(row=>({...row,quantity_sold:1}));
  expect(()=>zeroSalesRecords('2026-09-27',['m'],'r',menus,sold,now)).toThrow(/already has sales/);
 });
});
