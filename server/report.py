"""Case-grounded report generation. JSON on stdin, PDF on stdout, no network calls."""
import io
import json
import os
import sys
from datetime import datetime, timezone
from html import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

NAVY = colors.HexColor('#0b182b')
CYAN = colors.HexColor('#087f94')
GRAY = colors.HexColor('#536173')
PALE = colors.HexColor('#edf3f7')
BORDER = colors.HexColor('#d7e0e8')
FONT = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'
font_dir = '/usr/share/fonts/truetype/dejavu'
if os.path.isfile(font_dir + '/DejaVuSans.ttf'):
    pdfmetrics.registerFont(TTFont('TraceSans',font_dir + '/DejaVuSans.ttf'))
    pdfmetrics.registerFont(TTFont('TraceSans-Bold',font_dir + '/DejaVuSans-Bold.ttf'))
    FONT, FONT_BOLD = 'TraceSans', 'TraceSans-Bold'
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TraceTitle',fontName=FONT_BOLD,fontSize=24,leading=29,textColor=NAVY,spaceAfter=10))
styles.add(ParagraphStyle(name='TraceH2',fontName=FONT_BOLD,fontSize=12,leading=17,textColor=CYAN,spaceBefore=16,spaceAfter=7,keepWithNext=True))
styles.add(ParagraphStyle(name='TraceBody',fontName=FONT,fontSize=9,leading=14,textColor=NAVY,spaceAfter=6))
styles.add(ParagraphStyle(name='TraceSmall',fontName=FONT,fontSize=7.4,leading=10.8,textColor=GRAY,spaceAfter=4,splitLongWords=True))
styles.add(ParagraphStyle(name='TraceCell',fontName=FONT,fontSize=7.3,leading=10.5,textColor=NAVY,splitLongWords=True))
styles.add(ParagraphStyle(name='TraceHead',fontName=FONT_BOLD,fontSize=7.4,leading=10.5,textColor=colors.white,splitLongWords=True))
styles.add(ParagraphStyle(name='TraceKicker',fontName=FONT_BOLD,fontSize=8,leading=12,textColor=CYAN,spaceAfter=8))

def safe(value):
    return escape(str(value if value is not None else 'Not recorded')).replace('\n','<br/>')

def p(value,style='TraceBody'):
    return Paragraph(safe(value),styles[style])

def money(value):
    return 'INR ' + format(float(value or 0),',.2f')

def table(rows,widths,head=True):
    cells=[[p(v,'TraceHead' if i==0 and head else 'TraceCell') for v in row] for i,row in enumerate(rows)]
    output=Table(cells,colWidths=widths,repeatRows=1 if head else 0,hAlign='LEFT')
    commands=[('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,-1),0.4,BORDER)]
    if head: commands += [('BACKGROUND',(0,0),(-1,0),NAVY),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE])]
    else: commands += [('BACKGROUND',(0,0),(0,-1),PALE)]
    output.setStyle(TableStyle(commands))
    return output

def generate(data):
    case=data['case']
    created=data.get('reportCreatedAt') or datetime.now(timezone.utc).isoformat()
    version=data.get('reportVersion',1)
    buffer=io.BytesIO()
    doc=SimpleDocTemplate(buffer,pagesize=A4,rightMargin=42,leftMargin=42,topMargin=64,bottomMargin=56,title=f"CRYPTO-TRACE INDIA | {case['id']}",author='CRYPTO-TRACE INDIA - Demo Investigator',subject='Synthetic investigation intelligence; human verification required')
    width=A4[0]-84
    story=[]
    add=story.append
    def heading(label): add(p(label,'TraceH2'))
    def page(canvas,document):
        canvas.saveState()
        canvas.setFillColor(NAVY);canvas.rect(0,A4[1]-42,A4[0],42,fill=1,stroke=0)
        canvas.setFont(FONT_BOLD,10);canvas.setFillColor(colors.white);canvas.drawString(42,A4[1]-27,'CRYPTO-TRACE INDIA')
        canvas.setFont(FONT,7);canvas.drawRightString(A4[0]-42,A4[1]-26,'SIMULATED INVESTIGATION DATA')
        canvas.setStrokeColor(BORDER);canvas.line(42,40,A4[0]-42,40)
        canvas.setFillColor(GRAY);canvas.setFont(FONT,7)
        canvas.drawString(42,27,f"{case['id']}  |  Version {version}  |  Demo intelligence output")
        canvas.drawRightString(A4[0]-42,27,f'Page {document.page}')
        canvas.restoreState()
    add(p('TRACE  /  ATTRIBUTE  /  CORRELATE  /  ACT','TraceKicker'))
    add(p('Investigation report','TraceTitle'))
    add(p(f"{case['id']}  |  {case['fraudType']}  |  {case['status']}"))
    add(p('From Reported Wallet to Actionable Intelligence','TraceSmall'))
    add(Spacer(1,8))
    add(table([['Reported loss','Terminal traced value','Candidate confidence','Network'],[money(case['victimLoss']),money(case['tracedAmount']),f"{case['confidence']}%",f"{len(data['edges'])} transactions / {len(data['nodes'])} wallets"]],[145,145,109,width-399]))
    heading('01 / Case and complaint information')
    add(table([['Case ID',case['id']],['Complaint ID',case.get('complaintId','Not recorded')],['Fraud type',case['fraudType']],['Reported wallet',case['reportedWallet']],['Blockchain / currency',f"{case['chain']} / {case['currency']}"],['Priority / risk',f"{case['priority']} / {case['riskScore']} of 100"],['Description',case['description']],['Attachment metadata',json.dumps(case.get('attachments',[]),ensure_ascii=True)],['Generated / version',f'{created} / v{version}']],[124,width-124],head=False))
    heading('02 / Scope, source and evidentiary limitations')
    add(p('This report uses deterministic synthetic investigation data. Wallets and VASP entities in the demo are fictional fixtures. Monetary values are INR-equivalent scenario amounts, not token valuations, exchange rates or evidence of actual transfers. New reported addresses are inputs to the simulator; no live blockchain query was performed.'))
    add(p('Investigative intelligence output. Attribution represents analytical confidence and requires appropriate human/legal verification. The system does not identify wallet owners, access private KYC, freeze assets, deanonymize mixers, contact exchanges or make legal determinations.'))
    action_start=len(story)
    heading('03 / Actionable exit')
    if data['attributions']:
        a=data['attributions'][0]
        add(p(f"Strongest candidate: {a['candidate']} | Attribution confidence {a['confidence']}% | Terminal value {money(a['tracedAmount'])}"))
        add(p(f"{a['transactionCount']} terminal transactions across {', '.join(a['chains'])}; {a['hops']} intermediary hops. First interaction {a['firstInteraction']}; last interaction {a['lastInteraction']}."))
    else:
        add(p('No sufficiently supported VASP candidate in the current dataset. Continue monitoring downstream exits.'))
    for i,recommendation in enumerate(data['recommendations'],1): add(p(f'{i}. {recommendation}'))
    action_block=story[action_start:]
    del story[action_start:]
    add(KeepTogether(action_block))
    heading('04 / Transaction summary and fund flow')
    add(p(f"The persisted network contains {len(data['edges'])} transaction records and {len(data['nodes'])} wallets across {', '.join(case['chains'])}. Traced value counts terminal VASP inflows once; intermediate transfers and bridge representations are not added again."))
    nodes={n['id']:n for n in data['nodes']}
    flow=[e for e in data['edges'] if e.get('highlighted')]
    rows=[['Ref.','From / to','Chain / asset','Amount / observed']]
    for edge in flow[:20]:
        rows.append([edge['id'],f"{nodes[edge['source']]['label']} -> {nodes[edge['target']]['label']}",f"{edge['chain']} / {edge.get('asset','DEMO')}",f"{money(edge['amount'])}\n{edge['timestamp']}"])
    add(table(rows,[58,187,99,width-344]))
    heading('05 / Cross-chain movement')
    if data['crossChain']:
        add(table([['Reference / bridge','Source -> destination','Amount','Observed / transaction hash']]+[[t['id']+' / '+t['bridge'],t['sourceChain']+' -> '+t['destinationChain'],money(t['amount']),t['timestamp']+'\n'+t['transactionHash']] for t in data['crossChain']],[109,114,89,width-312]))
        add(p('Bridge linkages are explicit synthetic fixture evidence. Time/value proximity alone would not establish a cross-chain ownership link in a live investigation.','TraceSmall'))
    else: add(p('No cross-chain transfer observed in this dataset.'))
    heading('06 / Fraud flow fingerprint')
    add(p('Rule-based investigative pattern classification; not a machine-learning verdict or proof of a crime. Scores describe similarity within this synthetic dataset.'))
    add(table([['Pattern consistent with','Score','Evidence / rationale']]+[[r['name'],str(r['score'])+'%',r['reason']+'\nReferences: '+', '.join(r.get('evidenceIds',[]))] for r in data['fingerprint']['patterns']],[140,50,width-190]))
    add(p(data['fingerprint'].get('method','Rule-based synthetic dataset analysis.'),'TraceSmall'))
    features=list(data['fingerprint']['features'].items())
    add(table([['Behavioral feature','Observed value']]+[[k,'Unavailable - synthetic INR equivalents' if k=='stablecoinConcentration' and not data['fingerprint']['features'].get('assetCoverage') else str(round(v,4) if isinstance(v,float) else v)] for k,v in features],[width*.65,width*.35]))
    add(PageBreak())
    heading('07 / Candidate VASP attribution and supporting evidence')
    for a in data['attributions']:
        add(p(f"{a['candidate']} / {a['confidence']}% confidence / {money(a['tracedAmount'])}", 'TraceKicker'))
        add(p('Confidence = sum(evidence score x configurable evidence weight) / 100. It is an explainable heuristic, not a calibrated probability or verified ownership claim.'))
        add(table([['Evidence','Weight / score','Points','References and explanation']]+[[e['id']+'\n'+e['title'],str(e['weight'])+'% / '+str(e['score']),str(round(e['contribution'],2)),e['description']+'\nTransactions: '+', '.join(e['transactionIds'])+'\nWallets: '+', '.join(e['walletIds'])] for e in a['evidence']],[109,65,66,width-240]))
    if not data['attributions']: add(p('Insufficient evidence in the current dataset.'))
    heading('08 / Related complaints')
    if data['relatedCases']:
        add(table([['Case','Relationship / confidence','Shared intelligence']]+[[r['caseId'],r['relationship']+' / '+str(r['confidence'])+'%',f"Wallet: {r['sharedWallet'] or 'Not established'}\nCluster: {r['sharedCluster']}\nCandidate: {r['sharedVasp'] or 'Not established'}"] for r in data['relatedCases']],[100,200,width-300]))
    else: add(p('No corroborated shared wallet or cluster in the current session. A shared candidate VASP alone is not sufficient to correlate cases.'))
    heading('09 / Risk indicators')
    for e in data['riskIndicators']:
        add(p(f"{e['id']} - {e['title']}: {e['description']} References: {', '.join(e['transactionIds'])}; wallets {', '.join(e['walletIds'])}."))
    add(PageBreak())
    heading('10 / Wallet network register')
    add(table([['Wallet reference / address','Chain / role','Risk / cluster']]+[[n['id']+' / '+n['label']+'\n'+n['address'],n['chain']+' / '+n['type'],str(n['riskScore'])+' / '+str(n.get('cluster','Unassigned'))] for n in sorted(data['nodes'],key=lambda n:n['id'])],[width*.60,width*.22,width*.18]))
    heading('11 / Investigation history')
    add(table([['Timestamp','Event','Details / references']]+[[e['timestamp'],e['action'],e['description']+'\n'+', '.join(e.get('evidenceIds',[]))] for e in data['timeline']],[116,115,width-231]))
    add(PageBreak())
    heading('12 / Complete transaction and hash register')
    add(p('All transaction hashes below are synthetic. The table is an export of persisted evidence records, not a blockchain attestation.','TraceSmall'))
    add(table([['ID / source -> target','Chain / amount','Timestamp / complete transaction hash']]+[[e['id']+'\n'+e['source']+' -> '+e['target'],e['chain']+'\n'+money(e['amount']),e['timestamp']+'\n'+e['hash']] for e in data['edges']],[124,105,width-229]))
    heading('13 / Audit metadata and integrity')
    add(p(f"Report version: {version}. Generated at: {created}. Dataset mode: SIMULATED INVESTIGATION DATA. Application: CRYPTO-TRACE INDIA. Generator: ReportLab / case-grounded server export. Actor: Demo Investigator."))
    add(p('After generation the service records the report SHA-256, version and timestamp in its session-scoped report register and audit trail. Hashes provide local integrity comparison only; this prototype does not provide a signed legal chain of custody.'))
    audit=data.get('audit',[])
    if audit:
        add(table([['Timestamp','Actor / action','Object']]+[[a['timestamp'],a['user']+' / '+a['action'],a['object']] for a in audit[:12]],[123,222,width-345]))
    doc.build(story,onFirstPage=page,onLaterPages=page)
    return buffer.getvalue()

if __name__ == '__main__':
    try:
        sys.stdout.buffer.write(generate(json.load(sys.stdin)))
    except Exception as error:
        print('Report generation failed: '+str(error),file=sys.stderr)
        sys.exit(1)
