import { Store } from '../server/db.mjs';
import { initializeEvidenceAnalysis,saveAnalysis } from '../server/investigation/evidenceAnalysis.mjs';
import { INVESTIGATION_SCENARIOS } from '../server/investigation/scenarios.mjs';
import { randomBytes } from 'node:crypto';
import { readFileSync,writeFileSync,existsSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),dbPath=resolve(root,'data/presentation.sqlite'),accessPath=resolve(root,'data/presentation-access.json');
mkdirSync(resolve(root,'data'),{recursive:true});
process.env.NODE_ENV='production';process.env.DEMO_MODE='false';
const store=new Store(dbPath);initializeEvidenceAnalysis(store.db);
let access=existsSync(accessPath)?JSON.parse(readFileSync(accessPath,'utf8')):{email:'investigator@classroom.invalid',password:`Classroom#${randomBytes(12).toString('hex')}`};
let officer=store.getUserByEmail(access.email);
if(!officer)officer=store.registerUser({...access,name:'Project Investigator (Classroom)',role:'investigating_officer'});
let citizen=store.getUserByEmail('citizen@classroom.invalid');
if(!citizen)citizen=store.registerUser({email:'citizen@classroom.invalid',password:`Classroom#${randomBytes(12).toString('hex')}`,name:'Fictional Classroom Citizen',role:'reporter'});
writeFileSync(accessPath,JSON.stringify(access,null,2),{mode:0o600});
for(const scenario of INVESTIGATION_SCENARIOS){
 let existing=store.db.prepare("SELECT case_id FROM complaints WHERE incident_channel='CLASSROOM' AND incident_type=?").get(scenario.title);
 if(existing){
  const prior=store.db.prepare('SELECT rows_json FROM incident_transfers WHERE case_id=?').get(existing.case_id);
  if(prior?.rows_json!==JSON.stringify(scenario.transfers)){store.db.prepare('INSERT INTO incident_transfers VALUES(?,?,?) ON CONFLICT(case_id) DO UPDATE SET rows_json=excluded.rows_json,updated_at=excluded.updated_at').run(existing.case_id,JSON.stringify(scenario.transfers),new Date().toISOString());saveAnalysis(store.db,existing.case_id,officer.id,{sources:scenario.sources || [scenario.source],target:scenario.target});}
  continue;
 }
 const complaint=store.createComplaint({incidentType:scenario.title,description:`FICTIONAL CLASSROOM EXAMPLE — no real persons or financial allegations. ${scenario.objective} ${scenario.expected}`,incidentChannel:'CLASSROOM',isDemo:true,reporterId:citizen.id,reporterName:citizen.name,reporterEmail:citizen.email,reportedWallet:scenario.wallet,suspectUpi:scenario.upi,reportedLoss:0,chain:scenario.transfers[0].network==='UPI'?'UPI':scenario.transfers[0].network,presentationScenario:scenario.key});
 store.db.prepare('INSERT INTO incident_transfers VALUES(?,?,?)').run(complaint.caseId,JSON.stringify(scenario.transfers),new Date().toISOString());
 saveAnalysis(store.db,complaint.caseId,officer.id,{sources:scenario.sources || [scenario.source],target:scenario.target});
 store.addInternalNote({caseId:complaint.caseId,authorId:officer.id,authorName:officer.name,authorRole:'investigating_officer',note:`CLASSROOM OBJECTIVE: ${scenario.objective}\nEXPECTED OBSERVATIONS: ${scenario.expected}`});
 console.log(`Prepared ${scenario.title}: ${complaint.caseId}`);
}
store.close();
console.log(`\nClassroom server: http://localhost:${process.env.PORT || 8000}\nSign in: ${access.email}\nPassword: ${access.password}\nPrivate classroom credentials: ${accessPath}\nCases are fictional examples; ML research results are real trained model outputs.\n`);
if(!process.argv.includes('--prepare-only')){
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,DB_PATH:dbPath,EVIDENCE_DIR:resolve(root,'data/presentation-evidence'),HOST:'127.0.0.1',PORT:process.env.PORT || '8000'},stdio:'inherit'});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
 child.on('exit',code=>process.exit(code || 0));
}
