// Exact traversal of exported sklearn estimators; no generated coefficients or predictions.
import { readFileSync,statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
const path=fileURLToPath(new URL('../../data/ml/portable_models.json.gz',import.meta.url));
let model,mtime;
function leaf(tree,features){let node=0,depth=0;while(tree.left[node]!==-1){node=Math.fround(features[tree.feature[node]])<=tree.threshold[node]?tree.left[node]:tree.right[node];depth++;}return {node,depth};}
function averagePath(n){return n<=1?0:n===2?1:2*(Math.log(n-1)+0.5772156649015329)-2*(n-1)/n;}
export function predictResearchFeatures(features){
 if(!Array.isArray(features) || features.length!==6 || features.some(x=>typeof x!=='number' || !Number.isFinite(x)))throw new Error('Six finite topology features required.');
 const start=performance.now(),stamp=statSync(path).mtimeMs;
 if(!model || stamp!==mtime){model=JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'));mtime=stamp;}
 let probability=0;
 for(const tree of model.randomForest){const {node}=leaf(tree,features),values=tree.values[node];probability+=values[1]/values.reduce((a,b)=>a+b,0);}
 probability/=model.randomForest.length;
 const lr=model.logisticRegression,z=features.reduce((sum,x,i)=>sum+((x-lr.mean[i])/lr.scale[i])*lr.coef[i],lr.intercept);
 const logisticRegressionProbability=z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
 const isolation=model.isolationForest;let depths=0;
 for(let i=0;i<isolation.trees.length;i++){const tree=isolation.trees[i],sample=isolation.features[i].map(j=>features[j]),{node,depth}=leaf(tree,sample);depths+=depth+averagePath(tree.samples[node]);}
 const isolationForestAnomalyScore=2**(-depths/(isolation.trees.length*averagePath(isolation.maxSamples)))+isolation.offset;
 return {probability,logisticRegressionProbability,isolationForestAnomalyScore,runId:model.runId,executionMs:performance.now()-start,inferenceMode:'LIVE_EXPORTED_SKLEARN_MODEL',features:Object.fromEntries(model.features.map((name,i)=>[name,features[i]]))};
}
