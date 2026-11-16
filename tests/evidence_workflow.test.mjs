import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { generateTotpSecret, computeTotp } from '../server/auth/totp.mjs';
import { Store } from '../server/db.mjs';
import { analyzeTransfers } from '../server/investigation/evidenceAnalysis.mjs';
import { client, launchServer } from './helpers.mjs';

// Controlled examples test software behavior, not real complaints, model labels, or fraud accuracy.
const tx = (from,to,i,extra={}) => ({from,to,amount:'123.000000000000000001',asset:'INR',network:'UPI',timestamp:new Date(Date.UTC(2026,0,1,0,0,i)).toISOString(),reference:`TEST-${i}`,...extra});
const scenarios = [
  ['UPI phishing and money mule network',[tx('victim','mule',1),tx('mule','collector',2),tx('collector','exit',3)]],
  ['Cryptocurrency investment fraud',[tx('victim','scheme',1,{asset:'BTC',network:'Bitcoin'}),tx('scheme','intermediary',2,{asset:'BTC',network:'Bitcoin'}),tx('intermediary','exit',3,{asset:'BTC',network:'Bitcoin'})]],
  ['Account takeover and rapid transfers',[tx('victim','mule',1),tx('mule','collector',2),tx('collector','exit',3),tx('mule','branch',4)]],
  ['Cryptocurrency layering and peeling chain',[tx('victim','layer1',1,{asset:'ETH',network:'Ethereum'}),tx('layer1','layer2',2,{asset:'ETH',network:'Ethereum'}),tx('layer2','exit',3,{asset:'ETH',network:'Ethereum'}),tx('layer1','peel',4,{asset:'ETH',network:'Ethereum'})]],
  ['Multiple complaints connected to a common fraud network',[tx('victim','common',1),tx('common','collector',2),tx('collector','exit',3),tx('victim2','common',4)]]
];

test('evidence algorithms: real execution, directed cycles, asset isolation, validation and no fabricated ML',()=>{
 const rows=[tx('a','b',1),tx('b','c',2),tx('c','a',3),tx('c','d',4)];
 const result=analyzeTransfers(rows,{sources:['a','c'],target:'d'});
 assert.equal(result.executions.find(x=>x.algorithm==='BFS').path.length,4);
 assert.equal(result.executions.find(x=>x.algorithm==='Multi-source BFS').distances[result.nodes.find(n=>n.address==='d').id],1);
 assert.equal(result.executions.find(x=>x.algorithm.startsWith('DFS')).cycleDetected,true);
 const d=result.executions.find(x=>x.algorithm.startsWith('Dijkstra'));
 assert.equal(d.distance,3); assert.equal(d.heapPushes,d.heapPops);
 assert.equal(result.executions.find(x=>x.algorithm==='Union-Find').components.length,1);
 assert.equal(result.executions.find(x=>x.algorithm==='Sliding Window').maxTransfers,4);
 assert.equal(result.ml.available,false); assert.equal(result.confidence.value,null);
 for(const execution of result.executions){assert.ok(execution.executionMs>=0);assert.ok(execution.nodesVisited>0);assert.ok(execution.timeComplexity);assert.ok(execution.spaceComplexity);}
 const weighted=analyzeTransfers([tx('a','b',1),tx('b','d',2,{cost:10}),tx('b','c',3),tx('c','d',4)],{sources:['a'],target:'d'});
 assert.equal(weighted.executions.find(x=>x.algorithm==='BFS').path.length,3);
 assert.equal(weighted.executions.find(x=>x.algorithm.startsWith('Dijkstra')).path.length,4);
 assert.throws(()=>analyzeTransfers([tx('a','b',1,{cost:-1})]),/non-negative/);
 const isolated=analyzeTransfers([tx('a','b',1),tx('b','c',2,{asset:'BTC',network:'Bitcoin'})],{sources:['a'],target:'c'});
 assert.equal(isolated.executions.find(x=>x.algorithm==='BFS').path,null);
 assert.equal(analyzeTransfers([]).riskScore,null);
 assert.throws(()=>analyzeTransfers(rows,{sources:['missing']}),/Source not found/);
 assert.throws(()=>analyzeTransfers(rows,{target:'missing'}),/Target/);
 assert.throws(()=>analyzeTransfers([tx('a','b',1,{amount:'NaN'})]),/decimal/);
 assert.throws(()=>analyzeTransfers([tx('a','b',1),tx('a','b',1)]),/Duplicate/);
});

test('five citizen-to-investigator scenarios persist evidence, analysis, findings, notifications and history after restart',async t=>{
 const server=await launchServer({NODE_ENV:'production'}); t.after(()=>server.close());
 // Provision explicitly, via the same local Store API as the offline bootstrap command.
 const db=new Store(join(server.directory,'test.sqlite'));
 const password='ControlledTest#2026!';
 db.registerUser({email:'officer@test.invalid',password,name:'Test Officer',role:'investigating_officer'});
 db.close();
 const citizen=client(server.baseUrl),officer=client(server.baseUrl),other=client(server.baseUrl);
 assert.equal((await citizen.request('/auth/demo-officer',{method:'POST',body:{}})).response.status,403);
 for(const role of ['officer','admin','supervisor','cbi-officer']) assert.equal((await other.request('/auth/register',{method:'POST',body:{email:`${role}@test.invalid`,password,name:'Attacker',role}})).response.status,403);
 assert.equal((await other.request('/auth/login',{method:'POST',body:{email:'fake.officer@cbi.gov.in',password}})).response.status,401);
 assert.equal((await other.request('/complaints',{headers:{'x-session-token':'forged-token'}})).response.status,401);
 assert.equal((await citizen.request('/auth/register',{method:'POST',body:{email:'citizen@test.invalid',password,name:'Controlled Test Citizen'}})).response.status,201);
 assert.equal((await other.request('/auth/register',{method:'POST',body:{email:'other@test.invalid',password,name:'Other Citizen'}})).response.status,201);
 assert.equal((await officer.request('/auth/login',{method:'POST',body:{email:'officer@test.invalid',password}})).response.status,200);
 const cases=[];
 for(const [name,transfers] of scenarios) await t.test(name,async()=>{
   const original=Buffer.from(`Controlled test evidence: ${name}\n`);
   const created=await citizen.request('/complaints',{method:'POST',body:{incidentType:name,description:'Controlled integration scenario, no real person or fraud allegation.',reportedLoss:123,reportedWallet:'shared-test-beneficiary',suspectUpi:'common@test',attachments:[{name:'receipt.txt',type:'text/plain',base64:original.toString('base64')}]}});
   assert.equal(created.response.status,201,JSON.stringify(created.data));
   const id=created.data.caseId; cases.push(id);
   const detail=(await officer.request(`/complaints/${id}`)).data;
   assert.equal(detail.evidence.length,1);assert.equal(detail.evidence[0].avScanStatus,'NOT_SCANNED');
   assert.equal(detail.evidence[0].sha256,createHash('sha256').update(original).digest('hex'));
   assert.equal((await other.request(`/complaints/${id}`)).response.status,404);
   assert.ok((await officer.request('/complaints')).data.some(c=>c.caseId===id));
   assert.equal((await citizen.request(`/complaints/${id}/transfers`,{method:'PUT',body:{transfers}})).response.status,403);
   assert.equal((await officer.request(`/complaints/${id}/transfers`,{method:'PUT',body:{transfers}})).response.status,200);
   const options={sources:['victim'],target:'exit',...(cases.length===2?{researchTxId:'232438397'}:{})};
   const analysis=await officer.request(`/complaints/${id}/analyze`,{method:'POST',body:options});
   assert.equal(analysis.response.status,200,JSON.stringify(analysis.data));
   assert.equal(analysis.data.edges.length,transfers.length);
   assert.equal(analysis.data.executions.find(x=>x.algorithm==='BFS').path.length,4);
   if(cases.length===2){assert.equal(analysis.data.ml.available,true);assert.ok(analysis.data.ml.probability>=0 && analysis.data.ml.probability<=1);}
   else assert.equal(analysis.data.ml.available,false);
   assert.ok(analysis.data.riskScore>=0 && analysis.data.riskScore<=100);
   await officer.request(`/complaints/${id}/analyze`,{method:'POST',body:options});
   assert.equal((await officer.request(`/complaints/${id}/analysis-runs`)).data.length,2);
   await officer.request(`/complaints/${id}/notes`,{method:'POST',body:{note:'INTERNAL TEST FINDING: corroboration required.'}});
   assert.equal((await officer.request(`/complaints/${id}/status`,{method:'POST',body:{status:'Under Review',reason:'Evidence evaluated'}})).response.status,200);
   assert.ok(!(await citizen.request(`/complaints/${id}`)).data.updates.some(x=>x.message.includes('INTERNAL TEST FINDING')));
   const pdf=await officer.request(`/complaints/${id}/analysis-report`);
   assert.equal(pdf.response.status,200);assert.equal(Buffer.from(pdf.data).subarray(0,5).toString(),'%PDF-');
   if(process.env.QA_PDF_PATH && cases.length===1)await writeFile(process.env.QA_PDF_PATH,Buffer.from(pdf.data));
   const bytes=await citizen.request(`/complaints/${id}/evidence-download?evidenceId=${detail.evidence[0].id}`);
   assert.deepEqual(Buffer.from(bytes.data),original);
 });
 assert.ok((await officer.request('/notifications')).data.length>=5);
 assert.equal((await officer.request('/dashboard')).data.metrics.submittedComplaints,5);
 assert.equal((await officer.request(`/complaints/${cases[0]}/connections`)).data.links.length,4);
 assert.ok((await citizen.request(`/complaints/${cases.at(-1)}`)).data.linkedCaseIds.includes(cases[0]));
 await server.restart();
 assert.equal((await citizen.request('/complaints')).data.length,5);
 for(const id of cases){
   const detail=(await officer.request(`/complaints/${id}`)).data;
   assert.equal(detail.status,'Under Review');assert.ok(detail.updates.some(x=>x.message.includes('INTERNAL TEST FINDING')));
   assert.equal((await officer.request(`/complaints/${id}/analysis-runs`)).data.length,2);
   const e=detail.evidence[0],bytes=await citizen.request(`/complaints/${id}/evidence-download?evidenceId=${e.id}`);
   assert.equal(createHash('sha256').update(Buffer.from(bytes.data)).digest('hex'),e.sha256);
 }
 const rejected=await citizen.request('/complaints',{method:'POST',body:{incidentType:'Invalid upload',description:'Metadata is not evidence',attachments:[{name:'fake.txt',sha256:'fake'}]}});
 assert.equal(rejected.response.status,400);assert.equal((await citizen.request('/complaints')).data.length,5);
 assert.equal((await officer.request('/auth/logout',{method:'POST',body:{}})).response.status,200);
 assert.equal((await officer.request('/complaints')).response.status,401);
});

test('authentication survives restart: refresh rotation, replay revocation, officer invitation and lockout',async t=>{
 const server=await launchServer({NODE_ENV:'production'});t.after(()=>server.close());
 const db=new Store(join(server.directory,'test.sqlite')),password='PersistentAuth#2026!';
 db.registerUser({email:'admin@test.invalid',password,name:'Test Admin',role:'admin'});db.close();
 const admin=client(server.baseUrl),anonymous=client(server.baseUrl);
 const login=await admin.request('/auth/login',{method:'POST',body:{email:'admin@test.invalid',password}});
 assert.equal(login.response.status,200);const refreshToken=login.data.refreshToken;
 const invite=await admin.request('/auth/invite-officer',{method:'POST',body:{email:'new.officer@cbi.gov.in',unit:'Test Unit'}});
 assert.equal(invite.response.status,201);
 for(let i=0;i<5;i++)await anonymous.request('/auth/login',{method:'POST',body:{email:'locked@example.in',password:'IncorrectPassword#1'}});
 await server.restart();
 assert.equal((await anonymous.request('/auth/login',{method:'POST',body:{email:'locked@example.in',password:'IncorrectPassword#1'}})).response.status,429);
 assert.equal((await anonymous.request(`/auth/verify-invite?token=${invite.data.token}`)).response.status,200);
 const secret=generateTotpSecret();
 assert.equal((await anonymous.request('/auth/accept-invite',{method:'POST',body:{token:invite.data.token,password,totpSecret:secret,totpCode:computeTotp(secret)}})).response.status,201);
 const newLogin=await anonymous.request('/auth/login',{method:'POST',body:{email:'new.officer@cbi.gov.in',password,totpCode:computeTotp(secret)}});
 assert.equal(newLogin.response.status,200);assert.ok(newLogin.data.token);assert.equal(newLogin.data.user.totpSecret,undefined);
 const rotated=await admin.request('/auth/refresh',{method:'POST',body:{refreshToken}});
 assert.equal(rotated.response.status,200);assert.ok(rotated.data.token);
 assert.equal((await admin.request('/auth/me')).response.status,200);
 assert.equal((await admin.request('/auth/refresh',{method:'POST',body:{refreshToken}})).response.status,401);
 assert.equal((await admin.request('/auth/me')).response.status,401);
});
