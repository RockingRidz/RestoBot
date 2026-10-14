import React, {useState} from 'react';
import {api} from '../lib/api';
import type {MenuItem} from '../types';

export function ZeroSalesForm({menus,onSaved}:{menus:MenuItem[];onSaved:()=>Promise<void>}) {
  const [date,setDate]=useState(''),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const save=async()=>{
    setBusy(true);setMessage('');
    try{const result=await api('/api/sales/zero-day',{method:'POST',body:JSON.stringify({date,menuItemIds:selected})});await onSaved();setMessage(result.recorded ? 'Confirmed zero-sales days saved. Stock is unchanged.' : 'These observations were already saved.');}
    catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
  };
  return <details className="paper-panel"><summary>Record a day with no sales</summary><p>Use this only for completed days when these items were available but sold zero. Missing reports and days the restaurant was closed are not zero-sales observations. Dates use Detroit local time.</p><fieldset disabled={busy}><label>Completed sales date<input aria-label="Zero-sales date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><div>{menus.filter(menu=>menu.is_active!==false).map(menu=><label key={menu.id} style={{display:'block'}}><input type="checkbox" checked={selected.includes(menu.id)} onChange={e=>setSelected(e.target.checked?[...selected,menu.id]:selected.filter(id=>id!==menu.id))}/>{menu.name}</label>)}</div><button className="gold-button" disabled={!date||!selected.length} onClick={()=>void save()}>{busy?'Saving…':'Confirm no sales for selected items'}</button></fieldset>{message&&<p role="status">{message}</p>}</details>;
}
