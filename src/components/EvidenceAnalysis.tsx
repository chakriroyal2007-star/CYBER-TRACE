import { useEffect, useState } from 'react';
import { api, toast, navigate } from '../api';
import { Button } from './ui';

export default function EvidenceAnalysis({ caseId }: { caseId: string }) {
  const [connections,setConnections]=useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [selected, setSelected] = useState(0);
  const [input, setInput] = useState('');
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [researchTxId, setResearchTxId] = useState('');
  const [algorithm,setAlgorithm]=useState('BFS');
  const [step,setStep]=useState(0);
  const [selectedNode,setSelectedNode]=useState<string|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api(`/complaints/${caseId}/analysis-runs`).then(setRuns).catch(e=>setError(e.message)); }, [caseId]);
  useEffect(()=>{api(`/complaints/${caseId}/connections`).then(setConnections).catch(e=>setError(e.message));},[caseId]);
  const run = runs[selected];
  async function analyze() {
    setBusy(true); setError('');
    try {
      if(input.trim()) {
        const transfers = JSON.parse(input);
        await api(`/complaints/${caseId}/transfers`, { method:'PUT',body:JSON.stringify({transfers}) });
      }
      const result = await api(`/complaints/${caseId}/analyze`, {method:'POST',body:JSON.stringify({sources:source.split(',').map(x=>x.trim()).filter(Boolean),target,researchTxId:researchTxId.trim() || undefined})});
      setRuns([result, ...runs]); setSelected(0); toast('Evidence analysis saved');
    } catch(e:any) { setError(e.message); } finally { setBusy(false); }
  }
  async function download() {
    try {
      const response = await fetch(`/api/complaints/${caseId}/analysis-report?runId=${encodeURIComponent(run.id)}`, {credentials:'include',headers:{Authorization:`Bearer ${localStorage.getItem('ct_token') || ''}`}});
      if(!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href=url; a.download=`${caseId}-analysis.pdf`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e:any) { setError(e.message); }
  }
  const style = {width:'100%',background:'#091523',color:'#dbeafe',border:'1px solid #29445e',borderRadius:4,padding:8,boxSizing:'border-box' as const};
  const traversal=run?.executions.find((x:any)=>x.algorithm===algorithm);
  const visitedIds=new Set((traversal?.visited || []).slice(0,step));
  const positions = new Map<string,{x:number,y:number}>((run?.nodes || []).map((node:any,i:number,list:any[])=>[node.id,{x:210+160*Math.cos(2*Math.PI*i/list.length),y:180+140*Math.sin(2*Math.PI*i/list.length)}]));
  return <section style={{display:'flex',flexDirection:'column',gap:12}}>
    <p style={{fontSize:12,color:'#94a3b8'}}>Import observed transaction records. Each row requires from, to, amount (decimal string), asset, network, timestamp (ISO), and reference. Optional cost is a non-negative analyst-assigned weight for Dijkstra (default 1). Submitted records remain unverified. Existing runs are preserved.</p>
    <label>Transaction JSON<textarea aria-label="Transaction evidence JSON" rows={6} style={style} value={input} onChange={e=>setInput(e.target.value)} placeholder="Paste an array of transaction records" /></label>
    <label>Sources (comma separated)<input style={style} value={source} onChange={e=>setSource(e.target.value)} /></label>
    <label>Target<input style={style} value={target} onChange={e=>setTarget(e.target.value)} /></label>
    <label>Explicit Elliptic research transaction ID (optional)<input style={style} value={researchTxId} onChange={e=>setResearchTxId(e.target.value)} /></label>
    <Button onClick={analyze} disabled={busy}>{busy?'Analyzing…':'Analyze submitted evidence'}</Button>
    {error && <p role="alert" style={{color:'#fca5a5'}}>{error}</p>}
    {connections && <details><summary>{connections.links.length} connected complaints</summary><p>{connections.limitation}</p>{connections.links.map((link:any)=><div key={link.caseId}><Button variant="secondary" onClick={()=>navigate(`/app/case-review/${link.caseId}`)}>{link.caseId}</Button> · shared {link.sharedIdentifierType} via {link.viaCaseId}</div>)}</details>}
    {runs.length>0 && <label>Investigation history<select style={style} value={selected} onChange={e=>setSelected(Number(e.target.value))}>{runs.map((r,i)=><option key={r.id} value={i}>{r.createdAt} · {r.id}</option>)}</select></label>}
    {run && <>
      <p><strong>Risk: {run.riskScore ?? 'Unavailable'} / 100 · {run.riskCategory}</strong><br /><small>{run.confidence.basis}</small></p>
      {run.factors.map((f:any)=><div key={f.factor}>{f.factor}: <strong>{Number(f.points).toFixed(2)}</strong></div>)}
      <p>ML: {run.ml.available ? `Random Forest ${(run.ml.probability*100).toFixed(1)}% research illicit probability; LR ${(run.ml.logisticRegressionProbability*100).toFixed(1)}%; IF anomaly ${run.ml.isolationForestAnomalyScore.toFixed(3)}. Partition: ${run.ml.partition}.` : run.ml.reason}</p>
      <details><summary>Extracted transaction, graph, temporal and network features</summary><pre style={{overflowX:'auto'}}>{JSON.stringify(run.features,null,2)}</pre></details>
      <details><summary>Evidence limitations</summary><ul>{run.limitations.map((x:string)=><li key={x}>{x}</li>)}</ul></details>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><label>Replay actual traversal<select aria-label="Replay algorithm" value={algorithm} onChange={e=>{setAlgorithm(e.target.value);setStep(0);}}>{run.executions.filter((x:any)=>x.visited).map((x:any)=><option key={x.algorithm}>{x.algorithm}</option>)}</select></label><Button variant="secondary" onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}>Previous</Button><Button variant="secondary" onClick={()=>setStep(Math.min((traversal?.visited || []).length,step+1))} disabled={step>=(traversal?.visited || []).length}>Next node</Button><small>{step} / {(traversal?.visited || []).length} visited</small></div>
      {run.nodes.length>0 && run.nodes.length<=100 && <svg viewBox="0 0 420 360" role="img" aria-label="Submitted transaction graph" style={{width:'100%',background:'#091523'}}>
        <defs><marker id="evidenceArrow" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" /></marker></defs>
        {run.edges.map((e:any)=>{const a=positions.get(e.source)!,b=positions.get(e.target)!;return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#38bdf8" markerEnd="url(#evidenceArrow)"><title>{e.reference}: {e.amount} {e.asset}; path cost {e.weight}</title></line>;})}
        {run.nodes.map((n:any,i:number)=>{const p=positions.get(n.id)!;return <g key={n.id}><circle cx={p.x} cy={p.y} r="10" fill={visitedIds.has(n.id)?'#fbbf24':'#087f94'} role="button" tabIndex={0} aria-label={`Inspect ${n.address}`} onClick={()=>setSelectedNode(n.id)} onKeyDown={e=>{if(e.key==='Enter')setSelectedNode(n.id);}}><title>{n.address} · {n.network} · {n.asset}</title></circle><text x={p.x+12} y={p.y+4} fill="#fff" fontSize="10">{i+1}: {n.address.slice(0,10)}</text></g>;})}
      </svg>}
      {selectedNode && <p>Selected node: {run.nodes.find((n:any)=>n.id===selectedNode)?.address} · incoming transfers {run.edges.filter((e:any)=>e.target===selectedNode).length} · outgoing transfers {run.edges.filter((e:any)=>e.source===selectedNode).length}</p>}
      <div style={{overflowX:'auto'}}><table><thead><tr><th>Execution</th><th>Nodes / edges</th><th>Time / space</th><th>ms</th></tr></thead><tbody>{run.executions.map((x:any)=><tr key={x.algorithm}><td>{x.algorithm}{x.path && <details><summary>Multi-hop path</summary>{x.path.map((id:string)=><div key={id}>{run.nodes.find((n:any)=>n.id===id)?.address || id}</div>)}</details>}</td><td>{x.nodesVisited} / {x.edgeVisits}</td><td>{x.timeComplexity}<br/>{x.spaceComplexity}</td><td>{x.executionMs.toFixed(3)}</td></tr>)}</tbody></table></div>
      <details><summary>Visited nodes and execution details</summary><pre style={{overflowX:'auto',maxHeight:300}}>{JSON.stringify(run.executions,null,2)}</pre></details>
      <small>Input SHA-256: {run.inputSha256}</small>
      <Button variant="secondary" onClick={download}>Download this analysis PDF</Button>
    </>}
  </section>;
}
