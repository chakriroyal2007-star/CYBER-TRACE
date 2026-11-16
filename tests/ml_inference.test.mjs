import test from 'node:test';
import assert from 'node:assert/strict';
import { getGraphEngine } from '../server/graph/graphEngine.mjs';
import { predictResearchFeatures } from '../server/ml/portableInference.mjs';
import { loadResearchPrediction } from '../server/investigation/evidenceAnalysis.mjs';

test('portable RF, Logistic Regression and Isolation Forest match actual sklearn predictions',async()=>{
 const graph=await getGraphEngine(),ids=[...graph.nodeIndex.keys()];
 for(let index=0;index<ids.length;index+=997){
  const node=graph.getNode(ids[index]),i=node.inDegree,o=node.outDegree;
  const predicted=predictResearchFeatures([i,o,i+o,o/(i+1),Number(i===0),Number(o===0)]),expected=loadResearchPrediction(node.txId);
  assert.equal(expected.available,true);
  for(const field of ['probability','logisticRegressionProbability','isolationForestAnomalyScore'])assert.ok(Math.abs(predicted[field]-expected[field])<1e-10,`${field} mismatch for ${node.txId}: ${predicted[field]} != ${expected[field]}`);
  assert.equal(predicted.runId,expected.runId);
 }
 assert.throws(()=>predictResearchFeatures([NaN,0,0,0,0,0]),/finite/);
});
