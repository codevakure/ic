/**
 * Converts a number to words (English)
 * This is a simplified version - for full support, consider using a library
 */
export function amountInWords(n: number): string {
  const maxLen = 14;
  if (n.toString().split('.')[0]?.length > maxLen) {
    return `Maximum amount supported is ${maxLen} digits before decimal`;
  }

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

  if (n === 0) return 'Zero';

  const head = n < 0 ? 'Negative ' : '';
  n = Math.abs(n);

  const intPart = Math.floor(n);
  const decPart = Math.round((n - intPart) * 100);

  function convertHundreds(num: number): string {
    let result = '';
    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      result += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num >= 10) {
      result += teens[num - 10] + ' ';
      return result;
    }
    if (num > 0) {
      result += ones[num] + ' ';
    }
    return result;
  }

  let result = '';
  let scaleIndex = 0;
  let remaining = intPart;

  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      result = convertHundreds(chunk) + scales[scaleIndex] + ' ' + result;
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex++;
  }

  result = result.trim() || 'Zero';

  if (decPart > 0) {
    result += ' and ' + convertHundreds(decPart).trim() + ' Cents';
  } else {
    result += ' Dollars';
  }

  return head + result;
}
