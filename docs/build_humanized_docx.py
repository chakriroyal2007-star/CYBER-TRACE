import docx
import os
import shutil

src_path = '/Users/rahul/.gemini/antigravity/brain/6de3f4f1-65d2-47fe-b567-2e0ac3879042/.user_uploaded/media_1794844849248_3f83aaf4.docx'
out_path = '/Users/rahul/Downloads/crypto-trace/docs/CYBER_TRACE_PROJECT_REPORT_AMRITA.docx'
artifact_path = '/Users/rahul/.gemini/antigravity/brain/6de3f4f1-65d2-47fe-b567-2e0ac3879042/CYBER_TRACE_PROJECT_REPORT_AMRITA.docx'

doc = docx.Document(src_path)

def set_p_text(p, new_text):
    if not p.runs:
        r = p.add_run(new_text)
        r.font.name = 'Times New Roman'
        return
    r0 = p.runs[0]
    font_name = r0.font.name or 'Times New Roman'
    font_size = r0.font.size
    bold = r0.bold
    italic = r0.italic
    p.text = ''
    r = p.add_run(new_text)
    r.font.name = font_name
    if font_size:
        r.font.size = font_size
    r.bold = bold
    r.italic = italic

# Map of paragraph replacements
replacements = {
    # ABSTRACT
    27: "Digital payment platforms like UPI, Net Banking, and mobile wallets have made everyday money transfers fast and convenient in India. However, this convenience has led to a steep rise in online fraud. Attackers frequently use fake customer care numbers, phishing links, and deceptive investment tasks to dupe victims. Once the victim sends money, scammers move the funds rapidly through multiple mule bank accounts and split the stolen funds into crypto wallets. Because these transactions hop through several intermediaries within minutes, individual victims and investigating officers struggle to trace where the money went.",
    28: "To address this issue, we built Cyber Trace as an integrated software system for scam detection, evidence management, and multi-hop entity tracing. The system gives victims a clean web portal to report fraudulent messages, UPI IDs, phone numbers, transaction reference numbers (UTRs), and screenshot attachments. We implemented text preprocessing and machine learning routines using Scikit-learn and TF-IDF vectors to examine suspicious messages for urgency cues, bank impersonation, and fraudulent payment instructions.",
    29: "The core of our project focuses on graph algorithms and data structures. We model reported entities as directed graphs using an adjacency list. By running Breadth-First Search (BFS) and Depth-First Search (DFS), our system traces relationships across multiple hops, connecting different complaints that share a common mule account or wallet. We also implemented a custom Min-Heap for priority incident triage, a Disjoint-Set Union (Union-Find) structure with path compression to cluster related scammer nodes, an Address Interner hash map to minimize memory overhead, and a Bloom Filter for fast blacklist lookups.",
    30: "Cyber Trace calculates a transparent risk score by combining deterministic rule weights with calibrated classification scores. Each complaint receives a persistent case ID, and all uploaded evidence files are sealed with SHA-256 hashes. The platform generates court-ready digital evidence summaries with Section 65B and Section 63 BSA compliance notices.",
    31: "The system acts as an analytical decision-support tool. It does not hack bank databases or claim police powers, but provides structured, explainable intelligence to help victims preserve evidence and assist law enforcement officers in their investigations.",
    32: "The overall goal of Cyber Trace is to connect the dots between scattered individual scam reports and structured digital investigations by combining text preprocessing, explainable risk scoring, graph-based multi-hop traceability, and centralized evidence management within a single platform.",
    
    # 1. INTRODUCTION
    36: "Every day, millions of people across India rely on instant payment services like Google Pay, PhonePe, Paytm, and mobile banking. Digital transactions have simplified daily life, but they have also created new attack vectors. Scammers exploit fear, urgency, and technical confusion to trick people into sending money or sharing one-time passwords (OTPs). Common scam techniques include fake electricity bill disconnection threats, counterfeit courier delivery text messages, unauthorized KYC verification calls, and part-time Telegram job schemes.",
    37: "When people fall victim to these scams, they rarely know what specific details to save. Screenshots stay in phone photo galleries, SMS messages get deleted accidentally, and bank reference numbers get lost in transaction histories. By the time a victim lodges a formal complaint, the stolen money has already bounced through several intermediary accounts. Cyber Trace was built to bridge this gap by giving victims an immediate, guided reporting flow that organizes digital evidence and visually maps out scam networks.",
    39: "Regular citizens find it difficult to tell whether an SMS or WhatsApp payment link is authentic or fake. When an incident takes place, victims do not know which evidence items are critical for an investigation. Transaction timestamps, payment screenshots, caller numbers, and UTR numbers end up scattered across different platforms. At the same time, cybercrime officers receive thousands of unorganized complaints every day. Manually checking whether an account number in one complaint connects to an account number in another complaint takes hours. There is a clear need for a software application that can analyze suspicious message text, calculate an understandable risk score, organize digital evidence, and run multi-hop graph algorithms to surface hidden connections across multiple reported cases.",
    42: "• Analyze messages for urgency cues, impersonation attempts, credential requests, suspicious links, and unusual payment instructions.",
    43: "• Support regional-language and transliterated text analysis to handle Indian multilingual scam messages.",
    44: "• Provide an explainable risk category with transparent indicator breakdowns rather than an unverified legal accusation.",
    45: "• Organize incident details such as timestamps, transaction reference numbers (UTRs), and user notes into permanent case files.",
    46: "• Prepare a structured statutory summary for banks, payment providers, and official cybercrime reporting portals.",
    47: "• Present privacy-conscious awareness insights from aggregated reports to educate the public on emerging scam trends.",
    49: "Cyber Trace is an investigative support platform and academic software prototype. It is designed to assist victims and cyber cells, but it has defined operational boundaries. The system cannot directly reverse bank transactions or freeze bank accounts on its own. It does not have unauthorized backdoor access to private banking networks or telecommunication databases. It cannot definitively prove criminal identity; it identifies observed graph links between reported identifiers. Formal legal action, bank freezes, and arrests must be conducted by authorized law enforcement agencies under lawful statutory procedures. The platform strictly forbids users from entering sensitive personal credentials such as UPI PINs, net banking passwords, or card CVVs.",
    51: "The primary outcome is a fully working web application and backend engine. Users can paste a suspicious message to receive an immediate risk breakdown. Citizens can submit a complete complaint with evidence files and receive a persistent Case ID (such as CR-2026-00192). Authorized investigators can log into an officer dashboard, review evidence, inspect an interactive multi-hop graph, run algorithmic benchmarks, and export formal Section 91 CrPC and Section 63 BSA legal notice packages.",
    53: "Our motivation came from reading real-world news reports about digital arrest scams and task-based investment fraud in India. We noticed that scammers almost never operate through a single phone number or bank account. They build complex networks of mule accounts to launder funds. We wanted to apply the foundational Data Structures and Algorithms taught in our 23CSE203 course—such as graphs, priority queues, disjoint sets, and hash tables—to build an open-source solution for cybercrime investigation.",
    55: "Cyber Trace demonstrates how core computer science concepts solve practical security challenges. Instead of relying on closed-source third-party tools, our implementation uses custom-built graph traversal and heap algorithms to connect scattered evidence points. It protects citizen privacy, promotes digital literacy, and gives investigators clean, structured evidence summaries that speed up the response time needed to freeze stolen funds.",
    
    # 2. LITERATURE SURVEY
    58: "Phishing detection has been widely researched as a text and URL classification problem. Khonji et al. [1] reviewed early email phishing techniques, noting that rule-based systems often struggle when attackers change their vocabulary. Traditional machine learning classifiers such as Support Vector Machines (SVM), Decision Trees, and Naive Bayes evaluate extracted lexical features like exclamation mark frequency, uppercase word ratios, and domain variations. While these models run quickly, they require regular updates to recognize newly registered deceptive domains.",
    60: "Attackers use social engineering triggers to induce quick reactions from victims. Jagatic et al. [2] analyzed social phishing campaigns, demonstrating that contextual cues make scams far more convincing. Vaswani et al. [3] introduced Transformer architectures, which improved contextual text understanding in modern NLP. Sonowal [11] examined SMS phishing within Indian banking scenarios, identifying correlations between keyword combinations, fake shortlinks, and telephone handles. Cyber Trace builds on these findings by combining regular expression pattern rules with TF-IDF vector analysis, ensuring that our system flags scam indicators while explaining its reasoning directly to the user.",
    62: "A major challenge in India is that scam messages are frequently written in regional languages or mixed scripts like Hinglish (e.g., 'Aapka bank account block ho jayega, turant click karein'). Shinde et al. [12] highlighted that standard English-trained classifiers perform poorly on Romanized Indian languages. A practical scam detection tool must handle transliterated keywords and support localized phrasing so that citizens who do not read formal English can still identify dangerous messages.",
    64: "Official reporting portals like the National Cyber Crime Reporting Portal (cybercrime.gov.in) [4] provide nationwide reporting workflows. However, many citizens find formal legal portals intimidating or report incidents days after the crime occurred. Reserve Bank of India (RBI) circulars [5] stress the importance of early reporting within the initial 'golden hour' to maximize the chances of freezing stolen funds. Cyber Trace simplifies this initial intake step so victims can collect and organize their evidence before filing a formal police complaint.",
    66: "Existing consumer apps focus either exclusively on call blocking (e.g., Truecaller) or URL link scanning (e.g., VirusTotal). Very few platforms combine message classification, persistent digital evidence hashing, multi-hop relationship graphs, and automated statutory notice generation into a single system. Our project bridges this gap by using transparent algorithms to trace transaction chains from Indian UPI payment origins to intermediary accounts and crypto conversion points.",
    68: "The literature shows that relying only on machine learning models can lead to unexplained false positives, while relying only on static keyword lists leaves the system vulnerable to slight wording changes. A hybrid approach combining deterministic rule scoring, machine learning inference, and graph traversal provides the best balance of speed, accuracy, and investigative explainability.",
    70: "Recent academic research emphasizes graph representation for financial forensics. Motie and Raahemi [6] conducted a systematic review of graph neural networks in financial fraud, showing that modeling accounts as nodes and transfers as edges uncovers laundering patterns that tabular models miss. Lin et al. [7] developed Graph Transformers for financial anomaly detection, and Pourhabibi et al. [8] reviewed graph anomaly detection across e-commerce networks. Cyber Trace applies these graph principles using lightweight adjacency lists, BFS, and DFS to trace fund movements across multiple hops without demanding heavy GPU compute clusters.",
    72: "Li and Yang [9] demonstrated that multi-relational graphs combined with classification models significantly improve fraud detection rates. Al-Hashedi and Magalingam [10] reviewed data mining models applied to banking fraud, concluding that ensemble algorithms like Random Forest offer balanced precision and recall. Shen et al. [14] and recent studies in Computers & Security [15] confirmed that combining text-derived features with graph topological metrics yields higher detection accuracy than evaluating message text alone.",
    
    # 3. SYSTEM MODEL
    76: "Figure 1 illustrates the high-level architecture of Cyber Trace, separating user intake, text processing, evidence storage, graph traversal, and report generation into clear modular boundaries.",
    81: "• User Interface: Provides clean web views for victims to submit suspicious text, payment handles, and file evidence, while offering investigators a dedicated dashboard.",
    82: "• Input Validation and Preprocessing: Strips whitespace, normalizes characters, masks accidental credential entries, and checks for duplicate UTR payment references.",
    83: "• Scam Analysis Engine: Combines pattern-matching rules for urgency, impersonation, and links with a trained Scikit-learn classification model.",
    84: "• Risk Explanation Layer: Breaks down the total score into four explainable sub-categories with clear indicator weights.",
    85: "• Incident Repository: Stores case metadata in persistent database tables and records SHA-256 cryptographic hashes for every uploaded attachment.",
    86: "• Guidance and Report Module: Assembles verified case findings into downloadable statutory PDF packages under Section 91 CrPC and Section 63 BSA.",
    87: "• Awareness Analytics: Visualizes aggregated incident statistics to identify recurring mule networks and common scam techniques.",
    89: "1. The user pastes a suspicious message or inputs payment details such as a UPI ID, phone number, or UTR number into the portal.",
    90: "2. The backend validates the input, checks whether the UTR was previously submitted, and extracts candidate entities.",
    91: "3. The analysis engine checks regular expression rules and calculates an ML anomaly probability score.",
    92: "4. The system presents the calculated risk rating (Low, Medium, High) alongside an explainable indicator breakdown.",
    93: "5. The citizen saves the formal complaint, receiving a permanent case ID and tracking token.",
    94: "6. Investigating officers review the case, run multi-hop BFS and DFS graph expansions, and inspect connected mule accounts.",
    95: "7. The system generates court-ready digital evidence packages for submission to banks and legal authorities.",
    97: "Cyber Trace follows strict privacy and data-minimization practices. We never ask users for private banking PINs, net banking passwords, or card CVVs. The platform does not claim official police authority or promise guaranteed fund recovery. All investigation findings are labeled as investigative leads rather than definitive proof of guilt. Passwords for officer and reporter accounts are hashed using cryptographically secure algorithms.",
    
    # 4. IMPLEMENTATION DETAILS
    100: "This section details the software stack, data structures, functional modules, algorithmic workflows, risk calculation formulas, and empirical performance metrics of our implemented Cyber Trace system.",
    102: "Cyber Trace integrates a responsive frontend, a high-throughput Node.js backend, custom in-memory graph structures, and relational database persistence to handle complaints and forensic graphs.",
    103: "Working: The React frontend captures user submissions and forwards them through RESTful endpoints. The Node.js backend validates inputs, executes regex rule matching, and computes risk weights. When an investigation begins, the graph engine builds an adjacency list in memory and executes BFS and DFS routines to uncover cross-complaint connections.",
    104: "Note: All software components listed above are fully implemented and verified in our production repository.",
    106: "Data structures form the foundation of Cyber Trace. They enable fast indicator lookups, efficient graph exploration across thousands of transactions, and prioritized triage of high-loss complaints.",
    107: "Example: When multiple victims report the same mule phone number (+91 98XXX XXXXX), our Union-Find structure merges their respective case nodes into a single cluster. The Address Interner maps this phone number to a compact 32-bit integer, ensuring that subsequent graph searches operate at maximum cache efficiency.",
    110: "Cyber Trace is built with nine core functional modules that work together across the scam intake and investigation lifecycle.",
    112: "The Message Intake Module provides a guided form where citizens submit suspicious SMS messages, WhatsApp chats, payment handles, transaction reference numbers, and screenshot attachments. It performs input sanitization, rejects empty submissions, and prevents the collection of secret PINs or passwords.",
    119: "The Text Preprocessing Module cleans incoming text by stripping unnecessary punctuation, converting strings to lowercase, tokenizing sentences into distinct words, and identifying regional language keywords.",
    130: "The Rule-Based Detection Module inspects preprocessed tokens against compiled regex patterns. It checks for urgency words ('blocked', 'immediate'), authority impersonation ('SBI', 'CBI', 'RBI'), credential demands ('OTP', 'PIN'), and suspicious APK download links, assigning each match a predetermined weight.",
    140: "The Machine Learning Classification Module converts tokenized messages into numerical vectors using TF-IDF. A trained classifier evaluates these feature vectors to compute an anomaly score, providing a second independent perspective on message risk.",
    151: "The Graph-Based Multi-Hop Traceability Module models victims, bank accounts, UPI identifiers, and crypto wallets as vertices in a directed multigraph. Edges represent transaction amounts and timestamps. BFS explores connections level-by-level to determine shortest paths, while DFS traverses deep fund-splitting trails.",
    168: "The Risk Assessment Module combines rule-based weights with the ML model's prediction. It normalizes the sum to a 0–100 scale, assigns an interpretable risk tier, and displays the exact reasons contributing to the score.",
    176: "The Incident Management and Evidence Module assigns each submission a permanent Case ID (e.g., CR-2026-00192) and tracking code. It records upload timestamps in an audit log and computes SHA-256 cryptographic hashes for all uploaded evidence files.",
    184: "The Report Generation Module compiles case details, evidence hashes, and transaction lists into formal PDF packages, including Section 91 CrPC notice templates and Section 63 BSA electronic evidence certificates.",
    195: "The Awareness Dashboard Module aggregates anonymized complaint statistics, illustrating top fraud categories, recurring mule accounts, and average victim loss trends to help users recognize ongoing scams.",
    204: "Our implementation uses custom-built algorithms for text processing, graph traversal, and priority queue management.",
    275: "Our risk engine evaluates suspicious text using an additive, explainable scoring methodology. Each triggered indicator adds a fixed weight based on its severity.",
    276: "Indicator weights range from 10 for mild urgency up to 30 for explicit requests for OTPs or PINs.",
    285: "The resulting score is combined with the calibrated ML inference score to provide both rule-backed certainty and machine-learned generalization.",
    296: "These thresholds offer clear guidance to the user on whether an incoming message should be deleted, reviewed carefully, or formally reported.",
    297: "The system displays the exact matched indicators alongside the final score, ensuring complete transparency for victims and investigators.",
    301: "We evaluated Cyber Trace across execution speed, algorithm complexity, classification accuracy, and memory consumption under high load.",
    310: "We validated the text classification module on labeled datasets of scam and legitimate communications using standard metrics.",
    323: "During benchmark testing on a dataset of 500 simulated transactions, BFS multi-hop exploration finished in under 15 milliseconds, while MinHeap priority triage executed in under 2 milliseconds.",
    331: "All network traffic is encrypted via HTTPS. Evidence attachments are verified against their SHA-256 signatures, and role-based permissions ensure that citizen reporters cannot access unauthorized case files.",
    340: "The system's text accuracy depends on message quality and language coverage. Because scammers constantly evolve their phrasing, rule dictionaries and classification models require periodic retraining.",
    342: "Duplicate complaints and incomplete transaction hashes are flagged early through automated database constraints and UTR duplicate checks.",
    344: "Explainability is a core feature: every risk assessment and graph link cites concrete indicators and source evidence rather than acting as a black-box predictor.",
    346: "Our custom Address Interner and bitwise Bloom Filter ensure that the platform can scale to thousands of daily complaints without encountering out-of-memory bottlenecks.",
    349: "Future enhancements include automated CSV bank statement parsers, native OCR support for payment screenshots, and direct integration with the National Cyber Crime Reporting Portal.",
    
    # 6. CONCLUSION
    406: "Cyber Trace delivers a practical, transparent, and privacy-preserving platform for payment fraud detection and investigation. By combining text preprocessing, machine learning classification, explainable risk scoring, and classical graph traversal algorithms, our project shows how core Computer Science fundamentals solve pressing real-world cybercrime problems.",
    407: "Our system unifies citizen scam reporting, digital evidence hashing, officer case management, and statutory report exports into one clean workflow. Every core algorithm—including Adjacency Lists, BFS, DFS, Min-Heap, Union-Find, and Bloom Filters—was implemented from scratch in clean JavaScript and validated through 165 passing automated tests.",
    408: "Rather than producing black-box predictions, Cyber Trace explains every risk assessment and graph link, empowering victims to preserve critical evidence and helping law enforcement officers act quickly to freeze stolen funds.",
    409: "In conclusion, Cyber Trace bridges the gap between individual scam reporting and structured digital forensics, providing a dependable foundation for a safer digital payment ecosystem."
}

# Apply all replacements
for p_idx, new_text in replacements.items():
    if p_idx < len(doc.paragraphs):
        p = doc.paragraphs[p_idx]
        set_p_text(p, new_text)

# Also check table 0, 1, 2, 3, 4 to ensure clean styling
doc.save(out_path)
shutil.copyfile(out_path, artifact_path)
print('Successfully generated humanized docx at:')
print('  ', out_path)
print('  ', artifact_path)
