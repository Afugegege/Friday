const https = require('https');

class CalcConverterService {
  /**
   * Real-time currency conversion using open exchange rate API
   */
  async convertCurrency(amount, fromCurrency, toCurrency) {
    const from = (fromCurrency || 'USD').toUpperCase().trim();
    const to = (toCurrency || 'MYR').toUpperCase().trim();
    const amt = parseFloat(amount) || 1;

    const url = `https://open.er-api.com/v6/latest/${from}`;

    return new Promise((resolve) => {
      https.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.result === 'success' && json.rates && json.rates[to]) {
              const rate = json.rates[to];
              const converted = (amt * rate).toFixed(2);
              resolve({
                success: true,
                amount: amt,
                from,
                to,
                rate: rate.toFixed(4),
                result: parseFloat(converted),
                summary: `${amt} ${from} = ${converted} ${to} (Rate: 1 ${from} = ${rate.toFixed(4)} ${to})`
              });
            } else {
              resolve({
                success: false,
                error: `Currency pair ${from} to ${to} not found.`
              });
            }
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse currency rate.' });
          }
        });
      }).on('error', (err) => resolve({ success: false, error: err.message }))
        .on('timeout', () => resolve({ success: false, error: 'Currency request timed out.' }));
    });
  }

  /**
   * World Time & Timezone lookup for any city or timezone
   */
  getWorldTime(cityOrTz = 'UTC') {
    const query = cityOrTz.trim().toLowerCase();
    
    // Map common cities to IANA timezones
    const tzMap = {
      'new york': 'America/New_York',
      'los angeles': 'America/Los_Angeles',
      'san francisco': 'America/Los_Angeles',
      'london': 'Europe/London',
      'paris': 'Europe/Paris',
      'berlin': 'Europe/Berlin',
      'tokyo': 'Asia/Tokyo',
      'beijing': 'Asia/Shanghai',
      'shanghai': 'Asia/Shanghai',
      'singapore': 'Asia/Singapore',
      'kuala lumpur': 'Asia/Kuala_Lumpur',
      'malaysia': 'Asia/Kuala_Lumpur',
      'sydney': 'Australia/Sydney',
      'melbourne': 'Australia/Sydney',
      'dubai': 'Asia/Dubai',
      'hong kong': 'Asia/Hong_Kong',
      'toronto': 'America/Toronto',
      'seoul': 'Asia/Seoul',
      'utc': 'UTC',
      'gmt': 'GMT'
    };

    let timeZone = tzMap[query] || cityOrTz;

    try {
      const now = new Date();
      const options = {
        timeZone,
        hour12: true,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      };

      const formatter = new Intl.DateTimeFormat('en-US', options);
      const formatted = formatter.format(now);

      return {
        success: true,
        location: cityOrTz,
        timeZone,
        formattedTime: formatted,
        summary: `The current time in ${cityOrTz} (${timeZone}) is ${formatted}.`
      };
    } catch (e) {
      return {
        success: false,
        error: `Unknown timezone for "${cityOrTz}".`
      };
    }
  }

  /**
   * Mathematical and unit calculation evaluator
   */
  calculateMath(expression) {
    try {
      // Safe sanitized arithmetic calculation
      const sanitized = expression.replace(/[^0-9+\-*/().%^eE ]/g, '');
      if (!sanitized) {
        return { success: false, error: 'Invalid expression' };
      }
      
      // Evaluate exponentiation
      const safeExpr = sanitized.replace(/\^/g, '**');
      const result = Function(`'use strict'; return (${safeExpr})`)();
      
      return {
        success: true,
        expression,
        result,
        summary: `${expression} = ${result}`
      };
    } catch (e) {
      return {
        success: false,
        error: `Calculation error: ${e.message}`
      };
    }
  }
}

module.exports = new CalcConverterService();
