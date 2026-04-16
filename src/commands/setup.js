const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const { BREWAGENT_HOME } = require('../utils/constants');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function setup() {
  const configPath = path.join(BREWAGENT_HOME, 'config.json');
  fs.mkdirSync(BREWAGENT_HOME, { recursive: true });

  // Load existing config
  let config = {};
  if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
  }

  console.log('');
  console.log(chalk.bold('  🤖 brewagent setup'));
  console.log(chalk.dim('  ─────────────────────────────────'));
  console.log('');
  console.log(chalk.dim('  Configure brewagent for first use.'));
  console.log(chalk.dim('  Press Enter to keep existing values.\n'));

  // OpenAI API Key
  const currentKey = config.openai_api_key || process.env.OPENAI_API_KEY || '';
  const maskedKey = currentKey ? currentKey.slice(0, 8) + '...' + currentKey.slice(-4) : 'not set';
  const newKey = await prompt(chalk.bold(`  OpenAI API Key `) + chalk.dim(`[${maskedKey}]: `));
  if (newKey) {
    config.openai_api_key = newKey;
  }

  // Default author name
  const currentAuthor = config.default_author || '';
  const newAuthor = await prompt(chalk.bold(`  Your name `) + chalk.dim(`[${currentAuthor || 'not set'}]: `));
  if (newAuthor) {
    config.default_author = newAuthor;
  }

  // Save config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log('');
  console.log(chalk.green('  ✓ Config saved to ') + chalk.dim(configPath));
  console.log('');

  // Show status
  const hasKey = !!(config.openai_api_key || process.env.OPENAI_API_KEY);
  console.log(chalk.bold('  Status:'));
  console.log(`  ${hasKey ? chalk.green('✓') : chalk.yellow('⚠')} OpenAI API Key: ${hasKey ? chalk.green('configured') : chalk.yellow('not set (demo mode only)')}`);
  console.log(`  ${config.default_author ? chalk.green('✓') : chalk.dim('○')} Author: ${config.default_author || chalk.dim('not set')}`);
  console.log('');
  console.log(chalk.dim('  You\'re all set! Try:'));
  console.log(chalk.bold('    brewagent install <file.agent>'));
  console.log(chalk.bold('    brewagent run <agent-name> -m "hello"'));
  console.log('');
}

module.exports = setup;
