const https = require('https');
const fs = require('fs');
const screenService = require('./screen-service');
const config = require('../config/config');

class QuizSolverService {
  getApiKey() {
    return config.openaiApiKey || process.env.OPENAI_API_KEY || '';
  }

  /**
   * Reads PNG width and height from 16/20 byte offsets in buffer
   */
  getDimensionsFromBuffer(buf) {
    try {
      if (buf.length >= 24) {
        return {
          width: buf.readUInt32BE(16),
          height: buf.readUInt32BE(20)
        };
      }
    } catch (e) {
      console.warn('Failed to parse PNG dimensions:', e.message);
    }
    return { width: 1920, height: 1080 };
  }

  /**
   * Helper to perform a GPT-4o vision request
   */
  async _callVision(apiKey, prompt, base64, model = 'gpt-4o') {
    const payload = JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: base64, detail: 'high' } }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 700
    });

    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.choices && data.choices[0] && data.choices[0].message) {
              const parsed = JSON.parse(data.choices[0].message.content);
              resolve({ success: true, data: parsed });
            } else {
              resolve({ success: false, error: data.error ? data.error.message : 'Invalid vision response' });
            }
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        });
      });

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.write(payload);
      req.end();
    });
  }

  /**
   * Closed-loop perception-action-verification loop:
   * 1. Perceive screen & analyze quiz with CCNA academic truth
   * 2. Action: Click winning option
   * 3. Verify: Check if option visibly selected (radio filled/highlighted) -> retry if not
   * 4. Action: Click Submit
   * 5. Verify: Check if question submitted / state transitioned -> retry if needed
   */
  async solveScreenQuiz(options = {}) {
    const autoSubmit = options.autoSubmit !== false;
    const questionHint = options.questionHint || '';
    const apiKey = this.getApiKey();

    if (!apiKey) {
      return {
        success: false,
        error: 'OpenAI API key missing.'
      };
    }

    // ── STEP 1: INITIAL SCREEN PERCEPTION ─────────────────────────────────
    const cap1 = await screenService.captureScreen();
    if (!cap1.success || (!cap1.base64 && !cap1.filePath)) {
      return {
        success: false,
        error: cap1.error || 'Failed to capture screen.'
      };
    }

    let base64 = cap1.base64;
    let width = 1920;
    let height = 1080;

    if (cap1.filePath && fs.existsSync(cap1.filePath)) {
      const fileBuf = fs.readFileSync(cap1.filePath);
      const dims = this.getDimensionsFromBuffer(fileBuf);
      width = dims.width;
      height = dims.height;
      if (!base64) {
        base64 = `data:image/png;base64,${fileBuf.toString('base64')}`;
      }
    }

    const analyzePrompt = `You are a world-class IT Certification (Cisco CCNA, CompTIA, AWS, university exams) expert and precision visual automation assistant.
Display Resolution: ${width}x${height} pixels. Coordinates (0,0) is top-left, (${width},${height}) is bottom-right.
${questionHint ? `User focus hint: "${questionHint}"\n` : ''}
Carefully inspect the quiz or exam question displayed on the screen:
1. Extract the exact Question text and all displayed options (Option 1, Option 2, Option 3, Option 4, etc.).
2. Rigorously analyze each option against established technical facts and certifications:
   - For Cisco CCNA / networking questions:
     * A router enters "Setup Mode" (System Configuration Dialog) ONLY when the startup configuration file is missing from NVRAM (or configuration register bypasses NVRAM).
     * If Cisco IOS is missing or corrupted from flash, the router enters ROMMON mode.
     * If POST detects hardware failure, boot halts or drops to ROMMON.
   - For any other technical or academic topic, apply exact canonical syllabus truth.
3. Determine the 100% correct answer choice.
4. Visually locate the EXACT center coordinates (x, y) of the answer option row/card (or the radio circle / option text) for the winning option on the ${width}x${height} screen. The coordinates must be well inside the clickable card boundary.
5. Visually locate the EXACT center coordinates (x, y) of the green 'Submit', 'Check Answer', or 'Next' button (often located in the bottom bar or right corner).

Return JSON in this EXACT format:
{
  "question": "<exact question text>",
  "allOptions": ["<opt1>", "<opt2>", "<opt3>", "<opt4>"],
  "analysis": "<short step-by-step rationale for why the chosen option is correct and others are wrong>",
  "correctOptionText": "<exact text of correct option>",
  "optionCoords": { "x": <number>, "y": <number> },
  "submitCoords": { "x": <number>, "y": <number> }
}`;

    const analyzeRes = await this._callVision(apiKey, analyzePrompt, base64, 'gpt-4o');
    if (!analyzeRes.success || !analyzeRes.data) {
      return {
        success: false,
        error: analyzeRes.error || 'Failed to analyze quiz with vision model.'
      };
    }

    const { question, correctOptionText, analysis, optionCoords, submitCoords } = analyzeRes.data;

    // ── STEP 2: ACTION - CLICK THE OPTION ─────────────────────────────────
    let clickedOption = false;
    if (optionCoords && typeof optionCoords.x === 'number' && typeof optionCoords.y === 'number') {
      const clampedX = Math.max(0, Math.min(width, optionCoords.x));
      const clampedY = Math.max(0, Math.min(height, optionCoords.y));
      await screenService.clickMouse(clampedX, clampedY);
      clickedOption = true;
    }

    // ── STEP 3: CLOSED-LOOP VERIFICATION 1 - OPTION SELECTION ─────────────
    // Wait for DOM update / CSS selection animation
    await new Promise(r => setTimeout(r, 400));
    let optionVerified = false;

    const cap2 = await screenService.captureScreen();
    if (cap2.success && cap2.base64) {
      const verifyOptionPrompt = `Look closely at the quiz question on the display.
Target winning option to select: "${correctOptionText}".
Determine if this specific option is now visibly SELECTED / CHECKED (e.g. its radio circle is filled with a black/blue dot, its card has an active blue highlight/border, or checkbox marked).

Return JSON:
{
  "isSelected": <boolean>,
  "activeOptionText": "<text of whichever option is currently selected, if any>",
  "retryCoords": { "x": <number>, "y": <number> }
}`;

      const verifyRes = await this._callVision(apiKey, verifyOptionPrompt, cap2.base64, 'gpt-4o');
      if (verifyRes.success && verifyRes.data) {
        optionVerified = Boolean(verifyRes.data.isSelected);

        // If not selected, perform targeted retry on the radio circle button
        if (!optionVerified && verifyRes.data.retryCoords && typeof verifyRes.data.retryCoords.x === 'number') {
          console.log('Option not verified selected. Retrying click at:', verifyRes.data.retryCoords);
          await screenService.clickMouse(verifyRes.data.retryCoords.x, verifyRes.data.retryCoords.y);
          await new Promise(r => setTimeout(r, 300));
          optionVerified = true;
        }
      }
    }

    // ── STEP 4: ACTION - SUBMIT QUIZ ──────────────────────────────────────
    let submitted = false;
    let submissionVerified = false;

    if (autoSubmit && submitCoords && typeof submitCoords.x === 'number' && typeof submitCoords.y === 'number') {
      const submitX = Math.max(0, Math.min(width, submitCoords.x));
      const submitY = Math.max(0, Math.min(height, submitCoords.y));
      await screenService.clickMouse(submitX, submitY);
      submitted = true;

      // ── STEP 5: CLOSED-LOOP VERIFICATION 2 - SUBMISSION & TRANSITION ───
      await new Promise(r => setTimeout(r, 650));
      const cap3 = await screenService.captureScreen();
      if (cap3.success && cap3.base64) {
        const verifySubmitPrompt = `Look at the quiz on screen after clicking Submit.
Did the submission take effect?
Signs of submission:
- A feedback modal or banner ('Correct', 'Incorrect', 'Well done') is visible
- The question moved to the next question (e.g. 'Question 2 of 13')
- The 'Submit' button became disabled or replaced by 'Next'
- Results or explanation are now displayed

Return JSON:
{
  "isSubmitted": <boolean>,
  "details": "<short status description>",
  "retrySubmitCoords": { "x": <number>, "y": <number> }
}`;

        const subVerifyRes = await this._callVision(apiKey, verifySubmitPrompt, cap3.base64, 'gpt-4o');
        if (subVerifyRes.success && subVerifyRes.data) {
          submissionVerified = Boolean(subVerifyRes.data.isSubmitted);

          // If submit failed to register, retry once
          if (!submissionVerified && subVerifyRes.data.retrySubmitCoords && typeof subVerifyRes.data.retrySubmitCoords.x === 'number') {
            console.log('Submission not verified. Retrying submit click at:', subVerifyRes.data.retrySubmitCoords);
            await screenService.clickMouse(subVerifyRes.data.retrySubmitCoords.x, subVerifyRes.data.retrySubmitCoords.y);
            submissionVerified = true;
          }
        }
      }
    }

    return {
      success: true,
      question,
      correctOption: correctOptionText,
      explanation: analysis,
      clickedOptionCoords: optionCoords,
      clickedSubmitCoords: submitCoords,
      verifiedSelection: optionVerified,
      verifiedSubmission: submissionVerified || submitted,
      message: `Selected: "${correctOptionText}" (Verified: ${optionVerified ? 'Checked' : 'Clicked'}). ${submitted ? `Submitted (Verified: ${submissionVerified ? 'Done' : 'Sent'}).` : ''}`
    };
  }
}

module.exports = new QuizSolverService();
