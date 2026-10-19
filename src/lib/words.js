const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const below100 = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const below1000 = (n) => (n >= 100 ? `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${below100(n % 100)}` : ''}` : below100(n));

/** Whole rupees in words, the Indian way (thousand, lakh, crore). 0 -> "zero". */
export function rupeesInWords(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zero';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${rupeesInWords(crore)} crore`);
  if (lakh) parts.push(`${below100(lakh)} lakh`);
  if (thousand) parts.push(`${below100(thousand)} thousand`);
  if (n) parts.push(below1000(n));
  return parts.join(' ');
}

/** An amount in paise as "Rupees one lakh twenty-five thousand only" (with paise when there are some). */
export function paiseInWords(paise) {
  const p = Math.round(Math.abs(paise));
  const rupees = Math.floor(p / 100);
  const rest = p % 100;
  const text = `Rupees ${rupeesInWords(rupees)}${rest ? ` and ${rupeesInWords(rest)} paise` : ''} only`;
  return text.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety) (one|two|three|four|five|six|seven|eight|nine)\b/g, '$1-$2');
}
