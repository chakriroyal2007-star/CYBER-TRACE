import { useEffect, useState } from 'react';
import { api } from '../api';
import { Badge, Button } from '../components/ui';

export default function MlBenchmarkLab() {
  const [evaluation,setEvaluation]=useState<any>(null);
  const [txId,setTxId]=useState('232629023');
  const [prediction,setPrediction]=useState<any>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  function load(){setLoading(true);api('/ml/evaluation').then(setEvaluation).catch(e=>setError(e.message)).finally(()=>setLoading(false));}
  useEffect(load,[]);
  const card={background:'#090d16',border:'1px solid #1e293b',borderRadius:10,padding:20};
  return <div style={{padding:'24px 32px',maxWidth:1400,margin:'0 auto',color:'#e2e8f0'}}>
    <div style={{...card,marginBottom:20}}><Badge variant="warning">ACADEMIC RESEARCH DATASET</Badge><h1>Elliptic Machine Learning Benchmark Lab</h1><p>Measured results from the reproducible training pipeline. Research transaction IDs are not live blockchain hashes or UPI accounts.</p></div>
    {loading && <p>Loading measured evaluation…</p>}
    {error && <p role="alert">{error} <Button onClick={load}>Retry</Button></p>}
    {evaluation && <>
      <div style={{...card,marginBottom:20}}><h2>Run a real dataset prediction lookup</h2><p>Use an Elliptic transaction ID to inspect the outputs of the saved, trained models. This ID is a research node, not a live wallet or UPI account.</p><label>Elliptic transaction ID<input aria-label="Elliptic transaction ID" value={txId} onChange={e=>setTxId(e.target.value)}/></label><Button onClick={()=>api(`/transactions/${encodeURIComponent(txId)}`).then(setPrediction).catch(e=>setError(e.message))}>Inspect model prediction</Button>{prediction && <div><p>Dataset label: {prediction.knownLabel} · Model score: {prediction.riskScore ?? 'unavailable'}/100</p><p>RF illicit probability: {prediction.modelProvenance?.available ? (prediction.modelProvenance.probability*100).toFixed(2)+'%' : 'Unavailable'} · LR: {prediction.modelProvenance?.available ? (prediction.modelProvenance.logisticRegressionProbability*100).toFixed(2)+'%' : 'Unavailable'} · Isolation Forest anomaly score: {prediction.modelProvenance?.isolationForestAnomalyScore?.toFixed(4) ?? 'Unavailable'}</p><p>Inference: {prediction.modelProvenance?.inferenceMode || 'Saved research output'} · {prediction.modelProvenance?.executionMs?.toFixed(3) ?? '—'} ms</p><p>Partition: {prediction.modelProvenance?.partition} · Probabilities are uncalibrated. Dataset labels do not force or override predictions.</p></div>}</div>
      <div style={{...card,marginBottom:20}}><h2>Experiment setup</h2><p>{evaluation.dataset} · {evaluation.train_samples.toLocaleString()} training / {evaluation.test_samples.toLocaleString()} testing samples</p><p>{evaluation.split}</p><p>{evaluation.unknown_excluded_from_supervised.toLocaleString()} unknown labels excluded from supervised training.</p><p>Features: {evaluation.features.join(', ')}</p></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))',gap:16}}>{Object.entries(evaluation.models).map(([name,value])=>{const m:any=value;return <div key={name} style={card}><h2 style={{fontSize:18}}>{name.replaceAll('_',' ')}</h2><table><tbody>{['precision','recall','f1','roc_auc','pr_auc'].map(metric=><tr key={metric}><th>{metric.toUpperCase()}</th><td>{m[metric].toFixed(4)}</td></tr>)}</tbody></table><p>Confusion matrix (rows actual, columns predicted):</p><pre>{JSON.stringify(m.confusion_matrix,null,2)}</pre><p>Execution: {m.execution_seconds.toFixed(3)} seconds</p>{name==='isolation_forest' && <p>Anomaly score, not a fraud probability.</p>}</div>;})}</div>
      <div style={{...card,marginTop:20}}><h2>Evidence limitations</h2><ul>{evaluation.limitations.map((x:string)=><li key={x}>{x}</li>)}</ul><details><summary>Reproducibility and input hashes</summary><pre style={{whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{JSON.stringify({runId:evaluation.run_id,seed:evaluation.seed,python:evaluation.python,sklearn:evaluation.sklearn,inputSha256:evaluation.input_sha256},null,2)}</pre></details></div>
    </>}
  </div>;
}
