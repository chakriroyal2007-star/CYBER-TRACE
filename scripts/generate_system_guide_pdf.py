#!/usr/bin/env python3
"""
CYBER-TRACE INDIA: Complete System Architecture, Role Walkthrough & Operational Guide
Generates a comprehensive, court-grade, beautifully formatted PDF report covering
every aspect of the CYBER-TRACE platform, its architecture, user roles, algorithms, and workflows.
"""

import sys
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#475569"))

        # Header (Pages > 1)
        if self._pageNumber > 1:
            self.drawString(45, 752, "CYBER-TRACE INDIA · Forensic Intelligence & Multi-Hop Tracing Platform")
            self.drawRightString(567, 752, "CONFIDENTIAL & PROPRIETARY")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(45, 746, 567, 746)

        # Footer (All pages)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(45, 42, 567, 42)
        
        self.drawString(45, 30, "https://crypto-trace-omega.vercel.app · Academic Evaluation & Law Enforcement Briefing")
        self.drawRightString(567, 30, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=45,
        rightMargin=45,
        topMargin=46,
        bottomMargin=46
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=21,
        leading=25,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=3
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#0284C7"),
        spaceAfter=8
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#64748B")
    )

    h1 = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    h2 = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13.5,
        textColor=colors.HexColor("#0369A1"),
        spaceBefore=6,
        spaceAfter=3,
        keepWithNext=True
    )

    body = ParagraphStyle(
        'Body_Custom',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.8,
        textColor=colors.HexColor("#334155"),
        spaceAfter=4
    )

    bullet = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#334155"),
        leftIndent=12,
        spaceAfter=2
    )

    callout = ParagraphStyle(
        'Callout',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0F172A"),
        backColor=colors.HexColor("#F0F9FF"),
        borderColor=colors.HexColor("#0284C7"),
        borderWidth=0.8,
        borderPadding=6,
        spaceBefore=4,
        spaceAfter=6
    )

    story = []

    # ================= PAGE 1: EXECUTIVE SUMMARY & ARCHITECTURE =================
    story.append(Paragraph("CYBER-TRACE INDIA", title_style))
    story.append(Paragraph("Complete System Architecture, Role Walkthrough & Operational Guide", subtitle_style))
    story.append(Paragraph("<b>Version:</b> 2.4.0-Production &nbsp;|&nbsp; <b>Live URL:</b> <font color='#0284C7'>https://crypto-trace-omega.vercel.app</font> &nbsp;|&nbsp; <b>Audience:</b> Academic Evaluators, Judicial Officers & Cyber Crime Units", meta_style))
    story.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor("#0284C7"), spaceBefore=6, spaceAfter=8))

    story.append(Paragraph("1. Executive Summary & Core Mission", h1))
    story.append(Paragraph(
        "<b>CYBER-TRACE INDIA</b> is a forensic intelligence and money-trail reconstruction platform designed specifically to combat <i>hybrid cybercrimes</i> in India. Modern cyber syndicates systematically exploit multi-rail financial networks: stolen funds are collected via Unified Payments Interface (UPI), rapidly layered through multiple mule bank accounts within 10 to 30 minutes, converted into cryptocurrency (USDT TRC-20, Ethereum, or Bitcoin) via domestic peer-to-peer (P2P) desks or exchange gateways, and withdrawn to non-custodial or offshore exchange hot vaults.",
        body
    ))
    story.append(Paragraph(
        "Traditional investigations suffer from catastrophic jurisdictional delays: statutory notice dispatches via postal mail or uncoordinated emails take days or weeks, whereas fund dissipation occurs during the critical <b>'Golden Hour' (the initial 60–120 minutes)</b>. CYBER-TRACE overcomes this with four pillars:",
        body
    ))
    story.append(Paragraph("• <b>Deterministic Graph Theory & Classical DSA:</b> Real execution of BFS, DFS, Dijkstra, Tarjan SCC, Kahn Topological Sort, PageRank, A*, Prefix Trie, and LRU Cache without static fixtures.", bullet))
    story.append(Paragraph("• <b>Explainable Machine Learning:</b> Supervised Random Forest trained on 203,769 transactions from the academic Elliptic Bitcoin dataset with Platt calibration and feature importance attribution.", bullet))
    story.append(Paragraph("• <b>Bharatiya Sakshya Adhiniyam (BSA) 2023 Compliance:</b> Automated generation of court-ready Section 63 electronic record certificates and statutory freeze orders under Section 91 CrPC and Section 106 BSA.", bullet))
    story.append(Paragraph("• <b>Maker-Checker Governance:</b> Strict separation of duties ensuring investigating officers cannot self-authorize account freezes without supervisory concurrence.", bullet))

    story.append(Paragraph("2. End-to-End System Architecture", h1))
    story.append(Paragraph(
        "The application is engineered as a zero-trust, high-throughput, deterministic full-stack platform operating on a modern serverless and edge-ready architecture:",
        body
    ))

    arch_data = [
        ["Layer", "Technology / Stack", "Primary Responsibilities"],
        ["Client Presentation", "React 19, TypeScript, Vite 8, Recharts, Lucide", "Responsive intelligence console, interactive graph visualizers, DSA Study Studio, and citizen claim portal."],
        ["API Gateway & Auth", "Node.js 22 HTTP / Express Engine, Vercel Serverless", "REST API endpoints, JWT / session cookies, TOTP 2FA, brute-force lockout, rate limiting, and RBAC."],
        ["Data Persistence", "SQLite (Embedded / Vercel Serverless), PostgreSQL-ready", "ACID-compliant relational store for cases, evidence hashes, audit logs, notifications, and watchlists."],
        ["Graph & DSA Engine", "Custom TypeScript / ESM Algorithmic Library", "Graph representation (adjacency lists), BFS/DFS, Tarjan SCC, Kahn Topological Sort, A*, and Prefix Trie indexing."],
        ["Machine Learning", "Python 3 Scikit-Learn Pipeline + Pure-JS Runtime", "203K Elliptic transaction training, Platt scaling calibration, and real-time 4-part risk scoring."],
        ["Blockchain RPC", "Alchemy EVM, Etherscan API, TronGrid, Blockstream", "Live multi-chain balance verification, transaction confirmation, and 24/7 Watchtower surveillance."],
        ["Statutory Notices", "PDFKit & Node Crypto Engine", "Deterministic legal dossier compilation, SHA-256 seal computation, and BSA Section 63 certification."]
    ]

    t_arch = Table(arch_data, colWidths=[105, 145, 272])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 7.5),
        ('BOTTOMPADDING', (0,0), (-1,0), 3),
        ('TOPPADDING', (0,0), (-1,0), 3),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 7),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,1), (-1,-1), 2),
        ('TOPPADDING', (0,1), (-1,-1), 2),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Transparent Data Provenance:</b> CYBER-TRACE explicitly distinguishes between real on-chain data and synthetic demonstrations. Real blockchain RPCs are polled for Ethereum, Bitcoin, and TRON transaction hashes and balances, while synthetic banking mule accounts simulate banking ledgers that are legally inaccessible without judicial warrants.", callout))

    # ================= PAGE 2: ROLES 1 & 2 =================
    story.append(PageBreak())
    story.append(Paragraph("3. Complete Role-by-Role Operational Walkthrough", h1))
    story.append(Paragraph(
        "CYBER-TRACE implements role-based access control (RBAC) across five distinct operational personas, mirroring real-world law enforcement and judicial command structures.",
        body
    ))

    # ROLE 1
    story.append(Paragraph("Role 1: Citizen / Victim (Reporter Portal)", h2))
    story.append(Paragraph("<b>Primary Persona:</b> Priya Nair (Victim of Task Scam / Extortion) &nbsp;|&nbsp; <b>Access URL:</b> <font color='#0284C7'>/reporter/dashboard</font>", meta_style))
    story.append(Paragraph(
        "The Citizen Portal provides a secure, intuitive interface for victims of cyber fraud to formally file complaints, upload cryptographic evidence, and track investigation progress in real time without visiting a physical police station:",
        body
    ))
    story.append(Paragraph("1. <b>Identity & Email Verification:</b> Citizens register with name, email, and password. An automated 6-digit verification code is issued to confirm identity and prevent automated spam filings.", bullet))
    story.append(Paragraph("2. <b>Complaint Registration Form (/citizen-claim):</b> Citizens report incident type (Task Scam, Ransomware, Phishing, Investment Scam), loss amount in INR, transaction date, suspect UPI VPA, Bank UTR number, and recipient crypto wallet address.", bullet))
    story.append(Paragraph("3. <b>Evidence Ingestion & Cryptographic Sealing:</b> Victims upload chat screenshots, bank statements, and payment receipts. Each file is immediately processed by the backend, stripped of malicious metadata, and sealed with a deterministic SHA-256 hash for chain of custody.", bullet))
    story.append(Paragraph("4. <b>Tracking Code Issuance:</b> Upon submission, the citizen receives an immutable tracking code (e.g., <code>TRK-CR-2026-00192</code>). Citizens track status transitions (Pending Review → Under Investigation → Statutory Notice Issued → Recovery Confirmed) without accessing confidential police notes.", bullet))

    # ROLE 2
    story.append(Paragraph("Role 2: Investigating Officer (CBI / Cyber Crime Division)", h2))
    story.append(Paragraph("<b>Primary Persona:</b> Insp. Rajesh Sharma (CBI Cyber Crime Division) &nbsp;|&nbsp; <b>Access URL:</b> <font color='#0284C7'>/app/dashboard</font>", meta_style))
    story.append(Paragraph(
        "The Investigating Officer operates the primary forensic workspace, triage engine, and algorithmic analysis suite:",
        body
    ))
    story.append(Paragraph("1. <b>Incoming Reports Queue (/app/incoming):</b> Real-time triage inbox displaying newly registered citizen complaints. Officers review priority indicators (High/Medium/Low based on reported loss and automated risk assessment) and claim cases for active investigation.", bullet))
    story.append(Paragraph("2. <b>Case Dossier Review (/app/case-review/:id):</b> Comprehensive case file aggregating reporter statements, evidence attachments with SHA-256 seals, internal officer notes, status transitions, and assigned personnel.", bullet))
    story.append(Paragraph("3. <b>AI Investigation Workspace (/app/ai-investigation):</b> An automated 10-stage forensic agent orchestrator that correlates victim UPI payments, extracts UTR references, analyzes mule bank account pass-through velocity (detecting holding times < 1 hour), verifies fiat-to-crypto exchange gateway orders, traces multi-hop on-chain flows across Ethereum and TRON, and provides interactive natural-language Q&A.", bullet))
    story.append(Paragraph("4. <b>Financial Relationship Graph:</b> Renders the verified end-to-end money trail from the Victim UPI VPA, through intermediary Mule Bank Accounts, across the Exchange Gateway, to the final Exchange Hot Vault (e.g., Binance / WazirX).", bullet))
    story.append(Paragraph("5. <b>Statutory Notice Drafting:</b> Generates legal requisitions under Section 91 CrPC (summoning bank records) and Section 106 BSA (requesting immediate account freeze / debit block).", bullet))

    # ================= PAGE 3: ROLES 3, 4, 5 =================
    story.append(PageBreak())
    # ROLE 3
    story.append(Paragraph("Role 3: Supervisory Special Agent (Oversight & Maker-Checker)", h2))
    story.append(Paragraph("<b>Primary Persona:</b> SP Vikram Rathore (Supervisory Special Agent) &nbsp;|&nbsp; <b>Governance Principle:</b> Maker-Checker Separation", meta_style))
    story.append(Paragraph(
        "To prevent misuse of statutory powers and ensure judicial integrity, Indian law and organizational best practices require that account freezing orders cannot be unilaterally issued by a field investigator. CYBER-TRACE enforces this cryptographically:",
        body
    ))
    story.append(Paragraph("• <b>The Maker:</b> Insp. Rajesh Sharma prepares the freeze requisition, citing transaction hashes, UTR references, and mule classification evidence.", bullet))
    story.append(Paragraph("• <b>The Checker:</b> SP Vikram Rathore reviews the requisition dossier in the Supervisory Oversight console. Only the supervisor holds the cryptographic permission to approve the freeze and authorize dispatch to bank nodal officers.", bullet))
    story.append(Paragraph("• <b>Judicial Court Package Endorsement:</b> The supervisor compiles and digitally signs the Section 63 BSA Electronic Evidence Certificate, attaching master SHA-256 integrity seals.", bullet))

    # ROLE 4
    story.append(Paragraph("Role 4: Chief Forensic Director / Administrator", h2))
    story.append(Paragraph("<b>Primary Persona:</b> Dr. Ananya Roy (Chief Forensic Director) &nbsp;|&nbsp; <b>Access URL:</b> <font color='#0284C7'>/app/settings</font>", meta_style))
    story.append(Paragraph(
        "The Chief Forensic Director administers platform governance, forensic integrity, and institutional access control:",
        body
    ))
    story.append(Paragraph("• <b>Cryptographic Officer Invitations:</b> Issues single-use, time-limited, cryptographically signed invitation tokens restricted to approved law enforcement domains (<code>@cbi.gov.in</code>, <code>@police.gov.in</code>).", bullet))
    story.append(Paragraph("• <b>Tamper-Evident Hash-Chained Audit Log:</b> Every officer login, case view, status modification, ML score override, and notice generation is appended to a cryptographic audit ledger where each record includes the SHA-256 hash of the preceding block.", bullet))
    story.append(Paragraph("• <b>Account Security & Suspension:</b> Manages mandatory TOTP two-factor authentication enrollments, account lockouts (5 consecutive failed attempts trigger 15-minute lockout), and immediate session revocations.", bullet))

    # ROLE 5
    story.append(Paragraph("Role 5: Institutional Nodal Officer (Bank / Exchange Liaison)", h2))
    story.append(Paragraph("<b>Primary Persona:</b> Compliance & Nodal Officers at Paytm Bank, HDFC, ICICI, Binance, WazirX, and CoinDCX", meta_style))
    story.append(Paragraph(
        "Facilitates rapid electronic liaison between law enforcement and financial institutions during the Golden Hour. Nodal officers receive formal Section 91/106 requisitions containing exact bank account numbers, UTRs, and blockchain deposit addresses. Nodal officers log into the liaison endpoint to confirm debit freeze actions, record frozen amounts, and transmit customer KYC records securely.",
        body
    ))

    # ================= PAGE 4: TECHNICAL & ALGORITHMIC MODULES =================
    story.append(PageBreak())
    story.append(Paragraph("4. Technical Modules & Data Structures Deep-Dive", h1))
    story.append(Paragraph(
        "CYBER-TRACE incorporates an extensive catalog of <b>14 fully dynamic Data Structures and Algorithms (DSA)</b> implemented from first principles in TypeScript/ESM without external shortcuts or hardcoded outputs. Each algorithm serves an explicit forensic purpose in the money laundering investigation lifecycle.",
        body
    ))

    dsa_table = [
        ["Algorithm / Data Structure", "Category", "Time Complexity", "Forensic Purpose in CYBER-TRACE"],
        ["Breadth-First Search (BFS)", "Graph Traversal", "O(V + E)", "Traces hop-by-hop fund dissipation from victim origin; finds shortest transfer path to exchange exits."],
        ["Depth-First Search (DFS)", "Cycle & Depth", "O(V + E)", "Detects cyclic money-laundering topologies (wash trading loops and round-tripping)."],
        ["Dijkstra's Algorithm", "Weighted Shortest Path", "O((V + E) log V)", "Calculates the least-taint optimal asset recovery path using a Binary Min-Heap."],
        ["Tarjan's SCC Algorithm", "Strong Connectivity", "O(V + E)", "Isolates tightly coupled syndicate mule networks with circular transfer patterns."],
        ["Kahn's Topological Sort", "Causal DAG Ordering", "O(V + E)", "Constructs strict chronological, cause-and-effect timelines proving causal link from theft to cashout."],
        ["PageRank Centrality", "Centrality Power Iteration", "O(I * (V + E))", "Identifies central laundering aggregators and high-velocity mule pooling hubs."],
        ["A* Heuristic Search", "Targeted Heuristic", "O((V + E) log V)", "Accelerates targeted route recovery when the destination exchange hot wallet is known."],
        ["Prefix Trie (Radix Tree)", "String Retrieval (Non-Graph)", "O(L) [L = key len]", "Powers instant autocomplete and real-time screening across wallets, UPI VPAs, and case IDs."],
        ["LRU Cache (Doubly Linked)", "Memory (Non-Graph)", "O(1) Get / Put", "Caches on-chain balance lookups and RPC queries within strictly bounded memory."],
        ["Priority Queue (Binary Heap)", "Heap (Non-Graph)", "O(log N) Push/Pop", "Drives top-K suspicious wallet prioritization without sorting million-row datasets."],
        ["Union-Find (DSU)", "Disjoint Set Union", "O(α(V)) amortized", "Partitions disconnected fraud clusters using path compression and union by rank."]
    ]

    t_dsa = Table(dsa_table, colWidths=[115, 95, 80, 232])
    t_dsa.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 7.5),
        ('BOTTOMPADDING', (0,0), (-1,0), 3),
        ('TOPPADDING', (0,0), (-1,0), 3),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 7),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,1), (-1,-1), 2),
        ('TOPPADDING', (0,1), (-1,-1), 2),
    ]))
    story.append(t_dsa)
    story.append(Spacer(1, 6))

    story.append(Paragraph("Explainable Machine Learning Engine (Elliptic Dataset)", h2))
    story.append(Paragraph(
        "CYBER-TRACE rejects black-box AI predictions that cannot be explained in a court of law. The platform's risk engine is trained on the MIT/IBM <b>Elliptic Bitcoin Dataset</b> (203,769 on-chain Bitcoin transactions with 166 structural and neighborhood features):",
        body
    ))
    story.append(Paragraph("• <b>Model Architecture:</b> Supervised Random Forest Classifier with Platt scaling calibration to produce honest, probabilistic predictions rather than synthetic confidence claims.", bullet))
    story.append(Paragraph("• <b>4-Part Sub-Score Decomposition:</b> Overall risk (0–100) is decomposed into four independent explainable dimensions: <i>Temporal Velocity Risk</i>, <i>Transaction Volume Risk</i>, <i>Graph Topology Risk</i>, and <i>VASP/Sanction Risk</i>.", bullet))
    story.append(Paragraph("• <b>Human-in-the-Loop Override:</b> Authorized CBI officers can record formal overrides with mandatory legal justifications if external field intelligence contradicts the automated prediction. Overrides are immutably logged in the cryptographic audit trail.", bullet))

    # ================= PAGE 5: UI NAVIGATION, SCRIPT & COMPLIANCE =================
    story.append(PageBreak())
    story.append(Paragraph("5. Step-by-Step UI Navigation & Live Demonstration Guide", h1))
    story.append(Paragraph(
        "For evaluators, professors, and judges reviewing the live deployment at <b>https://crypto-trace-omega.vercel.app</b>, the platform provides seamless navigation across specialized workspaces:",
        body
    ))

    nav_table = [
        ["Page / Workspace", "URL Route", "Key Interactive Features to Demonstrate"],
        ["Dashboard", "/app/dashboard", "Executive metrics, incoming case queue, five presentation scenarios, quick navigation pills."],
        ["Incoming Reports", "/app/incoming", "Live citizen complaint queue, priority badges (High/Med/Low), 'Review Dossier' action button."],
        ["Case Dossier Review", "/app/case-review/:id", "Full case file for CR-2026-72301 & CR-2026-00192, UTR verification, evidence attachments, status transitions."],
        ["AI Investigation", "/app/ai-investigation", "10-stage automated forensic orchestrator, 5 risk cards, 6-node Financial Relationship Graph, follow-up chat."],
        ["Mode B: DSA Studio", "/app/dsa-studio", "Step-by-step algorithmic simulation (BFS, Dijkstra, Kahn, Prefix Trie, LRU Cache) with Play/Pause and inspection."],
        ["Mode C: ML Benchmark", "/app/ml-benchmark", "Elliptic dataset confusion matrix, precision/recall curves, ROC-AUC score, and feature importance rankings."],
        ["Watchtower", "/app/watchtower", "24/7 wallet monitoring pool across Bitcoin, Ethereum, and TRON with live RPC balance polling."],
        ["Global Palette", "Cmd + K (Shortcut)", "Real-time search bar powered by the Prefix Trie with O(L) autocomplete across cases, wallets, and VPAs."],
        ["Citizen Portal", "/reporter/dashboard", "Public victim workspace: complaint filing, evidence upload, and tracking code status inquiry."]
    ]

    t_nav = Table(nav_table, colWidths=[105, 115, 302])
    t_nav.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 7.5),
        ('BOTTOMPADDING', (0,0), (-1,0), 3),
        ('TOPPADDING', (0,0), (-1,0), 3),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 7),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,1), (-1,-1), 2),
        ('TOPPADDING', (0,1), (-1,-1), 2),
    ]))
    story.append(t_nav)
    story.append(Spacer(1, 6))

    story.append(Paragraph("6. Legal, Statutory & Regulatory Compliance Framework", h1))
    story.append(Paragraph(
        "CYBER-TRACE was architected in direct consultation with the procedural mandates of modern Indian criminal jurisprudence:",
        body
    ))
    story.append(Paragraph("• <b>Bharatiya Sakshya Adhiniyam (BSA) 2023, Section 63:</b> Replaces former Section 65B of the Indian Evidence Act. Every digital evidence export includes an automated, tamper-proof electronic record certificate containing server execution hashes, officer digital identity, device specifications, and SHA-256 provenance seals.", bullet))
    story.append(Paragraph("• <b>Code of Criminal Procedure (CrPC) Section 91:</b> Automates the formal requisition process summoning transactional logs, IP addresses, and KYC documents from intermediary banks and VASP compliance officers.", bullet))
    story.append(Paragraph("• <b>BSA Section 106 / CrPC Section 102:</b> Provides the formal statutory vehicle for asset preservation orders instructing financial institutions to execute immediate debit freezes on confirmed mule accounts.", bullet))
    story.append(Paragraph("• <b>I4C & CFCFRS Integration:</b> Aligns with the 1930 National Cyber Crime Reporting Portal data schemas, ensuring seamless interoperability with existing Indian cyber cell workflows.", bullet))

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceBefore=4, spaceAfter=6))
    story.append(Paragraph("<b>End of Official Briefing Document</b> &nbsp;|&nbsp; CYBER-TRACE INDIA &nbsp;|&nbsp; <i>Built for Smart India Hackathon & Amrita Vishwa Vidyapeetham Academic Evaluation</i>", meta_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated at: {filename}")

if __name__ == '__main__':
    out_path = sys.argv[1] if len(sys.argv) > 1 else 'docs/CYBER_TRACE_COMPLETE_SYSTEM_AND_USER_GUIDE.pdf'
    build_pdf(out_path)
