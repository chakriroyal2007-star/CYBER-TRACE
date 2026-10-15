# Shared implementation contract
Runtime: Node 24 HTTP server, React 19 + TypeScript + Vite client. Root /api. SQLite durable local database; documented PostgreSQL schema and optional PostgreSQL adapter if feasible. Source always SIMULATED INVESTIGATION DATA. No external data credentials. Demo session cookie established POST /api/auth/demo; case mutations/reads scoped to session with seeded global read-only cases (clone on updates) if feasible.
JSON successes are direct objects/arrays, errors {error:string}. All IDs strings. All money INR number. Frontend helper api<T>(path, options?) handles /api prefix, credentials same-origin. Client routing /app/dashboard, /app/cases, /app/new, /app/investigations/:id, /app/wallets, /app/graph, /app/vasps, /app/cross-chain, /app/patterns, /app/alerts, /app/reports, /app/api, /app/settings, /app/sources, /app/requests. React Router not installed; navigation via shared navigate(path), custom use location.
Case: {id, complaintId, fraudType, victimLoss, currency:'INR', reportedWallet, chain, transactionHash, priority, description, attachments:[], status, riskScore, tracedAmount, confidence, vaspCandidate, transactionCount, walletCount, chains:string[], updatedAt, createdAt, source:'demo'}.
GET /api/cases -> Case[]. query q,fraudType,risk,chain,status,vasp,date,sort supported when feasible.
POST /api/cases body {id?,complaintId?,fraudType,victimLoss,currency,reportedWallet,chain,transactionHash?,priority,description,attachments?} -> Case. POST /api/investigations {caseId} -> full Investigation (synchronous deterministic analysis persisted, frontend stages progress but labels demo replay).
GET /api/cases/:id -> Case. PATCH /api/cases/:id {status} -> Case
GET /api/investigations/:id -> Investigation {case:Case, nodes:Node[], edges:Edge[], attributions:Attribution[], fingerprint:Fingerprint, relatedCases:Relationship[], crossChain:Transfer[], timeline:Event[], recommendations:string[], riskIndicators:Evidence[], knowledgeGraph:{nodes:any[],edges:any[]}}
Node {id,address,label,type:'victim'|'suspect'|'intermediary'|'bridge'|'dex'|'mixer'|'vasp'|'unknown',chain,balance,riskScore,entity,cluster,firstSeen,lastSeen,incomingCount,outgoingCount,behavior:string[],evidenceIds:string[],x:number,y:number}
Edge {id,source,target,amount,timestamp,hash,chain,asset,highlighted:boolean}
Evidence {id,title,description,weight,score,contribution,transactionIds:string[],walletIds:string[]}
Attribution {id,candidate,confidence,tracedAmount,transactionCount,chains:string[],firstInteraction,lastInteraction,hops,evidence:Evidence[]}
Fingerprint {features:Record<string,number>,patterns:{name,score,reason,evidenceIds:string[]}[]}
Relationship {caseId,fraudType,relationship,sharedWallet,sharedCluster,sharedVasp,confidence}
Transfer {id,bridge,sourceChain,destinationChain,amount,timestamp,transactionHash,sourceWallet,destinationWallet,evidenceId}
Event {id,timestamp,action,description,evidenceIds?:string[]}
GET /api/graph/:id -> {nodes,edges}; GET /api/attribution/:id -> Attribution[]; GET /api/cases/:id/related -> Relationship[]
GET /api/wallets/:address -> {wallet:Node,cases:Case[],transactions:Edge[],behavior:Fingerprint.features,fingerprint:Fingerprint}
GET /api/wallets/:address/transactions -> Edge[]
GET /api/dashboard -> {cases:Case[],metrics:{activeCases,highRiskWallets,vaspLeads,fundsTraced,crossChainMovements,relatedCases,activeAlerts},fraudTypes:{name,value}[],chainFlows:{name,value}[],attributionDistribution:{name,value}[],riskTrend:{date,value}[],activity:Event[]}
GET /api/search?q= -> {type,title,subtitle,id,caseId?,path}[]
GET /api/alerts -> Alert[] {id,severity,type,caseId,wallet,amount,timestamp,status,description}; PATCH /api/alerts/:id {status:'Reviewed'|'Dismissed'} -> Alert
POST /api/assistant/:caseId {question} -> {answer,citations:{id,type,label}[],mode:'case-grounded deterministic assistant'}
POST /api/evidence/:caseId/:id/view -> Evidence and audit
GET /api/reports -> {id,caseId,createdAt,version,filename}[]; POST /api/reports/:caseId/generate -> {id,caseId,createdAt,version,filename,url}; GET /api/reports/:id -> PDF bytes.
POST /api/requests/:caseId/generate -> structured JSON request package and audit. Download frontend as JSON.
GET /api/settings -> {weights:Record<string,number>,mode,session}; PUT /api/settings {weights} -> settings. Keys cluster,pattern,deposit,temporal,crossChain,historical,external; values sum 100 (25,20,15,15,10,10,5). Recompute on trace.
GET /api/sources -> {name,status,coverage,mode,lastUpdated}[]
GET /api/audit -> {id,timestamp,user,action,object}[]
GET /api/events -> SSE demo stream; events default message JSON {type,caseId,message,timestamp,mode:'DEMO STREAM'}; must not claim real new transactions if merely replaying stored evidence.
GET /api/health; GET /api/openapi.json; GET /api/docs documentation HTML (CSP compatible, no CDN requirement).
UI shared components exported src/components/ui.tsx: Button, Card, Badge, RiskBadge, MetricCard, PageHeader, EmptyState, LoadingState, ErrorState, Field. Generic components accept ordinary React props and children. api.ts exports api, navigate, money, shortAddress, formatTime. toast via window.dispatchEvent(new CustomEvent('toast',{detail:{message,type}})).
