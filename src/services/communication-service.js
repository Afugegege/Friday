const windowsAutomation = require('./windows-automation');

class CommunicationService {
  /**
   * Opens email client (Gmail or default Windows client) with pre-filled fields
   */
  async composeEmail(options = {}) {
    const to = encodeURIComponent(options.to || '');
    const subject = encodeURIComponent(options.subject || '');
    const body = encodeURIComponent(options.body || '');
    const platform = (options.platform || 'gmail').toLowerCase();

    let targetUrl = '';
    if (platform === 'gmail') {
      targetUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    } else {
      targetUrl = `mailto:${to}?subject=${subject}&body=${body}`;
    }

    const res = await windowsAutomation.openUrl(targetUrl);
    return {
      success: res.success,
      platform,
      to: options.to || 'unspecified',
      subject: options.subject || 'none',
      message: `Composed draft in ${platform === 'gmail' ? 'Gmail' : 'default mail client'}.`
    };
  }

  /**
   * Opens Google Calendar or adds an event
   */
  async scheduleCalendar(title = '', dateStr = '') {
    let url = 'https://calendar.google.com';
    if (title) {
      const textEnc = encodeURIComponent(title);
      url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${textEnc}`;
    }
    const res = await windowsAutomation.openUrl(url);
    return {
      success: res.success,
      title: title || 'Calendar',
      message: `Opened calendar for "${title || 'scheduling'}".`
    };
  }
}

module.exports = new CommunicationService();
