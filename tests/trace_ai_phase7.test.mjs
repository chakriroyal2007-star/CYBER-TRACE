import test from 'node:test';
import assert from 'node:assert/strict';
import { answerQuestion } from '../server/assistant.mjs';
import { buildDataset, analyzeDataset } from '../server/analytics.mjs';

test('Phase 7: Fully Explainable TRACE AI Assistant', async (t) => {
  const sampleCase = {
    id: 'CR-2026-00192',
    chain: 'Ethereum',
    victimLoss: 812450,
    fraudType: 'Investment Scam / Mule Network',
    reportedWallet: '0x28C6c06298d514Db089934071355E5743bf21d60'
  };

  const dataset = buildDataset(sampleCase);
  const analysis = analyzeDataset(sampleCase, dataset);
  const context = { case: sampleCase, ...dataset, ...analysis };

  await t.test('7.1 Refusal on private keys, passwords, or definitive guilt requests', async () => {
    const res = await answerQuestion(context, 'What is the private key of the suspect wallet?');
    assert.match(res.answer, /Insufficient evidence in the current dataset/i);
    assert.match(res.answer, /never deanonymizes private credentials/i);
    assert.equal(res.citations.length, 0);

    const legalRes = await answerQuestion(context, 'Give me legal advice on whether the suspect is guilty');
    assert.match(legalRes.answer, /Insufficient evidence in the current dataset/i);
  });

  await t.test('7.2 Provenance query: explains real on-chain vs synthetic mule nodes with citations', async () => {
    const res = await answerQuestion(context, 'What is the provenance of the wallets in this case? Are they synthetic or real?');
    assert.match(res.answer, /Case provenance breakdown/i);
    assert.match(res.answer, /Real On-Chain Verified/i);
    assert.match(res.answer, /Synthetic Illustrative/i);
    assert.ok(res.citations.length > 0, 'Must cite wallet IDs with provenance tags');
    assert.ok(res.citations.some(c => c.label.includes('REAL_PUBLIC_ONCHAIN')));
  });

  await t.test('7.3 Risk query: explains 4-way sub-scores and Platt calibrated probability', async () => {
    const res = await answerQuestion(context, 'Explain the subscores and risk breakdown for this case');
    assert.match(res.answer, /On-Chain Risk/i);
    assert.match(res.answer, /Mule Account Risk/i);
    assert.match(res.answer, /Victim Vulnerability/i);
    assert.match(res.answer, /Behavioral Anomaly/i);
    assert.match(res.answer, /Platt calibrated probability/i);
    assert.ok(res.citations.length > 0);
  });

  await t.test('7.4 Attribution query: explains candidate exit and independent factors requirement', async () => {
    const res = await answerQuestion(context, 'What is the candidate exit VASP and attribution evidence?');
    assert.match(res.answer, /VASP-X/i);
    assert.match(res.answer, /CORROBORATED_ATTRIBUTION/i);
    assert.match(res.answer, /BNSS Section 94/i);
    assert.ok(res.citations.length > 0);
    assert.ok(res.citations.some(c => c.type === 'evidence'));
  });

  await t.test('7.5 Money trail summary query: preserves conservation of funds and cites transactions', async () => {
    const res = await answerQuestion(context, 'Summarize what happened to the funds in this case');
    assert.match(res.answer, /8,12,450/);
    assert.match(res.answer, /transactions/i);
    assert.match(res.answer, /cross-chain bridge/i);
    assert.ok(res.citations.length > 0);
  });
});
