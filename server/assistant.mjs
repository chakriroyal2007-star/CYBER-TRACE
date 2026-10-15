import { shortestPath } from './analytics.mjs';
const inr=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value);
const cite=(id,type,label=id)=>({id,type,label});
export function answerQuestion(investigation,question) {
  const {case:record,attributions,nodes,edges,relatedCases,crossChain,riskIndicators}=investigation;
  const q=question.toLowerCase(),a=attributions[0];
  let answer='Insufficient evidence in the current dataset.',citations=[];
  if(/private key|password|kyc|owner|guilty|real identity|freeze|arrest|deanonym|legal advice/.test(q)) return {answer,citations,mode:'case-grounded deterministic assistant'};
  if(/related|complaint|correlat/.test(q)) {
    answer=relatedCases.length ? `${relatedCases.length} other complaints share corroborating synthetic network evidence: ${relatedCases.map(r=>`${r.caseId} (${r.relationship}; ${r.confidence}% heuristic confidence)`).join('; ')}. A shared VASP alone is not considered a sufficient link.` : 'No related complaints with shared wallet or cluster evidence in the current dataset.';
    citations=relatedCases.map(r=>cite(r.caseId,'case',r.caseId));
  } else if(/shortest|path.*exchange|path.*vasp/.test(q)) {
    const start=nodes.find(n=>n.type==='victim')||nodes[0],targets=nodes.filter(n=>n.type==='vasp');
    const paths=targets.map(t=>shortestPath(investigation,start?.id,t.id)).filter(p=>p && p.length);
    const path=paths.sort((x,y)=>x.length-y.length)[0];
    if(path) {
      const ids=path.map(n=>typeof n==='string'?n:n.id);
      answer=`Shortest observed directed path: ${ids.map(id=>nodes.find(n=>n.id===id)?.label || id).join(' → ')}. This is a ${ids.length-1}-edge path through the recorded synthetic graph, not proof of common ownership.`;
      citations=ids.map(id=>cite(id,'wallet',nodes.find(n=>n.id===id)?.label || id));
    }
  } else if(/after.*bridge|cross.chain|bridge transfer/.test(q)) {
    if(crossChain.length) {
      const t=crossChain[0];
      answer=`The recorded ${t.bridge} movement links ${t.sourceChain} to ${t.destinationChain} at ${t.timestamp}, carrying ${inr(t.amount)} of synthetic INR-equivalent value. ${a ? `The downstream candidate is ${a.candidate}, with ${inr(a.tracedAmount)} in terminal deposits and ${a.confidence}% analytical confidence.` : 'No supported downstream VASP exit is present.'} The bridge pairing is explicit fixture evidence, not a live chain assertion.`;
      citations=[cite(t.evidenceId,'evidence'),cite(nodes.find(n=>n.address===t.sourceWallet)?.id,'wallet'),cite(nodes.find(n=>n.address===t.destinationWallet)?.id,'wallet')].filter(c=>c.id);
      if(a) citations.push(...a.evidence.find(e=>e.id==='EV-deposit')?.transactionIds.slice(0,3).map(id=>cite(id,'transaction')) || []);
    }
  } else if(/why.*risk|high.risk|risk score|risk indicator/.test(q)) {
    answer=`This case has a rule-based risk score of ${record.riskScore}/100. ${riskIndicators.map(e=>`${e.title}: ${e.description}`).join(' ')} These are investigative indicators, not a finding that any person committed a crime.`;
    citations=riskIndicators.map(e=>cite(e.id,'evidence',e.title));
  } else if(/vasp|exchange|attribut|confidence|evidence/.test(q)) {
    if(a) {
      answer=`The strongest candidate is ${a.candidate}, with ${a.confidence}% attribution confidence. ${inr(a.tracedAmount)} reaches the candidate cluster in ${a.transactionCount} terminal transactions. The weighted evidence is: ${a.evidence.map(e=>`${e.title} (${e.score}/100 × ${e.weight}% weight = ${e.contribution} points)`).join('; ')}. This score is an explainable heuristic, not a calibrated probability or verified entity identity.`;
      citations=a.evidence.map(e=>cite(e.id,'evidence',e.title));
    }
  } else if(/fund|money|happen|summary|summari[sz]e|trace/.test(q)) {
    answer=`The reported loss is ${inr(record.victimLoss)}. The recorded synthetic network contains ${edges.length} transactions and ${nodes.length} wallets across ${record.chains.join(' and ')}. ${a ? `${inr(a.tracedAmount)} reaches the ${a.candidate} candidate deposit cluster; ${inr(Math.max(0,record.victimLoss-a.tracedAmount))} remains outside that terminal exit in the fixture.` : 'No sufficiently supported VASP exit has been identified.'} ${crossChain.length ? `${crossChain.length} paired bridge movement connects the observed chains.` : 'No cross-chain movement is recorded.'} Traced value excludes repeated intermediate transfers.`;
    citations=[...edges.slice(0,1).map(e=>cite(e.id,'transaction')),...(a?.evidence.find(e=>e.id==='EV-deposit')?.transactionIds.slice(0,3).map(id=>cite(id,'transaction')) || [])];
  } else if(/fingerprint|pattern|classification/.test(q)) {
    answer=investigation.fingerprint.patterns.map(p=>`Pattern consistent with ${p.name}: ${p.score}%. ${p.reason}`).join(' ')+' These are rule-based pattern similarities, not proof of criminal conduct.';
    citations=[...new Set(investigation.fingerprint.patterns.flatMap(p=>p.evidenceIds))].map(id=>cite(id,'evidence'));
  }
  return {answer,citations,mode:'case-grounded deterministic assistant'};
}
