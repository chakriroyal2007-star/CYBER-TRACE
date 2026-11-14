/**
 * Indian Multilingual Scam Message Detection & Categorization Engine
 * Evaluates messages in English, Hindi, Telugu, Tamil, Kannada, Malayalam, and Hinglish.
 * Computes calibrated Scam Probability, Language Detection, 20 Fraud Categories,
 * Suspicious Indicators, and Explainable Evidence Tokens.
 */

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
    'fedex', 'dhl', 'blue dart', 'customs clearance', 'illegal passport', 'mdma found in parcel',
    'mumbai customs', 'delhi airport customs', 'parcel detained'
  ],
  loan: [
    'instant loan', 'pre-approved loan', 'no cibil required', 'low interest loan', 'zero collateral',
    'loan approved 5 lakh', 'click link to disburse'
  ]
};

// Language detection heuristic rules based on script and romanized keywords
export function detectLanguage(text = '') {
  const str = String(text).toLowerCase();
  
  // Script ranges
  if (/[\u0900-\u097F]/.test(str)) return { code: 'hi', name: 'Hindi (Devanagari)', script: 'Devanagari' };
  if (/[\u0C00-\u0C7F]/.test(str)) return { code: 'te', name: 'Telugu', script: 'Telugu' };
  if (/[\u0B80-\u0BFF]/.test(str)) return { code: 'ta', name: 'Tamil', script: 'Tamil' };
  if (/[\u0C80-\u0CFF]/.test(str)) return { code: 'kn', name: 'Kannada', script: 'Kannada' };
  if (/[\u0D00-\u0D7F]/.test(str)) return { code: 'ml', name: 'Malayalam', script: 'Malayalam' };

  // Romanized Hinglish checks
  const hinglishTokens = ['aapka', 'kare', 'hoga', 'band', 'paisa', 'bhejo', 'khata', 'turant', 'sabhyata', 'bijli', 'crore', 'lakh'];
  const matches = hinglishTokens.filter(t => str.includes(t));
  if (matches.length >= 2) {
    return { code: 'hinglish', name: 'Hinglish (Romanized Hindi)', script: 'Latin' };
  }

  return { code: 'en', name: 'English', script: 'Latin' };
}

/**
 * Evaluates scam likelihood and categorizes the message
 */
export function classifyScamMessage(text = '') {
  const clean = String(text || '').trim();
  const lower = clean.toLowerCase();
  const lang = detectLanguage(clean);

  if (!clean || clean.length < 5) {
    return {
      scamProbability: 0.1,
      legitimateProbability: 0.9,
      isScam: false,
      predictedCategory: 'Unknown or Other',
      confidence: 0.5,
      language: lang,
      extractedIndicators: [],
      explainableFeatures: ['Insufficient text length for reliable inference.'],
      modelVersion: 'v2.4-multilingual-indic',
      timestamp: new Date().toISOString()
    };
  }

  let scamScore = 0;
  const indicators = [];
  const explanations = [];
  let categoryScores = {
    'Fake KYC Verification': 0,
    'Digital Arrest Scam': 0,
    'Fake Banking Message': 0,
    'OTP Theft & Impersonation': 0,
    'Fake Job Offer (Part-Time/Telegram)': 0,
    'Courier & Parcel Customs Scam': 0,
    'Instant Loan & Harassment App': 0,
    'UPI Payment Fraud': 0,
    'Phishing Website': 0
  };

  // 1. Digital Arrest Pattern Check
  const arrestMatches = SCAM_PATTERNS.digital_arrest.filter(w => lower.includes(w));
  if (arrestMatches.length > 0) {
    scamScore += 45;
    categoryScores['Digital Arrest Scam'] += arrestMatches.length * 30;
    indicators.push(...arrestMatches.map(m => `Authority Impersonation: '${m}'`));
    explanations.push(`Impersonates Indian enforcement agencies/telecom departments (${arrestMatches.join(', ')}).`);
  }

  // 2. KYC Expiry & Threat Pattern
  const kycMatches = SCAM_PATTERNS.kyc.filter(w => lower.includes(w));
  if (kycMatches.length > 0) {
    scamScore += 35;
    categoryScores['Fake KYC Verification'] += kycMatches.length * 25;
    indicators.push(...kycMatches.map(m => `KYC Coercion: '${m}'`));
    explanations.push(`Demands urgent KYC or PAN/Aadhaar document linking to prevent immediate account suspension.`);
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
    scamScore += 40;
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

  // 6. Urgency Boost
  const urgencyMatches = SCAM_PATTERNS.urgency.filter(w => lower.includes(w));
  if (urgencyMatches.length > 0) {
    scamScore += 20;
    indicators.push(...urgencyMatches.map(m => `Psychological Pressure: '${m}'`));
    explanations.push(`Employs artificial time pressure (${urgencyMatches.join(', ')}) to induce panic.`);
  }

  // 7. Presence of Links or Contact Numbers
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
