import { ownerText } from '../lib/displayText';
import { unitLabel } from '../lib/displayText';
import React,{useEffect,useRef,useState} from 'react';
import { Plus, Copy, Printer, FileText, TriangleAlert, Save } from 'lucide-react';
import type { Ingredient,MenuItem,SalesRecord } from '../types';
import { useForecast } from './ForecastContext';
import { PageHeading, foodIcon } from './RinetUi';
import { api } from '../lib/api';
import { tomorrowBusinessDate } from '../lib/businessDate';
export function RinetOrder({ingredients,menuItems,salesRecords,currencySymbol:currency}:{ingredients:Ingredient[];menuItems:MenuItem[];salesRecords:SalesRecord[];currencySymbol:string}){
 const {forecast,live,refresh,loading}=useForecast();
 const [edits,setEdits]=useState<Record<string,number>>({}),[excluded,setExcluded]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{setEdits({});setExcluded([]);setMessage('');},[live]);
 const [reason,setReason]=useState(''),[approval,setApproval]=useState<{id:string;note_text:string}|null>(null);
 const revision=useRef(0);
 const exportRequests=useRef<Record<string,string>>({});
 useEffect(()=>{exportRequests.current={};},[approval]);
 useEffect(()=>{revision.current++;setApproval(null);},[live,edits,excluded,reason]);
 const approve=async()=>{if(!live)return;const version=revision.current;setBusy(true);setError('');try{const result=await api('/api/orders/approve',{method:'POST',body:JSON.stringify({forecastId:live.savedForecastId,quantities:Object.fromEntries(forecast.lines.filter(l=>l.recommended_order_qty>0).map(l=>[l.id,excluded.includes(l.id)?0:(edits[l.id]??l.recommended_order_qty)])),reason})});if(version===revision.current){setApproval(result.data);setMessage('Approval saved. Further edits require a new approval.');}}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const lines=forecast.lines.filter(l=>l.recommended_order_qty>0);
 const quantity=(line:typeof lines[number])=>edits[line.id]??line.recommended_order_qty;
 const chosen=lines.filter(l=>!excluded.includes(l.id) && quantity(l)>0);
 const cost=chosen.reduce((sum,l)=>sum+quantity(l)*l.unit_cost,0);
 const money=(n:number)=>currency+n.toLocaleString(undefined,{maximumFractionDigits:2});
 const date=live?.targetDate || tomorrowBusinessDate();
 const label=new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const text=[`DAILY ORDER NOTE · ${label}`,...[...new Set(chosen.map(l=>l.supplier_name))].flatMap(s=>[`\nTO: ${s}`, ...chosen.filter(l=>l.supplier_name===s).map(l=>`- ${l.ingredient_name}: ${quantity(l)} ${l.unit}`)])].join('\n');
 const generate=async()=>{setBusy(true);setError('');setMessage('');try{await refresh();setEdits({});setExcluded([]);}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const exportOrder=async(channel:'clipboard'|'print')=>{
  if(!approval||busy)return;
  const version=revision.current;
  setBusy(true);setError('');setMessage('');
  const requestId=exportRequests.current[channel] ||= crypto.randomUUID();
  try {
   const result=await api('/api/orders/send',{method:'POST',body:JSON.stringify({approvalId:approval.id,channel,requestId})});
   if(version!==revision.current)throw new Error('The order changed. Approve the current revision before exporting.');
   if(channel==='clipboard'){
    await navigator.clipboard.writeText(result.data.note_text);
    try{await api('/api/orders/'+encodeURIComponent(result.data.id)+'/status',{method:'PATCH',body:JSON.stringify({status:'Copied'})});}
    catch{throw new Error('The note was copied, but completion could not be recorded. Retry to confirm the history entry.');}
    setMessage('Copied and recorded in order history. Supplier delivery is not confirmed.');
   }else{
    window.print();
    setMessage('Print request recorded. Saving or printing is controlled by your browser; supplier delivery is not confirmed.');
   }
   delete exportRequests.current[channel];
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 };
 return <><div className="no-print"><PageHeading title="Daily Order Note" subtitle="Your smart ingredient order for tomorrow."><div className="heading-actions"><span className="date-chip">Tomorrow · {label} (Detroit time)</span><button className="gold-button" disabled={busy||loading} onClick={generate}><Plus size={17}/>{busy?'Working…':'Generate new plan'}</button></div></PageHeading><div className="order-metrics"><div><strong>{live ? chosen.length : '—'}</strong><small>Ingredients selected</small></div><div><strong>{live ? money(cost) : '—'}</strong><small>Estimated cost</small></div><div><strong>{live ? Math.round((live.safetyBuffer-1)*100)+'%' : '—'}</strong><small>Safety buffer</small></div><div><strong>{live ? [...new Set(chosen.map(l=>l.supplier_name))].length : '—'}</strong><small>Suppliers</small></div></div>{error&&<p role="alert" className="error-banner">{error}</p>}{message&&<p role="status" className="success-banner">{message}</p>}<section className="paper-panel"><div className="table-scroll"><table className="rinet-table order-table"><thead><tr><th>Select</th><th>Ingredient</th><th>Suggested Qty</th><th>Order Qty</th><th>Supplier</th><th>Est. Cost</th></tr></thead><tbody>{lines.map(line=><tr key={line.id}><td><input aria-label={`Include ${line.ingredient_name}`} type="checkbox" disabled={busy} checked={!excluded.includes(line.id)} onChange={e=>setExcluded(e.target.checked?excluded.filter(id=>id!==line.id):[...excluded,line.id])}/></td><td><span className="food-icon">{foodIcon(line.ingredient_name)}</span>{line.ingredient_name}</td><td>{line.recommended_order_qty} {unitLabel(line.unit)}</td><td><label className="quantity-field"><input aria-label={`Order quantity for ${line.ingredient_name}`} type="number" disabled={busy} min={0} step="0.1" value={quantity(line)} onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value)&&value>=0)setEdits({...edits,[line.id]:value})}}/>{unitLabel(line.unit)}</label></td><td>{line.supplier_name}</td><td>{money(quantity(line)*line.unit_cost)}</td></tr>)}</tbody></table></div>{!lines.length&&<div className="empty-state"><FileText/><b>{live ? 'No ingredients to order.' : 'Generate a forecast to see your order.'}</b><p>Import sales and map your recipes to calculate purchasing needs.</p></div>}<div className="order-notice"><TriangleAlert size={20}/><div><b>Review before ordering</b><p>Quantities use stock units and configured pack sizes. Review missing-pack, yield, lead-time and shelf-life notices before approval.</p></div></div>{forecast.warnings.length>0&&<details className="forecast-notices"><summary>{forecast.warnings.length} forecast confidence and recipe notices</summary>{forecast.warnings.map((w,i)=><p key={i}>{ownerText(w)}</p>)}</details>}<label className="quantity-field">Reason for edits or exclusions<input aria-label="Reason for order edits" disabled={busy} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="order-footer"><button className="gold-button" disabled={busy||loading||!chosen.length||!!approval||!!forecast.blockingIssues?.length} onClick={approve}><Save size={16}/>{approval?'Approved':'Approve this order'}</button><span className="muted">Adjust quantities directly in the table.</span><button disabled={busy||!approval} className="outline-button" onClick={()=>void exportOrder('clipboard')}><Copy size={16}/>Copy to clipboard</button><button disabled={busy||!approval} className="gold-button" onClick={()=>void exportOrder('print')}><Printer size={16}/>Print / Save PDF</button></div></section></div><div className="print-order"><h1>Rinet RestoBot</h1><div style={{whiteSpace:"pre-wrap"}}>{ownerText(approval?.note_text, "")}</div><p>Review supplier packaging and confirm delivery directly.</p></div></>;
}




