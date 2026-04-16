#!/usr/bin/env node
// Unit tests for agentbox core functionality
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

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

// Setup temp dirs
const tmpDir = path.join(os.tmpdir(), 'agentbox-test-' + Date.now());
const origHome = process.env.HOME;
fs.mkdirSync(tmpDir, { recursive: true });

// Override HOME so we don't pollute real ~/.agentbox
process.env.HOME = tmpDir;

// Require modules after setting HOME
const { parseAgentId, ensureDirs, listInstalledAgents } = require('../src/utils/fs');
const { readManifest, readAndValidateManifest, writeManifest, packAgent, unpackAgent, inspectAgent, validateManifest } = require('../src/utils/agent-file');
const { sanitizeManifestField } = require('../src/utils/validate');

const cliPath = path.join(__dirname, '..', 'src', 'cli.js');

async function runAllTests() {
  console.log('\n\x1b[1m  agentbox unit tests\x1b[0m\n');

  // ─── parseAgentId ───
  console.log('  \x1b[36mparseAgentId\x1b[0m');

  test('parses scoped name @user/agent', () => {
    const result = parseAgentId('@piyush/tax-agent');
    assertEqual(result.scope, 'piyush');
    assertEqual(result.name, 'tax-agent');
    assertEqual(result.fullName, '@piyush/tax-agent');
  });

  test('parses unscoped name', () => {
    const result = parseAgentId('my-agent');
    assertEqual(result.scope, null);
    assertEqual(result.name, 'my-agent');
    assertEqual(result.fullName, 'my-agent');
  });

  test('parses scoped name with underscores', () => {
    const result = parseAgentId('@my_user/my_agent');
    assertEqual(result.scope, 'my_user');
    assertEqual(result.name, 'my_agent');
  });

  // ─── ensureDirs ───
  console.log('\n  \x1b[36mensureDirs\x1b[0m');

  test('creates agentbox directories', () => {
    ensureDirs();
    assert(fs.existsSync(path.join(tmpDir, '.agentbox')), 'AGENTBOX_HOME should exist');
    assert(fs.existsSync(path.join(tmpDir, '.agentbox', 'registry')), 'REGISTRY_DIR should exist');
    assert(fs.existsSync(path.join(tmpDir, '.agentbox', 'agents')), 'INSTALLED_DIR should exist');
  });

  // ─── validateManifest ───
  console.log('\n  \x1b[36mvalidateManifest\x1b[0m');

  test('validates a correct manifest', () => {
    const manifest = {
      name: 'test-agent',
      version: '1.0.0',
      agent: { system_prompt: 'You are helpful.' },
    };
    const result = validateManifest(manifest);
    assert(result.valid, 'Should be valid');
    assertEqual(result.errors.length, 0);
  });

  test('rejects manifest without name', () => {
    const manifest = { version: '1.0.0', agent: { system_prompt: 'test' } };
    const result = validateManifest(manifest);
    assert(!result.valid, 'Should be invalid');
    assert(result.errors.includes('Missing required field: name'));
  });

  test('rejects manifest without version', () => {
    const manifest = { name: 'test', agent: { system_prompt: 'test' } };
    const result = validateManifest(manifest);
    assert(!result.valid);
    assert(result.errors.includes('Missing required field: version'));
  });

  test('rejects manifest without agent section', () => {
    const manifest = { name: 'test', version: '1.0.0' };
    const result = validateManifest(manifest);
    assert(!result.valid);
    assert(result.errors.includes('Missing required section: agent'));
  });

  test('rejects manifest without system_prompt', () => {
    const manifest = { name: 'test', version: '1.0.0', agent: {} };
    const result = validateManifest(manifest);
    assert(!result.valid);
    assert(result.errors.includes('Missing required field: agent.system_prompt'));
  });

  // ─── sanitizeManifestField ───
  console.log('\n  \x1b[36msanitizeManifestField\x1b[0m');

  test('passes through a clean name', () => {
    assertEqual(sanitizeManifestField('piyush'), 'piyush');
  });

  test('strips path traversal sequences', () => {
    const result = sanitizeManifestField('../../outside');
    assert(!result.includes('..'), 'Should not contain ".."');
    assert(!result.includes('/'), 'Should not contain "/"');
    assertEqual(result, 'outside');
  });

  test('strips backslash path separators', () => {
    const result = sanitizeManifestField('..\\..\\outside');
    assert(!result.includes('\\'), 'Should not contain backslash');
    assert(!result.includes('..'), 'Should not contain ".."');
  });

  test('returns _unknown for empty/null input', () => {
    assertEqual(sanitizeManifestField(''), '_unknown');
    assertEqual(sanitizeManifestField(null), '_unknown');
    assertEqual(sanitizeManifestField(undefined), '_unknown');
  });

  test('handles leading dots', () => {
    const result = sanitizeManifestField('...hidden');
    assert(!result.startsWith('.'), 'Should not start with dots');
  });

  // ─── readManifest / writeManifest ───
  console.log('\n  \x1b[36mreadManifest / writeManifest\x1b[0m');

  const testAgentDir = path.join(tmpDir, 'test-agent');
  fs.mkdirSync(testAgentDir, { recursive: true });

  test('writeManifest creates agent.yaml', () => {
    const manifest = {
      name: 'test-agent',
      version: '1.0.0',
      description: 'A test agent',
      author: 'tester',
      agent: {
        system_prompt: 'You are a test agent.',
        model: { provider: 'openai', name: 'gpt-4o-mini' },
        tools: [],
        knowledge: [],
      },
      metadata: { category: 'general', tags: ['test'] },
    };
    writeManifest(testAgentDir, manifest);
    assert(fs.existsSync(path.join(testAgentDir, 'agent.yaml')));
  });

  test('readManifest reads back correctly', () => {
    const manifest = readManifest(testAgentDir);
    assertEqual(manifest.name, 'test-agent');
    assertEqual(manifest.version, '1.0.0');
    assertEqual(manifest.agent.system_prompt, 'You are a test agent.');
    assertEqual(manifest.author, 'tester');
  });

  test('readManifest throws on missing directory', () => {
    let threw = false;
    try {
      readManifest('/nonexistent/path');
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Should throw on missing directory');
  });

  // ─── packAgent / unpackAgent / inspectAgent ───
  console.log('\n  \x1b[36mpackAgent / unpackAgent / inspectAgent\x1b[0m');

  // Add a knowledge file
  const knowledgeDir = path.join(testAgentDir, 'knowledge');
  fs.mkdirSync(knowledgeDir, { recursive: true });
  fs.writeFileSync(path.join(knowledgeDir, 'facts.md'), '# Facts\n- Fact 1\n- Fact 2\n');

  const agentFilePath = path.join(tmpDir, 'test-agent-1.0.0.agent');

  // Pack — must await since it's async (handled manually outside test())
  total++;
  try {
    const result = await packAgent(testAgentDir, agentFilePath);
    assert(fs.existsSync(agentFilePath), '.agent file should exist');
    assert(result.size > 0, 'File should have content');
    assertEqual(result.manifest.name, 'test-agent');
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m packAgent creates .agent file`);
  } catch (err) {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m packAgent creates .agent file`);
    console.log(`    ${err.message}`);
  }

  test('inspectAgent reads .agent file metadata', () => {
    const info = inspectAgent(agentFilePath);
    assertEqual(info.manifest.name, 'test-agent');
    assertEqual(info.manifest.version, '1.0.0');
    assert(info.files.length >= 2, 'Should have at least agent.yaml and knowledge file');
    assert(info.totalSize > 0);
    assert(info.compressedSize > 0);

    const fileNames = info.files.map(f => f.name);
    assert(fileNames.includes('agent.yaml'), 'Should contain agent.yaml');
  });

  test('unpackAgent extracts to target directory', () => {
    const extractDir = path.join(tmpDir, 'extracted-agent');
    const manifest = unpackAgent(agentFilePath, extractDir);
    assertEqual(manifest.name, 'test-agent');
    assert(fs.existsSync(path.join(extractDir, 'agent.yaml')));
    assert(fs.existsSync(path.join(extractDir, 'knowledge', 'facts.md')));
  });

  test('inspectAgent throws on invalid .agent file', () => {
    // Create a file that's not a valid zip
    const badFile = path.join(tmpDir, 'bad.agent');
    fs.writeFileSync(badFile, 'this is not a zip file');
    let threw = false;
    try {
      inspectAgent(badFile);
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Should throw on invalid .agent file');
  });

  // ─── CLI integration tests ───
  console.log('\n  \x1b[36mCLI integration\x1b[0m');

  test('agentbox --version outputs version', () => {
    const output = execSync(`node ${cliPath} --version`, { encoding: 'utf-8' }).trim();
    assert(output.match(/^\d+\.\d+\.\d+$/), `Expected version string, got: ${output}`);
  });

  test('agentbox --help shows commands', () => {
    const output = execSync(`node ${cliPath} --help`, { encoding: 'utf-8' });
    assert(output.includes('init'), 'Should list init command');
    assert(output.includes('pack'), 'Should list pack command');
    assert(output.includes('install'), 'Should list install command');
    assert(output.includes('run'), 'Should list run command');
    assert(output.includes('publish'), 'Should list publish command');
    assert(output.includes('list'), 'Should list list command');
  });

  test('agentbox init creates agent directory', () => {
    const initDir = path.join(tmpDir, 'cli-test');
    fs.mkdirSync(initDir, { recursive: true });
    execSync(`node ${cliPath} init test-cli-agent`, { cwd: initDir, encoding: 'utf-8' });

    const agentDir = path.join(initDir, 'test-cli-agent');
    assert(fs.existsSync(agentDir), 'Agent dir should exist');
    assert(fs.existsSync(path.join(agentDir, 'agent.yaml')), 'agent.yaml should exist');
    assert(fs.existsSync(path.join(agentDir, 'knowledge')), 'knowledge/ should exist');
    assert(fs.existsSync(path.join(agentDir, 'tools')), 'tools/ should exist');
    assert(fs.existsSync(path.join(agentDir, 'README.md')), 'README.md should exist');
  });

  test('agentbox init with template sets correct category', () => {
    const initDir = path.join(tmpDir, 'cli-test-tmpl');
    fs.mkdirSync(initDir, { recursive: true });
    execSync(`node ${cliPath} init research-agent --template research`, { cwd: initDir, encoding: 'utf-8' });

    const manifest = readManifest(path.join(initDir, 'research-agent'));
    assertEqual(manifest.metadata.category, 'research');
    assert(manifest.agent.system_prompt.includes('research'), 'Should have research prompt');
  });

  test('agentbox pack creates .agent file from CLI', () => {
    const initDir = path.join(tmpDir, 'cli-test-pack');
    fs.mkdirSync(initDir, { recursive: true });
    execSync(`node ${cliPath} init packable-agent`, { cwd: initDir, encoding: 'utf-8' });
    execSync(`node ${cliPath} pack packable-agent`, { cwd: initDir, encoding: 'utf-8' });

    const agentFile = path.join(initDir, 'packable-agent-1.0.0.agent');
    assert(fs.existsSync(agentFile), '.agent file should be created');
    const stats = fs.statSync(agentFile);
    assert(stats.size > 0, '.agent file should have content');
  });

  // ─── End-to-end flow ───
  console.log('\n  \x1b[36mEnd-to-end flow\x1b[0m');

  test('full flow: init -> pack -> install from file -> list installed', () => {
    // Reset agentbox state
    const agentboxHome = path.join(tmpDir, '.agentbox');
    if (fs.existsSync(agentboxHome)) {
      fs.rmSync(agentboxHome, { recursive: true });
    }

    const workDir = path.join(tmpDir, 'e2e-test');
    fs.mkdirSync(workDir, { recursive: true });

    // Init
    execSync(`node ${cliPath} init e2e-agent`, { cwd: workDir, encoding: 'utf-8' });

    // Pack
    execSync(`node ${cliPath} pack e2e-agent`, { cwd: workDir, encoding: 'utf-8' });
    const agentFile = path.join(workDir, 'e2e-agent-1.0.0.agent');
    assert(fs.existsSync(agentFile), 'Pack should create .agent file');

    // Install from file
    execSync(`node ${cliPath} install ${agentFile}`, { encoding: 'utf-8' });

    // Verify installed
    const installed = listInstalledAgents();
    assert(installed.length > 0, 'Should have at least one installed agent');

    const installedManifest = readManifest(installed[0]);
    assertEqual(installedManifest.name, 'e2e-agent');
  });

  // ─── Summary ───
  console.log('\n  ─────────────────────────────────');
  console.log(`  ${passed} passing, ${failed} failing, ${total} total`);

  if (failed > 0) {
    console.log('\x1b[31m  TESTS FAILED\x1b[0m\n');
    process.exit(1);
  } else {
    console.log('\x1b[32m  ALL TESTS PASSED\x1b[0m\n');
  }

  // Cleanup
  process.env.HOME = origHome;
  try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
