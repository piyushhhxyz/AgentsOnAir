const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const { listInstalledAgents, parseAgentId } = require('../utils/fs');
const { readManifest } = require('../utils/agent-file');
const { INSTALLED_DIR } = require('../utils/constants');

/**
 * Find an installed agent by name
 */
function findAgent(name) {
  const { scope, name: agentName } = parseAgentId(name);
  const agents = listInstalledAgents();
  
  for (const agentDir of agents) {
    try {
      const manifest = readManifest(agentDir);
      if (manifest.name === agentName || manifest.name === name) {
        return { dir: agentDir, manifest };
      }
    } catch (e) {
      // skip invalid agents
    }
  }
  
  // Also check by directory name
  const possiblePaths = [
    path.join(INSTALLED_DIR, name),
    scope ? path.join(INSTALLED_DIR, scope, agentName) : null,
  ].filter(Boolean);
  
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'agent.yaml'))) {
      return { dir: p, manifest: readManifest(p) };
    }
  }
  
  return null;
}

/**
 * Load knowledge files content
 */
function loadKnowledge(agentDir, manifest) {
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
 * Run agent in local/demo mode — uses the system prompt to simulate agent behavior
 * This works without any API key for demo purposes
 */
function runLocal(manifest, systemPrompt, userMessage) {
  const name = manifest.name;
  const category = manifest.metadata?.category || 'general';
  
  // Simulate intelligent responses based on the agent's system prompt and category
  const responses = {
    research: [
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
      `- Confidence: High for market trends, Medium for specific predictions\n\n` +
      `_[${name} — research agent, powered by agentbox]_`,
    ],
    coding: [
      `Here's my code review analysis for "${userMessage}":\n\n` +
      `**Quality Score: 7/10**\n\n` +
      `Issues found:\n` +
      `- Consider adding error handling for edge cases\n` +
      `- The function could benefit from input validation\n` +
      `- Good use of patterns, but watch for potential memory leaks\n\n` +
      `_[${name} — coding agent, powered by agentbox]_`,
    ],
    writing: [
      `Here's what I've crafted for "${userMessage}":\n\n` +
      `**Option A (Direct — 47 words):**\n` +
      `Hey — saw your team just shipped [recent launch]. Impressive velocity.\n` +
      `We built a tool that cuts [specific pain point] by 40% for teams your size. Two-minute demo, no commitment. Worth a look?\n\n` +
      `**Option B (Value-first — 52 words):**\n` +
      `Quick thought: most dev teams at your stage spend 30% of eng time on [pain point]. We've helped 50+ teams reclaim that.\n` +
      `Happy to share the playbook — no strings. Reply "sure" and I'll send it over.\n\n` +
      `**Subject lines:** "Quick question about [company]" | "Saw your launch — one idea"\n\n` +
      `_[${name} — outreach agent, powered by agentbox]_`,
    ],
    finance: [
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
      `*Disclaimer: Consult a licensed CPA for your specific situation.*\n\n` +
      `_[${name} — tax agent, powered by agentbox]_`,
    ],
    general: [
      `Here's my analysis of "${userMessage}":\n\n` +
      `I've looked at this from multiple angles:\n` +
      `- The core question has several important dimensions\n` +
      `- There are well-established approaches worth considering\n` +
      `- I'd recommend starting with the simplest path forward\n\n` +
      `Let me know if you'd like me to dive deeper into any specific aspect.\n\n` +
      `_[${name} — powered by agentbox]_`,
    ],
  };
  
  const categoryResponses = responses[category] || responses.general;
  return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
}

async function run(name, options) {
  console.log('');
  
  // Find the agent
  const agent = findAgent(name);
  if (!agent) {
    console.log(chalk.red(`  Agent "${name}" not found.`));
    console.log('');
    console.log(chalk.dim('  Installed agents:'));
    console.log(chalk.dim('    agentbox list --installed'));
    console.log('');
    console.log(chalk.dim('  Install an agent first:'));
    console.log(chalk.dim('    agentbox install @user/agent-name'));
    console.log('');
    process.exit(1);
  }
  
  const { dir: agentDir, manifest } = agent;
  const knowledge = loadKnowledge(agentDir, manifest);
  const systemPrompt = buildSystemPrompt(manifest, knowledge);
  
  // Determine provider
  const provider = options.provider || manifest.agent.model?.provider || 'openai';
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const useLocal = provider === 'local' || (!hasApiKey && provider === 'openai');
  
  // Print agent info
  console.log(chalk.bold.cyan('  ┌─────────────────────────────────────────┐'));
  console.log(chalk.bold.cyan('  │') + ` 🤖 ${chalk.bold(manifest.name)} v${manifest.version}` + ' '.repeat(Math.max(0, 33 - manifest.name.length - manifest.version.length)) + chalk.bold.cyan('│'));
  console.log(chalk.bold.cyan('  │') + ` ${chalk.dim(manifest.description || '')}`.slice(0, 42).padEnd(42) + chalk.bold.cyan('│'));
  console.log(chalk.bold.cyan('  └─────────────────────────────────────────┘'));
  console.log('');
  
  if (useLocal && provider !== 'local') {
    console.log(chalk.yellow('  ⚠ No OPENAI_API_KEY found. Running in local demo mode.'));
    console.log(chalk.dim('    Set OPENAI_API_KEY to use the full LLM-powered agent.'));
    console.log(chalk.dim('    Or use: agentbox run ' + name + ' --provider ollama'));
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
    
    let reply;
    if (useLocal) {
      reply = runLocal(manifest, systemPrompt, options.message);
    } else {
      try {
        reply = await runWithOpenAI(manifest, systemPrompt, options.model, [], options.message);
      } catch (err) {
        console.log(chalk.red(`  Error: ${err.message}`));
        console.log(chalk.dim('  Falling back to local mode...'));
        console.log('');
        reply = runLocal(manifest, systemPrompt, options.message);
      }
    }
    
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
    
    let reply;
    if (useLocal) {
      reply = runLocal(manifest, systemPrompt, input);
    } else {
      try {
        reply = await runWithOpenAI(manifest, systemPrompt, options.model, messages, input);
      } catch (err) {
        reply = `Error: ${err.message}. Falling back to local mode.\n\n` + runLocal(manifest, systemPrompt, input);
      }
    }
    
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
