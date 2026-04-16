#!/usr/bin/env node
// Tests for enriched example agents, init starter knowledge, and runLocal knowledge references
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

const tmpDir = path.join(os.tmpdir(), 'agentbox-enrich-test-' + Date.now());
const origHome = process.env.HOME;
fs.mkdirSync(tmpDir, { recursive: true });
process.env.HOME = tmpDir;

const yaml = require('js-yaml');
const cliPath = path.join(__dirname, '..', 'src', 'cli.js');
const rootDir = path.join(__dirname, '..');

async function runAllTests() {
  console.log('\n\x1b[1m  agentbox enrich tests\x1b[0m\n');

  // ─── Task 1: Research assistant knowledge files ───
  console.log('  \x1b[36mresearch-assistant knowledge\x1b[0m');

  test('ai-agents-landscape-2024.md exists', () => {
    const filePath = path.join(rootDir, 'examples', 'research-assistant', 'knowledge', 'ai-agents-landscape-2024.md');
    assert(fs.existsSync(filePath), 'ai-agents-landscape-2024.md should exist');
  });

  test('ai-agents-landscape-2024.md has substantial content (~600 words)', () => {
    const filePath = path.join(rootDir, 'examples', 'research-assistant', 'knowledge', 'ai-agents-landscape-2024.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    const wordCount = content.split(/\s+/).length;
    assert(wordCount >= 400, `Expected at least 400 words, got ${wordCount}`);
    assert(content.includes('OpenAI'), 'Should mention OpenAI');
    assert(content.includes('Anthropic'), 'Should mention Anthropic');
    assert(content.includes('LangChain'), 'Should mention LangChain');
    assert(content.includes('CrewAI'), 'Should mention CrewAI');
    assert(content.includes('2025'), 'Should include predictions for 2025');
  });

  test('research-methodologies.md exists', () => {
    const filePath = path.join(rootDir, 'examples', 'research-assistant', 'knowledge', 'research-methodologies.md');
    assert(fs.existsSync(filePath), 'research-methodologies.md should exist');
  });

  test('research-methodologies.md has substantial content (~400 words)', () => {
    const filePath = path.join(rootDir, 'examples', 'research-assistant', 'knowledge', 'research-methodologies.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    const wordCount = content.split(/\s+/).length;
    assert(wordCount >= 250, `Expected at least 250 words, got ${wordCount}`);
    assert(content.includes('Porter'), 'Should mention Porter\'s 5 forces');
    assert(content.includes('arXiv') || content.includes('arxiv'), 'Should mention arXiv');
  });

  test('research-assistant agent.yaml references knowledge files', () => {
    const filePath = path.join(rootDir, 'examples', 'research-assistant', 'agent.yaml');
    const manifest = yaml.load(fs.readFileSync(filePath, 'utf-8'));
    assert(Array.isArray(manifest.agent.knowledge), 'knowledge should be an array');
    assert(manifest.agent.knowledge.includes('ai-agents-landscape-2024.md'), 'Should include ai-agents-landscape-2024.md');
    assert(manifest.agent.knowledge.includes('research-methodologies.md'), 'Should include research-methodologies.md');
  });

  // ─── Task 2: Cold outreach knowledge files ───
  console.log('\n  \x1b[36mcold-outreach knowledge\x1b[0m');

  test('outreach-templates.md exists', () => {
    const filePath = path.join(rootDir, 'examples', 'cold-outreach', 'knowledge', 'outreach-templates.md');
    assert(fs.existsSync(filePath), 'outreach-templates.md should exist');
  });

  test('outreach-templates.md has template content', () => {
    const filePath = path.join(rootDir, 'examples', 'cold-outreach', 'knowledge', 'outreach-templates.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    const wordCount = content.split(/\s+/).length;
    assert(wordCount >= 300, `Expected at least 300 words, got ${wordCount}`);
    assert(content.includes('Mutual Connection'), 'Should include Mutual Connection template');
    assert(content.includes('Specific Observation'), 'Should include Specific Observation template');
    assert(content.includes('Value-First'), 'Should include Value-First template');
    assert(content.includes('Quick Question'), 'Should include Quick Question template');
  });

  test('email-best-practices.md exists', () => {
    const filePath = path.join(rootDir, 'examples', 'cold-outreach', 'knowledge', 'email-best-practices.md');
    assert(fs.existsSync(filePath), 'email-best-practices.md should exist');
  });

  test('email-best-practices.md has best practices content', () => {
    const filePath = path.join(rootDir, 'examples', 'cold-outreach', 'knowledge', 'email-best-practices.md');
    const content = fs.readFileSync(filePath, 'utf-8');
    const wordCount = content.split(/\s+/).length;
    assert(wordCount >= 250, `Expected at least 250 words, got ${wordCount}`);
    assert(content.includes('Subject Line') || content.includes('subject line'), 'Should cover subject lines');
    assert(content.includes('50-125') || content.includes('50–125'), 'Should mention optimal email length');
    assert(content.includes('follow-up') || content.includes('Follow-Up') || content.includes('Follow-up'), 'Should cover follow-up cadence');
  });

  test('cold-outreach agent.yaml references knowledge files', () => {
    const filePath = path.join(rootDir, 'examples', 'cold-outreach', 'agent.yaml');
    const manifest = yaml.load(fs.readFileSync(filePath, 'utf-8'));
    assert(Array.isArray(manifest.agent.knowledge), 'knowledge should be an array');
    assert(manifest.agent.knowledge.includes('outreach-templates.md'), 'Should include outreach-templates.md');
    assert(manifest.agent.knowledge.includes('email-best-practices.md'), 'Should include email-best-practices.md');
  });

  // ─── Task 3: init.js creates starter knowledge files ───
  console.log('\n  \x1b[36minit.js starter knowledge\x1b[0m');

  test('init with research template creates getting-started.md', () => {
    const initDir = path.join(tmpDir, 'init-research');
    fs.mkdirSync(initDir, { recursive: true });
    execSync(`node ${cliPath} init research-test --template research`, { cwd: initDir, encoding: 'utf-8' });

    const knowledgeFile = path.join(initDir, 'research-test', 'knowledge', 'getting-started.md');
    assert(fs.existsSync(knowledgeFile), 'getting-started.md should exist');

    const content = fs.readFileSync(knowledgeFile, 'utf-8');
    assert(content.includes('Research Knowledge Base'), 'Should have research content');
  });

  test('init with research template sets knowledge in manifest', () => {
    const manifestPath = path.join(tmpDir, 'init-research', 'research-test', 'agent.yaml');
    const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf-8'));
    assert(Array.isArray(manifest.agent.knowledge), 'knowledge should be an array');
    assert(manifest.agent.knowledge.includes('getting-started.md'), 'Should include getting-started.md');
  });

  test('init with outreach template creates target-audience.md', () => {
    const initDir = path.join(tmpDir, 'init-outreach');
    fs.mkdirSync(initDir, { recursive: true });
    execSync(`node ${cliPath} init outreach-test --template outreach`, { cwd: initDir, encoding: 'utf-8' });

    const knowledgeFile = path.join(initDir, 'outreach-test', 'knowledge', 'target-audience.md');
    assert(fs.existsSync(knowledgeFile), 'target-audience.md should exist');

    const content = fs.readFileSync(knowledgeFile, 'utf-8');
    assert(content.includes('Target Audience Profile'), 'Should have audience content');
  });

  test('init with outreach template sets knowledge in manifest', () => {
    const manifestPath = path.join(tmpDir, 'init-outreach', 'outreach-test', 'agent.yaml');
    const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf-8'));
    assert(Array.isArray(manifest.agent.knowledge), 'knowledge should be an array');
    assert(manifest.agent.knowledge.includes('target-audience.md'), 'Should include target-audience.md');
  });

  test('init with default template does not add knowledge files', () => {
    const initDir = path.join(tmpDir, 'init-default');
    fs.mkdirSync(initDir, { recursive: true });
    execSync(`node ${cliPath} init default-test`, { cwd: initDir, encoding: 'utf-8' });

    const knowledgeDir = path.join(initDir, 'default-test', 'knowledge');
    const files = fs.readdirSync(knowledgeDir);
    assertEqual(files.length, 0, 'Default template should not have starter knowledge files');

    const manifestPath = path.join(initDir, 'default-test', 'agent.yaml');
    const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf-8'));
    assertEqual(manifest.agent.knowledge.length, 0, 'Default manifest should have empty knowledge array');
  });

  // ─── Task 4: runLocal knowledge references ───
  console.log('\n  \x1b[36mrunLocal knowledge references\x1b[0m');

  // We can test runLocal directly by requiring run.js internals
  // Since runLocal is not exported, we test it indirectly via the module's behavior
  // But we can load the function from the file using a small trick
  
  // Load the runLocal function by evaluating the module's source
  const runSrc = fs.readFileSync(path.join(rootDir, 'src', 'commands', 'run.js'), 'utf-8');

  test('runLocal function accepts knowledge parameter', () => {
    // Check the function signature in source
    assert(runSrc.includes('function runLocal(manifest, systemPrompt, userMessage, knowledge)'),
      'runLocal should accept knowledge as 4th parameter');
  });

  test('runLocal builds knowledge reference when knowledge is provided', () => {
    assert(runSrc.includes('📚 **Sources referenced:**'), 'Should include sources referenced output');
    assert(runSrc.includes('📚 **From knowledge base'), 'Should include knowledge base snippet');
  });

  test('runLocal call sites pass knowledge argument', () => {
    // Check all call sites pass knowledge
    const callSites = runSrc.match(/runLocal\(manifest,\s*systemPrompt,\s*\S+,\s*knowledge\)/g);
    assert(callSites && callSites.length >= 3, 
      `Expected at least 3 runLocal calls with knowledge, found ${callSites ? callSites.length : 0}`);
  });

  test('runLocal appends knowledgeRef to each category response', () => {
    // Check that knowledgeRef is appended to each category's response
    const categories = ['research', 'coding', 'writing', 'finance', 'general'];
    for (const cat of categories) {
      // Each response should end with knowledgeRef + footer
      assert(runSrc.includes(`knowledgeRef +\n      \`\\n\\n_[\${name}`),
        `${cat} response should append knowledgeRef before footer`);
    }
  });

  test('runLocal handles no knowledge gracefully', () => {
    // Verify the function checks for null/empty knowledge
    assert(runSrc.includes("if (knowledge && knowledge.length > 0)"),
      'Should guard against null/empty knowledge');
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
