import { useState } from 'react';
import { Button } from './ui';
export default function EvidenceDownload({caseId,evidence}:{caseId:string,evidence:any}) {
  const [status,setStatus]=useState('');
  async function download(){
    try {
      const r=await fetch(`/api/complaints/${encodeURIComponent(caseId)}/evidence-download?evidenceId=${encodeURIComponent(evidence.id)}`,{credentials:'include',headers:{Authorization:`Bearer ${localStorage.getItem('ct_token')||''}`}});
      if(!r.ok) throw new Error((await r.json()).error);
      const bytes=await r.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes);
      const digest=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==evidence.sha256) throw new Error('Downloaded bytes failed SHA-256 verification.');
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'})),a=document.createElement('a');
      a.href=url;a.download=evidence.filename||'evidence.bin';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('SHA-256 verified');
    } catch(e:any){setStatus(e.message);}
  }
  return <div><Button variant="secondary" onClick={download}>Verify &amp; download original</Button>{status && <p role="status" style={{fontSize:11}}>{status}</p>}</div>;
}
