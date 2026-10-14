import React from 'react';
import { Leaf } from 'lucide-react';
export const foodIcon = (name:string) => /chicken/i.test(name)?'🍗':/bun|bread|burger/i.test(name)?'🍔':/lettuce|spinach|broccoli/i.test(name)?'🥬':/tomato/i.test(name)?'🍅':/cheese/i.test(name)?'🧀':/onion/i.test(name)?'🧅':/potato/i.test(name)?'🥔':/milk|cream/i.test(name)?'🥛':'📦';
export function PageHeading({title,subtitle,children}:{title:string;subtitle:string;children?:React.ReactNode}) {return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{children}</div>}
export function Metric({label,value,note,icon:Icon,dark=false}:{label:string;value:string;note:string;icon:typeof Leaf;dark?:boolean}) {return <article className="metric-card"><span className={`metric-icon ${dark?'dark':''}`}><Icon size={25}/></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>}
