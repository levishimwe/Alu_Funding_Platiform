// Shared OCR-assisted verification for degree certificates (FR02) and RDB
// certificates (FR05). One engine, two rule sets: extract text, run the
// document's pattern checks, extract the holder's name and compare it with the
// profile name using fuzzy matching. The result is a preliminary
// "Likely Valid" / "Suspicious" flag for an administrator — never a decision.
const { extractText } = require('./textExtraction');
const { nameSimilarity, findNameInText, normalize } = require('./fuzzy');

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10,
  november: 10, dec: 11, december: 11,
};
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_PATTERNS = [
  // 12 June 2024 / 12th of June, 2024
  { re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\.?,?\\s+(\\d{4})\\b`, 'gi'), parse: (m) => [m[3], MONTHS[m[2].toLowerCase()], m[1]] },
  // June 12, 2024
  { re: new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi'), parse: (m) => [m[3], MONTHS[m[1].toLowerCase()], m[2]] },
  // 2024-06-12
  { re: /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g, parse: (m) => [m[1], Number(m[2]) - 1, m[3]] },
  // 12/06/2024 (day first, as used in Rwanda)
  { re: /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g, parse: (m) => [m[3], Number(m[2]) - 1, m[1]] },
  // June 2024
  { re: new RegExp(`\\b${MONTH_RE}\\.?,?\\s+(\\d{4})\\b`, 'gi'), parse: (m) => [m[2], MONTHS[m[1].toLowerCase()], 1] },
];

function findDates(text) {
  const found = [];
  for (const { re, parse } of DATE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const [y, mo, d] = parse(m).map(Number);
      const date = new Date(Date.UTC(y, mo, d));
      if (Number.isNaN(date.getTime()) || mo < 0 || mo > 11 || d < 1 || d > 31) continue;
      // Skip a shorter match already covered by an earlier, more specific pattern.
      if (found.some((f) => m.index >= f.index && m.index < f.index + f.raw.length)) continue;
      found.push({ raw: m[0], date, index: m.index });
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

const lines = (text) =>
  text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const cleanName = (s) =>
  s
    .replace(/[^\p{L}' .-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Looks for a name introduced by one of `labels`, either on the same line
 * after the label or on the next non-empty line.
 */
function extractLabelledValues(text, labels) {
  const all = lines(text);
  const values = [];
  all.forEach((line, i) => {
    for (const label of labels) {
      const m = line.match(label);
      if (!m) continue;
      const rest = line.slice(m.index + m[0].length).replace(/^[\s:–—-]+/, '').trim();
      const candidate = rest.length >= 3 ? rest : all[i + 1] || '';
      if (candidate) values.push(candidate);
    }
  });
  return values;
}

function compareName(text, candidates, expectedName, threshold) {
  let best = { extractedName: null, score: 0, source: null };
  for (const raw of candidates) {
    // A labelled line may contain several names ("Directors: A, B").
    for (const part of raw.split(/,|;|\band\b|&/i)) {
      const candidate = cleanName(part);
      if (candidate.split(' ').length < 1 || candidate.length < 3) continue;
      const score = nameSimilarity(candidate, expectedName);
      if (score > best.score) best = { extractedName: candidate, score, source: 'label' };
    }
  }
  if (best.score < threshold) {
    // No labelled match: search the whole text for the best-matching window.
    // Keep the labelled name for the reviewer unless the search finds a real match.
    const window = findNameInText(text, expectedName);
    if (window.score >= threshold || (!best.extractedName && window.score > best.score)) {
      best = { extractedName: window.match, score: window.score, source: 'text-search' };
    }
  }
  return { ...best, score: Math.round(best.score * 100) / 100, passed: best.score >= threshold };
}

const hasPhrase = (text, phrase, re) => re.test(text) || normalize(text).includes(normalize(phrase));

const RULES = {
  degree_certificate(text, { expectedName, nameThreshold }) {
    const checks = [];
    checks.push({
      id: 'institution',
      label: 'Mentions “African Leadership University”',
      passed: hasPhrase(text, 'African Leadership University', /african\s+leadership\s+univers/i),
    });

    const program = text.match(
      /\b(bachelor(?:'s)?|master(?:'s)?|b\.?\s?sc|m\.?\s?sc|b\.?\s?a|mba|diploma|degree)\b[^\n]{0,15}?\b(?:of|in)\b\s+([a-z][a-z &,-]{3,60})/i
    );
    checks.push({
      id: 'program',
      label: 'States a degree programme',
      passed: Boolean(program),
      detail: program ? program[0].replace(/\s+/g, ' ').trim() : 'No programme or degree name found.',
    });

    const now = new Date();
    const graduationDates = findDates(text).filter((d) => d.date.getUTCFullYear() >= 2008 && d.date <= now);
    checks.push({
      id: 'graduation_date',
      label: 'Shows a graduation or award date',
      passed: graduationDates.length > 0,
      detail: graduationDates.length ? graduationDates[graduationDates.length - 1].raw : 'No plausible past date found.',
    });

    const candidates = extractLabelledValues(text, [
      /certif(?:y|ies)\s+that/i,
      /conferred\s+(?:up)?on/i,
      /awarded\s+to/i,
      /presented\s+to/i,
      /\bname\s*(?:of\s+graduate)?\s*:/i,
    ]);
    const name = compareName(text, candidates, expectedName, nameThreshold);
    checks.push({
      id: 'name_match',
      label: 'Holder name matches the registered name',
      passed: name.passed,
      detail: name.extractedName
        ? `Found “${name.extractedName}” — ${Math.round(name.score * 100)}% similar to “${expectedName}”.`
        : 'No name could be extracted.',
    });

    return {
      checks,
      extractedName: name.extractedName,
      nameScore: name.score,
      fields: { program: program ? program[0].trim() : null, graduationDate: graduationDates.at(-1)?.raw || null },
    };
  },

  rdb_certificate(text, { expectedName, nameThreshold, companyNumber }) {
    const checks = [];
    checks.push({
      id: 'republic',
      label: 'Mentions “Republic of Rwanda”',
      passed: hasPhrase(text, 'Republic of Rwanda', /republic\s+of\s+rwanda/i),
    });
    checks.push({
      id: 'rdb',
      label: 'Mentions “Rwanda Development Board”',
      passed: hasPhrase(text, 'Rwanda Development Board', /rwanda\s+development\s+board/i),
    });

    const labelled = text.match(
      /(?:company\s+code|company\s+(?:registration\s+)?(?:no|number)|registration\s+(?:no|number|code)|reg\.?\s*no|tin)\.?\s*[:#.\-]?\s*([A-Z0-9][A-Z0-9/-]{5,19})/i
    );
    const registrationNumber = labelled ? labelled[1] : (text.match(/\b\d{9}\b/) || [])[0] || null;
    checks.push({
      id: 'registration_number',
      label: 'Contains a registration number',
      passed: Boolean(registrationNumber),
      detail: registrationNumber || 'No registration number found.',
    });
    if (companyNumber) {
      const matches = registrationNumber && normalize(registrationNumber) === normalize(companyNumber);
      checks.push({
        id: 'registration_number_match',
        label: 'Registration number matches the submitted company number',
        passed: Boolean(matches),
        detail: matches ? registrationNumber : `Submitted ${companyNumber}; certificate shows ${registrationNumber || 'none'}.`,
      });
    }

    // Expiry: a date introduced by an expiry/validity label must be in the future.
    const expiryMatch = text.match(/(?:expir\w*|valid\s+(?:until|till|to|through|thru))(?:\s+date)?\s*(?:on)?\s*[:\-]?\s*([^\n]{6,40})/i);
    const expiry = expiryMatch ? findDates(expiryMatch[1])[0] : null;
    const unexpired = Boolean(expiry && expiry.date > new Date());
    checks.push({
      id: 'unexpired',
      label: 'Has an unexpired validity date',
      passed: unexpired,
      detail: expiry
        ? `${unexpired ? 'Valid until' : 'Expired on'} ${expiry.raw}`
        : 'No expiry or “valid until” date found.',
    });

    const companyName = extractLabelledValues(text, [/(?:company|business|enterprise)\s+name\s*:/i])[0] || null;
    const candidates = extractLabelledValues(text, [
      /(?:managing\s+)?directors?\s*(?:name)?\s*:/i,
      /\bowner\s*:/i,
      /\bproprietor\s*:/i,
      /\bshareholders?\s*:/i,
      /(?:legal\s+)?representative\s*:/i,
    ]);
    if (companyName) candidates.push(companyName);
    const name = compareName(text, candidates, expectedName, nameThreshold);
    checks.push({
      id: 'name_match',
      label: 'Company or director name matches the graduate’s name',
      passed: name.passed,
      detail: name.extractedName
        ? `Found “${name.extractedName}” — ${Math.round(name.score * 100)}% similar to “${expectedName}”.`
        : 'No company or director name could be extracted.',
    });

    return {
      checks,
      extractedName: name.extractedName,
      nameScore: name.score,
      fields: { registrationNumber, companyName: companyName ? cleanName(companyName) : null, expiry: expiry?.raw || null },
    };
  },
};

/**
 * @param {'degree_certificate'|'rdb_certificate'} kind
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {{expectedName: string, nameThreshold?: number, companyNumber?: string}} options
 */
async function verifyDocument(kind, buffer, mimeType, options) {
  const rules = RULES[kind];
  if (!rules) throw new Error(`No verification rules for document kind "${kind}"`);
  const nameThreshold = options.nameThreshold ?? 0.8;

  const extraction = await extractText(buffer, mimeType);
  const text = extraction.text || '';
  const textFound = text.replace(/\s/g, '').length >= 20;

  const result = textFound
    ? rules(text, { ...options, nameThreshold })
    : {
        checks: [{ id: 'text', label: 'Readable text extracted', passed: false, detail: 'The document could not be read. It may be blurred, rotated or low resolution.' }],
        extractedName: null,
        nameScore: 0,
        fields: {},
      };

  const flag = result.checks.every((c) => c.passed) ? 'likely_valid' : 'suspicious';
  return {
    kind,
    method: extraction.method,
    pages: extraction.pages,
    ocrConfidence: extraction.confidence != null ? Math.round(extraction.confidence) : null,
    expectedName: options.expectedName,
    ...result,
    flag,
    textExcerpt: text.slice(0, 1500),
    processedAt: new Date().toISOString(),
  };
}

module.exports = { verifyDocument, findDates, RULES };
