#!/usr/bin/env node
// Tests for enriched example agents, init starter knowledge, and runLocal knowledge references
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createTestEnv, createTestRunner } = require('./helpers');

const { tmpDir, cliPath, rootDir, cleanup } = createTestEnv('enrich-test');
const { test, assert, assertEqual, printSummary } = createTestRunner();

const yaml = require('js-yaml');

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

  // ─── Task 4: runLocal knowledge references (functional tests) ───
  // These tests exercise runLocal behavior by installing an agent with
  // knowledge and running it via the CLI in local/demo mode.
  console.log('\n  \x1b[36mrunLocal knowledge references\x1b[0m');

  test('run in local mode includes knowledge references in output', () => {
    // Init, add knowledge, pack, install, run
    const workDir = path.join(tmpDir, 'run-knowledge');
    fs.mkdirSync(workDir, { recursive: true });
    execSync(`node ${cliPath} init knowledge-agent --template research`, { cwd: workDir, encoding: 'utf-8' });

    // Add a real knowledge file
    const kDir = path.join(workDir, 'knowledge-agent', 'knowledge');
    fs.writeFileSync(path.join(kDir, 'test-data.md'), '# Test Data\nSome research facts here.\nAnother line of content.');

    // Pack
    execSync(`node ${cliPath} pack knowledge-agent`, { cwd: workDir, encoding: 'utf-8' });
    const agentFile = path.join(workDir, 'knowledge-agent-1.0.0.agent');
    assert(fs.existsSync(agentFile), '.agent file should exist');

    // Install
    execSync(`node ${cliPath} install ${agentFile}`, { encoding: 'utf-8' });

    // Run with a message (local mode — no OPENAI_API_KEY)
    const output = execSync(
      `node ${cliPath} run knowledge-agent -m "Tell me about AI"`,
      { encoding: 'utf-8', env: { ...process.env, OPENAI_API_KEY: '' } }
    );
    assert(output.includes('📚'), 'Output should include knowledge reference emoji');
    assert(output.includes('Sources referenced'), 'Output should include sources referenced');
  });

  test('run in local mode without knowledge does not show knowledge section', () => {
    // Init with default template (no knowledge)
    const workDir = path.join(tmpDir, 'run-no-knowledge');
    fs.mkdirSync(workDir, { recursive: true });
    execSync(`node ${cliPath} init plain-agent`, { cwd: workDir, encoding: 'utf-8' });

    // Pack
    execSync(`node ${cliPath} pack plain-agent`, { cwd: workDir, encoding: 'utf-8' });
    const agentFile = path.join(workDir, 'plain-agent-1.0.0.agent');

    // Install
    execSync(`node ${cliPath} install ${agentFile}`, { encoding: 'utf-8' });

    // Run with a message (local mode)
    const output = execSync(
      `node ${cliPath} run plain-agent -m "Hello"`,
      { encoding: 'utf-8', env: { ...process.env, OPENAI_API_KEY: '' } }
    );
    assert(!output.includes('Sources referenced'), 'Output should NOT include sources referenced when no knowledge');
  });

  printSummary();
  cleanup();
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
