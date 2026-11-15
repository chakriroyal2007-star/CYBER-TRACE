/**
 * Indian Multilingual Scam Message Detection & Categorization Engine
 * Powered by OpenRouter LLaMA-3.3-70B Frontier LLM + Indic Linguistic Classifier
 * Evaluates messages in English, Hindi, Telugu, Tamil, Kannada, Malayalam, and Hinglish.
 * Computes calibrated Scam Probability, Language Detection, 20 Fraud Categories,
 * Suspicious Indicators, and Explainable Evidence Tokens.
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODELS = ['meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-chat', 'openrouter/auto'];

// 20 Standard Indian Cyber Fraud Categories
export const FRAUD_CATEGORIES = [
  'UPI Payment Fraud',
  'Fake UPI Collect Request',
  'QR-Code Payment Scam',
  'Fake KYC Verification',
  'OTP Theft & Impersonation',
  'Phishing Website',
  'Malicious URL',
  'Fake Banking Message',
  'Fake Customer Care Number',
  'Investment & Staking Scam',
  'Fake Job Offer (Part-Time/Telegram)',
  'Digital Arrest Scam',
  'Courier & Parcel Customs Scam',
  'Instant Loan & Harassment App',
  'Identity Impersonation',
  'Social Engineering',
  'WhatsApp & Telegram Task Scam',
  'Suspicious Payment Request',
  'Fake Government Scheme / Subsidy',
  'Emerging Digital Fraud'
];

// Multilingual token dictionaries & linguistic patterns
const SCAM_PATTERNS = {
  urgency: [
    'immediate', 'urgent', 'blocked within', '24 hours', 'action required', 'suspended', 'deactivated',
    'turant', 'aaj hi', 'band ho jayega', 'rok diya', 'jaldi', 'khatam',
    'ventane', 'apeyabadunu', 'samayam ledu', 'ippude',
    'udane', 'mudikkappadum', 'neram illai',
    'koodale', 'thadeyalaagide',
    'udane', 'stambhikkum'
  ],
  kyc: [
    'kyc', 'pan card', 'aadhaar', 'update your kyc', 'kyc expired', 'kyc pending',
    'kyc update kare', 'pan link kare', 'document verify',
    'kyc renewal', 'kyc vivaralu', 'kyc seithu'
  ],
  digital_arrest: [
    'cbi', 'police', 'customs', 'narcotics', 'ncb', 'digital arrest', 'money laundering',
    'arrest warrant', 'supreme court', 'fedex package illegal', 'trai', 'telecom department',
    'video call investigation', 'surrender', 'dharapakad'
  ],
  banking_otp: [
    'otp', 'one time password', 'pin', 'cvv', 'share otp', 'bank account credited', 'refund',
    'cashback', 'electricity bill unpaid', 'power cut tonight', 'bijli bill', 'lottery winner',
    'kaun banega crorepati', 'kbc', 'reward points expired'
  ],
  part_time_job: [
    'part time job', 'daily income', 'earn 2000 to 5000', 'telegram task', 'youtube like subscribe',
    'google review task', 'work from home', 'ghar baithe kamaye', 'daily payout', 'easy money',
    'recharge task', 'crypto investment profit'
  ],
  courier_parcel: [
    'customs duty', 'parcel held', 'illegal goods', 'contraband', 'mumbai airport customs',
    'delhi customs', 'clearing charge', 'courier detained'
  ],
  investment_ponzi: [
    'send me', 'sedn you', 'send you', 'double your money', 'i will send', 'i will give',
    'guaranteed return', 'daily return', 'crypto double', 'forex trading', 'instant profit',
    'paisa double', '1 lakh', '5 lakh', 'lakh rupees', 'invest and earn', '500% profit',
    'risk free', 'deposit and get', 'advance fee', 'returns guaranteed'
  ]
};

// Script detection patterns
const SCRIPTS = {
  devanagari: /[\u0900-\u097F]/,
  telugu: /[\u0C00-\u0C7F]/,
  tamil: /[\u0B80-\u0BFF]/,
  kannada: /[\u0C80-\u0CFF]/,
  malayalam: /[\u0D00-\u0D7F]/
};

/**
 * Detect language script and dialect
 */
export function detectLanguage(text = '') {
  if (SCRIPTS.devanagari.test(text)) return { code: 'hi', name: 'Hindi', script: 'Devanagari' };
  if (SCRIPTS.telugu.test(text)) return { code: 'te', name: 'Telugu', script: 'Telugu' };
  if (SCRIPTS.tamil.test(text)) return { code: 'ta', name: 'Tamil', script: 'Tamil' };
  if (SCRIPTS.kannada.test(text)) return { code: 'kn', name: 'Kannada', script: 'Kannada' };
  if (SCRIPTS.malayalam.test(text)) return { code: 'ml', name: 'Malayalam', script: 'Malayalam' };

  // Hinglish detection (Latin script with Hindi romanized tokens)
  const hinglishTokens = ['aapka', 'karein', 'turant', 'khata', 'paisa', 'bhejo', 'jaldi', 'milega', 'bhejiye', 'paise', 'karo', 'gaya'];
  const lower = text.toLowerCase();
  const hasHinglish = hinglishTokens.some(t => lower.includes(t));
  if (hasHinglish) return { code: 'hinglish', name: 'Hinglish (Hindi in Latin script)', script: 'Latin' };

  return { code: 'en', name: 'English', script: 'Latin' };
}

/**
 * Heuristic/Linguistic Feature Extraction & Baseline Classifier
 */
export function classifyScamMessage(rawText = '') {
  const text = String(rawText || '').trim();
  if (!text) {
    return {
      scamProbability: 0.05,
      legitimateProbability: 0.95,
      isScam: false,
      predictedCategory: 'Likely Legitimate Communication',
      confidence: 0.95,
      language: { code: 'en', name: 'English', script: 'Latin' },
      extractedIndicators: [],
      explainableFeatures: ['Empty input received.'],
      modelVersion: 'v2.4-multilingual-indic',
      timestamp: new Date().toISOString()
    };
  }

  const lang = detectLanguage(text);
  const clean = text.replace(/[\r\n\t]+/g, ' ');
  const lower = clean.toLowerCase();

  let scamScore = 15; // Baseline prior probability
  const indicators = [];
  const explanations = [];

  const categoryScores = {};
  for (const cat of FRAUD_CATEGORIES) {
    categoryScores[cat] = 0;
  }

  // 1. Digital Arrest & Police Impersonation
  const daMatches = SCAM_PATTERNS.digital_arrest.filter(w => lower.includes(w));
  if (daMatches.length > 0) {
    scamScore += 50;
    categoryScores['Digital Arrest Scam'] += daMatches.length * 35;
    categoryScores['Identity Impersonation'] += daMatches.length * 20;
    indicators.push(...daMatches.map(m => `Law Enforcement Threat: '${m}'`));
    explanations.push(`Contains coercive law enforcement/court coercion tokens (${daMatches.join(', ')}).`);
  }

  // 2. Fake KYC & Document Theft
  const kycMatches = SCAM_PATTERNS.kyc.filter(w => lower.includes(w));
  if (kycMatches.length > 0) {
    scamScore += 45;
    categoryScores['Fake KYC Verification'] += kycMatches.length * 30;
    indicators.push(...kycMatches.map(m => `Document Verification Coercion: '${m}'`));
    explanations.push(`Demands urgent identity document update under threat of service suspension.`);
  }

  // 3. Banking & OTP Theft
  const otpMatches = SCAM_PATTERNS.banking_otp.filter(w => lower.includes(w));
  if (otpMatches.length > 0) {
    scamScore += 40;
    categoryScores['OTP Theft & Impersonation'] += otpMatches.length * 25;
    categoryScores['Fake Banking Message'] += otpMatches.length * 20;
    indicators.push(...otpMatches.map(m => `Credential Lure: '${m}'`));
    explanations.push(`Lures victim with lottery/refund or requests sensitive authorization tokens (OTP/PIN/CVV).`);
  }

  // 4. Job & Task Scams
  const jobMatches = SCAM_PATTERNS.part_time_job.filter(w => lower.includes(w));
  if (jobMatches.length > 0) {
    scamScore += 45;
    categoryScores['Fake Job Offer (Part-Time/Telegram)'] += jobMatches.length * 30;
    indicators.push(...jobMatches.map(m => `Unrealistic Return: '${m}'`));
    explanations.push(`Promises high daily work-from-home earnings via Telegram tasks or rating manipulation.`);
  }

  // 5. Courier & Customs
  const courierMatches = SCAM_PATTERNS.courier_parcel.filter(w => lower.includes(w));
  if (courierMatches.length > 0) {
    scamScore += 45;
    categoryScores['Courier & Parcel Customs Scam'] += courierMatches.length * 35;
    indicators.push(...courierMatches.map(m => `Detained Parcel Trap: '${m}'`));
    explanations.push(`Falsely claims illegal narcotics or passports found in a parcel under victim's name.`);
  }

  // 6. Investment Ponzi / Multiplier Scam
  const ponziMatches = SCAM_PATTERNS.investment_ponzi.filter(w => lower.includes(w));
  const hasSendMultiplier = (lower.includes('send') || lower.includes('sedn') || lower.includes('bhejo')) &&
                            (lower.includes('lakh') || lower.includes('rupees') || lower.includes('rs') || lower.includes('return') || lower.includes('give'));
  if (ponziMatches.length > 0 || hasSendMultiplier) {
    scamScore += 65;
    categoryScores['Investment & Staking Scam'] += 50;
    categoryScores['Suspicious Payment Request'] += 35;
    indicators.push(`Unrealistic Return Multiplier: '${ponziMatches.join("', '") || "send money promise"}'`);
    explanations.push(`Explicit high-yield investment / advance-fee promise soliciting upfront payment with promise of multiplied returns.`);
  }

  // 7. Urgency Boost
  const urgencyMatches = SCAM_PATTERNS.urgency.filter(w => lower.includes(w));
  if (urgencyMatches.length > 0) {
    scamScore += 20;
    indicators.push(...urgencyMatches.map(m => `Psychological Pressure: '${m}'`));
    explanations.push(`Employs artificial time pressure (${urgencyMatches.join(', ')}) to induce panic.`);
  }

  // 8. Presence of Links or Contact Numbers
  const urlMatches = clean.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  if (urlMatches.length > 0) {
    scamScore += 15;
    categoryScores['Phishing Website'] += 20;
    indicators.push(`Embedded Hyperlink: ${urlMatches[0]}`);
  }

  const phoneMatches = clean.match(/(?:\+91|91)?[6-9]\d{9}/g) || [];
  if (phoneMatches.length > 0) {
    indicators.push(`Suspect Call-Back Number: ${phoneMatches[0]}`);
  }

  // Calibrated Probability (sigmoid)
  const z = (scamScore - 30) / 18;
  const scamProbability = Number((1 / (1 + Math.exp(-z))).toFixed(4));
  const legitimateProbability = Number((1 - scamProbability).toFixed(4));

  // Determine top category
  let topCategory = 'Emerging Digital Fraud';
  let maxCatScore = 0;
  for (const [cat, score] of Object.entries(categoryScores)) {
    if (score > maxCatScore) {
      maxCatScore = score;
      topCategory = cat;
    }
  }

  if (scamProbability < 0.35) {
    topCategory = 'Likely Legitimate Communication';
    explanations.push('Message does not contain coercive threats, credential requests, or known scam triggers.');
  }

  return {
    scamProbability,
    legitimateProbability,
    isScam: scamProbability >= 0.55,
    predictedCategory: topCategory,
    confidence: Number(Math.max(scamProbability, legitimateProbability).toFixed(2)),
    language: lang,
    extractedIndicators: indicators,
    explainableFeatures: explanations.length ? explanations : ['Standard textual communication.'],
    modelVersion: 'v2.4-multilingual-indic',
    timestamp: new Date().toISOString()
  };
}

/**
 * Deep Multilingual Scam Classification using OpenRouter LLaMA-3.3-70B Frontier AI
 */
export async function classifyScamMessageAsync(rawText = '') {
  const text = String(rawText || '').trim();
  if (!text) return classifyScamMessage(text);

  const fallbackResult = classifyScamMessage(text);

  if (!OPENROUTER_API_KEY) {
    return fallbackResult;
  }

  const prompt = `You are a Principal AI Cyber Forensic Investigator specializing in Indian Cyber Crime & Financial Fraud Detection.
Analyze the following user-submitted message (SMS, WhatsApp, Telegram, Email, or Social Media) for fraud patterns.
The text may be in English, Hindi, Hinglish, Telugu, Tamil, Kannada, or Malayalam.

20 Recognized Indian Fraud Categories:
1. UPI Payment Fraud
2. Fake UPI Collect Request
3. QR-Code Payment Scam
4. Fake KYC Verification
5. OTP Theft & Impersonation
6. Phishing Website
7. Malicious URL
8. Fake Banking Message
9. Fake Customer Care Number
10. Investment & Staking Scam
11. Fake Job Offer (Part-Time/Telegram)
12. Digital Arrest Scam
13. Courier & Parcel Customs Scam
14. Instant Loan & Harassment App
15. Identity Impersonation
16. Social Engineering
17. WhatsApp & Telegram Task Scam
18. Suspicious Payment Request
19. Fake Government Scheme / Subsidy
20. Emerging Digital Fraud

Message to analyze:
"""
${text}
"""

Return ONLY a valid JSON object strictly matching this schema:
{
  "scamProbability": number between 0.0 and 1.0,
  "legitimateProbability": number between 0.0 and 1.0,
  "isScam": boolean,
  "predictedCategory": string (must be one of the 20 categories above or "Likely Legitimate Communication"),
  "confidence": number between 0.0 and 1.0,
  "language": {
    "code": "en" | "hi" | "te" | "ta" | "kn" | "ml" | "hinglish",
    "name": string,
    "script": string
  },
  "extractedIndicators": [string],
  "explainableFeatures": [string],
  "investigatorActions": [string],
  "modelVersion": "OpenRouter LLaMA-3.3-70B AI Engine"
}`;

  for (const model of OPENROUTER_MODELS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crypto-trace-omega.vercel.app',
          'X-Title': 'Cyber Trace India Scam Analyzer'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) continue;

      const parsed = JSON.parse(rawContent.trim());
      if (typeof parsed.scamProbability === 'number') {
        return {
          scamProbability: Number(parsed.scamProbability.toFixed(4)),
          legitimateProbability: Number((1 - parsed.scamProbability).toFixed(4)),
          isScam: parsed.isScam ?? (parsed.scamProbability >= 0.5),
          predictedCategory: parsed.predictedCategory || fallbackResult.predictedCategory,
          confidence: Number((parsed.confidence || parsed.scamProbability).toFixed(2)),
          language: parsed.language || fallbackResult.language,
          extractedIndicators: (parsed.extractedIndicators && parsed.extractedIndicators.length) ? parsed.extractedIndicators : fallbackResult.extractedIndicators,
          explainableFeatures: (parsed.explainableFeatures && parsed.explainableFeatures.length) ? parsed.explainableFeatures : fallbackResult.explainableFeatures,
          investigatorActions: parsed.investigatorActions || [],
          modelVersion: `OpenRouter ${model.split('/')[1] || model}`,
          timestamp: new Date().toISOString()
        };
      }
    } catch {
      // Continue to next model or fallback
    }
  }

  return fallbackResult;
}
