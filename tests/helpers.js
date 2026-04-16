// Shared test harness for brewagent test files
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Create a test environment with isolated temp dir and HOME override.
 * Returns { tmpDir, origHome, cliPath, cleanup }.
 */
function createTestEnv(prefix) {
  const tmpDir = path.join(os.tmpdir(), `brewagent-${prefix}-` + Date.now());
  const origHome = process.env.HOME;
  fs.mkdirSync(tmpDir, { recursive: true });
  process.env.HOME = tmpDir;

  const cliPath = path.join(__dirname, '..', 'src', 'cli.js');
  const rootDir = path.join(__dirname, '..');

  function cleanup() {
    process.env.HOME = origHome;
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
  }

  return { tmpDir, origHome, cliPath, rootDir, cleanup };
}

/**
 * Create a test runner with pass/fail/total counters.
 * Returns { test, assert, assertEqual, printSummary }.
 */
function createTestRunner() {
  let passed = 0;
  let failed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } catch (err) {
      failed++;
      console.log(`  \x1b[31m✗\x1b[0m ${name}`);
      console.log(`    ${err.message}`);
    }
  }

  function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
  }

  function assertEqual(a, b, msg) {
    if (a !== b) throw new Error(msg || `Expected "${b}", got "${a}"`);
  }

  /** Manually record an async test result (for tests that must be awaited). */
  function recordAsync(didPass) {
    total++;
    if (didPass) passed++;
    else failed++;
  }

  function printSummary() {
    console.log('\n  ─────────────────────────────────');
    console.log(`  ${passed} passing, ${failed} failing, ${total} total`);

    if (failed > 0) {
      console.log('\x1b[31m  TESTS FAILED\x1b[0m\n');
      process.exit(1);
    } else {
      console.log('\x1b[32m  ALL TESTS PASSED\x1b[0m\n');
    }
  }

  return { test, assert, assertEqual, recordAsync, printSummary };
}

module.exports = { createTestEnv, createTestRunner };
