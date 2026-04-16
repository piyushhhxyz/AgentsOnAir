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

// ─── Streaming Helpers ───

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
 * Show a thinking step with spinner animation
 */
async function showStep(icon, text, durationMs = 600) {
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
 * Show the agent boot sequence — the "thinking" animation
 */
async function showBootSequence(manifest, knowledge) {
  const name = manifest.name;
  const category = manifest.metadata?.category || 'general';

  console.log('');
  console.log(`  ${chalk.bold.cyan('▸')} ${chalk.bold(name)} ${chalk.dim('v' + manifest.version)}`);
  console.log('');

  await showStep('✓', `Loading agent profile...`, 400);
  await showStep('✓', `System prompt loaded (${manifest.agent.system_prompt.length} chars)`, 350);

  if (knowledge.length > 0) {
    for (const k of knowledge) {
      await showStep('✓', `Reading knowledge: ${chalk.cyan(k.file)}`, 300);
    }
    await showStep('✓', `Knowledge base indexed (${knowledge.length} file${knowledge.length > 1 ? 's' : ''})`, 250);
  }

  await showStep('✓', `Connecting to ${chalk.cyan(manifest.agent.model?.name || 'gpt-4o-mini')}...`, 500);
  await showStep('✓', `Agent ready`, 200);

  console.log('');
  console.log(`  ${chalk.dim('─'.repeat(50))}`);
  console.log('');
}

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

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      // Indent new lines for clean formatting
      const formatted = delta.replace(/\n/g, '\n  ');
      process.stdout.write(formatted);
      fullReply += delta;
    }
  }

  console.log('\n');
  messages.push({ role: 'assistant', content: fullReply });
  return fullReply;
}

/**
 * Run agent in local/demo mode with simulated streaming
 */
async function runLocal(manifest, systemPrompt, userMessage, knowledge) {
  const name = manifest.name;
  const category = manifest.metadata?.category || 'general';

  // Build a knowledge-aware response
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

  // Stream the response character by character
  process.stdout.write('  ');
  await streamText(response, 6);
  console.log('\n');

  return response;
}

/**
 * Get a reply — streaming for both OpenAI and local mode
 */
async function getReply(useLocal, manifest, systemPrompt, model, messages, input, knowledge) {
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

  // Show the boot sequence (the cool part)
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
    await showStep('✓', 'Thinking...', 400);
    console.log('');

    await getReply(useLocal, manifest, systemPrompt, options.model, messages, input, knowledge);
    rl.prompt();
  });
  
  rl.on('close', () => process.exit(0));
}

module.exports = run;
