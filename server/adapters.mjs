import { buildDataset } from './analytics.mjs';
/** Explicit provider boundary. Demo output can never be mistaken for a live adapter result. */
export class DemoBlockchainAdapter {
  mode='SIMULATED INVESTIGATION DATA';
  trace(caseRecord) { return {mode:this.mode,...buildDataset(caseRecord)}; }
  async health() { return {connected:true,live:false,mode:this.mode}; }
}
class DisabledOfficialAdapter {
  constructor(name) { this.name=name; }
  async health() { return {name:this.name,connected:false,status:'ADAPTER READY',reason:'No official endpoint or credentials configured.'}; }
  async submit() { throw Object.assign(new Error(`${this.name} is not configured. No external action was performed.`),{status:503}); }
}
export class NCRPAdapter extends DisabledOfficialAdapter {
  constructor(){super('NCRP Integration Adapter');}
  normalizeComplaint(input) { return {externalComplaintId:input.complaintId || null,reportedWallet:input.reportedWallet,chain:input.chain,victimLoss:input.victimLoss,source:'UNVERIFIED IMPORT',connected:false}; }
  async fetchComplaint() { return this.submit(); }
}
export class SAHYOGAdapter extends DisabledOfficialAdapter {
  constructor(){super('SAHYOG Integration Adapter');}
  prepareRoutingMetadata(caseRecord) { return {caseId:caseRecord.id,complaintId:caseRecord.complaintId,route:'AUTHORIZED CHANNEL TO BE SELECTED BY INVESTIGATOR',sent:false}; }
}
export class VASPRequestAdapter extends DisabledOfficialAdapter {
  constructor(){super('VASP Request Adapter');}
  prepare(pkg) { return {...pkg,status:'DRAFT FOR AUTHORIZED HUMAN REVIEW',sent:false}; }
}
/** Graph storage boundary currently resolved from relational tables; Neo4j is not enabled. */
export class RelationalGraphRepository {
  constructor(store) { this.store=store; }
  getTransactionGraph(sessionId,caseId) { const item=this.store.getInvestigation(sessionId,caseId); return item?{nodes:item.nodes,edges:item.edges}:null; }
  getKnowledgeGraph(sessionId,caseId) { return this.store.getInvestigation(sessionId,caseId)?.knowledgeGraph || null; }
}
