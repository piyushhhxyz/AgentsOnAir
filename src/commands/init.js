const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const yaml = require('js-yaml');

// Templates for different agent types
const TEMPLATES = {
  default: {
    system_prompt: 'You are a helpful AI assistant. Answer questions clearly and concisely.',
    category: 'general',
    tags: ['general', 'assistant'],
  },
  research: {
    system_prompt: `You are a deep research assistant. When given a topic:
1. Break it down into key subtopics
2. Provide comprehensive analysis with facts and data
3. Cite sources when possible
4. Present findings in a structured, readable format
5. Highlight key insights and actionable takeaways

Always be thorough but concise. Use bullet points and headers for clarity.`,
    category: 'research',
    tags: ['research', 'analysis', 'deep-dive'],
  },
  'code-review': {
    system_prompt: `You are an expert code reviewer. When given code:
1. Identify bugs, security issues, and performance problems
2. Suggest improvements with specific code examples
3. Check for best practices and design patterns
4. Rate code quality on a scale of 1-10
5. Provide a summary of findings

Be constructive and specific. Always explain WHY something is an issue.`,
    category: 'coding',
    tags: ['code-review', 'programming', 'quality'],
  },
  outreach: {
    system_prompt: `You are a cold outreach specialist. When given a target audience or product:
1. Craft personalized, non-spammy outreach messages
2. Focus on value proposition, not features
3. Keep messages short (under 150 words)
4. Include a clear, low-friction CTA
5. Generate multiple variants for A/B testing

Tone: Professional but human. Never sound like a template.`,
    category: 'writing',
    tags: ['outreach', 'sales', 'email', 'marketing'],
  },
};

async function init(name, options) {
  const agentName = name || 'my-agent';
  const dir = path.join(process.cwd(), agentName);
  const template = options.template || 'default';
  
  if (fs.existsSync(dir)) {
    console.log(chalk.red(`\n  Error: Directory "${agentName}" already exists.\n`));
    process.exit(1);
  }
  
  const tmpl = TEMPLATES[template] || TEMPLATES.default;
  
  // Create directory structure
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'knowledge'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  
  // Build manifest
  const manifest = {
    name: agentName,
    version: '1.0.0',
    description: `A ${template} AI agent`,
    author: process.env.USER || 'anonymous',
    agent: {
      system_prompt: tmpl.system_prompt,
      model: {
        provider: 'openai',
        name: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 2048,
      },
      tools: [],
      knowledge: [],
    },
    metadata: {
      category: tmpl.category,
      tags: tmpl.tags,
      license: 'MIT',
    },
  };
  
  // Write agent.yaml
  const yamlContent = yaml.dump(manifest, { lineWidth: 80, noRefs: true });
  fs.writeFileSync(path.join(dir, 'agent.yaml'), yamlContent);
  
  // Write README
  fs.writeFileSync(path.join(dir, 'README.md'), `# ${agentName}

> ${manifest.description}

## Usage

\`\`\`bash
# Pack this agent
agentbox pack .

# Run this agent
agentbox run ${agentName}
\`\`\`

## About

Created with [agentbox](https://github.com/piyushhhxyz/AgentsOnAir) — the npm for AI agents.
`);
  
  // Write .gitignore
  fs.writeFileSync(path.join(dir, '.gitignore'), `*.agent\nnode_modules/\n`);
  
  console.log('');
  console.log(chalk.green('  ✓ Agent initialized!'));
  console.log('');
  console.log(`  ${chalk.bold(agentName)}/`);
  console.log(`  ├── ${chalk.cyan('agent.yaml')}      # Agent manifest (the brain)`);
  console.log(`  ├── ${chalk.cyan('knowledge/')}      # Knowledge files (RAG context)`);
  console.log(`  ├── ${chalk.cyan('tools/')}          # Custom tool scripts`);
  console.log(`  ├── ${chalk.dim('README.md')}`);
  console.log(`  └── ${chalk.dim('.gitignore')}`);
  console.log('');
  console.log(`  Template: ${chalk.yellow(template)}`);
  console.log('');
  console.log(chalk.dim('  Next steps:'));
  console.log(`    cd ${agentName}`);
  console.log(`    ${chalk.cyan('agentbox pack .')}        # Create .agent file`);
  console.log(`    ${chalk.cyan('agentbox publish .')}     # Publish to registry`);
  console.log('');
}

module.exports = init;
