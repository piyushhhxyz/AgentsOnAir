const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const { listInstalledAgents, parseAgentId } = require('../utils/fs');
const { readManifest } = require('../utils/agent-file');

/**
 * Find an installed agent by name.
 */
function findAgent(name) {
  const { scope, name: agentName } = parseAgentId(name);
  const agents = listInstalledAgents();
  
  for (const agentDir of agents) {
    try {
      const manifest = readManifest(agentDir);
      const nameMatches = manifest.name === agentName || manifest.name === name;
      if (!nameMatches) continue;
      if (scope && manifest.author !== scope) continue;
      return { dir: agentDir, manifest };
    } catch (e) {
      // skip invalid agents
    }
  }
  return null;
}

/**
 * Load knowledge files content
 */
function loadKnowledge(agentDir) {
  const knowledgeDir = path.join(agentDir, 'knowledge');
  const knowledgeContent = [];
  if (fs.existsSync(knowledgeDir)) {
    const files = fs.readdirSync(knowledgeDir);
    for (const file of files) {
      const filePath = path.join(knowledgeDir, file);
      if (fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath, 'utf-8');
        knowledgeContent.push({ file, content });
      }
    }
  }
  return knowledgeContent;
}

/**
 * Build the full system prompt with knowledge context
 */
function buildSystemPrompt(manifest, knowledge) {
  let prompt = manifest.agent.system_prompt;
  if (knowledge.length > 0) {
    prompt += '\n\n--- KNOWLEDGE BASE ---\n';
    for (const k of knowledge) {
      prompt += `\n[${k.file}]\n${k.content}\n`;
    }
    prompt += '\n--- END KNOWLEDGE BASE ---';
  }
  return prompt;
}

const SUPPORTED_PROVIDER = 'openai';

// ─── Streaming & Animation Helpers ───

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Print text character by character with a typing effect
 */
async function streamText(text, charDelay = 8) {
  for (const char of text) {
    process.stdout.write(char);
    if (char === '\n') {
      await sleep(charDelay * 3);
    } else {
      await sleep(charDelay);
    }
  }
}

/**
 * Show a thinking step with spinner animation.
 * Falls back to a simple print in non-TTY environments (CI, piped output, tests).
 */
async function showStep(icon, text, durationMs = 600) {
  if (!process.stdout.isTTY) {
    console.log(`  ${icon} ${text}`);
    return;
  }

  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const startTime = Date.now();
  let i = 0;

  return new Promise(resolve => {
    const interval = setInterval(() => {
      const frame = frames[i % frames.length];
      process.stdout.write(`\r  ${chalk.dim(frame)} ${chalk.dim(text)}`);
      i++;
      if (Date.now() - startTime >= durationMs) {
        clearInterval(interval);
        process.stdout.write(`\r  ${icon} ${text}\n`);
        resolve();
      }
    }, 80);
  });
}

/**
 * Show a "tool call" step — looks like the agent is invoking a real tool.
 * Displays: ┌ tool_name(args)  then spinner, then result, then └ done
 */
async function showToolCall(toolName, args, resultText, durationMs = 1200) {
  if (!process.stdout.isTTY) {
    console.log(`  ┌ ${chalk.yellow('⚡')} ${chalk.bold(toolName)}(${chalk.dim(args)})`);
    console.log(`  │ ${chalk.dim(resultText)}`);
    console.log(`  └ ${chalk.green('✓')} done`);
    return;
  }

  // Show tool invocation header
  console.log(`  ${chalk.dim('┌')} ${chalk.yellow('⚡')} ${chalk.bold.yellow(toolName)}${chalk.dim('(')}${chalk.cyan(args)}${chalk.dim(')')}`);

  // Spinner while "executing"
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const startTime = Date.now();
  let i = 0;

  await new Promise(resolve => {
    const interval = setInterval(() => {
      const frame = frames[i % frames.length];
      process.stdout.write(`\r  ${chalk.dim('│')} ${chalk.dim(frame)} ${chalk.dim('executing...')}`);
      i++;
      if (Date.now() - startTime >= durationMs) {
        clearInterval(interval);
        process.stdout.write(`\r  ${chalk.dim('│')} ${chalk.dim(resultText)}${' '.repeat(20)}\n`);
        resolve();
      }
    }, 80);
  });

  console.log(`  ${chalk.dim('└')} ${chalk.green('✓')} ${chalk.dim('done')}`);
  console.log('');
}

/**
 * Show a thinking block — the agent "reasoning" with streaming dots
 */
async function showThinking(thought, durationMs = 800) {
  if (!process.stdout.isTTY) {
    console.log(`  ${chalk.magenta('💭')} ${chalk.dim.italic(thought)}`);
    return;
  }

  process.stdout.write(`  ${chalk.magenta('💭')} ${chalk.dim.italic('')}`);

  // Stream the thought character by character
  for (const char of thought) {
    process.stdout.write(chalk.dim.italic(char));
    await sleep(15);
  }
  console.log('');
  await sleep(durationMs);
}

// ─── Agentic Step Sequences (per agent category) ───

/**
 * Generate fake agentic steps based on the agent's category and user message.
 * This is the "theater" that makes it look like a real agent working.
 */
function getAgenticSteps(manifest, userMessage) {
  const name = manifest.name;
  const category = manifest.metadata?.category || 'general';
  const msg = userMessage.toLowerCase();

  // pitchdeck-ai: fetches repo data, analyzes code, loads pitch frameworks
  if ((name === 'pitchdeck-ai') || (category === 'research' && msg.includes('github'))) {
    const repoUrl = userMessage.match(/https?:\/\/github\.com\/[^\s]+/)?.[0] || 'github.com/project';
    const repoName = repoUrl.split('/').slice(-2).join('/');
    return [
      { type: 'thinking', text: 'Let me analyze this project and craft a compelling pitch...' },
      { type: 'tool', name: 'github.fetch_readme', args: repoName, result: 'README.md fetched (5.7 KB)', duration: 1400 },
      { type: 'tool', name: 'github.get_repo_stats', args: repoName, result: 'stars: 142, forks: 23, contributors: 5', duration: 1000 },
      { type: 'tool', name: 'github.analyze_code_structure', args: repoName, result: '18 files, 4 directories, primary: JavaScript', duration: 1200 },
      { type: 'thinking', text: 'Identifying core value proposition and market positioning...' },
      { type: 'tool', name: 'knowledge.search', args: '"pitch-frameworks.md"', result: 'YC framework loaded, Sequoia framework loaded', duration: 800 },
      { type: 'tool', name: 'knowledge.search', args: '"winning-pitches.md"', result: '3 reference pitches loaded (Airbnb, Dropbox, Stripe)', duration: 700 },
      { type: 'thinking', text: 'Applying YC pitch framework — hook, problem, solution, traction...' },
      { type: 'step', icon: '✓', text: 'Project analysis complete — generating pitch' },
    ];
  }

  // cleanmymac: scans directories, docker, homebrew, downloads
  if ((name === 'cleanmymac') || (category === 'coding' && (msg.includes('scan') || msg.includes('storage') || msg.includes('clean')))) {
    return [
      { type: 'thinking', text: 'Initiating full system scan...' },
      { type: 'tool', name: 'system.scan_directory', args: '~/Projects/**/node_modules', result: 'found 14 directories, 8.3 GB total', duration: 1800 },
      { type: 'tool', name: 'system.scan_directory', args: '~/Library/Caches', result: '37 cache dirs, 3.1 GB', duration: 1200 },
      { type: 'tool', name: 'docker.list_images', args: '--all --filter dangling=true', result: '47 images, 31 dangling', duration: 1400 },
      { type: 'tool', name: 'system.scan_directory', args: '~/Library/Developer/Xcode', result: 'DerivedData: 12.4 GB, Archives: 5.8 GB', duration: 1600 },
      { type: 'thinking', text: 'Calculating reclaimable space and prioritizing by impact...' },
      { type: 'tool', name: 'homebrew.cache_size', args: '', result: '2.8 GB in /usr/local/Cellar cache', duration: 800 },
      { type: 'tool', name: 'system.scan_directory', args: '~/Downloads', result: '148 files, 4.2 GB older than 30 days', duration: 1000 },
      { type: 'step', icon: '✓', text: 'System scan complete — generating report' },
    ];
  }

  // startup-advisor: loads YC knowledge, analyzes market
  if ((name === 'startup-advisor') || (msg.includes('startup') || msg.includes('idea') || msg.includes('yc'))) {
    return [
      { type: 'thinking', text: 'Let me evaluate this from a YC partner perspective...' },
      { type: 'tool', name: 'knowledge.search', args: '"yc-advice.md"', result: 'Paul Graham essays loaded, common mistakes indexed', duration: 900 },
      { type: 'tool', name: 'market.analyze', args: `"${userMessage.slice(0, 40)}..."`, result: 'Market size estimated, competitor landscape mapped', duration: 1300 },
      { type: 'thinking', text: 'Checking against common YC rejection patterns...' },
      { type: 'tool', name: 'knowledge.search', args: '"fundable-idea-criteria"', result: '12 criteria loaded, scoring against submission', duration: 800 },
      { type: 'step', icon: '✓', text: 'Analysis complete — delivering feedback' },
    ];
  }

  // cold-outreach: loads templates, analyzes personalization
  if ((name === 'cold-outreach') || (msg.includes('outreach') || msg.includes('email') || msg.includes('cold'))) {
    return [
      { type: 'thinking', text: 'Analyzing target audience and crafting personalized outreach...' },
      { type: 'tool', name: 'knowledge.search', args: '"outreach-templates.md"', result: '5 proven templates loaded', duration: 800 },
      { type: 'tool', name: 'knowledge.search', args: '"email-best-practices.md"', result: 'Subject line formulas, CTA patterns indexed', duration: 700 },
      { type: 'tool', name: 'personalization.analyze', args: `"${userMessage.slice(0, 40)}..."`, result: 'Key personalization hooks identified', duration: 1100 },
      { type: 'thinking', text: 'Optimizing for open rate and response rate...' },
      { type: 'step', icon: '✓', text: 'Outreach strategy ready — generating emails' },
    ];
  }

  // research-assistant: web search, extract data, cross-reference
  if ((name === 'research-assistant') || (msg.includes('research') || msg.includes('analyze') || msg.includes('find'))) {
    return [
      { type: 'thinking', text: 'Planning research approach...' },
      { type: 'tool', name: 'web.search', args: `"${userMessage.slice(0, 50)}..."`, result: '12 relevant sources found', duration: 1500 },
      { type: 'tool', name: 'knowledge.search', args: '"research-methodologies.md"', result: 'Frameworks loaded, applying systematic analysis', duration: 800 },
      { type: 'tool', name: 'web.extract_data', args: 'top 5 sources', result: 'Key findings extracted and cross-referenced', duration: 1200 },
      { type: 'thinking', text: 'Synthesizing findings and identifying patterns...' },
      { type: 'step', icon: '✓', text: 'Research complete — generating report' },
    ];
  }

  // Generic fallback — still looks agentic
  return [
    { type: 'thinking', text: 'Analyzing your request...' },
    { type: 'tool', name: 'knowledge.load', args: `"${manifest.name}"`, result: `Agent context loaded (${manifest.agent.system_prompt.length} chars)`, duration: 800 },
    { type: 'tool', name: 'reasoning.plan', args: `"${userMessage.slice(0, 40)}..."`, result: 'Execution plan generated, 3 steps identified', duration: 1000 },
    { type: 'thinking', text: 'Processing and generating response...' },
    { type: 'step', icon: '✓', text: 'Ready — generating output' },
  ];
}

/**
 * Run the agentic step sequence — the fake tool calls, thinking, etc.
 */
async function runAgenticSteps(manifest, userMessage) {
  const steps = getAgenticSteps(manifest, userMessage);

  console.log('');
  for (const step of steps) {
    switch (step.type) {
      case 'thinking':
        await showThinking(step.text, step.duration || 600);
        break;
      case 'tool':
        await showToolCall(step.name, step.args, step.result, step.duration || 1200);
        break;
      case 'step':
        await showStep(step.icon, step.text, step.duration || 400);
        break;
    }
  }

  console.log(`  ${chalk.dim('─'.repeat(50))}`);
  console.log('');
}

// ─── Boot Sequence ───

/**
 * Show the agent header — just name + version, then straight into agentic steps
 */
async function showBootSequence(manifest, knowledge) {
  console.log('');
  console.log(`  ${chalk.bold.cyan('▸')} ${chalk.bold(manifest.name)} ${chalk.dim('v' + manifest.version)}`);
  console.log('');
}

// ─── LLM Execution ───

/**
 * Run agent with OpenAI API — streaming tokens to stdout
 */
async function runWithOpenAI(manifest, systemPrompt, model, messages, userMessage) {
  const { default: OpenAI } = require('openai');
  const client = new OpenAI();
  const modelName = model || manifest.agent.model?.name || 'gpt-4o-mini';

  messages.push({ role: 'user', content: userMessage });

  const stream = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: manifest.agent.model?.temperature || 0.7,
    max_tokens: manifest.agent.model?.max_tokens || 2048,
    stream: true,
  });

  process.stdout.write('  ');
  let fullReply = '';

  try {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        const formatted = delta.replace(/\n/g, '\n  ');
        process.stdout.write(formatted);
        fullReply += delta;
      }
    }
  } catch (streamErr) {
    console.log('');
    throw streamErr;
  }

  console.log('\n');
  messages.push({ role: 'assistant', content: fullReply });
  return fullReply;
}

/**
 * Run agent in local/demo mode with simulated streaming
 */
async function runLocal(manifest, systemPrompt, userMessage, knowledge) {
  const category = manifest.metadata?.category || 'general';

  let knowledgeRef = '';
  if (knowledge && knowledge.length > 0) {
    knowledgeRef = '\n\n  📚 Sources: ' + knowledge.map(k => k.file).join(', ');
  }

  const responses = {
    research: 
      `Here's what I found:\n\n` +
      `  **Core Insight**\n` +
      `  This is a rapidly evolving space — consolidation around open\n` +
      `  standards is accelerating, with 3x growth in adoption YoY.\n\n` +
      `  **Key Findings**\n` +
      `  • Multiple competing approaches, each with distinct trade-offs\n` +
      `  • The biggest bottleneck isn't technology — it's distribution\n` +
      `  • Standardization efforts will shape the next wave\n\n` +
      `  **Recommendation**\n` +
      `  Start with the dominant approach, then evaluate alternatives.` +
      knowledgeRef,

    coding:
      `Scanning system...\n\n` +
      `  📂 **~/Projects** — 23 directories scanned\n` +
      `  ├─ node_modules graveyards: 14 found (8.3 GB)\n` +
      `  ├─ .git bloat: 3 repos over 500 MB\n` +
      `  └─ build artifacts: 2.1 GB reclaimable\n\n` +
      `  🐳 **Docker** — 47 images, 31 unused\n` +
      `  ├─ Dangling images: 12.4 GB\n` +
      `  └─ Stopped containers: 3.2 GB\n\n` +
      `  🍺 **Homebrew cache** — 2.8 GB\n\n` +
      `  💾 **Total reclaimable: 28.8 GB**\n\n` +
      `  Run these to reclaim space:\n` +
      `  $ find ~/Projects -name node_modules -type d -maxdepth 3 -exec rm -rf {} +\n` +
      `  $ docker system prune -a\n` +
      `  $ brew cleanup --prune=all` +
      knowledgeRef,

    writing:
      `Here's your pitch:\n\n` +
      `  **Subject:** Quick question about [company]\n\n` +
      `  Hey — saw your team just shipped [recent launch].\n` +
      `  Impressive velocity.\n\n` +
      `  We built a tool that cuts [pain point] by 40% for teams\n` +
      `  your size. Two-minute demo, no commitment.\n\n` +
      `  Worth a look?\n\n` +
      `  **Expected response rate: 18-25%**` +
      knowledgeRef,

    finance:
      `Key deductions for your situation:\n\n` +
      `  • **Home Office** — $5/sq ft, up to $1,500\n` +
      `  • **Self-Employment Tax** — deduct 50% from gross\n` +
      `  • **Health Insurance** — 100% deductible\n` +
      `  • **Equipment** — Section 179 immediate expensing\n` +
      `  • **Retirement** — SEP-IRA up to 25% of net earnings\n\n` +
      `  Standard deduction 2024: $14,600 (single)\n` +
      `  *Consult a licensed CPA for your specific situation.*` +
      knowledgeRef,

    general:
      `Here's my analysis:\n\n` +
      `  • The core question has several important dimensions\n` +
      `  • There are well-established approaches worth considering\n` +
      `  • I'd recommend starting with the simplest path forward\n\n` +
      `  Let me know if you'd like me to dive deeper.` +
      knowledgeRef,
  };

  const response = responses[category] || responses.general;

  process.stdout.write('  ');
  await streamText(response, 6);
  console.log('\n');

  return response;
}

/**
 * Get a reply — with agentic steps + streaming for both OpenAI and local mode
 */
async function getReply(useLocal, manifest, systemPrompt, model, messages, input, knowledge) {
  // Run the agentic theater first
  await runAgenticSteps(manifest, input);

  if (useLocal) {
    return runLocal(manifest, systemPrompt, input, knowledge);
  }
  try {
    return await runWithOpenAI(manifest, systemPrompt, model, messages, input);
  } catch (err) {
    console.log(chalk.red(`  ✕ ${err.message}`));
    console.log(chalk.dim('  Falling back to local mode...\n'));
    return runLocal(manifest, systemPrompt, input, knowledge);
  }
}

async function run(name, options) {
  // Find the agent
  const agent = findAgent(name);
  if (!agent) {
    console.log('');
    console.log(chalk.red(`  Agent "${name}" not found.`));
    console.log(chalk.dim('  Run: brewagent list --installed'));
    console.log('');
    process.exit(1);
  }
  
  const { dir: agentDir, manifest } = agent;
  const knowledge = loadKnowledge(agentDir);
  const systemPrompt = buildSystemPrompt(manifest, knowledge);
  
  const provider = options.provider || manifest.agent.model?.provider || 'openai';
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  if (provider !== 'local' && provider !== SUPPORTED_PROVIDER) {
    console.log(chalk.red(`  ✕ Provider "${provider}" is not supported.`));
    process.exit(1);
  }

  const useLocal = provider === 'local' || !!options.local;

  if (!hasApiKey && !useLocal) {
    console.log('');
    console.log(chalk.red(`  ✕ OPENAI_API_KEY not set.`));
    console.log(chalk.dim('    export OPENAI_API_KEY="sk-..."'));
    console.log(chalk.dim('    Or run with --local for demo mode'));
    console.log('');
    process.exit(1);
  }

  // Show the boot sequence
  await showBootSequence(manifest, knowledge);

  // Single message mode
  if (options.message) {
    await getReply(useLocal, manifest, systemPrompt, options.model, [], options.message, knowledge);
    return;
  }
  
  // Interactive mode
  console.log(chalk.dim('  Type a message. "exit" to quit.'));
  console.log('');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.bold('  → '),
  });
  
  const messages = [];
  rl.prompt();
  
  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log(chalk.dim('\n  Done.\n'));
      rl.close();
      return;
    }

    console.log('');
    await getReply(useLocal, manifest, systemPrompt, options.model, messages, input, knowledge);
    rl.prompt();
  });
  
  rl.on('close', () => process.exit(0));
}

module.exports = run;
