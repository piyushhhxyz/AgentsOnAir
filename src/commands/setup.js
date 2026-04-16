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

async function setup(options) {
  const configPath = path.join(BREWAGENT_HOME, 'config.json');
  fs.mkdirSync(BREWAGENT_HOME, { recursive: true });

  // Load existing config
  let config = {};
  if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
  }

  // Non-interactive mode: flag provided directly
  if (options.author) {
    config.default_author = options.author;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log('');
    console.log(chalk.green('  ✓ Config saved!'));
    console.log(chalk.green('  ✓') + ` Author: ${options.author}`);
    console.log('');
    return;
  }

  // Interactive mode
  console.log('');
  console.log(chalk.bold('  🤖 brewagent setup'));
  console.log(chalk.dim('  ─────────────────────────────────'));
  console.log('');
  console.log(chalk.dim('  Configure brewagent for first use.'));
  console.log(chalk.dim('  Press Enter to keep existing values.\n'));

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
  const hasKey = !!process.env.OPENAI_API_KEY;
  console.log(chalk.bold('  Status:'));
  console.log(`  ${hasKey ? chalk.green('✓') : chalk.yellow('⚠')} OpenAI API Key: ${hasKey ? chalk.green('set via environment') : chalk.yellow('not set — run: export OPENAI_API_KEY="sk-..."')}`);
  console.log(`  ${config.default_author ? chalk.green('✓') : chalk.dim('○')} Author: ${config.default_author || chalk.dim('not set')}`);
  console.log('');
  console.log(chalk.dim('  You\'re all set! Try:'));
  console.log(chalk.bold('    brewagent install <file.agent>'));
  console.log(chalk.bold('    brewagent run <agent-name> -m "hello"'));
  console.log('');
}

module.exports = setup;
