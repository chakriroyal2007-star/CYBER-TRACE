import React from 'react';
import {ArrowUpRight,AlertCircle,Loader2,FolderSearch} from 'lucide-react';
export function Button({children,variant='primary',className='',...props}:any){return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>}
export function Card({children,className='',...props}:any){return <section className={`card ${className}`} {...props}>{children}</section>}
export function Badge({children,variant='',className='',...props}:any){return <span className={`badge ${variant} ${className}`} {...props}>{children}</span>}
export function RiskBadge({score=0}:any){return <Badge variant={score>=70?'danger':score>=40?'warning':'success'}><span className="status-dot"/>{score>=70?'High':score>=40?'Medium':'Low'} risk{score>0?` · ${score}`:''}</Badge>}
export function MetricCard({label,value,detail,icon:Icon,trend,className=''}:any){return <Card className={`metric-card ${className}`}><div className="metric-label">{label}{Icon&&<Icon size={16}/>}</div><div className="metric-value">{value}</div><div className="metric-detail">{trend&&<ArrowUpRight size={13}/>} {detail}</div></Card>}
export function PageHeader({eyebrow,title,description,action,children}:any){return <div className="page-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description&&<p>{description}</p>}</div><div className="heading-actions">{action}{children}</div></div>}
export function EmptyState({title='No results found',description='Try a different search or start a new investigation.',action}:any){return <div className="empty-state"><FolderSearch size={28}/><h3>{title}</h3><p>{description}</p>{action}</div>}
export function LoadingState(){return <div className="loading-state" role="status"><Loader2 className="spin" size={25}/><span>Loading intelligence…</span></div>}
export function ErrorState({message='Unable to load this view',retry}:any){return <div className="error-state" role="alert"><AlertCircle size={23}/><h3>Request could not be completed</h3><p>{message}</p>{retry&&<Button onClick={retry}>Try again</Button>}</div>}
export function Field({label,children,hint}:any){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
