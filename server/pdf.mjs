import PDFDocument from 'pdfkit';

/**
 * Generates an official-looking, multi-page investigation PDF report in pure Node.js
 * @param {Object} data Investigation case, edges, nodes, attributions, recommendations, riskIndicators, timeline
 * @returns {Promise<Buffer>} PDF file buffer
 */
export function generatePdfNode(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `CRYPTO-TRACE INDIA | ${data.case?.id || 'Investigation'}`,
          Author: 'CRYPTO-TRACE INDIA - Official Intelligence Platform',
          Subject: 'Synthetic investigation intelligence; human verification required',
          Keywords: 'crypto, trace, investigation, blockchain, forensic, vasp'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const c = data.case || {};
      const version = data.reportVersion || 1;
      const created = data.reportCreatedAt || new Date().toISOString();
      const attributions = data.attributions || [];
      const edges = data.edges || [];
      const nodes = data.nodes || [];
      const recommendations = data.recommendations || [];
      const riskIndicators = data.riskIndicators || [];

      // Color Palette
      const NAVY = '#0b182b';
      const CYAN = '#087f94';
      const DARK = '#1e293b';
      const GRAY = '#64748b';
      const LIGHT_BG = '#f8fafc';
      const BORDER = '#e2e8f0';

      const formatMoney = (val) => 'INR ' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Page Header Bar
      const renderHeader = (pageNumber) => {
        doc.save();
        doc.rect(0, 0, doc.page.width, 36).fill(NAVY);
        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('CRYPTO-TRACE INDIA', 40, 13);
        doc.fontSize(7.5).font('Helvetica').text('CONFIDENTIAL · LAW ENFORCEMENT & INVESTIGATION USE ONLY', doc.page.width - 320, 14, { align: 'right', width: 280 });
        doc.restore();

        // Footer
        doc.save();
        doc.strokeColor(BORDER).lineWidth(0.5).moveTo(40, doc.page.height - 35).lineTo(doc.page.width - 40, doc.page.height - 35).stroke();
        doc.fillColor(GRAY).fontSize(7).font('Helvetica').text(`${c.id || 'CASE'} | Version ${version} | Generated ${created}`, 40, doc.page.height - 25);
        doc.text(`Page ${pageNumber}`, doc.page.width - 100, doc.page.height - 25, { align: 'right', width: 60 });
        doc.restore();
      };

      let pageCount = 1;
      renderHeader(pageCount);

      doc.y = 55;

      // Kicker & Title
      doc.fillColor(CYAN).fontSize(8).font('Helvetica-Bold').text('TRACE  /  ATTRIBUTE  /  CORRELATE  /  ACT');
      doc.moveDown(0.3);
      doc.fillColor(NAVY).fontSize(20).font('Helvetica-Bold').text('Crypto Forensic Investigation Report');
      doc.moveDown(0.2);
      doc.fillColor(DARK).fontSize(9).font('Helvetica').text(`Case ID: ${c.id || 'N/A'}  |  Type: ${c.fraudType || 'Fraud'}  |  Status: ${c.status || 'Active'}  |  Priority: ${c.priority || 'High'}`);
      doc.moveDown(0.8);

      // KPI Metric Cards
      const boxWidth = (doc.page.width - 80 - 30) / 4;
      const kpis = [
        { label: 'REPORTED LOSS', value: formatMoney(c.victimLoss) },
        { label: 'TERMINAL TRACED', value: formatMoney(c.tracedAmount) },
        { label: 'CONFIDENCE SCORE', value: `${c.confidence || 0}%` },
        { label: 'CHAIN ACTIVITY', value: `${edges.length} txs / ${nodes.length} wallets` }
      ];

      const kpiY = doc.y;
      kpis.forEach((kpi, i) => {
        const x = 40 + i * (boxWidth + 10);
        doc.save();
        doc.roundedRect(x, kpiY, boxWidth, 42, 4).fillAndStroke(LIGHT_BG, BORDER);
        doc.fillColor(GRAY).fontSize(6.5).font('Helvetica-Bold').text(kpi.label, x + 8, kpiY + 8);
        doc.fillColor(NAVY).fontSize(9.5).font('Helvetica-Bold').text(kpi.value, x + 8, kpiY + 22, { width: boxWidth - 16 });
        doc.restore();
      });

      doc.y = kpiY + 54;

      // Section 1: Case Details
      const sectionHeading = (title) => {
        if (doc.y > doc.page.height - 110) {
          doc.addPage();
          pageCount++;
          renderHeader(pageCount);
          doc.y = 55;
        }
        doc.fillColor(CYAN).fontSize(11).font('Helvetica-Bold').text(title);
        doc.moveDown(0.4);
      };

      sectionHeading('01 / Case and Complaint Information');

      const caseDetails = [
        ['Case Reference', c.id || 'N/A', 'Complaint ID', c.complaintId || 'Not Recorded'],
        ['Fraud Category', c.fraudType || 'N/A', 'Reported Wallet', c.reportedWallet || 'N/A'],
        ['Primary Chain', `${c.chain || 'Ethereum'} (${c.currency || 'INR'})`, 'Risk Rating', `${c.riskScore || 0} / 100 (${c.priority || 'Normal'})`],
        ['Case Summary', c.description || 'No description provided.', '', '']
      ];

      caseDetails.forEach((row) => {
        if (row[2]) {
          doc.fillColor(GRAY).fontSize(7.5).font('Helvetica-Bold').text(row[0] + ':', 45, doc.y, { width: 95 });
          doc.fillColor(DARK).fontSize(8).font('Helvetica').text(row[1], 145, doc.y, { width: 140 });
          doc.fillColor(GRAY).fontSize(7.5).font('Helvetica-Bold').text(row[2] + ':', 295, doc.y, { width: 95 });
          doc.fillColor(DARK).fontSize(8).font('Helvetica').text(row[3], 395, doc.y, { width: 155 });
          doc.moveDown(0.6);
        } else {
          doc.fillColor(GRAY).fontSize(7.5).font('Helvetica-Bold').text(row[0] + ':', 45, doc.y, { width: 95 });
          doc.fillColor(DARK).fontSize(8).font('Helvetica').text(row[1], 145, doc.y, { width: 405 });
          doc.moveDown(0.7);
        }
      });

      doc.moveDown(0.5);

      // Section 2: Scope & Legal Disclaimers
      sectionHeading('02 / Scope, Source and Evidentiary Limitations');
      doc.fillColor(DARK).fontSize(8).font('Helvetica')
        .text('This report is compiled by the CRYPTO-TRACE INDIA investigative analytical suite. Monetary values and transaction records are calculated from deterministic transaction graphs and verified cluster heuristics. Attribution scores represent analytical confidence and are prepared to guide official inquiry, subpoena requests, or statutory Section 91 CrPC / BNSS notifications. The system does not directly confiscate assets or freeze on-chain contracts without judicial process.')
        .moveDown(0.8);

      // Section 3: Actionable Exit & Recommendations
      sectionHeading('03 / Actionable Exit & VASP Attribution');
      if (attributions.length > 0) {
        const top = attributions[0];
        doc.save();
        doc.roundedRect(40, doc.y, doc.page.width - 80, 52, 4).fillAndStroke('#eff6ff', '#bfdbfe');
        doc.fillColor('#1e40af').fontSize(8.5).font('Helvetica-Bold')
          .text(`Identified Lead Entity: ${top.candidate}  |  Attribution Confidence: ${top.confidence}%  |  Exit Volume: ${formatMoney(top.tracedAmount)}`, 50, doc.y + 10);
        doc.fillColor('#1e3a8a').fontSize(7.5).font('Helvetica')
          .text(`Analysis reveals ${top.transactionCount} terminal settlement transactions across [${(top.chains || []).join(', ')}] over ${top.hops || 2} intermediary hops. First observed activity: ${top.firstInteraction || 'N/A'}, last settlement: ${top.lastInteraction || 'N/A'}.`, 50, doc.y + 24, { width: doc.page.width - 100 });
        doc.restore();
        doc.y += 60;
      } else {
        doc.fillColor(GRAY).fontSize(8).font('Helvetica-Oblique').text('No primary VASP candidate reached analytical threshold. Ongoing transaction monitoring recommended.').moveDown(0.6);
      }

      if (recommendations.length > 0) {
        doc.fillColor(NAVY).fontSize(8).font('Helvetica-Bold').text('Investigative Next Steps:');
        doc.moveDown(0.3);
        recommendations.forEach((rec, idx) => {
          doc.fillColor(DARK).fontSize(7.8).font('Helvetica').text(`${idx + 1}.  ${rec}`, { indent: 10 }).moveDown(0.2);
        });
        doc.moveDown(0.6);
      }

      // Section 4: Transaction Summary Table
      sectionHeading('04 / Transaction Graph & Fund Movement Breakdown');
      doc.fillColor(DARK).fontSize(7.8).font('Helvetica').text(`Traced graph contains ${edges.length} transfer records across ${nodes.length} clustered addresses. Highlighted fund flow paths:`).moveDown(0.5);

      // Table Header
      const colWidths = [110, 110, 65, 85, 140];
      const renderTableHeader = () => {
        doc.save();
        doc.rect(40, doc.y, doc.page.width - 80, 16).fill(NAVY);
        doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
        doc.text('SOURCE (ORIGIN)', 45, doc.y + 4, { width: colWidths[0] });
        doc.text('TARGET (DESTINATION)', 160, doc.y + 4, { width: colWidths[1] });
        doc.text('CHAIN', 275, doc.y + 4, { width: colWidths[2] });
        doc.text('AMOUNT (INR)', 345, doc.y + 4, { width: colWidths[3] });
        doc.text('TX HASH / EVIDENCE', 435, doc.y + 4, { width: colWidths[4] });
        doc.restore();
        doc.y += 18;
      };

      renderTableHeader();

      const sampleEdges = edges.slice(0, 12);
      sampleEdges.forEach((edge, idx) => {
        if (doc.y > doc.page.height - 60) {
          doc.addPage();
          pageCount++;
          renderHeader(pageCount);
          doc.y = 55;
          renderTableHeader();
        }

        const bg = idx % 2 === 0 ? LIGHT_BG : '#ffffff';
        doc.save();
        doc.rect(40, doc.y, doc.page.width - 80, 14).fill(bg);
        doc.fillColor(DARK).fontSize(6.8).font('Helvetica');
        const trunc = (str, len = 16) => (!str ? '-' : str.length > len ? str.slice(0, len - 3) + '…' : str);
        doc.text(trunc(edge.source, 20), 45, doc.y + 3, { width: colWidths[0] });
        doc.text(trunc(edge.target, 20), 160, doc.y + 3, { width: colWidths[1] });
        doc.text(edge.chain || 'Ethereum', 275, doc.y + 3, { width: colWidths[2] });
        doc.text(formatMoney(edge.amount), 345, doc.y + 3, { width: colWidths[3] });
        doc.text(trunc(edge.hash || edge.id, 24), 435, doc.y + 3, { width: colWidths[4] });
        doc.restore();
        doc.y += 14;
      });

      doc.moveDown(0.8);

      // Section 5: Risk Indicators & Behavioral Fingerprint
      if (riskIndicators.length > 0) {
        sectionHeading('05 / Behavioral Fingerprint & Indicators');
        riskIndicators.slice(0, 5).forEach(risk => {
          doc.fillColor(risk.severity === 'high' ? '#b91c1c' : CYAN).fontSize(7.5).font('Helvetica-Bold')
            .text(`•  [${(risk.severity || 'INFO').toUpperCase()}] ${risk.title}: `, { continued: true });
          doc.fillColor(DARK).fontSize(7.5).font('Helvetica').text(risk.description).moveDown(0.3);
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
