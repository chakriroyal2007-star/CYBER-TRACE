import { createHash } from 'node:crypto';
export const CHAINS=['Ethereum','Polygon','BNB Chain','Bitcoin','TRON'];
export const FRAUD_TYPES=['Investment Scam','Task Scam','Phishing','Sextortion','Ransomware','Darknet','Financial Fraud','Other'];
export const STATUSES=['New','Analyzing','Investigating','Action Required','Monitoring','Closed'];
export const PRIORITIES=['Low','Medium','High','Critical'];
export function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
export function object(value) { if(!value || typeof value!=='object' || Array.isArray(value)) fail('A JSON object is required.'); return value; }
export function textField(value,name,max=500,{required=false}={}) {
  if(value===undefined || value===null) { if(required) fail(`${name} is required.`); return ''; }
  if(typeof value!=='string') fail(`${name} must be text.`);
  const valueText=value.trim();
  if(valueText.length>max || (required && !valueText)) fail(`${name} must contain ${required?'1':'0'} to ${max} characters.`);
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(valueText)) fail(`${name} contains unsupported control characters.`);
  return valueText;
}
export function enumField(value,options,name,defaultValue) {
  const actual=value || defaultValue;
  if(!options.includes(actual)) fail(`${name} must be one of: ${options.join(', ')}.`);
  return actual;
}
export function numberField(value,name,{min=0,max=1e12}={}) {
  if(typeof value!=='number' || !Number.isFinite(value) || value<min || value>max) fail(`${name} must be a number between ${min} and ${max}.`);
  return value;
}
function base58Valid(address,version) {
  try {
    const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let n=0n;
    for(const c of address) { const i=alphabet.indexOf(c); if(i<0) return false; n=n*58n+BigInt(i); }
    let hex=n.toString(16); if(hex.length%2) hex='0'+hex;
    let bytes=Buffer.from(hex,'hex');
    let zeroes=0; while(address[zeroes]==='1') zeroes++;
    bytes=Buffer.concat([Buffer.alloc(zeroes),bytes]);
    if(bytes.length!==25 || !version.includes(bytes[0])) return false;
    const checksum=createHash('sha256').update(createHash('sha256').update(bytes.subarray(0,21)).digest()).digest().subarray(0,4);
    return checksum.equals(bytes.subarray(21));
  } catch { return false; }
}
function bech32Valid(address) {
  if(address!==address.toLowerCase() && address!==address.toUpperCase()) return false;
  const normalized=address.toLowerCase(),pos=normalized.lastIndexOf('1');
  if(pos<1 || normalized.length>90) return false;
  const hrp=normalized.slice(0,pos),alphabet='qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  if(hrp!=='bc') return false;
  const vals=[...normalized.slice(pos+1)].map(c=>alphabet.indexOf(c));
  if(vals.length<7 || vals.some(v=>v<0)) return false;
  const expanded=[...[...hrp].map(c=>c.charCodeAt(0)>>5),0,...[...hrp].map(c=>c.charCodeAt(0)&31),...vals];
  let chk=1;
  for(const v of expanded) { const top=chk>>>25; chk=((chk&0x1ffffff)<<5)^v; for(let i=0;i<5;i++) if((top>>>i)&1) chk^=[0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3][i]; }
  const version=vals[0];
  if(version>16 || (version===0 && chk!==1) || (version>0 && (chk>>>0)!==0x2bc830a3)) return false;
  return true;
}
export function normalizeWallet(address,chain) {
  const value=textField(address,'Reported wallet',120,{required:true});
  if(['Ethereum','Polygon','BNB Chain'].includes(chain)) {
    if(!/^0x[a-fA-F0-9]{40}$/.test(value)) fail('EVM wallet must be 0x followed by 40 hexadecimal characters.');
    // Lowercase canonical storage. EIP-55 display checksum is not asserted by this adapter.
    return value.toLowerCase();
  }
  if(chain==='TRON') { if(!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value) || !base58Valid(value,[0x41])) fail('TRON wallet must be a valid Base58Check address beginning with T.'); return value; }
  if(chain==='Bitcoin') { if(!base58Valid(value,[0,5]) && !bech32Valid(value)) fail('Bitcoin wallet must have a valid Base58Check or bech32/bech32m checksum.'); return value.toLowerCase().startsWith('bc1')?value.toLowerCase():value; }
  fail('Unsupported blockchain.');
}
export function validateCase(body) {
  object(body);
  const chain=enumField(body.chain,CHAINS,'Blockchain');
  const attachments=body.attachments || [];
  if(!Array.isArray(attachments) || attachments.length>10) fail('Provide at most 10 attachment metadata records.');
  const mapped=attachments.map((a,i)=> { object(a); return {name:textField(a.name,`Attachment ${i+1} name`,120,{required:true}),type:textField(a.type,'Attachment type',100),size:numberField(a.size??0,'Attachment size',{max:1e9}),description:textField(a.description,'Attachment description',500)}; });
  const id=body.id ? textField(body.id,'Case ID',50,{required:true}) : undefined;
  if(id && !/^[A-Za-z0-9][A-Za-z0-9_-]{2,49}$/.test(id)) fail('Case ID must contain 3-50 letters, digits, underscores or hyphens.');
  return {id,complaintId:textField(body.complaintId,'Complaint ID',100),fraudType:enumField(body.fraudType,FRAUD_TYPES,'Fraud type'),victimLoss:numberField(body.victimLoss,'Victim loss',{min:0.01}),currency:enumField(body.currency,['INR'],'Currency','INR'),reportedWallet:normalizeWallet(body.reportedWallet,chain),chain,transactionHash:textField(body.transactionHash,'Transaction hash',130),priority:enumField(body.priority,PRIORITIES,'Priority','Medium'),description:textField(body.description,'Description',5000),attachments:mapped};
}
export function validateWeights(body) {
  object(body); object(body.weights);
  const keys=['cluster','pattern','deposit','temporal','crossChain','historical','external'];
  if(Object.keys(body.weights).some(k=>!keys.includes(k))) fail('Unsupported attribution weight.');
  const weights=Object.fromEntries(keys.map(k=>[k,numberField(body.weights[k],k,{max:100})]));
  if(Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-100)>0.00001) fail('Attribution weights must sum to 100.');
  return weights;
}
export function validateTransaction(t,investigation) {
  object(t);
  const id=textField(t.id,'Transaction ID',80,{required:true});
  if(!/^[A-Za-z0-9_-]+$/.test(id)) fail('Transaction ID contains unsupported characters.');
  if(!investigation.nodes.some(n=>n.id===t.source) || !investigation.nodes.some(n=>n.id===t.target)) fail('Source and target must reference wallets in this investigation.');
  const chain=enumField(t.chain,CHAINS,'Transaction chain');
  if(investigation.nodes.find(n=>n.id===t.source).chain!==chain) fail('Transaction chain must match the source wallet chain.');
  const timestamp=textField(t.timestamp,'Timestamp',40,{required:true});
  if(!Number.isFinite(Date.parse(timestamp))) fail('Timestamp must be a valid ISO date.');
  return {id,source:t.source,target:t.target,chain,amount:numberField(t.amount,'Amount'),hash:textField(t.hash,'Transaction hash',130,{required:true}),timestamp:new Date(timestamp).toISOString(),asset:textField(t.asset || 'DEMO-INR','Asset',30),highlighted:Boolean(t.highlighted)};
}
