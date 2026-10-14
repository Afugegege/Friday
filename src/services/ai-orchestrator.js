const https = require('https');
const toolRegistry = require('../tools/tool-registry');
const memoryService = require('./memory-service');
const actionEngine = require('./action-engine');
const screenService = require('./screen-service');
const activityLogger = require('./activity-logger');
const config = require('../config/config');

class AiOrchestrator {
  constructor() {
    this.model = 'gpt-4o-mini';
    this.systemPrompt = `You are F.R.I.D.A.Y. (Female Replacement Intelligent Digital Assistant Youth), the tactical, ultra-competent, razor-sharp AI originally engineered by Tony Stark, now running with full administrative authority over this Windows PC.

CORE DIRECTIVES:
1. IMMEDIATE ACTION EXECUTION FOR SIMPLE COMMANDS:
   - When the user asks for a direct task (e.g. "play Perfect", "open VS Code", "lock my PC", "mute", "answer this quiz"), YOU MUST CALL THE APPROPRIATE TOOL IMMEDIATELY with a single punchy sentence ("Playing Perfect by Ed Sheeran."). Never lecture or give trivia.
2. COMPLEX MULTI-STEP PLANNING & WORKFLOWS (e.g. "plan me a trip to Greece", "organize my schedule", "compare laptops"):
   - When the user brings up a complex project or travel goal:
     a) Acknowledge the destination or goal with tactical confidence ("Greece sounds phenomenal.").
     b) Proactively ask 1-2 focused follow-up questions to gather necessary details (e.g. departure airport, travel dates, budget).
     c) Offer platform choices to execute: Google Flights, Skyscanner, Booking.com, Airbnb, or local notes.
     d) Distinguish between searching options and booking them. NEVER claim to have booked a flight or room unless confirmed.
3. AUTONOMOUS SCREEN & QUIZ SOLVING:
   - If the user asks to solve, answer, do, or complete a question/quiz/test on screen (e.g., Cisco CCNA, AWS, exam questions, multiple choice):
     YOU MUST CALL solve_screen_quiz tool! It uses high-precision GPT-4o vision to analyze the question, determine the academically correct option, click the radio option, and click the Submit button.
   - For general desktop UI interaction (search boxes, forms, clicking buttons):
     Identify the visual coordinates on the display, call click_screen, type_text, or press_key.
4. RESEARCH & NOTE SYNTHESIS:
   - When asked to research a technical concept, comparison, or study topic (e.g. "research IPv6 and save notes", "compare TCP and UDP", "find cybersecurity internships in Ireland and compare requirements"):
     Call conduct_research, analyze the sources, prepare a structured markdown summary (in Chinese if requested by user), and call save_research_notes to save it to disk and Knowledge Memory.
5. CODE & DEVELOPER ASSISTANCE:
   - When asked about project bugs or build errors:
     Call diagnose_project or git_inspect, read the error output, identify the root cause, and explain the exact resolution cleanly.
6. PERSISTENT MEMORY & SCHEDULING:
   - When asked to remember something: Call save_note.
   - When asked to recall previous notes: Call get_notes.
   - When asked to set a reminder or schedule a background task: Call schedule_task.
7. TACTICAL TONE & CONCISENESS:
   - Persona: Calm, sharp, witty, elite tactical assistant. Confident, razor-focused.
   - Spoken confirmations: single punchy sentence.
   - For complex plans: organized, proactive, and structured without fluffy filler.
8. STRICT LANGUAGE DIRECTIVE:
   - DEFAULT LANGUAGE IS ENGLISH: Always speak, confirm, and respond in crisp, fluent ENGLISH.
   - If the user explicitly asks for an explanation in Chinese, respond in Mandarin Chinese as requested.
9. STRICTLY NO HONORIFIC TITLES:
   - NEVER call the user "Boss", "Sir", "Master", or any honorific title. Speak directly and naturally.
10. NO MARKDOWN IN SPOKEN SPEECH:
   - Never output asterisks (*), markdown formatting, hashtags, or bullet points in your spoken responses.`;
  }

  getApiKey() {
    return config.openaiApiKey || process.env.OPENAI_API_KEY || '';
  }

  /**
   * Cleans text of markdown and honorifics before speech synthesis or display
   */
  cleanSpokenOutput(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text
      // Strip markdown links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Strip bold, italic, code markers (*, _, `)
      .replace(/[*_`#~]/g, '')
      // Strip markdown list bullet points at start of lines
      .replace(/^\s*[-+*]\s+/gm, '')
      // Strip honorifics
      .replace(/\b(Boss|Sir|Master)\b[,.]?/gi, '')
      // Clean up multiple spaces or dangling commas
      .replace(/\s{2,}/g, ' ')
      .replace(/,\s*,/g, ',')
      .trim();

    return cleaned;
  }

  /**
   * Cancels any active multi-step operation or LLM generation
   */
  cancelActiveOperation() {
    return actionEngine.cancelTask('User aborted task.');
  }

  /**
   * Fast-path router for instant sub-100ms response on frequent desktop & task actions
   */
  async tryFastPath(rawText, onStatusChange = () => {}) {
    const text = rawText.toLowerCase().trim().replace(/^(?:friday|hey friday)\s*[,:]?\s*/i, '');

    // 1. Explicit Task Lifecycle Controls (Phases 3, 4, 6)
    if (text === 'cancel that task' || text === 'cancel task' || text === 'stop task' || text === 'cancel mission' || text === 'stop the task') {
      const res = actionEngine.cancelTask('User instructed cancellation.');
      return {
        spokenText: res.message || "Task cancelled. Standing by.",
        displayText: "Task Cancelled",
        toolCalls: []
      };
    }

    if (text === 'what are you currently doing?' || text === 'what are you doing' || text === 'current task' || text === 'task status' || text === 'what is your status') {
      const active = actionEngine.getActiveTask();
      if (!active || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(active.status)) {
        return {
          spokenText: "I have no active multi-step task running. Ready for your instructions.",
          displayText: "Idle - Standing By",
          toolCalls: []
        };
      }
      const reply = `Currently working on: ${active.objective}. Status is ${active.status}.`;
      return {
        spokenText: reply,
        displayText: `Status: ${active.status}`,
        toolCalls: []
      };
    }

    if (text === 'forget this plan' || text === 'forget plan' || text === 'clear task' || text === 'forget this task') {
      memoryService.clearActiveTask();
      return {
        spokenText: "Active plan cleared from working memory.",
        displayText: "Plan Cleared",
        toolCalls: []
      };
    }

    if (text === 'show my pending tasks' || text === 'pending tasks' || text === 'list tasks') {
      const pending = memoryService.getPendingTasks();
      if (!pending || pending.length === 0) {
        return {
          spokenText: "You have no pending background tasks.",
          displayText: "No Pending Tasks",
          toolCalls: []
        };
      }
      const summary = `You have ${pending.length} pending task(s): ` + pending.map((t, idx) => `${idx + 1}. ${t.objective} (${t.status})`).join('; ');
      return {
        spokenText: summary,
        displayText: `Pending: ${pending.length}`,
        toolCalls: []
      };
    }

    if (text === 'continue my previous task' || text === 'continue task' || text === 'resume task') {
      const pending = memoryService.getPendingTasks();
      if (pending && pending.length > 0) {
        const resumed = memoryService.resumeTask(pending[pending.length - 1].id);
        const reply = `Resuming: ${resumed.objective}. Current status is ${resumed.status}.`;
        return {
          spokenText: reply,
          displayText: `Resumed: ${resumed.objective}`,
          toolCalls: []
        };
      }
      const active = actionEngine.getActiveTask();
      if (active && active.status === 'AWAITING_INFORMATION') {
        const question = active.missingInfo && active.missingInfo.length > 0 
          ? `Continuing ${active.objective}. Please specify: ${active.missingInfo[0]}.`
          : `Continuing ${active.objective}. How would you like to proceed?`;
        return {
          spokenText: question,
          displayText: `Continuing: ${active.objective}`,
          toolCalls: []
        };
      }
      return {
        spokenText: "There are no suspended tasks to continue. What would you like to work on?",
        displayText: "No Suspended Tasks",
        toolCalls: []
      };
    }

    // 2. Dismissal / Leave commands
    const dismissWords = [
      'go away', 'dismiss', 'close', 'hide', 'bye', 'goodbye', 
      'that is all', "that's all", 'leave me', 'you can go', 'you can leave',
      '再见', '退下', '关闭', '退出'
    ];
    if (dismissWords.some(w => text === w || text.startsWith(w)) || text.includes('bye') || text.includes('goodbye') || text.includes('dismiss')) {
      return {
        shouldDismiss: true,
        spokenText: "Standing by. Call me when you need me.",
        displayText: "Dismissed",
        toolCalls: []
      };
    }

    // Companion Mode toggle commands
    const stayWords = ['stay with me', 'stay', 'stay open', 'stick around', "don't go", "don't leave", 'keep open', 'stay here'];
    if (stayWords.some(w => text === w || text.startsWith(w))) {
      return {
        keepOpen: true,
        spokenText: "Standing by with you. Let me know when you're finished.",
        displayText: "Staying with you",
        toolCalls: []
      };
    }

    // 3. Play music / Spotify
    if (text.startsWith('play ') || text === 'play' || text === 'play music' || text.startsWith('play song ')) {
      onStatusChange('Accessing Spotify...');
      const trackQuery = text.replace(/^play(?:\s+(?:music|song|track))?\s*/i, '').trim();
      const spotifyService = require('./spotify-service');
      const res = await spotifyService.play(trackQuery);
      const reply = trackQuery ? `Playing ${trackQuery}.` : "Resuming playback.";
      return {
        spokenText: reply,
        displayText: reply,
        toolCalls: [{ name: 'spotify_play', result: res }]
      };
    }

    // 4. Media Controls
    if (text === 'pause' || text === 'pause music' || text === 'stop music' || text === 'stop the music') {
      onStatusChange('Pausing...');
      const spotifyService = require('./spotify-service');
      const res = await spotifyService.pause();
      return {
        spokenText: "Paused.",
        displayText: "Paused",
        toolCalls: [{ name: 'spotify_pause', result: res }]
      };
    }

    if (text === 'next' || text === 'skip' || text === 'next song' || text === 'next track' || text === 'skip song') {
      onStatusChange('Skipping track...');
      const spotifyService = require('./spotify-service');
      const res = await spotifyService.next();
      return {
        spokenText: "Skipped.",
        displayText: "Next track",
        toolCalls: [{ name: 'spotify_next', result: res }]
      };
    }

    if (text === 'previous' || text === 'prev' || text === 'previous song' || text === 'previous track') {
      onStatusChange('Previous track...');
      const spotifyService = require('./spotify-service');
      const res = await spotifyService.previous();
      return {
        spokenText: "Returning to previous track.",
        displayText: "Previous track",
        toolCalls: [{ name: 'spotify_previous', result: res }]
      };
    }

    // 5. System Power & Workstation Actions
    const windowsAutomation = require('./windows-automation');

    if (text === 'lock' || text === 'lock pc' || text === 'lock screen' || text === 'lock my pc') {
      onStatusChange('Locking workstation...');
      const res = await windowsAutomation.systemAction('lock');
      return {
        spokenText: "Locking workstation.",
        displayText: "Workstation Locked",
        toolCalls: [{ name: 'system_action', result: res }]
      };
    }

    if (text === 'minimize all' || text === 'show desktop' || text === 'minimize windows') {
      onStatusChange('Minimizing windows...');
      const res = await windowsAutomation.systemAction('minimize_all');
      return {
        spokenText: "Desktop clear.",
        displayText: "Desktop",
        toolCalls: [{ name: 'system_action', result: res }]
      };
    }

    if (text === 'restore windows' || text === 'undo minimize') {
      const res = await windowsAutomation.systemAction('undo_minimize');
      return {
        spokenText: "Restoring windows.",
        displayText: "Restored",
        toolCalls: [{ name: 'system_action', result: res }]
      };
    }

    if (text === 'battery' || text === 'check battery' || text === 'battery status') {
      const res = await windowsAutomation.systemAction('battery');
      return {
        spokenText: res.message,
        displayText: res.message,
        toolCalls: [{ name: 'system_action', result: res }]
      };
    }

    if (text === 'volume up') {
      const res = await windowsAutomation.systemAction('volume_up');
      return { spokenText: "Volume up.", displayText: "Volume Up", toolCalls: [{ name: 'system_action', result: res }] };
    }

    if (text === 'volume down') {
      const res = await windowsAutomation.systemAction('volume_down');
      return { spokenText: "Volume down.", displayText: "Volume Down", toolCalls: [{ name: 'system_action', result: res }] };
    }

    if (text === 'mute' || text === 'unmute') {
      const res = await windowsAutomation.systemAction('mute');
      return { spokenText: "Muted.", displayText: "Mute Toggled", toolCalls: [{ name: 'system_action', result: res }] };
    }

    // Set Volume Level
    const volMatch = text.match(/^(?:set\s+)?volume\s+(?:to\s+)?(\d{1,3})(?:\s*%)?$/i);
    if (volMatch) {
      const pct = parseInt(volMatch[1], 10);
      onStatusChange(`Setting volume to ${pct}%...`);
      const hardwareService = require('./hardware-service');
      const res = await hardwareService.setVolumeLevel(pct);
      return { spokenText: res.message, displayText: `Volume: ${pct}%`, toolCalls: [{ name: 'set_volume_level', result: res }] };
    }

    // Empty Recycle Bin
    if (text === 'empty recycle bin' || text === 'clean recycle bin' || text === 'clear recycle bin') {
      onStatusChange('Emptying Recycle Bin...');
      const hardwareService = require('./hardware-service');
      const res = await hardwareService.emptyRecycleBin();
      return { spokenText: res.message, displayText: "Recycle Bin Cleared", toolCalls: [{ name: 'empty_recycle_bin', result: res }] };
    }

    // System Specs & Hardware Health
    if (text === 'system specs' || text === 'specs' || text === 'system status' || text === 'pc status' || text === 'hardware' || text === 'check ram' || text === 'check disk') {
      onStatusChange('Reading hardware metrics...');
      const hardwareService = require('./hardware-service');
      const res = await hardwareService.getSystemMetrics();
      return { spokenText: res.summary, displayText: "System Specs", toolCalls: [{ name: 'get_system_specs', result: res }] };
    }

    // Network Diagnostics & IP
    if (text === 'my ip' || text === 'what is my ip' || text === 'ip address' || text === 'network status' || text === 'check internet') {
      onStatusChange('Querying network diagnostics...');
      const hardwareService = require('./hardware-service');
      const res = await hardwareService.getNetworkDiagnostics();
      return { spokenText: res.summary, displayText: "Network Diagnostics", toolCalls: [{ name: 'get_network_info', result: res }] };
    }

    // Read Clipboard
    if (text === 'read clipboard' || text === 'what is in my clipboard' || text === 'clipboard') {
      onStatusChange('Reading clipboard...');
      const clipboardService = require('./clipboard-service');
      const res = await clipboardService.readClipboard();
      const reply = res.hasText ? `Clipboard contains: ${res.text.slice(0, 150)}` : "Your clipboard is currently empty.";
      return { spokenText: reply, displayText: "Clipboard", toolCalls: [{ name: 'read_clipboard', result: res }] };
    }

    // Weather Lookup
    const weatherMatch = text.match(/^(?:what(?:'s| is) the )?weather(?:\s+in|\s+for)?\s*([a-zA-Z\s]+)?$/i);
    if (weatherMatch && !text.includes('screen') && !text.includes('code')) {
      const loc = (weatherMatch[1] || '').trim();
      onStatusChange(`Checking weather for ${loc || 'current location'}...`);
      const weatherService = require('./weather-service');
      const res = await weatherService.getWeather(loc);
      if (res.success) {
        return { spokenText: res.summary, displayText: `Weather: ${res.tempC}`, toolCalls: [{ name: 'get_weather', result: res }] };
      }
    }

    // Direct Web Navigation
    const webMatch = text.match(/^(?:open|go to)\s+(youtube|github|google|reddit|twitter|x|netflix|chatgpt)(?:\.com)?$/i);
    if (webMatch) {
      const site = webMatch[1].toLowerCase();
      const urls = {
        'youtube': 'https://youtube.com',
        'github': 'https://github.com',
        'google': 'https://google.com',
        'reddit': 'https://reddit.com',
        'twitter': 'https://x.com',
        'x': 'https://x.com',
        'netflix': 'https://netflix.com',
        'chatgpt': 'https://chatgpt.com'
      };
      const url = urls[site] || `https://${site}.com`;
      onStatusChange(`Opening ${site}...`);
      const res = await windowsAutomation.openUrl(url);
      return {
        spokenText: `Opening ${site}.`,
        displayText: `Opened ${site}`,
        toolCalls: [{ name: 'open_url', result: res }]
      };
    }

    // Launch Application
    const openMatch = text.match(/^(?:open|launch)\s+([a-zA-Z0-9_\- ]+)$/i);
    if (openMatch && !openMatch[1].includes('file') && !openMatch[1].includes('project') && !openMatch[1].includes('document')) {
      const appName = openMatch[1].trim();
      onStatusChange(`Launching ${appName}...`);
      const res = await windowsAutomation.launchApp(appName);
      return {
        spokenText: `Opening ${appName}.`,
        displayText: `Opened ${appName}`,
        toolCalls: [{ name: 'launch_app', result: res }]
      };
    }

    // Instant Quiz & Test Solving on Screen
    const quizMatch = /^(?:solve|answer|do|check)\s+(?:the\s+)?(?:quiz|test|question|exam)|(?:choose|pick|select)\s+(?:the\s+)?(?:option|choice|answer)\s+and\s+submit|jawab\s+soalan/i.test(text);
    if (quizMatch) {
      onStatusChange('Analyzing quiz question & options...');
      const quizSolverService = require('./quiz-solver-service');
      const res = await quizSolverService.solveScreenQuiz({ autoSubmit: true, questionHint: text });
      if (res.success) {
        const spoken = `Selected "${res.correctOption}". ${res.verifiedSelection ? 'Selection confirmed.' : ''} ${res.verifiedSubmission ? 'Verified and submitted.' : 'Submitted.'}`;
        return {
          spokenText: spoken,
          displayText: `Answered: ${res.correctOption}`,
          toolCalls: [{ name: 'solve_screen_quiz', result: res }]
        };
      } else {
        const spoken = `I had trouble analyzing the quiz: ${res.error || 'visual processing error'}.`;
        return {
          spokenText: spoken,
          displayText: 'Quiz Analysis Failed',
          toolCalls: [{ name: 'solve_screen_quiz', result: res }]
        };
      }
    }

    return null;
  }

  /**
   * Transcribe recorded audio using OpenAI Whisper API with timeout & error safety
   */
  async transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
    const apiKey = this.getApiKey();
    if (!apiKey) return '';

    const boundary = '----FridayFormBoundary' + Math.random().toString(36).substring(2);
    const ext = mimeType.includes('wav') ? 'wav' : (mimeType.includes('mp4') ? 'm4a' : 'webm');
    const filename = `speech.${ext}`;

    const crlf = '\r\n';
    const lang = (config.language && config.language !== 'auto') ? config.language : 'en';
    const postDataHeader = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="model"',
      '',
      'whisper-1',
      `--${boundary}`,
      'Content-Disposition: form-data; name="language"',
      '',
      lang,
      `--${boundary}`,
      'Content-Disposition: form-data; name="prompt"',
      '',
      'FRIDAY desktop AI assistant commands in English: answer question, choose option, submit quiz, play music, open apps, system control.',
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      `Content-Type: ${mimeType}`,
      '',
      ''
    ].join(crlf);

    const postDataFooter = `${crlf}--${boundary}--${crlf}`;
    const headerBuf = Buffer.from(postDataHeader, 'utf8');
    const footerBuf = Buffer.from(postDataFooter, 'utf8');
    const fullPayload = Buffer.concat([headerBuf, audioBuffer, footerBuf]);

    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': fullPayload.length
        },
        timeout: 10000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(data.text ? data.text.trim() : '');
          } catch (e) {
            resolve('');
          }
        });
      });

      req.on('error', (err) => {
        console.error('Whisper transcription error:', err.message);
        resolve('');
      });

      req.on('timeout', () => {
        req.destroy();
        resolve('');
      });

      req.write(fullPayload);
      req.end();
    });
  }

  /**
   * Main interaction entrypoint: Process a user utterance or query
   */
  async processCommand(userText, options = {}, onStatusChange = () => {}) {
    const startTime = Date.now();

    // 1. Try Instant Fast-Path first for immediate action
    const fastResult = await this.tryFastPath(userText, onStatusChange);
    if (fastResult) {
      memoryService.addConversationTurn('user', userText, 'general');
      memoryService.addConversationTurn('assistant', fastResult.spokenText, 'general');
      activityLogger.logTurn({
        input: userText,
        actions: fastResult.toolCalls || [],
        output: fastResult.spokenText,
        durationMs: Date.now() - startTime,
        status: 'SUCCESS (FastPath)'
      });
      return fastResult;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      const errReply = "API key is missing. Please configure your key in settings.";
      activityLogger.logTurn({
        input: userText,
        actions: [],
        output: errReply,
        durationMs: Date.now() - startTime,
        status: 'FAILED (Missing API Key)'
      });
      return {
        spokenText: errReply,
        displayText: "API Key Missing",
        toolCalls: []
      };
    }

    // 2. Active Task & Progressive Planning Check (Phases 3, 4, 6)
    const activeTask = actionEngine.getActiveTask();
    const isContinuingActiveTask = activeTask && 
      !['COMPLETED', 'FAILED', 'CANCELLED'].includes(activeTask.status) &&
      (activeTask.status === 'AWAITING_INFORMATION' || activeTask.status === 'PLANNING') &&
      !userText.toLowerCase().startsWith('what is') &&
      !userText.toLowerCase().startsWith('play') &&
      !userText.toLowerCase().startsWith('solve');

    if (isContinuingActiveTask) {
      // User is providing follow-up answers to an active task (e.g. Greece trip parameters)
      onStatusChange('Updating plan with your preferences...');
      const followUp = actionEngine.processTaskFollowUp(userText, activeTask);

      memoryService.addConversationTurn('user', userText, activeTask.domain, activeTask.id);

      if (followUp.requiresAnswer) {
        const reply = followUp.question;
        memoryService.addConversationTurn('assistant', reply, activeTask.domain, activeTask.id);
        activityLogger.logTurn({
          input: userText,
          actions: [],
          output: reply,
          durationMs: Date.now() - startTime,
          status: 'AWAITING_INFORMATION'
        });
        return {
          spokenText: reply,
          displayText: reply,
          toolCalls: []
        };
      }

      if (followUp.readyToExecute && followUp.planSteps) {
        // Execute the first planned search step immediately
        const firstStep = followUp.planSteps[0];
        onStatusChange(`Executing: ${firstStep.title}...`);
        actionEngine.updateStep(1, 'RUNNING');
        const toolResult = await toolRegistry.executeTool(firstStep.tool, firstStep.args);
        actionEngine.updateStep(1, 'COMPLETED', toolResult, true);
        actionEngine.advanceStep();

        const summary = `${followUp.confirmation} First step completed: ${firstStep.title}.`;
        memoryService.addConversationTurn('assistant', summary, activeTask.domain, activeTask.id);
        activityLogger.logTurn({
          input: userText,
          actions: [{ name: firstStep.tool, args: firstStep.args, result: toolResult }],
          output: summary,
          durationMs: Date.now() - startTime,
          status: 'SUCCESS'
        });
        return {
          spokenText: summary,
          displayText: summary,
          toolCalls: [{ name: firstStep.tool, args: firstStep.args, result: toolResult }]
        };
      }
    }

    // 3. New Goal Assessment (e.g. "Friday, I want to travel to Greece. Plan a trip for me.")
    const complexGoal = actionEngine.assessComplexGoal(userText);
    if (complexGoal.isComplex) {
      const newTask = actionEngine.createTask(complexGoal.objective, complexGoal.domain, complexGoal.initialContext);
      memoryService.addConversationTurn('user', userText, complexGoal.domain, newTask.id);

      if (complexGoal.domain === 'travel') {
        const dest = complexGoal.initialContext.destination;
        const initialQuestion = `${dest} sounds phenomenal. Where will you be departing from, and how many days are you planning for the trip?`;
        memoryService.addConversationTurn('assistant', initialQuestion, complexGoal.domain, newTask.id);

        activityLogger.logTurn({
          input: userText,
          actions: [],
          output: initialQuestion,
          durationMs: Date.now() - startTime,
          status: 'AWAITING_INFORMATION'
        });

        return {
          spokenText: initialQuestion,
          displayText: `Planning trip to ${dest}`,
          toolCalls: []
        };
      }
    }

    // 4. General LLM Orchestration with Strict Context Isolation (Phase 2 & Phase 6)
    const lower = userText.toLowerCase();
    const domain = lower.includes('flight') || lower.includes('travel') || lower.includes('hotel') ? 'travel'
                 : lower.includes('quiz') || lower.includes('exam') || lower.includes('cisco') ? 'quiz'
                 : lower.includes('code') || lower.includes('git') || lower.includes('build') ? 'code'
                 : 'general';

    // Record turn tagged with domain
    memoryService.addConversationTurn('user', userText, domain);

    // Retrieve filtered history (strictly omitting past unrelated domain turns)
    const filteredHistory = memoryService.getFilteredConversation(domain, 6);
    const messages = [
      { role: 'system', content: this.systemPrompt }
    ];

    // Only inject active task context if relevant to this turn
    if (activeTask && activeTask.domain === domain && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(activeTask.status)) {
      messages.push({
        role: 'system',
        content: `[Active Task Context: Objective="${activeTask.objective}", Status="${activeTask.status}", Gathered Parameters=${JSON.stringify(activeTask.context)}]`
      });
    }

    for (const item of filteredHistory) {
      messages.push({
        role: item.role === 'user' ? 'user' : 'assistant',
        content: item.content
      });
    }

    // Vision detection
    const needsVision = lower.includes('screen') || 
                        lower.includes('document') || 
                        lower.includes('paragraph') || 
                        lower.includes('click') || 
                        lower.includes('type') || 
                        lower.includes('fill') || 
                        lower.includes('quiz') || 
                        lower.includes('question') || 
                        lower.includes('answer') || 
                        lower.includes('button') || 
                        lower.includes('form') ||
                        options.inspectScreen;

    if (needsVision) {
      onStatusChange('Analyzing screen & visual elements...');
      const cap = await screenService.captureScreen();
      if (cap.success && cap.base64) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: `[Screen capture attached. Task: "${userText}". If the user is asking to answer or solve a quiz, exam, test, or question on screen, CALL solve_screen_quiz tool immediately. Otherwise locate the visual target (e.g. search box, button, link), determine (x,y) pixel coordinates, and call click_screen, type_text, or press_key.]` },
            { type: 'image_url', image_url: { url: cap.base64, detail: 'high' } }
          ]
        });
      }
    }

    try {
      onStatusChange('Processing...');
      const tools = toolRegistry.getOpenAiToolDefinitions();

      // First LLM call
      let response = await this._chatCompletion(messages, tools);
      const executedTools = [];

      // Loop for tool calls (up to 4 consecutive tool steps)
      let iterations = 0;
      while (response.tool_calls && response.tool_calls.length > 0 && iterations < 4) {
        // Check if task was cancelled mid-flight
        if (actionEngine.isCancelled()) {
          const cancelMsg = "Task cancelled during execution.";
          return { spokenText: cancelMsg, displayText: "Cancelled", toolCalls: executedTools };
        }

        iterations++;
        messages.push(response);

        for (const toolCall of response.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            console.error('Failed to parse tool arguments:', e);
          }

          onStatusChange(`Executing ${fnName.replace(/_/g, ' ')}...`);
          const toolResult = await toolRegistry.executeTool(fnName, fnArgs);
          executedTools.push({ name: fnName, args: fnArgs, result: toolResult });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }

        onStatusChange('Finalizing...');
        response = await this._chatCompletion(messages, tools);
      }

      const rawReply = response.content || 'Task completed.';
      const cleanReply = this.cleanSpokenOutput(rawReply);

      memoryService.addConversationTurn('assistant', cleanReply, domain);

      activityLogger.logTurn({
        input: userText,
        actions: executedTools,
        output: cleanReply,
        durationMs: Date.now() - startTime,
        status: 'SUCCESS'
      });

      return {
        spokenText: cleanReply,
        displayText: cleanReply,
        toolCalls: executedTools
      };
    } catch (err) {
      console.error('AiOrchestrator error:', err);
      const errMsg = `Diagnostic notice: ${err.message}`;

      activityLogger.logTurn({
        input: userText,
        actions: [],
        output: errMsg,
        durationMs: Date.now() - startTime,
        status: `ERROR: ${err.message}`
      });

      return {
        spokenText: errMsg,
        displayText: `Error: ${err.message}`,
        toolCalls: []
      };
    }
  }

  /**
   * Synthesize speech using OpenAI TTS API with markdown stripped and error fallback
   */
  async synthesizeSpeech(text) {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    const cleanedText = this.cleanSpokenOutput(text);
    if (!cleanedText) return null;

    return new Promise((resolve) => {
      const payload = JSON.stringify({
        model: 'tts-1',
        input: cleanedText.slice(0, 1000),
        voice: config.voice || 'alloy',
        response_format: 'mp3'
      });

      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/audio/speech',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 6000
      }, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          resolve(`data:audio/mp3;base64,${base64}`);
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.write(payload);
      req.end();
    });
  }

  _chatCompletion(messages, tools) {
    const apiKey = this.getApiKey();
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model: this.model,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        temperature: 0.3,
        max_tokens: 450
      });

      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 12000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.error) {
              return reject(new Error(data.error.message || 'OpenAI API Error'));
            }
            if (data.choices && data.choices.length > 0) {
              resolve(data.choices[0].message);
            } else {
              reject(new Error('No response from AI model'));
            }
          } catch (e) {
            reject(new Error(`Failed to parse AI response: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(14000, () => {
        req.destroy();
        reject(new Error('AI request timed out'));
      });
      req.write(payload);
      req.end();
    });
  }
}

module.exports = new AiOrchestrator();
