const spotifyService = require('../services/spotify-service');
const webSearchService = require('../services/web-search-service');
const windowsAutomation = require('../services/windows-automation');
const screenService = require('../services/screen-service');
const memoryService = require('../services/memory-service');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.registerDefaultTools();
  }

  register(tool) {
    if (!tool.name || !tool.description || !tool.parameters || !tool.handler) {
      throw new Error(`Invalid tool registration for: ${tool.name || 'unnamed'}`);
    }
    this.tools.set(tool.name, tool);
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getOpenAiToolDefinitions() {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  async executeTool(name, args = {}) {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        status: 'failed',
        error: `Tool "${name}" is not registered in Friday.`
      };
    }

    try {
      const result = await tool.handler(args);
      return {
        status: 'executed',
        tool: name,
        result
      };
    } catch (err) {
      console.error(`Error executing tool ${name}:`, err);
      return {
        status: 'failed',
        tool: name,
        error: err.message
      };
    }
  }

  registerDefaultTools() {
    // 1. SPOTIFY: PLAY
    this.register({
      name: 'spotify_play',
      description: 'Plays music on Spotify or resumes playback. Can specify a song name or artist.',
      parameters: {
        type: 'object',
        properties: {
          track: {
            type: 'string',
            description: 'The title and/or artist of the song to play (e.g. "Perfect by Ed Sheeran"). Leave empty to resume.'
          }
        }
      },
      handler: async ({ track }) => {
        return await spotifyService.play(track || '');
      }
    });

    // 2. SPOTIFY: PAUSE
    this.register({
      name: 'spotify_pause',
      description: 'Pauses active Spotify or media playback.',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        return await spotifyService.pause();
      }
    });

    // 3. SPOTIFY: NEXT TRACK
    this.register({
      name: 'spotify_next',
      description: 'Skips to the next track on Spotify or media player.',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        return await spotifyService.next();
      }
    });

    // 4. SPOTIFY: PREVIOUS TRACK
    this.register({
      name: 'spotify_previous',
      description: 'Goes back to the previous track on Spotify or media player.',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        return await spotifyService.previous();
      }
    });

    // 5. WEB SEARCH
    this.register({
      name: 'web_search',
      description: 'Searches the live internet for current information, news, explanations, facts, or comparisons.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query or keywords to look up.'
          }
        },
        required: ['query']
      },
      handler: async ({ query }) => {
        const results = await webSearchService.search(query, 5);
        return {
          query,
          resultsCount: results.length,
          results
        };
      }
    });

    // 6. FETCH WEB PAGE
    this.register({
      name: 'fetch_web_page',
      description: 'Retrieves and parses text content from a specific web page URL for in-depth analysis.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The full URL of the webpage to read.'
          }
        },
        required: ['url']
      },
      handler: async ({ url }) => {
        const content = await webSearchService.fetchPageContent(url);
        return { url, content };
      }
    });

    // 7. LAUNCH APP
    this.register({
      name: 'launch_app',
      description: 'Opens or launches a desktop application on Windows (e.g. spotify, vscode, notepad, chrome, browser, terminal, calc, explorer).',
      parameters: {
        type: 'object',
        properties: {
          appName: {
            type: 'string',
            description: 'The name or executable of the application to launch.'
          }
        },
        required: ['appName']
      },
      handler: async ({ appName }) => {
        return await windowsAutomation.launchApp(appName);
      }
    });

    // 8. FIND FILES
    this.register({
      name: 'find_files',
      description: 'Searches the computer for files matching a keyword, filename, or project name in Documents, Projects, Desktop, or Downloads.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The file name, partial name, or extension to search for.'
          }
        },
        required: ['query']
      },
      handler: async ({ query }) => {
        const files = await windowsAutomation.searchFiles(query);
        return {
          query,
          found: files.length,
          files
        };
      }
    });

    // 9. OPEN FILE
    this.register({
      name: 'open_file',
      description: 'Opens a local file in its default Windows application.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The full absolute path to the file to open.'
          }
        },
        required: ['filePath']
      },
      handler: async ({ filePath }) => {
        return await windowsAutomation.openFile(filePath);
      }
    });

    // 10. READ DOCUMENT
    this.register({
      name: 'read_document',
      description: 'Reads the text content of a local document or code file.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The path of the file to inspect.'
          }
        },
        required: ['filePath']
      },
      handler: async ({ filePath }) => {
        return await windowsAutomation.readFileContent(filePath);
      }
    });

    // 11. SAVE NOTE / REMINDER
    this.register({
      name: 'save_note',
      description: 'Stores a note, study reminder, or persistent information into Friday’s memory.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The note text or information to remember.'
          },
          category: {
            type: 'string',
            description: 'Optional category (e.g. study, work, reminder, music).'
          }
        },
        required: ['content']
      },
      handler: async ({ content, category }) => {
        const note = memoryService.addNote(content, category || 'general');
        // Also save to disk if extensive
        await windowsAutomation.saveDocument('Friday_Notes', `[${new Date().toLocaleString()}] ${content}\n`);
        return { success: true, note };
      }
    });

    // 12. GET NOTES
    this.register({
      name: 'get_notes',
      description: 'Retrieves saved notes or reminders from Friday’s persistent memory.',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description: 'Optional keyword to filter notes.'
          }
        }
      },
      handler: async ({ filter }) => {
        const notes = memoryService.getNotes(filter || '');
        return { count: notes.length, notes };
      }
    });

    // 13. INSPECT SCREEN (VISION)
    this.register({
      name: 'inspect_screen',
      description: 'Captures the current screen so Friday can see what the user is looking at (e.g. PDF, webpage, error message).',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        const cap = await screenService.captureScreen();
        return {
          success: cap.success,
          filePath: cap.filePath,
          hasImageData: Boolean(cap.base64)
        };
      }
    });

    // 14. GET RUNNING APPLICATIONS
    this.register({
      name: 'get_running_apps',
      description: 'Lists currently open application windows on the desktop.',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        const windows = await windowsAutomation.getRunningWindows();
        return { windows };
      }
    });

    // 15. SYSTEM ACTION
    this.register({
      name: 'system_action',
      description: 'Controls Windows system state: lock workstation, minimize all windows, restore windows, check battery, volume_up, volume_down, mute.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['lock', 'minimize_all', 'undo_minimize', 'battery', 'volume_up', 'volume_down', 'mute'],
            description: 'The system action to perform.'
          }
        },
        required: ['action']
      },
      handler: async ({ action }) => {
        return await windowsAutomation.systemAction(action);
      }
    });

    // 16. KEYBOARD SHORTCUT
    this.register({
      name: 'keyboard_shortcut',
      description: 'Executes a keyboard shortcut combination on Windows (e.g. "ctrl+c", "ctrl+v", "ctrl+w", "alt+f4", "enter", "space").',
      parameters: {
        type: 'object',
        properties: {
          keys: {
            type: 'string',
            description: 'The key combination to press.'
          }
        },
        required: ['keys']
      },
      handler: async ({ keys }) => {
        return await windowsAutomation.sendKeyboardShortcut(keys);
      }
    });

    // 17. OPEN URL
    this.register({
      name: 'open_url',
      description: 'Opens any website or URL in the default web browser (e.g. "https://youtube.com", "github.com").',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The website URL to open.'
          }
        },
        required: ['url']
      },
      handler: async ({ url }) => {
        return await windowsAutomation.openUrl(url);
      }
    });

    // 18. EXECUTE COMMAND (POWERSHELL)
    this.register({
      name: 'execute_command',
      description: 'Executes a safe PowerShell command directly on Windows for system diagnostics, automation, or task execution.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The PowerShell command to run.'
          }
        },
        required: ['command']
      },
      handler: async ({ command }) => {
        const securityService = require('../services/security-service');
        const validation = securityService.validateCommand(command);
        if (!validation.allowed) {
          return { success: false, error: `Command blocked by security policy: ${validation.reason}` };
        }
        return await windowsAutomation.executeShell(command);
      }
    });

    // 19. CLICK SCREEN (MOUSE)
    this.register({
      name: 'click_screen',
      description: 'Clicks the mouse at specific screen coordinates (x, y). Supports single click, double click, and right click.',
      parameters: {
        type: 'object',
        properties: {
          x: {
            type: 'number',
            description: 'Horizontal pixel coordinate.'
          },
          y: {
            type: 'number',
            description: 'Vertical pixel coordinate.'
          },
          clickType: {
            type: 'string',
            enum: ['click', 'double_click', 'right_click'],
            description: 'The type of click to perform (default: "click").'
          }
        },
        required: ['x', 'y']
      },
      handler: async ({ x, y, clickType = 'click' }) => {
        if (clickType === 'double_click') return await screenService.doubleClick(x, y);
        if (clickType === 'right_click') return await screenService.rightClick(x, y);
        return await screenService.clickMouse(x, y);
      }
    });

    // 20. TYPE TEXT (KEYBOARD)
    this.register({
      name: 'type_text',
      description: 'Types text into the currently active or clicked input box on Google, a website, a document, or a form. Can automatically press Enter.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The exact string to type.'
          },
          pressEnter: {
            type: 'boolean',
            description: 'Whether to press Enter after typing.'
          }
        },
        required: ['text']
      },
      handler: async ({ text, pressEnter = false }) => {
        const res = await screenService.sendKeyboardText(text);
        if (pressEnter) {
          await screenService.sendKey('enter');
        }
        return res;
      }
    });

    // 21. PRESS KEY
    this.register({
      name: 'press_key',
      description: 'Presses a specific keyboard key like Enter, Tab, Escape, Space, Backspace, Up, Down.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            enum: ['enter', 'tab', 'escape', 'space', 'backspace', 'up', 'down', 'left', 'right'],
            description: 'The key to press.'
          }
        },
        required: ['key']
      },
      handler: async ({ key }) => {
        return await screenService.sendKey(key);
      }
    });

    // 22. SCROLL SCREEN
    this.register({
      name: 'scroll_screen',
      description: 'Scrolls the screen or active web page up or down.',
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['up', 'down'],
            description: 'Scroll direction.'
          },
          amount: {
            type: 'number',
            description: 'Intensity of scroll (default: 300).'
          }
        },
        required: ['direction']
      },
      handler: async ({ direction, amount = 300 }) => {
        const delta = direction === 'up' ? Math.abs(amount) : -Math.abs(amount);
        return await screenService.scroll(delta);
      }
    });

    // 23. TRAVEL SEARCH & BOOKING PLATFORMS
    this.register({
      name: 'travel_search',
      description: 'Opens dedicated travel, flight, and hotel booking platforms (Google Flights, Booking.com, Skyscanner, Airbnb, TripAdvisor, Google Maps) pre-configured for a destination or trip.',
      parameters: {
        type: 'object',
        properties: {
          destination: {
            type: 'string',
            description: 'The travel destination (e.g. "Greece", "Athens", "Santorini", "Tokyo").'
          },
          platform: {
            type: 'string',
            enum: ['google_flights', 'booking', 'skyscanner', 'airbnb', 'tripadvisor', 'google_maps'],
            description: 'The booking or research platform to launch.'
          },
          details: {
            type: 'string',
            description: 'Optional additional parameters like dates or preferences.'
          }
        },
        required: ['destination', 'platform']
      },
      handler: async ({ destination, platform, details = '' }) => {
        const destEnc = encodeURIComponent(destination);
        const urlMap = {
          'google_flights': `https://www.google.com/travel/flights?q=flights+to+${destEnc}`,
          'booking': `https://www.booking.com/searchresults.html?ss=${destEnc}`,
          'skyscanner': `https://www.skyscanner.com/transport/flights/everywhere/${destEnc}`,
          'airbnb': `https://www.airbnb.com/s/${destEnc}/homes`,
          'tripadvisor': `https://www.tripadvisor.com/Search?q=${destEnc}`,
          'google_maps': `https://www.google.com/maps/search/${destEnc}`
        };

        const targetUrl = urlMap[platform.toLowerCase()] || `https://www.google.com/travel/flights?q=flights+to+${destEnc}`;
        const res = await windowsAutomation.openUrl(targetUrl);
        return {
          success: res.success,
          platform,
          destination,
          url: targetUrl,
          message: `Opened ${platform.replace('_', ' ')} for ${destination}`
        };
      }
    });

    // 24. SOLVE SCREEN QUIZ
    this.register({
      name: 'solve_screen_quiz',
      description: 'Solves the multiple-choice or single-choice question currently visible on screen (e.g. Cisco CCNA, CompTIA, AWS, university tests). Analyzes question and options with GPT-4o vision, determines the technically correct answer, clicks the answer option, and automatically clicks Submit.',
      parameters: {
        type: 'object',
        properties: {
          autoSubmit: {
            type: 'boolean',
            description: 'Whether to click the Submit/Check button after selecting the option (default: true).'
          },
          questionHint: {
            type: 'string',
            description: 'Optional question number or context hint from the user.'
          }
        }
      },
      handler: async ({ autoSubmit = true, questionHint = '' }) => {
        const quizSolverService = require('../services/quiz-solver-service');
        return await quizSolverService.solveScreenQuiz({ autoSubmit, questionHint });
      }
    });

    // 25. GET WEATHER
    this.register({
      name: 'get_weather',
      description: 'Fetches real-time weather, temperature, humidity, wind, and forecast for any city or location in the world.',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city or location name (e.g. "London", "Tokyo", "Kuala Lumpur", "New York").'
          }
        },
        required: ['location']
      },
      handler: async ({ location }) => {
        const weatherService = require('../services/weather-service');
        return await weatherService.getWeather(location);
      }
    });

    // 26. GET SYSTEM SPECS & HARDWARE HEALTH
    this.register({
      name: 'get_system_specs',
      description: 'Queries live PC hardware metrics: CPU model and core count, RAM utilization, C: drive disk space free, battery percentage, and uptime.',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        const hardwareService = require('../services/hardware-service');
        return await hardwareService.getSystemMetrics();
      }
    });

    // 27. GET NETWORK DIAGNOSTICS
    this.register({
      name: 'get_network_info',
      description: 'Checks local IPv4 address, public external IP, and internet ping latency.',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        const hardwareService = require('../services/hardware-service');
        return await hardwareService.getNetworkDiagnostics();
      }
    });

    // 28. EMPTY RECYCLE BIN
    this.register({
      name: 'empty_recycle_bin',
      description: 'Cleans and empties the Windows Recycle Bin to free up disk space.',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        const hardwareService = require('../services/hardware-service');
        return await hardwareService.emptyRecycleBin();
      }
    });

    // 29. SET VOLUME LEVEL
    this.register({
      name: 'set_volume_level',
      description: 'Sets the master PC volume to an exact percentage (0% to 100%).',
      parameters: {
        type: 'object',
        properties: {
          percent: {
            type: 'number',
            description: 'The target volume percentage from 0 to 100.'
          }
        },
        required: ['percent']
      },
      handler: async ({ percent }) => {
        const hardwareService = require('../services/hardware-service');
        return await hardwareService.setVolumeLevel(percent);
      }
    });

    // 30. READ CLIPBOARD
    this.register({
      name: 'read_clipboard',
      description: 'Reads and retrieves whatever text, URL, code, or content is currently copied to the Windows clipboard.',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        const clipboardService = require('../services/clipboard-service');
        return await clipboardService.readClipboard();
      }
    });

    // 31. WRITE CLIPBOARD
    this.register({
      name: 'write_clipboard',
      description: 'Copies text, code, summary, or data to the Windows clipboard.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to copy to clipboard.'
          }
        },
        required: ['text']
      },
      handler: async ({ text }) => {
        const clipboardService = require('../services/clipboard-service');
        return await clipboardService.writeClipboard(text);
      }
    });

    // 32. CONVERT CURRENCY
    this.register({
      name: 'convert_currency',
      description: 'Converts currencies in real-time with live exchange rates (e.g. USD, EUR, GBP, MYR, JPY, SGD, CAD, AUD).',
      parameters: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: 'The monetary amount to convert.'
          },
          from: {
            type: 'string',
            description: '3-letter currency code to convert from (e.g. "USD").'
          },
          to: {
            type: 'string',
            description: '3-letter currency code to convert to (e.g. "MYR", "EUR").'
          }
        },
        required: ['amount', 'from', 'to']
      },
      handler: async ({ amount, from, to }) => {
        const calcService = require('../services/calc-converter-service');
        return await calcService.convertCurrency(amount, from, to);
      }
    });

    // 33. GET WORLD TIME
    this.register({
      name: 'get_world_time',
      description: 'Gets current local time and date for any major world city or timezone (e.g. Tokyo, New York, London, Paris, Sydney).',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'The city or timezone name.'
          }
        },
        required: ['city']
      },
      handler: async ({ city }) => {
        const calcService = require('../services/calc-converter-service');
        return calcService.getWorldTime(city);
      }
    });

    // 34. CALCULATE MATH
    this.register({
      name: 'calculate',
      description: 'Evaluates mathematical calculations, percentages, formulas, and arithmetic expressions accurately.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression (e.g. "(120 * 4) + 15%", "2^10", "sqrt(144)").'
          }
        },
        required: ['expression']
      },
      handler: async ({ expression }) => {
        const calcService = require('../services/calc-converter-service');
        return calcService.calculateMath(expression);
      }
    });

    // 35. SET TIMER
    this.register({
      name: 'set_timer',
      description: 'Sets a countdown timer with desktop notification and audio alarm alert (e.g. 5 minutes, 30 seconds).',
      parameters: {
        type: 'object',
        properties: {
          durationMinutes: {
            type: 'number',
            description: 'Duration in minutes (e.g. 5, 0.5 for 30s, 15, 60).'
          },
          label: {
            type: 'string',
            description: 'Optional label or purpose for the timer.'
          }
        },
        required: ['durationMinutes']
      },
      handler: async ({ durationMinutes, label = 'Timer' }) => {
        const timerService = require('../services/timer-service');
        return timerService.setTimer(durationMinutes, label);
      }
    });

    // 36. LIST TIMERS
    this.register({
      name: 'list_timers',
      description: 'Lists all currently running countdown timers and their remaining time.',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        const timerService = require('../services/timer-service');
        return timerService.listTimers();
      }
    });

    // 37. CANCEL TIMER
    this.register({
      name: 'cancel_timer',
      description: 'Cancels a specific running timer or cancels all active timers.',
      parameters: {
        type: 'object',
        properties: {
          timerId: {
            type: 'string',
            description: 'Optional specific timer ID to cancel. Leave empty to cancel all.'
          }
        }
      },
      handler: async ({ timerId }) => {
        const timerService = require('../services/timer-service');
        return timerService.cancelTimer(timerId);
      }
    });

    // 38. CREATE FOLDER
    this.register({
      name: 'create_folder',
      description: 'Creates a new folder or directory at a specified path (e.g. "Desktop/MyProject", "Downloads/Work").',
      parameters: {
        type: 'object',
        properties: {
          folderPath: {
            type: 'string',
            description: 'The path of the folder to create.'
          }
        },
        required: ['folderPath']
      },
      handler: async ({ folderPath }) => {
        const fileManagerService = require('../services/file-manager-service');
        return await fileManagerService.createFolder(folderPath);
      }
    });

    // 39. LIST RECENT FILES
    this.register({
      name: 'list_recent_files',
      description: 'Lists recently modified or downloaded files in Downloads, Desktop, or Documents.',
      parameters: {
        type: 'object',
        properties: {
          folder: {
            type: 'string',
            description: 'Folder name: "downloads", "desktop", or "documents" (default: "downloads").'
          },
          limit: {
            type: 'number',
            description: 'Number of recent files to return (default: 8).'
          }
        }
      },
      handler: async ({ folder = 'downloads', limit = 8 }) => {
        const fileManagerService = require('../services/file-manager-service');
        return await fileManagerService.listRecentFiles(folder, limit);
      }
    });

    // 40. COMPOSE EMAIL
    this.register({
      name: 'compose_email',
      description: 'Opens Gmail or default email client pre-filled with recipient, subject line, and email body.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address.'
          },
          subject: {
            type: 'string',
            description: 'Email subject.'
          },
          body: {
            type: 'string',
            description: 'Email body text.'
          },
          platform: {
            type: 'string',
            enum: ['gmail', 'default'],
            description: 'Mail platform (default: "gmail").'
          }
        }
      },
      handler: async (options) => {
        const commService = require('../services/communication-service');
        return await commService.composeEmail(options);
      }
    });

    // 41. SCHEDULE CALENDAR
    this.register({
      name: 'open_calendar',
      description: 'Opens Google Calendar to view schedule or create an event.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Event title to schedule.'
          }
        }
      },
      handler: async ({ title = '' }) => {
        const commService = require('../services/communication-service');
        return await commService.scheduleCalendar(title);
      }
    });

    // 42. GIT INSPECTION
    this.register({
      name: 'git_inspect',
      description: 'Runs Git status, diff, log, or branch check on a local repository.',
      parameters: {
        type: 'object',
        properties: {
          repoPath: {
            type: 'string',
            description: 'Path to git repository (default: current directory).'
          },
          command: {
            type: 'string',
            enum: ['status', 'diff', 'log', 'branch'],
            description: 'Git inspection command (default: "status").'
          }
        }
      },
      handler: async ({ repoPath = process.cwd(), command = 'status' }) => {
        const developerService = require('../services/developer-service');
        return await developerService.gitInspection(repoPath, command);
      }
    });

    // 43. DIAGNOSE PROJECT
    this.register({
      name: 'diagnose_project',
      description: 'Scans a project directory for build logs, compilation errors, and code issues (e.g. C++, Python, Rust).',
      parameters: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to project directory.'
          }
        }
      },
      handler: async ({ projectPath = process.cwd() }) => {
        const developerService = require('../services/developer-service');
        return await developerService.findProjectErrors(projectPath);
      }
    });

    // 44. CONDUCT RESEARCH
    this.register({
      name: 'conduct_research',
      description: 'Executes comprehensive multi-source internet research on a technical, study, or career topic with citation gathering.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The research topic (e.g. "IPv6 protocol architecture", "Cybersecurity internships in Ireland").'
          },
          searchCount: {
            type: 'number',
            description: 'Number of sources to retrieve (default: 4).'
          }
        },
        required: ['topic']
      },
      handler: async ({ topic, searchCount = 4 }) => {
        const researchService = require('../services/research-service');
        return await researchService.conductResearch(topic, searchCount);
      }
    });

    // 45. SAVE RESEARCH NOTES
    this.register({
      name: 'save_research_notes',
      description: 'Saves structured research summaries or revision notes to markdown and stores in Knowledge Memory.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Title or topic of notes.'
          },
          markdownContent: {
            type: 'string',
            description: 'Complete formatted markdown text.'
          },
          targetFolder: {
            type: 'string',
            description: 'Folder to store file: "documents", "desktop", etc.'
          }
        },
        required: ['topic', 'markdownContent']
      },
      handler: async ({ topic, markdownContent, targetFolder = 'documents' }) => {
        const researchService = require('../services/research-service');
        return await researchService.saveResearchNotes(topic, markdownContent, targetFolder);
      }
    });

    // 46. SCHEDULE TASK
    this.register({
      name: 'schedule_task',
      description: 'Schedules a background task or reminder that persists across application restarts (e.g. in 15 minutes, 2 hours).',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'The reminder or task description.'
          },
          delayMinutes: {
            type: 'number',
            description: 'Delay in minutes.'
          }
        },
        required: ['description', 'delayMinutes']
      },
      handler: async ({ description, delayMinutes }) => {
        const schedulerService = require('../services/scheduler-service');
        return schedulerService.scheduleTask(description, delayMinutes);
      }
    });

    // 47. LIST SCHEDULED TASKS
    this.register({
      name: 'list_scheduled_tasks',
      description: 'Lists all pending scheduled tasks and background reminders.',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        const schedulerService = require('../services/scheduler-service');
        return schedulerService.listScheduledTasks();
      }
    });

    // 48. CANCEL SCHEDULED TASK
    this.register({
      name: 'cancel_scheduled_task',
      description: 'Cancels a pending scheduled task.',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The task ID to cancel.'
          }
        },
        required: ['taskId']
      },
      handler: async ({ taskId }) => {
        const schedulerService = require('../services/scheduler-service');
        return schedulerService.cancelTask(taskId);
      }
    });
  }
}

module.exports = new ToolRegistry();
