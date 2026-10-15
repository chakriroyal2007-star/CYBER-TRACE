import { useEffect, useMemo, useRef, useState } from 'react';
import { Expand, Minus, Plus, RotateCcw, Layers, Route, ChevronDown, Network } from 'lucide-react';
import '../workspace.css';

export interface GraphNode {
  id: string; address: string; label: string;
  type: 'victim'|'suspect'|'intermediary'|'bridge'|'dex'|'mixer'|'vasp'|'unknown';
  chain: string; balance: number; riskScore: number; entity: string; cluster: string;
  firstSeen: string; lastSeen: string; incomingCount: number; outgoingCount: number;
  behavior: string[]; evidenceIds: string[]; x: number; y: number;
}
export interface GraphEdge {
  id: string; source: string; target: string; amount: number; timestamp: string;
  hash: string; chain: string; asset: string; highlighted: boolean;
}
interface GraphProps { nodes: GraphNode[]; edges: GraphEdge[]; onNodeSelect?: (node: GraphNode)=>void; onEdgeSelect?: (edge: GraphEdge)=>void; selectedId?: string; compact?: boolean; }
const colorFor = (type: string) => ({victim:'#9bb4d6',suspect:'#fa9c72',intermediary:'#6e8aaa',bridge:'#a99bed',dex:'#70a5db',mixer:'#d080a5',vasp:'#4fd7c1',unknown:'#677b93'}[type]||'#8397b1');
const currency = (value: number) => value>=100000 ? `₹${(value/100000).toFixed(2)}L` : `₹${Math.round(value).toLocaleString('en-IN')}`;
const short = (value: string) => value.length>17 ? `${value.slice(0,8)}…${value.slice(-5)}` : value;

function NodeGlyph({type,color}:{type:string;color:string}) {
  if(type==='vasp') return <g stroke={color} strokeWidth="1.6" fill="none"><path d="M-10-5L0-11 10-5H-10M-10 10H10M-9 7H9M-6-3V5M0-3V5M6-3V5"/></g>;
  if(type==='bridge') return <g stroke={color} strokeWidth="1.5" fill="none"><path d="M-11 7V-8M11 7V-8M-11-6Q0 6 11-6M-11 3H11M-6-2V3M0 0V3M6-2V3"/></g>;
  if(type==='victim') return <g stroke={color} strokeWidth="1.5" fill="none"><circle cy="-5" r="4"/><path d="M-8 10V7C-8 0 8 0 8 7V10"/></g>;
  if(type==='mixer') return <g stroke={color} strokeWidth="1.5" fill="none"><path d="M-10-8H-5L6 8H11M-10 8H-5L6-8H11M7-11L11-8 7-5M7 5L11 8 7 11"/></g>;
  return <g stroke={color} strokeWidth="1.5" fill="none"><rect x="-10" y="-7" width="20" height="15" rx="3"/><path d="M10-2H3V4H10M-8-7V-10H6V-7"/><circle cx="5.5" cy="1" r=".7"/></g>;
}

export default function GraphPanel({nodes,edges,onNodeSelect,onEdgeSelect,selectedId,compact=false}:GraphProps) {
  const [zoom,setZoom] = useState(1);
  const [pan,setPan] = useState({x:0,y:0});
  const [collapsed,setCollapsed] = useState(false);
  const [pathOnly,setPathOnly] = useState(false);
  const [hover,setHover] = useState<string|null>(null);
  const [menu,setMenu] = useState(false);
  const svgRef=useRef<SVGSVGElement>(null);
  const containerRef=useRef<HTMLDivElement>(null);
  const drag=useRef<{x:number;y:number;px:number;py:number}|null>(null);
  const [expanded,setExpanded]=useState<string[]>([]);
  const routeNodes=useMemo(()=>new Set(edges.filter(e=>e.highlighted).flatMap(e=>[e.source,e.target])),[edges]);
  const {visibleNodes,visibleEdges,clusterSizes}=useMemo(()=>{
    let shown=nodes.filter(n=>!pathOnly||routeNodes.has(n.id)||expanded.includes(n.id));
    const representatives=new Map<string,string>(); const sizes:Record<string,number>={}; const remap=new Map<string,string>();
    shown.forEach(n=>{if(collapsed&&n.cluster){const group=`${n.chain}:${n.cluster}`;if(!representatives.has(group))representatives.set(group,n.id);const rep=representatives.get(group)!;remap.set(n.id,rep);sizes[rep]=(sizes[rep]||0)+1;}});
    if(collapsed)shown=shown.filter(n=>!remap.has(n.id)||remap.get(n.id)===n.id);
    const shownIds=new Set(shown.map(n=>n.id));
    const mapped=edges.map(e=>({...e,source:remap.get(e.source)||e.source,target:remap.get(e.target)||e.target})).filter(e=>shownIds.has(e.source)&&shownIds.has(e.target)&&e.source!==e.target);
    return {visibleNodes:shown,visibleEdges:mapped,clusterSizes:sizes};
  },[nodes,edges,collapsed,pathOnly,expanded,routeNodes]);
  const layout=useMemo(()=>{
    if(!visibleNodes.length)return {nodes:[],map:new Map<string,GraphNode>(),scale:1};
    const xs=visibleNodes.map(n=>Number(n.x)||0),ys=visibleNodes.map(n=>Number(n.y)||0);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const sx=830/Math.max(maxX-minX,1),sy=285/Math.max(maxY-minY,1),scale=Math.min(sx,sy,1.1);
    const width=(maxX-minX)*scale,height=(maxY-minY)*scale;
    const arranged=visibleNodes.map((n,i)=>({...n,x: maxX===minX ? 110+(i%6)*165 : (n.x-minX)*scale+(1050-width)/2,y:maxY===minY ? 185+Math.floor(i/6)*110:(n.y-minY)*scale+(440-height)/2-5}));
    return {nodes:arranged,map:new Map(arranged.map(n=>[n.id,n])),scale};
  },[visibleNodes]);
  const selected=nodes.find(n=>n.id===selectedId);
  const selectedNeighbors=useMemo(()=>new Set(edges.filter(e=>e.source===selectedId||e.target===selectedId).flatMap(e=>[e.source,e.target])),[edges,selectedId]);
  useEffect(()=>{setZoom(1);setPan({x:0,y:0});setExpanded([]);},[nodes[0]?.id]);
  const canExpand=Boolean(selected&&(collapsed||edges.some(e=>(e.source===selected.id||e.target===selected.id)&&(!visibleNodes.some(n=>n.id===e.source)||!visibleNodes.some(n=>n.id===e.target)))));
  const expandSelected=()=>{if(!selected)return;setCollapsed(false);setExpanded(prev=>[...new Set([...prev,...edges.filter(e=>e.source===selected.id||e.target===selected.id).flatMap(e=>[e.source,e.target])])]);setMenu(false);};
  const zoomBy=(factor:number)=>setZoom(z=>Math.max(.45,Math.min(3.5,z*factor)));
  const fullscreen=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else containerRef.current?.requestFullscreen?.().catch(()=>{setZoom(1.3)});};
  const hovered=layout.map.get(hover||'');
  return <div className={`graph-panel ${compact?'graph-compact':''}`} ref={containerRef}>
    <div className="graph-topbar"><div className="graph-view-label"><span className="ws-pulse"/> {pathOnly?'Highlighted fund path':'Fund flow network'} <span className="ws-muted">{visibleNodes.length} wallets · {visibleEdges.length} transfers</span></div><div className="graph-actions"><button className={pathOnly?'active':''} onClick={()=>setPathOnly(v=>!v)} title="Show highlighted path only"><Route size={14}/><span>Fund path</span></button><div className="graph-menu-wrap"><button onClick={()=>setMenu(v=>!v)} aria-expanded={menu}><Layers size={14}/><span>Network</span><ChevronDown size={12}/></button>{menu&&<div className="graph-menu"><button onClick={()=>{setCollapsed(v=>!v);setMenu(false)}}>{collapsed?'Expand all clusters':'Collapse clusters'}</button><button disabled={!canExpand} onClick={expandSelected}>Expand selected wallet</button><button onClick={()=>{setPathOnly(false);setCollapsed(false);setExpanded([]);setMenu(false)}}>Show complete network</button></div>}</div></div></div>
    <svg className="transaction-svg" ref={svgRef} viewBox="0 0 1050 440" aria-label="Interactive transaction graph. Select a wallet or transfer for evidence." role="group" onWheel={e=>{zoomBy(e.deltaY>0?.92:1.08)}} onPointerDown={e=>{if((e.target as Element).closest('[data-graph-item]'))return;drag.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current)return;const ratio=1050/(svgRef.current?.getBoundingClientRect().width||1050);setPan({x:drag.current.px+(e.clientX-drag.current.x)*ratio,y:drag.current.py+(e.clientY-drag.current.y)*ratio})}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
      <defs><pattern id="graph-grid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#24354a"/></pattern><marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#516782"/></marker><marker id="graph-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#4fd7c1"/></marker><filter id="graph-glow"><feGaussianBlur stdDeviation="4"/></filter></defs>
      <rect width="1050" height="440" fill="url(#graph-grid)"/>
      <g transform={`translate(${pan.x+525} ${pan.y+220}) scale(${zoom}) translate(-525 -220)`}>
        {visibleEdges.map((edge,index)=>{const source=layout.map.get(edge.source),target=layout.map.get(edge.target);if(!source||!target)return null;const dx=target.x-source.x,dy=target.y-source.y,d=Math.max(1,Math.hypot(dx,dy));const x1=source.x+dx/d*23,y1=source.y+dy/d*23,x2=target.x-dx/d*27,y2=target.y-dy/d*27;const duplicate=visibleEdges.filter(e=>e.source===edge.source&&e.target===edge.target);const duplicateIndex=duplicate.findIndex(e=>e.id===edge.id);const offset=duplicate.length>1?(duplicateIndex-(duplicate.length-1)/2)*15:0;const mx=(x1+x2)/2-dy/d*offset,my=(y1+y2)/2+dx/d*offset;const path=`M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`;const active=selectedId===edge.id||edge.highlighted;const dim=selectedId&&!selectedNeighbors.has(edge.source)&&!selectedNeighbors.has(edge.target)&&selectedId!==edge.id;return <g key={`${edge.id}-${index}`} data-graph-item="edge" className="graph-edge" role="button" tabIndex={0} aria-label={`${edge.id}: ${currency(edge.amount)} ${source.label} to ${target.label}`} onClick={()=>onEdgeSelect?.(edges.find(e=>e.id===edge.id)||edge)} onKeyDown={e=>{if(e.key==='Enter')onEdgeSelect?.(edges.find(x=>x.id===edge.id)||edge)}} opacity={dim?.28:1}><title>{edge.id} · {currency(edge.amount)} · {edge.chain} · {edge.timestamp}</title><path d={path} fill="none" stroke="transparent" strokeWidth="14"/><path className={active?'graph-flow':''} d={path} fill="none" stroke={active?'#4fd7c1':'#41566e'} strokeOpacity={active?.8:.45} strokeWidth={selectedId===edge.id?3:active?1.8:1.1} markerEnd={`url(#${active?'graph-arrow-active':'graph-arrow'})`}/>{active&&duplicateIndex===0&&<g transform={`translate(${mx} ${my-8})`}><rect x="-34" y="-8" width="68" height="15" rx="3" fill="#0b1725"/><text fill="#82baaF" textAnchor="middle" fontSize="9" fontFamily="monospace">{currency(edge.amount)}</text></g>}</g>})}
        {layout.nodes.map(node=>{const color=colorFor(node.type),isSelected=node.id===selectedId;const dim=selectedId&&selectedId!==node.id&&!selectedNeighbors.has(node.id)&&!edges.some(e=>e.id===selectedId&&(e.source===node.id||e.target===node.id));return <g key={node.id} data-graph-item="node" transform={`translate(${node.x} ${node.y})`} className={`graph-node graph-node-${node.type}`} role="button" tabIndex={0} aria-label={`${node.label}, ${node.chain}, risk ${node.riskScore}`} onClick={()=>onNodeSelect?.(node)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onNodeSelect?.(node)}}} onMouseEnter={()=>setHover(node.id)} onMouseLeave={()=>setHover(null)} opacity={dim?.42:1}>
          <title>{node.label} · {node.address} · {node.chain} · Risk {node.riskScore}</title>
          {(isSelected||node.type==='vasp')&&<circle r="31" fill="none" stroke={color} strokeWidth="1" strokeOpacity={isSelected?.65:.18}/>}
          <circle r="23" fill="#102031" stroke={color} strokeWidth={isSelected?2:1.2}/><circle r="18" fill={color} fillOpacity=".055"/><NodeGlyph type={node.type} color={color}/>
          {node.riskScore>=70&&<circle cx="17" cy="-17" r="4" fill="#f09a69" stroke="#0d1725" strokeWidth="2"/>}
          {clusterSizes[node.id]>1&&<g transform="translate(20 18)"><rect x="-10" y="-8" width="23" height="16" rx="8" fill="#2b4156"/><text textAnchor="middle" x="1" y="3" fontSize="9" fill="#dceafa">{clusterSizes[node.id]}</text></g>}
          <rect x="-67" y="29" width="134" height="18" rx="3" fill="#0b1522" fillOpacity=".93"/>
          <text y="41" textAnchor="middle" fill={isSelected?'#ffffff':'#b5c7dd'} fontSize="10.5" fontWeight={node.type==='vasp'?'600':'400'}>{node.label.length>22?`${node.label.slice(0,21)}…`:node.label}</text>
          <text y="56" textAnchor="middle" fill={color} fontSize="8" letterSpacing="1">{node.chain?.toUpperCase()||'ENTITY'} {node.type==='vasp'?'· CANDIDATE':''}</text>
        </g>})}
        {hovered&&<g transform={`translate(${Math.max(110,Math.min(940,hovered.x))} ${hovered.y-61})`} pointerEvents="none"><rect x="-104" y="-22" width="208" height="40" rx="5" fill="#1a2a3e" stroke="#3b536e"/><text y="-6" textAnchor="middle" fill="#e4effc" fontSize="10" fontFamily="monospace">{short(hovered.address||hovered.id)}</text><text y="9" textAnchor="middle" fill="#95aac4" fontSize="9">Risk {hovered.riskScore||0}/100 · Click to inspect evidence</text></g>}
      </g>
      {!nodes.length&&<text x="525" y="220" textAnchor="middle" fill="#879bb5" fontSize="14">No graph evidence available for this case.</text>}
    </svg>
    <div className="graph-footer"><div className="graph-legend"><span><i style={{background:colorFor('victim')}}/>Reported</span><span><i style={{background:colorFor('suspect')}}/>Suspect</span><span><i style={{background:colorFor('intermediary')}}/>Intermediary</span><span><i style={{background:colorFor('bridge')}}/>Bridge</span><span><i style={{background:colorFor('vasp')}}/>VASP candidate</span></div><div className="graph-controls"><button onClick={()=>zoomBy(.8)} title="Zoom out" aria-label="Zoom out"><Minus size={14}/></button><span>{Math.round(zoom*100)}%</span><button onClick={()=>zoomBy(1.25)} title="Zoom in" aria-label="Zoom in"><Plus size={14}/></button><button onClick={()=>{setZoom(1);setPan({x:0,y:0})}} title="Fit network" aria-label="Fit network"><RotateCcw size={13}/></button><button onClick={fullscreen} title="Expand graph" aria-label="Expand graph"><Expand size={14}/></button></div></div>
    <div className="graph-context-hint"><Network size={11}/> Scroll to zoom · Drag to pan · Select a wallet or transfer {selected&&canExpand&&<button onClick={expandSelected}>Expand {selected.label}</button>}</div>
  </div>;
}
