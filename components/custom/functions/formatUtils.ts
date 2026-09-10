export function compareDate(date1: string, date2: string): boolean {
  function parseFlexibleDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const trimmed = dateStr.trim();

    // Try ISO format first (YYYY-MM-DD)
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split(/[-/]/).map(Number);
      return new Date(year, month - 1, day);
    }

    // Handle DD-MM-YYYY or DD/MM/YYYY or MM-DD-YYYY or MM/DD/YYYY
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(trimmed)) {
      const parts = trimmed.split(/[-/]/).map(Number);
      const [first, second, year] = parts;

      // If first part > 12, it must be day (DD-MM-YYYY)
      if (first > 12) {
        return new Date(year, second - 1, first);
      }
      // If second part > 12, it must be day (MM-DD-YYYY)
      if (second > 12) {
        return new Date(year, first - 1, second);
      }
      // Ambiguous case: assume DD-MM-YYYY (more common internationally)
      return new Date(year, second - 1, first);
    }

    // Handle DD-MM-YY or DD/MM/YY
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2}$/.test(trimmed)) {
      const parts = trimmed.split(/[-/]/).map(Number);
      let [first, second, year] = parts;
      // Convert 2-digit year to 4-digit (assume 1950-2049 range)
      year = year >= 50 ? 1900 + year : 2000 + year;

      if (first > 12) {
        return new Date(year, second - 1, first);
      }
      if (second > 12) {
        return new Date(year, first - 1, second);
      }
      return new Date(year, second - 1, first);
    }

    // Fallback to native Date parsing
    const fallback = new Date(trimmed);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  function compareDate(date1: string, date2: string): number {
    const d1 = parseFlexibleDate(date1);
    const d2 = parseFlexibleDate(date2);

    if (!d1 || !d2) {
      return NaN;
    }

    return d1.getTime() - d2.getTime();
  }
  const diff = compareDate(date1, date2);
  return !isNaN(diff) && diff === 0;
}

export function cleanToCompare(value: string | undefined | null) {
  if (!value) {
    return '';
  }
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

export function compareTwoString(
  str1: string | undefined | null,
  str2: string | undefined | null,
): boolean {
  // Handle null/undefined cases
  if (!str1 && !str2) return false;
  if (!str1 || !str2) return false;

  // Normalize: lowercase, remove dots, trim, and collapse multiple spaces to single space
  const normalize = (s: string) =>
    s.toLowerCase().replace(/\./g, '').trim().replace(/\s+/g, ' ');

  const normalized1 = normalize(str1);
  const normalized2 = normalize(str2);

  // Direct match after normalization
  if (normalized1 === normalized2) return true;

  // Split into words and sort for order-independent comparison
  const words1 = normalized1.split(' ').filter(Boolean).sort();
  const words2 = normalized2.split(' ').filter(Boolean).sort();

  // Compare sorted word arrays
  if (words1.length !== words2.length) return false;

  return words1.every((word, index) => word === words2[index]);
}

export function compareTwoNames(
  str1: string | undefined | null,
  str2: string | undefined | null,
): boolean {
  // Handle null/undefined cases
  if (!str1 && !str2) return false;
  if (!str1 || !str2) return false;

  // Honorific titles / prefixes and name suffixes to drop entirely.
  const titles = new Set([
    'mr',
    'mrs',
    'ms',
    'miss',
    'mst',
    'master',
    'dr',
    'prof',
    'shri',
    'sri',
    'sh',
    'smt',
    'kumari',
    'kum',
    'late',
    'baby',
    'col',
    'capt',
    'lt',
    'gen',
    'maj',
    'adv',
    'advocate',
    // trailing name suffixes
    'jr',
    'sr',
    'ii',
    'iii',
    'iv',
  ]);

  // Tokens that represent "no data" and must never count as a real name word.
  const junk = new Set([
    'na',
    'nil',
    'none',
    'null',
    'undefined',
    'nan',
    'xxxx',
  ]);

  // Strip relationship markers (and the relative's name that follows them).
  // Handles "S/o", "D/o", "W/o", abbreviations without a slash ("So", "Do",
  // "Wo", "S o"), "son of", "daughter of", glued forms like "sonof" /
  // "son ofdeendayal", and a bare trailing "son"/"daughter"/etc.
  // e.g. "Pankaj Son Ofdeendayal"            -> "Pankaj"
  //      "Jitendra Pal So Sh Harpal Rai"     -> "Jitendra Pal"
  const relationshipPatterns = [
    /\b[sdw]\s*\/?\s*o\b.*/i, // s/o d/o w/o and bare "so"/"do"/"wo"/"s o" + rest
    /\bc\s*\/\s*o\b.*/i, // c/o (care of) — slash required, avoids matching "co"
    /\b(?:son|daughter|wife|husband|child)\s*of\w*.*/i, // son of / sonof / son ofXxx + rest
    /\b(?:son|daughter|wife|husband)\b.*/i, // bare relationship word + rest
  ];

  // Normalize into comparable word tokens.
  const normalize = (s: string): string[] => {
    let text = s.toLowerCase();

    // Drop alias markers and everything after them, keeping the primary name.
    // e.g. "Raju @ Rajesh", "Raju alias Rajesh", "Raju urf Rajesh".
    text = text.split(/\s*@\s*|\b(?:alias|urf|aka)\b/)[0];

    // Strip relationship markers and the relative's name that follows.
    for (const pattern of relationshipPatterns) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) {
        text = text.slice(0, match.index);
        break;
      }
    }

    return (
      text
        // Punctuation/digits -> space, so "A.K." -> "a k" and "D'Souza" -> "d souza".
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .filter((word) => !titles.has(word) && !junk.has(word))
        // Drop Gujarati/Marathi honorific suffixes: "Dipakbhai" -> "dipak",
        // "Heliben" -> "heli" (only when a real stem of >= 3 chars remains).
        .map((word) => {
          for (const suffix of ['bhai', 'ben']) {
            if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
              return word.slice(0, -suffix.length);
            }
          }
          return word;
        })
    );
  };

  const words1 = normalize(str1);
  const words2 = normalize(str2);

  // Nothing left to compare (e.g. both were "NA" / only titles) => no match.
  if (words1.length === 0 || words2.length === 0) return false;

  // Direct match after normalization.
  if (words1.join(' ') === words2.join(' ')) return true;

  const levenshtein = (a: string, b: string): number => {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let curr = new Array<number>(n + 1);
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  };

  // Two name words match if they are equal or close spelling variants. Allowed
  // edit distance scales with word length, so longer words tolerate more typos
  // while short words must match (near-)exactly:
  //   < 5 chars : 0 edits  -> "amit" != "amir"
  //   5-7 chars : 1 edit   -> "sonia" ~ "soniya"
  //   8+  chars : 2 edits  -> "jitendra" ~ "jitender", "parshottam" ~ "parsotam"
  const wordsMatch = (a: string, b: string): boolean => {
    if (a === b) return true;
    if (Math.min(a.length, b.length) < 5) return false;
    const maxLen = Math.max(a.length, b.length);
    const allowed = maxLen >= 8 ? 2 : 1;
    return levenshtein(a, b) <= allowed;
  };

  // Greedy 1:1 pairing: every word in the shorter list must find a distinct
  // matching word in the longer list (order-independent).
  const [shorter, longer] =
    words1.length <= words2.length ? [words1, words2] : [words2, words1];
  const used = new Array(longer.length).fill(false);
  const allShorterMatched = shorter.every((word) => {
    const idx = longer.findIndex(
      (cand, i) => !used[i] && wordsMatch(word, cand),
    );
    if (idx === -1) return false;
    used[idx] = true;
    return true;
  });

  if (allShorterMatched) {
    // Equal length: a full 1:1 match means the names are equivalent.
    if (shorter.length === longer.length) return true;
    // Different length: only accept as a partial match when the longer name has
    // 3+ words (e.g. "Jitender Pal Rai" vs "Jitender Pal" => true, but
    // "Ashish Tiwari" vs "Ashish" => false).
    if (longer.length >= 3) return true;
  }

  // Final safety net: whole-name fuzzy match on the sorted, joined words,
  // catching variants that per-word pairing splits awkwardly. Match if >= 90%.
  const a = [...words1].sort().join(' ');
  const b = [...words2].sort().join(' ');
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return false;
  return 1 - levenshtein(a, b) / maxLen >= 0.9;
}

export function timeAgo(timestamp: string | undefined | null): string {
  if (!timestamp) {
    return '----';
  }

  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (seconds < 60) return `${seconds} sec ago`;
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  // For dates older than a week, show the actual date
  return past.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function numberToIndianRuppe(amount: number | string): string {
  if (typeof amount === 'string') {
    amount = Number(amount);
  }
  if (amount >= 1_00_00_000) {
    return `${(amount / 1_00_00_000).toFixed(amount % 1_00_00_000 === 0 ? 0 : 1)} crore`;
  } else if (amount >= 1_00_000) {
    return `${(amount / 1_00_000).toFixed(amount % 1_00_000 === 0 ? 0 : 1)} lakh`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)} thousand`;
  } else {
    return amount.toString();
  }
}

export function cleanAndCapitalize(input: string | undefined): string {
  if (!input) {
    return '----';
  }
  const cleaned = input
    .normalize('NFKD')
    .replace(/[\u200B-\u200D\uFEFF\u202C\u202D\u202E]/g, '')
    .trim();
  return cleaned.toUpperCase();
}
export function formatDateTime(input: string | undefined | null): string {
  if (!input) {
    return '----';
  }

  let normalizedString = input.trim();

  // Handle various timestamp formats:
  // 1. "2025-12-26T14:00:32.192914" (no timezone - treat as UTC)
  // 2. "2024-03-31+05:30" (date with timezone offset)
  // 3. "2024-03-31T00:00:00+05:30" (full ISO with timezone)
  // 4. "2024-03-31T00:00:00Z" (UTC)
  // 5. "2024-03-31T00:00:00" (no timezone)

  // Handle date-only format with timezone offset: "2024-03-31+05:30"
  if (/^\d{4}-\d{2}-\d{2}[+-]\d{2}:\d{2}$/.test(normalizedString)) {
    normalizedString = normalizedString.replace(
      /^(\d{4}-\d{2}-\d{2})([+-]\d{2}:\d{2})$/,
      '$1T00:00:00$2',
    );
  }

  // Handle timestamp without timezone (treat as UTC): "2025-12-26T14:00:32.192914"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalizedString)) {
    normalizedString = normalizedString + 'Z';
  }

  const date = new Date(normalizedString);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return input;
  }

  // Always format in Indian Standard Time (IST)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  };

  // Ensure AM/PM is always uppercase
  const formatted = date.toLocaleString('en-IN', options);
  return formatted.replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());
}

export const formatSentence = (
  value: string | undefined | null | number | boolean,
  allToUpperCase = false,
  allToLowerCase = false,
) => {
  if (!value) return '----';
  if (
    typeof value === 'string' &&
    [
      'na',
      'nan',
      'null',
      'undefined',
      'none',
      'n/a',
      '-',
      '--',
      '---',
      '----',
    ].includes(value.trim().toLowerCase())
  ) {
    return '----';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    const word = String(value);
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return value
    ?.toLowerCase()
    ?.split(' ')
    ?.map((word) => {
      if (allToUpperCase) {
        return word.toUpperCase();
      }
      if (allToLowerCase) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    ?.join(' ');
};

export function formatKey(key: string | undefined | null): string {
  if (!key) {
    return '----';
  }
  key = key.replaceAll('_', ' ');
  const withSpaces = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
/**
 * Formats any date-of-birth string into DD-MM-YYYY.
 * Handles ISO, DD-MM-YYYY, MM-DD-YYYY, 2-digit years, slashes/dots/spaces,
 * month names, ISO timestamps and epoch values. Returns "" if no valid DOB.
 */
export function formatDateOfBirth(
  input: string | number | undefined | null,
): string {
  if (input === undefined || input === null) return '';

  const MONTHS: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  // Sanity check: a DOB should be a real calendar date within a sane range.
  const isValidDob = (d: number, m: number, y: number): boolean => {
    if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
      return false;
    }
    if (y < 1900 || y > 2100) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    // Verify the day actually exists in that month/year.
    const dt = new Date(y, m - 1, d);
    return (
      dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
    );
  };

  const build = (d: number, m: number, y: number): string =>
    isValidDob(d, m, y) ? `${pad(d)}-${pad(m)}-${pad(y)}` : '';

  // Expand a 2-digit year, assuming birth dates fall in 1925-2024.
  const expandYear = (y: number): number => {
    if (y >= 100) return y;
    const currentYY = new Date().getFullYear() % 100;
    return y > currentYY ? 1900 + y : 2000 + y;
  };

  // Numeric epoch (seconds or milliseconds).
  if (typeof input === 'number' || /^\d{10,13}$/.test(String(input).trim())) {
    const num = Number(input);
    if (!isNaN(num)) {
      const ms = String(Math.trunc(num)).length <= 10 ? num * 1000 : num;
      const dt = new Date(ms);
      if (!isNaN(dt.getTime())) {
        return build(dt.getDate(), dt.getMonth() + 1, dt.getFullYear());
      }
    }
    return '';
  }

  let str = String(input).trim();
  if (!str) return '';

  // Reject obvious null-ish placeholders.
  if (
    [
      'na',
      'nan',
      'null',
      'undefined',
      'none',
      'n/a',
      '-',
      '--',
      '---',
      '----',
    ].includes(str.toLowerCase())
  ) {
    return '';
  }

  // Strip a time portion if present: "1990-05-12T00:00:00", "1990-05-12 10:30:00".
  str = str.replace(/[T\s]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?.*$/, '').trim();
  // Strip a timezone offset on a bare date: "1990-05-12+05:30". The colon is
  // required so we don't eat the "-YYYY" year of a DD-MM-YYYY date (e.g.
  // "01-11-1989", where "-1989" looks like a "-HHMM" offset).
  str = str.replace(/([+-]\d{2}:\d{2})$/, '').trim();

  // ISO: YYYY-MM-DD (or with / or .)
  let match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    return build(Number(d), Number(m), expandYear(Number(y)));
  }

  // Month name formats: "12 Jan 1990", "Jan 12 1990", "12-Jan-1990", "January 12, 1990"
  const cleaned = str
    .replace(/,/g, ' ')
    .replace(/[-/.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleaned.split(' ');
  if (tokens.length === 3) {
    const lower = tokens.map((t) => t.toLowerCase());
    const monthIdx = lower.findIndex((t) => t in MONTHS);
    if (monthIdx !== -1) {
      const m = MONTHS[lower[monthIdx]];
      const others = tokens.filter((_, i) => i !== monthIdx).map(Number);
      if (others.every((n) => !isNaN(n))) {
        // One of them is the 4-digit (or larger) year.
        const yearGuess = others.find((n) => n > 31);
        const dayGuess = others.find((n) => n !== yearGuess);
        if (yearGuess !== undefined && dayGuess !== undefined) {
          return build(dayGuess, m, expandYear(yearGuess));
        }
        // Both <= 31: treat first token as day, last as year.
        return build(others[0], m, expandYear(others[1]));
      }
    }
  }

  // Numeric DD-MM-YYYY / MM-DD-YYYY / DD-MM-YY etc. (separators - / .)
  match = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (match) {
    let [, a, b, y] = match;
    const first = Number(a);
    const second = Number(b);
    const year = expandYear(Number(y));

    // Disambiguate day vs month.
    if (first > 12 && second <= 12) {
      return build(first, second, year); // DD-MM
    }
    if (second > 12 && first <= 12) {
      return build(second, first, year); // MM-DD
    }
    // Ambiguous: default to DD-MM (international convention).
    return build(first, second, year);
  }

  // Compact YYYYMMDD or DDMMYYYY (8 digits).
  match = str.match(/^(\d{8})$/);
  if (match) {
    const s = match[1];
    // Try YYYYMMDD first.
    const y1 = Number(s.slice(0, 4));
    const m1 = Number(s.slice(4, 6));
    const d1 = Number(s.slice(6, 8));
    if (isValidDob(d1, m1, y1)) return build(d1, m1, y1);
    // Then DDMMYYYY.
    const d2 = Number(s.slice(0, 2));
    const m2 = Number(s.slice(2, 4));
    const y2 = Number(s.slice(4, 8));
    if (isValidDob(d2, m2, y2)) return build(d2, m2, y2);
    return '';
  }

  // Last resort: native parsing.
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return build(dt.getDate(), dt.getMonth() + 1, dt.getFullYear());
  }

  return '';
}

/**
 * Completed years between a date of birth and today. Accepts any format
 * `formatDateOfBirth` understands; returns `null` when the DOB is unusable or
 * lies in the future.
 */
export function calculateAge(
  input: string | number | undefined | null,
): number | null {
  const formatted = formatDateOfBirth(input);
  if (!formatted) return null;

  const [day, month, year] = formatted.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) age -= 1;

  return age >= 0 && age < 150 ? age : null;
}

export function convertMoneyToString(amount: number): string {
  if (amount >= 1_00_00_000) {
    return `${(amount / 1_00_00_000).toFixed(amount % 1_00_00_000 === 0 ? 0 : 1)} crore`;
  } else if (amount >= 1_00_000) {
    return `${(amount / 1_00_000).toFixed(amount % 1_00_000 === 0 ? 0 : 1)} lakh`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)} thousand`;
  } else {
    return amount.toString();
  }
}

export const expandGender = (v?: string | null) => {
  if (!v) return v ?? '';
  const t = v.trim().toLowerCase();
  if (t === 'm' || t === 'male') return 'Male';
  if (t === 'f' || t === 'female') return 'Female';
  return v;
};

export const expandRelation = (v?: string | null) => {
  if (!v) return v ?? '';
  const t = v.trim().toLowerCase();
  if (t === 'f' || t === 'father') return 'Father';
  if (t === 'h' || t === 'husband') return 'Husband';
  if (t === 'm' || t === 'mother') return 'Mother';
  if (t === 'w' || t === 'wife') return 'Wife';
  return v;
};

export const expandMaritalStatus = (v?: string | null) => {
  if (!v) return v ?? '';
  const t = v.trim().toUpperCase();
  if (t === 'U' || t === 'UNMARRIED') return 'Unmarried';
  if (t === 'M' || t === 'MARRIED') return 'Married';
  if (t === 'D' || t === 'DIVORCED') return 'Divorced';
  if (t === 'W' || t === 'WIDOWED') return 'Widowed';
  return v;
};

export const expandYesNo = (v?: string | null) => {
  if (!v) return v ?? '';
  const t = v.trim().toUpperCase();
  if (t === 'Y' || t === 'YES') return 'Yes';
  if (t === 'N' || t === 'NO') return 'No';
  return v;
};
