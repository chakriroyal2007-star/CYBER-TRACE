export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('ct_token') || '' : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}`, 'x-session-token': token } : {}),
    ...(options.headers as any)
  };

  const response = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    credentials: 'include',
    ...options,
    headers
  });

  const newToken = response.headers.get('x-new-session-token');
  if (newToken && typeof localStorage !== 'undefined') {
    localStorage.setItem('ct_token', newToken);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request could not be completed' }));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  const data = await response.json();
  if (data?.token && typeof localStorage !== 'undefined') {
    localStorage.setItem('ct_token', data.token);
  }
  return data;
}

export function navigate(path:string){if(window.location.pathname+window.location.search===path)return;history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));window.scrollTo(0,0)}
export function money(value:number,compact=false){if(compact&&value>=10000000)return `₹${(value/10000000).toFixed(2)} Cr`;if(compact&&value>=100000)return `₹${(value/100000).toFixed(2)} L`;return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value)||0)}
export function shortAddress(value:string='',size=6){return value.length>size*2+3?`${value.slice(0,size)}…${value.slice(-4)}`:value}
export function formatTime(value:string){if(!value)return '—';const d=new Date(value);return isNaN(d.getTime())?value:d.toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC'}
export function toast(message:string,type='success'){window.dispatchEvent(new CustomEvent('toast',{detail:{message,type}}))}
