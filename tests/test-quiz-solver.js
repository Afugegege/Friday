const toolRegistry = require('../src/tools/tool-registry');
const quizSolverService = require('../src/services/quiz-solver-service');

console.log('=== TESTING QUIZ SOLVER INTEGRATION ===');

// 1. Verify tool registration
const quizTool = toolRegistry.getTool('solve_screen_quiz');
if (!quizTool) {
  console.error('[FAIL] solve_screen_quiz tool not registered');
  process.exit(1);
}
console.log('[PASS] solve_screen_quiz tool registered with description:', quizTool.description);

// 2. Verify service methods
if (typeof quizSolverService.solveScreenQuiz !== 'function') {
  console.error('[FAIL] solveScreenQuiz is not a function');
  process.exit(1);
}
console.log('[PASS] quizSolverService.solveScreenQuiz is available');

console.log('=== QUIZ SOLVER INTEGRATION VERIFIED ===');
