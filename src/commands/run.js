const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const { listInstalledAgents, parseAgentId } = require('../utils/fs');
const { readManifest } = require('../utils/agent-file');

/**
 * Find an installed agent by name.
 * When a scope is provided (e.g. @user/agent), the manifest's author must
 * match, so `@aaa/foo` and `@zzz/foo` are correctly distinguished.
 */
function findAgent(name) {
  const { scope, name: agentName } = parseAgentId(name);
  const agents = listInstalledAgents();
  
  for (const agentDir of agents) {
    try {
      const manifest = readManifest(agentDir);
      const nameMatches = manifest.name === agentName || manifest.name === name;
      if (!nameMatches) continue;

      // When a scope is requested, verify the manifest author matches
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

// Only OpenAI has a real backend implementation today.
const SUPPORTED_PROVIDER = 'openai';

/**
 * Run agent with OpenAI API
 */
async function runWithOpenAI(manifest, systemPrompt, model, messages, userMessage) {
  const { default: OpenAI } = require('openai');
  const client = new OpenAI();
  
  const modelName = model || manifest.agent.model?.name || 'gpt-4o-mini';
  
  messages.push({ role: 'user', content: userMessage });
  
  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: manifest.agent.model?.temperature || 0.7,
    max_tokens: manifest.agent.model?.max_tokens || 2048,
  });
  
  const reply = response.choices[0].message.content;
  messages.push({ role: 'assistant', content: reply });
  return reply;
}

/**
 * Build a knowledge reference string from loaded knowledge files.
 * Returns an empty string when no knowledge is present.
 */
function buildKnowledgeRef(knowledge) {
  if (!knowledge || knowledge.length === 0) return '';

  const sourcesList = '📚 **Sources referenced:** ' + knowledge.map(k => k.file).join(', ');

  // Extract a readable snippet from the first knowledge file
  const rawLines = knowledge[0].content.slice(0, 300).split('\n');
  const contentLines = rawLines.filter(l => l.trim() && !l.startsWith('#'));
  const snippet = contentLines.slice(0, 3).join('\n  ');

  if (snippet) {
    return `\n\n📚 **From knowledge base (${knowledge[0].file}):**\n  ${snippet}\n` + sourcesList;
  }
  return '\n\n' + sourcesList;
}

// Demo response templates — one per category.
// Each is a function(userMessage, name, knowledgeRef) → string.
const DEMO_RESPONSES = {
  research: (userMessage, name, knowledgeRef) =>
    `Based on my deep-dive into "${userMessage}", here are the key findings:\n\n` +
    `## Overview\n` +
    `This is a rapidly evolving space with several key dimensions worth examining.\n\n` +
    `## Key Findings\n` +
    `1. **Market Landscape**: Multiple competing approaches exist, each with distinct trade-offs\n` +
    `2. **Emerging Patterns**: Consolidation around open standards is accelerating\n` +
    `3. **Data Points**: Industry reports suggest 3x growth in adoption over the past 12 months\n` +
    `4. **Non-obvious Insight**: The biggest bottleneck isn't technology — it's distribution\n\n` +
    `## Key Takeaways\n` +
    `- Start with the dominant approach, then evaluate alternatives\n` +
    `- Watch for standardization efforts — they'll shape the next wave\n` +
    `- Confidence: High for market trends, Medium for specific predictions` +
    knowledgeRef +
    `\n\n_[${name} — research agent, powered by brewagent]_`,

  coding: (userMessage, name, knowledgeRef) =>
    `Here's my code review analysis for "${userMessage}":\n\n` +
    `**Quality Score: 7/10**\n\n` +
    `Issues found:\n` +
    `- Consider adding error handling for edge cases\n` +
    `- The function could benefit from input validation\n` +
    `- Good use of patterns, but watch for potential memory leaks` +
    knowledgeRef +
    `\n\n_[${name} — coding agent, powered by brewagent]_`,

  writing: (userMessage, name, knowledgeRef) =>
    `Here's what I've crafted for "${userMessage}":\n\n` +
    `**Option A (Direct — 47 words):**\n` +
    `Hey — saw your team just shipped [recent launch]. Impressive velocity.\n` +
    `We built a tool that cuts [specific pain point] by 40% for teams your size. Two-minute demo, no commitment. Worth a look?\n\n` +
    `**Option B (Value-first — 52 words):**\n` +
    `Quick thought: most dev teams at your stage spend 30% of eng time on [pain point]. We've helped 50+ teams reclaim that.\n` +
    `Happy to share the playbook — no strings. Reply "sure" and I'll send it over.\n\n` +
    `**Subject lines:** "Quick question about [company]" | "Saw your launch — one idea"` +
    knowledgeRef +
    `\n\n_[${name} — outreach agent, powered by brewagent]_`,

  finance: (userMessage, name, knowledgeRef) =>
    `Great question about "${userMessage}"! Here's what you should know:\n\n` +
    `## Key Deductions & Strategies\n` +
    `- **Home Office**: $5/sq ft simplified method, up to 300 sq ft ($1,500 max)\n` +
    `- **Self-Employment Tax**: Deduct 50% of SE tax from gross income\n` +
    `- **Health Insurance**: 100% deductible if self-employed\n` +
    `- **Retirement**: SEP-IRA contributions up to 25% of net earnings\n` +
    `- **Equipment**: Section 179 for immediate expensing of business assets\n\n` +
    `## Important Reminders\n` +
    `- Standard deduction for 2024: $14,600 (single)\n` +
    `- Estimated tax payments due quarterly (next: Jan 15)\n` +
    `- Keep receipts for everything — the IRS requires documentation\n\n` +
    `*Disclaimer: Consult a licensed CPA for your specific situation.*` +
    knowledgeRef +
    `\n\n_[${name} — tax agent, powered by brewagent]_`,

  general: (userMessage, name, knowledgeRef) =>
    `Here's my analysis of "${userMessage}":\n\n` +
    `I've looked at this from multiple angles:\n` +
    `- The core question has several important dimensions\n` +
    `- There are well-established approaches worth considering\n` +
    `- I'd recommend starting with the simplest path forward\n\n` +
    `Let me know if you'd like me to dive deeper into any specific aspect.` +
    knowledgeRef +
    `\n\n_[${name} — powered by brewagent]_`,
};

/**
 * Run agent in local/demo mode — uses the system prompt to simulate agent behavior.
 * This works without any API key for demo purposes.
 */
function runLocal(manifest, systemPrompt, userMessage, knowledge) {
  const name = manifest.name;
  const category = manifest.metadata?.category || 'general';
  const knowledgeRef = buildKnowledgeRef(knowledge);
  const templateFn = DEMO_RESPONSES[category] || DEMO_RESPONSES.general;
  return templateFn(userMessage, name, knowledgeRef);
}

/**
 * Get a reply from either local mode or the OpenAI API, with automatic
 * fallback to local mode on API errors.
 */
async function getReply(useLocal, manifest, systemPrompt, model, messages, input, knowledge) {
  if (useLocal) {
    return runLocal(manifest, systemPrompt, input, knowledge);
  }
  try {
    return await runWithOpenAI(manifest, systemPrompt, model, messages, input);
  } catch (err) {
    console.log(chalk.red(`  Error: ${err.message}`));
    console.log(chalk.dim('  Falling back to local mode...'));
    console.log('');
    return runLocal(manifest, systemPrompt, input, knowledge);
  }
}

async function run(name, options) {
  console.log('');
  
  // Find the agent
  const agent = findAgent(name);
  if (!agent) {
    console.log(chalk.red(`  Agent "${name}" not found.`));
    console.log('');
    console.log(chalk.dim('  Installed agents:'));
    console.log(chalk.dim('    brewagent list --installed'));
    console.log('');
    console.log(chalk.dim('  Install an agent first:'));
    console.log(chalk.dim('    brewagent install @user/agent-name'));
    console.log('');
    process.exit(1);
  }
  
  const { dir: agentDir, manifest } = agent;
  const knowledge = loadKnowledge(agentDir);
  const systemPrompt = buildSystemPrompt(manifest, knowledge);
  
  // Determine provider
  const provider = options.provider || manifest.agent.model?.provider || 'openai';

  // Load API key: env var takes priority, then config file from `brewagent setup`
  if (!process.env.OPENAI_API_KEY) {
    const { BREWAGENT_HOME } = require('../utils/constants');
    const configPath = path.join(BREWAGENT_HOME, 'config.json');
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.openai_api_key) {
        process.env.OPENAI_API_KEY = config.openai_api_key;
      }
    } catch {}
  }
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  // Reject unsupported remote providers early instead of silently falling
  // through to the OpenAI client.
  if (provider !== 'local' && provider !== SUPPORTED_PROVIDER) {
    console.log(chalk.red(`  Error: Provider "${provider}" is not yet supported.`));
    console.log(chalk.dim(`  Supported providers: ${SUPPORTED_PROVIDER}, local`));
    console.log('');
    process.exit(1);
  }

  const useLocal = provider === 'local' || (!hasApiKey && provider === SUPPORTED_PROVIDER);
  
  // Print agent info
  console.log(chalk.bold.cyan('  ┌─────────────────────────────────────────┐'));
  console.log(chalk.bold.cyan('  │') + ` 🤖 ${chalk.bold(manifest.name)} v${manifest.version}` + ' '.repeat(Math.max(0, 35 - manifest.name.length - manifest.version.length)) + chalk.bold.cyan('│'));
  console.log(chalk.bold.cyan('  │') + chalk.dim((' ' + (manifest.description || '')).slice(0, 41).padEnd(41)) + chalk.bold.cyan('│'));
  console.log(chalk.bold.cyan('  └─────────────────────────────────────────┘'));
  console.log('');
  
  if (useLocal && provider !== 'local') {
    console.log(chalk.yellow('  ⚠ No API key found. Running in local demo mode.'));
    console.log(chalk.dim('    Run `brewagent setup` to configure your OpenAI key.'));
    console.log('');
  }
  
  const modeLabel = useLocal ? chalk.yellow('local/demo') : chalk.green(provider);
  console.log(`  ${chalk.dim('Provider:')}  ${modeLabel}`);
  console.log(`  ${chalk.dim('Model:')}     ${options.model || manifest.agent.model?.name || 'gpt-4o-mini'}`);
  console.log(`  ${chalk.dim('Knowledge:')} ${knowledge.length} file(s) loaded`);
  console.log('');
  
  // Single message mode
  if (options.message) {
    console.log(chalk.dim('  You: ') + options.message);
    console.log('');
    
    const reply = await getReply(useLocal, manifest, systemPrompt, options.model, [], options.message, knowledge);
    
    console.log(chalk.cyan('  Agent: ') + reply);
    console.log('');
    return;
  }
  
  // Interactive mode
  console.log(chalk.dim('  Type your message and press Enter. Type "exit" to quit.'));
  console.log(chalk.dim('  ─────────────────────────────────────────'));
  console.log('');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.bold('  You: '),
  });
  
  const messages = [];
  
  rl.prompt();
  
  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log('');
      console.log(chalk.dim('  Session ended. Goodbye!'));
      console.log('');
      rl.close();
      return;
    }
    
    const reply = await getReply(useLocal, manifest, systemPrompt, options.model, messages, input, knowledge);
    
    console.log('');
    console.log(chalk.cyan('  Agent: ') + reply);
    console.log('');
    rl.prompt();
  });
  
  rl.on('close', () => {
    process.exit(0);
  });
}

module.exports = run;
