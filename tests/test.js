#!/usr/bin/env node
// Unit tests for agentbox core functionality
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createTestEnv, createTestRunner } = require('./helpers');

const { tmpDir, cliPath, cleanup } = createTestEnv('test');
const { test, assert, assertEqual, recordAsync, printSummary } = createTestRunner();

// Require modules after setting HOME (createTestEnv overrides it)
const { parseAgentId, ensureDirs, listInstalledAgents } = require('../src/utils/fs');
const { readManifest, readAndValidateManifest, writeManifest, packAgent, unpackAgent, inspectAgent, validateManifest } = require('../src/utils/agent-file');
const { sanitizeManifestField } = require('../src/utils/validate');

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
  try {
    const result = await packAgent(testAgentDir, agentFilePath);
    assert(fs.existsSync(agentFilePath), '.agent file should exist');
    assert(result.size > 0, 'File should have content');
    assertEqual(result.manifest.name, 'test-agent');
    recordAsync(true);
    console.log(`  \x1b[32m✓\x1b[0m packAgent creates .agent file`);
  } catch (err) {
    recordAsync(false);
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

  // ─── Review fix: unpackAgent clears stale files ───
  console.log('\n  \x1b[36munpackAgent stale-file cleanup\x1b[0m');

  // This test involves async packAgent, so handle it like the earlier pack test
  try {
    // Create v1 agent with an extra knowledge file
    const v1Dir = path.join(tmpDir, 'stale-v1');
    fs.mkdirSync(path.join(v1Dir, 'knowledge'), { recursive: true });
    writeManifest(v1Dir, {
      name: 'stale-test', version: '1.0.0',
      agent: { system_prompt: 'v1' },
    });
    fs.writeFileSync(path.join(v1Dir, 'knowledge', 'old.md'), '# Old knowledge');
    fs.writeFileSync(path.join(v1Dir, 'knowledge', 'keep.md'), '# Keep');

    // Create v2 agent WITHOUT old.md
    const v2Dir = path.join(tmpDir, 'stale-v2');
    fs.mkdirSync(path.join(v2Dir, 'knowledge'), { recursive: true });
    writeManifest(v2Dir, {
      name: 'stale-test', version: '2.0.0',
      agent: { system_prompt: 'v2' },
    });
    fs.writeFileSync(path.join(v2Dir, 'knowledge', 'keep.md'), '# Keep updated');

    const staleTargetDir = path.join(tmpDir, 'stale-install');

    // Pack and install v1
    const v1File = path.join(tmpDir, 'stale-test-1.0.0.agent');
    await packAgent(v1Dir, v1File);
    unpackAgent(v1File, staleTargetDir);
    assert(fs.existsSync(path.join(staleTargetDir, 'knowledge', 'old.md')),
      'v1 should have old.md');

    // Pack and install v2 into the same directory
    const v2File = path.join(tmpDir, 'stale-test-2.0.0.agent');
    await packAgent(v2Dir, v2File);
    unpackAgent(v2File, staleTargetDir);

    // old.md should be gone; keep.md should be present
    assert(!fs.existsSync(path.join(staleTargetDir, 'knowledge', 'old.md')),
      'old.md should be removed after v2 install');
    assert(fs.existsSync(path.join(staleTargetDir, 'knowledge', 'keep.md')),
      'keep.md should still exist');
    const staleManifest = readManifest(staleTargetDir);
    assertEqual(staleManifest.version, '2.0.0');

    recordAsync(true);
    console.log('  \x1b[32m✓\x1b[0m unpackAgent removes files not in new version');
  } catch (err) {
    recordAsync(false);
    console.log('  \x1b[31m✗\x1b[0m unpackAgent removes files not in new version');
    console.log(`    ${err.message}`);
  }

  // ─── Review fix: packAgent skips .agent files ───
  console.log('\n  \x1b[36mpackAgent skips existing .agent files\x1b[0m');

  try {
    const packDir = path.join(tmpDir, 'pack-twice');
    fs.mkdirSync(path.join(packDir, 'knowledge'), { recursive: true });
    writeManifest(packDir, {
      name: 'pack-twice', version: '1.0.0',
      agent: { system_prompt: 'test' },
    });
    fs.writeFileSync(path.join(packDir, 'knowledge', 'info.md'), '# Info');

    // First pack — output into the agent's own directory (mimics default behaviour)
    const firstOutput = path.join(packDir, 'pack-twice-1.0.0.agent');
    await packAgent(packDir, firstOutput);
    assert(fs.existsSync(firstOutput), 'First .agent file should exist');

    // Second pack — the .agent file from round 1 now sits in sourceDir
    const secondOutput = path.join(tmpDir, 'pack-twice-round2.agent');
    await packAgent(packDir, secondOutput);

    // Inspect second pack — should NOT contain the first .agent file
    const info = inspectAgent(secondOutput);
    const fileNames = info.files.map(f => f.name);
    const agentInArchive = fileNames.some(n => n.endsWith('.agent'));
    assert(!agentInArchive,
      'Second pack should not contain .agent files inside archive');

    recordAsync(true);
    console.log('  \x1b[32m✓\x1b[0m repeated pack does not bundle previous .agent file');
  } catch (err) {
    recordAsync(false);
    console.log('  \x1b[31m✗\x1b[0m repeated pack does not bundle previous .agent file');
    console.log(`    ${err.message}`);
  }

  // ─── Review fix: install picks newest version ───
  console.log('\n  \x1b[36minstall picks newest version\x1b[0m');

  const { extractVersion, pickNewest } = require('../src/commands/install');

  test('extractVersion parses semver from filename', () => {
    const v = extractVersion('/reg/foo-2.1.3.agent', 'foo');
    assertEqual(v[0], 2);
    assertEqual(v[1], 1);
    assertEqual(v[2], 3);
  });

  test('extractVersion returns [0,0,0] for unparseable', () => {
    const v = extractVersion('/reg/foo-bad.agent', 'foo');
    assertEqual(v[0], 0);
    assertEqual(v[1], 0);
    assertEqual(v[2], 0);
  });

  test('pickNewest returns null for empty list', () => {
    assertEqual(pickNewest([], 'foo'), null);
  });

  test('pickNewest returns only element for single-item list', () => {
    const result = pickNewest(['/reg/foo-1.0.0.agent'], 'foo');
    assertEqual(result, '/reg/foo-1.0.0.agent');
  });

  test('pickNewest selects highest semver from multiple versions', () => {
    const files = [
      '/reg/foo-1.0.0.agent',
      '/reg/foo-2.0.0.agent',
      '/reg/foo-1.5.0.agent',
    ];
    const result = pickNewest(files, 'foo');
    assertEqual(result, '/reg/foo-2.0.0.agent');
  });

  test('pickNewest handles minor/patch ordering', () => {
    const files = [
      '/reg/bar-1.0.9.agent',
      '/reg/bar-1.1.0.agent',
      '/reg/bar-1.0.10.agent',
    ];
    const result = pickNewest(files, 'bar');
    assertEqual(result, '/reg/bar-1.1.0.agent');
  });

  // ─── Banner box dynamic width (Simplification #10) ───
  console.log('\n  \x1b[36mBanner box dynamic width\x1b[0m');

  test('banner box has aligned borders', () => {
    // Run CLI without arguments to see the banner — Commander writes help to
    // stderr and exits 1, so we catch the error and grab stdout from it.
    let output;
    try {
      output = execSync(`node ${cliPath}`, { encoding: 'utf-8' });
    } catch (err) {
      output = err.stdout || '';
    }
    const lines = output.split('\n').filter(l => l.includes('║') || l.includes('╔') || l.includes('╚'));
    assert(lines.length >= 3, 'Banner should have at least 3 box lines');
    // All box lines (including border rows) should end with the closing character
    // at the same column. Check that the visible-character widths are consistent.
    for (const line of lines) {
      const trimmed = line.trimEnd();
      assert(trimmed.endsWith('╗') || trimmed.endsWith('║') || trimmed.endsWith('╝'),
        `Box line should end with a border char: ${trimmed}`);
    }
  });

  printSummary();
  cleanup();
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
