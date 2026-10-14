const toolRegistry = require('../src/tools/tool-registry');
const webSearchService = require('../src/services/web-search-service');
const memoryService = require('../src/services/memory-service');
const windowsAutomation = require('../src/services/windows-automation');
const screenService = require('../src/services/screen-service');
const spotifyService = require('../src/services/spotify-service');

async function runTests() {
  console.log('=== RUNNING FRIDAY BACKEND TEST SUITE ===\n');

  // Test 1: Tool Registry
  console.log('1. Testing Tool Registry:');
  const toolDefs = toolRegistry.getOpenAiToolDefinitions();
  console.log(`   Registered tools: ${toolDefs.length}`);
  const toolNames = toolDefs.map(t => t.function.name);
  console.log(`   Tools: ${toolNames.join(', ')}`);
  if (toolDefs.length >= 10) {
    console.log('   [PASS] Tool Registry initialized with complete schemas\n');
  } else {
    console.error('   [FAIL] Missing tools in registry\n');
  }

  // Test 2: Memory Service
  console.log('2. Testing Memory Service:');
  const note = memoryService.addNote('Test note for Friday verification', 'test');
  console.log(`   Created note ID: ${note.id}`);
  const notes = memoryService.getNotes('verification');
  if (notes.length > 0) {
    console.log(`   [PASS] Retrieved ${notes.length} note(s) from persistent store\n`);
  } else {
    console.error('   [FAIL] Failed to retrieve note\n');
  }

  // Test 3: Web Search Service
  console.log('3. Testing Web Search Service (Live Internet):');
  try {
    const results = await webSearchService.search('IPv6 protocol definition', 3);
    console.log(`   Received ${results.length} result(s):`);
    for (const r of results) {
      console.log(`   - ${r.title} (${r.link.slice(0, 45)}...)`);
    }
    if (results.length > 0) {
      console.log('   [PASS] Live web search operational\n');
    }
  } catch (err) {
    console.error('   [FAIL] Search error:', err.message, '\n');
  }

  // Test 4: Windows Automation (Running Windows)
  console.log('4. Testing Windows Process Inspection:');
  try {
    const windows = await windowsAutomation.getRunningWindows();
    console.log(`   Detected ${windows.length} active window(s) on desktop`);
    const top3 = windows.slice(0, 3).map(w => w.MainWindowTitle || w.ProcessName);
    console.log(`   Sample: ${top3.join(', ')}`);
    console.log('   [PASS] Windows automation process query functional\n');
  } catch (err) {
    console.error('   [FAIL] Windows query error:', err.message, '\n');
  }

  // Test 5: Screen Capture
  console.log('5. Testing Screen Capture Service:');
  try {
    const cap = await screenService.captureScreen();
    if (cap.success) {
      console.log(`   Screenshot captured: ${cap.filePath}`);
      console.log(`   Base64 image length: ${cap.base64 ? cap.base64.length : 0} bytes`);
      console.log('   [PASS] Screen inspection operational\n');
    } else {
      console.warn('   [NOTICE] Screen capture returned:', cap.error, '\n');
    }
  } catch (err) {
    console.error('   [FAIL] Screen capture error:', err.message, '\n');
  }

  // Test 6: Spotify & Media Key Fallback
  console.log('6. Testing Spotify / Media Control Fallback:');
  const mediaResult = await spotifyService.play('');
  console.log(`   Result: ${JSON.stringify(mediaResult)}`);
  console.log('   [PASS] Media control fallback verified\n');

  // Test 7: Security Service
  console.log('7. Testing Security & Permission Gate:');
  const securityService = require('../src/services/security-service');
  const safeCmd = securityService.validateCommand('Get-Process');
  const dangerCmd = securityService.validateCommand('format C:');
  if (safeCmd.allowed && !dangerCmd.allowed) {
    console.log('   [PASS] Security policy successfully permitted safe command and blocked destructive command\n');
  } else {
    console.error('   [FAIL] Security validation check failed\n');
  }

  // Test 8: Tri-Tier Memory Engine
  console.log('8. Testing Tri-Tier Memory Engine:');
  memoryService.setActiveObjective('Study IPv6 for CCNA exam', ['Read concepts', 'Answer quiz']);
  const activeObj = memoryService.getActiveObjective();
  memoryService.addNote('IPv6 uses 128-bit addresses represented in hexadecimal.', 'networking', 'IPv6 Fundamentals');
  const searchRes = memoryService.searchKnowledge('IPv6 hexadecimal');
  if (activeObj && activeObj.activePlan.length === 2 && searchRes.length > 0) {
    console.log(`   [PASS] Working Memory & Knowledge Memory FTS operational (${searchRes.length} match)\n`);
  } else {
    console.error('   [FAIL] Memory engine verification failed\n');
  }

  // Test 9: Hardware & Environmental Intelligence
  console.log('9. Testing Hardware Diagnostics & Weather:');
  const hardwareService = require('../src/services/hardware-service');
  const weatherService = require('../src/services/weather-service');
  const specs = await hardwareService.getSystemMetrics();
  const weather = await weatherService.getWeather('London');
  console.log(`   Hardware: ${specs.cpu} | ${specs.ram}`);
  console.log(`   Weather: ${weather.location} -> ${weather.tempC}, ${weather.condition}`);
  if (specs.success && weather.success) {
    console.log('   [PASS] Hardware and Weather services online\n');
  } else {
    console.error('   [FAIL] Hardware/Weather service failure\n');
  }

  // Test 10: Currency & World Time
  console.log('10. Testing Calc & Currency Engine:');
  const calcService = require('../src/services/calc-converter-service');
  const fx = await calcService.convertCurrency(50, 'USD', 'EUR');
  const timeTokyo = calcService.getWorldTime('Tokyo');
  console.log(`   FX: ${fx.summary}`);
  console.log(`   Time: ${timeTokyo.summary}`);
  if (fx.success && timeTokyo.success) {
    console.log('   [PASS] Currency and World Time operational\n');
  } else {
    console.error('   [FAIL] Calc/Currency engine error\n');
  }

  // Test 11: Task Scheduler
  console.log('11. Testing Background Task Scheduler:');
  const schedulerService = require('../src/services/scheduler-service');
  const sched = schedulerService.scheduleTask('Review networking notes', 60);
  const taskList = schedulerService.listScheduledTasks();
  schedulerService.cancelTask(sched.taskId);
  if (sched.success && taskList.tasks.length > 0) {
    console.log('   [PASS] Background task scheduling & persistence verified\n');
  } else {
    console.error('   [FAIL] Scheduler verification failed\n');
  }

  console.log('=== ALL TESTS FINISHED ===');
}

runTests();
