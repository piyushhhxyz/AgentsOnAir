#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const pkg = require('../package.json');

const initCmd = require('./commands/init');
const packCmd = require('./commands/pack');
const installCmd = require('./commands/install');
const runCmd = require('./commands/run');
const publishCmd = require('./commands/publish');
const listCmd = require('./commands/list');
const inspectCmd = require('./commands/inspect');
const registryCmd = require('./commands/registry');

const program = new Command();

program
  .name('brewagent')
  .description(chalk.bold('brewagent') + ' — the npm for AI agents. Pack, share, install, run.')
  .version(pkg.version);

program
  .command('init [name]')
  .description('Initialize a new agent project')
  .option('-t, --template <template>', 'Use a template (research, code-review, outreach)', 'default')
  .action(initCmd);

program
  .command('pack [dir]')
  .description('Pack an agent directory into a .agent file')
  .option('-o, --output <path>', 'Output file path')
  .action(packCmd);

program
  .command('install <name>')
  .description('Install an agent from the registry (e.g. @piyush/tax-agent)')
  .option('-g, --global', 'Install globally')
  .action(installCmd);

program
  .command('run <name>')
  .description('Run an installed agent')
  .option('-m, --message <msg>', 'Initial message to send')
  .option('-i, --interactive', 'Run in interactive mode', false)
  .option('--model <model>', 'Override the LLM model')
  .option('--provider <provider>', 'Override the LLM provider (openai, anthropic, ollama)')
  .action(runCmd);

program
  .command('publish [dir]')
  .description('Publish an agent to the local registry')
  .action(publishCmd);

program
  .command('list')
  .alias('ls')
  .description('List available agents in the registry')
  .option('-i, --installed', 'Show only installed agents')
  .action(listCmd);

program
  .command('inspect <file>')
  .description('Inspect a .agent file without installing')
  .action(inspectCmd);

program
  .command('registry')
  .description('Show registry info and stats')
  .action(registryCmd);

// Banner — box width is computed dynamically so the right border stays
// aligned regardless of version string length (e.g. 0.1.0 vs 0.10.0).
if (process.argv.length <= 2) {
  const BOX_INNER = 39; // character width between ║ borders
  const pad = (text) => text.padEnd(BOX_INNER);
  const border = '═'.repeat(BOX_INNER);
  console.log('');
  console.log(chalk.bold.cyan(`  ╔${border}╗`));
  console.log(chalk.bold.cyan('  ║') + chalk.bold(pad(`   🤖 brewagent v${pkg.version}`)) + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('  ║') + pad('   The npm for AI agents.') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('  ║') + pad('   Pack. Share. Install. Run.') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan(`  ╚${border}╝`));
  console.log('');
}

program.parse();
