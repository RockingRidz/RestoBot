import React from 'react';
import { Store, CalendarDays, Bell, Settings } from 'lucide-react';
export function Navbar({restaurantName,onResetConfig,onAlerts}: {restaurantName:string;onResetConfig:()=>void;onAlerts?:()=>void}) {
 return <header className="rinet-navbar"><button className="restaurant-picker" onClick={onResetConfig}><Store size={19}/><b>{restaurantName}</b><Settings size={15}/></button><div className="nav-details"><span><CalendarDays size={17}/>{new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</span><button className="icon-button" aria-label="View inventory and price alerts" onClick={onAlerts}><Bell size={21}/></button></div></header>;
}
