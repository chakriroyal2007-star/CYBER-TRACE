import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
const root=resolve(import.meta.dirname,'..');
for(const path of ['README.md','docs/PRESENTATION_GUIDE.md','docs/REPOSITORY_AUDIT_2026-11-16.md','docs/TEST_RESULTS.md','server/ml/train_research.py'])assert.ok(existsSync(resolve(root,path)),`${path} missing`);
const report=JSON.parse(readFileSync(resolve(root,'data/ml/evaluation.json'),'utf8'));
for(const name of ['random_forest','logistic_regression','isolation_forest']){
 const model=report.models[name];assert.ok(model,`${name} missing`);
 assert.equal(model.confusion_matrix.flat().reduce((sum,n)=>sum+n,0),report.test_samples);
 for(const metric of ['precision','recall','f1','roc_auc','pr_auc'])assert.ok(model[metric]>=0 && model[metric]<=1,`Invalid ${name}.${metric}`);
}
for(const [file,expected]of Object.entries(report.input_sha256))assert.equal(createHash('sha256').update(readFileSync(resolve(root,'data/elliptic',file))).digest('hex'),expected,`Dataset input changed: ${file}`);
const models=JSON.parse(gunzipSync(readFileSync(resolve(root,'data/ml/portable_models.json.gz'))));
assert.equal(models.runId,report.run_id,'Model/evaluation run mismatch');
console.log('Documentation paths, dataset hashes, measured evaluation counts and portable model provenance verified.');
