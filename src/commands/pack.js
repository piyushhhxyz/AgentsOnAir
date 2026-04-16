const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { packAgent, readManifest, validateManifest } = require('../utils/agent-file');

async function pack(dir, options) {
  const sourceDir = dir ? path.resolve(dir) : process.cwd();
  
  console.log('');
  
  // Validate manifest first
  let manifest;
  try {
    manifest = readManifest(sourceDir);
  } catch (err) {
    console.log(chalk.red(`  Error: ${err.message}`));
    console.log(chalk.dim('  Make sure you\'re in an agent directory with an agent.yaml file.'));
    console.log('');
    process.exit(1);
  }
  
  const validation = validateManifest(manifest);
  if (!validation.valid) {
    console.log(chalk.red('  Validation errors:'));
    for (const err of validation.errors) {
      console.log(chalk.red(`    • ${err}`));
    }
    console.log('');
    process.exit(1);
  }
  
  const spinner = ora({
    text: `Packing ${chalk.bold(manifest.name)} v${manifest.version}...`,
    prefixText: ' ',
  }).start();
  
  try {
    const result = await packAgent(sourceDir, options.output);
    spinner.succeed(`Packed ${chalk.bold(manifest.name)} v${manifest.version}`);
    
    const sizeKB = (result.size / 1024).toFixed(1);
    console.log('');
    console.log(`  ${chalk.cyan('→')} ${chalk.bold(path.basename(result.path))}  ${chalk.dim(`(${sizeKB} KB)`)}`);
    console.log('');
    console.log(chalk.dim('  This file contains your entire agent. Share it anywhere:'));
    console.log(chalk.dim('    • AirDrop it to a friend'));
    console.log(chalk.dim('    • Upload to a shared drive'));
    console.log(chalk.dim('    • Post it on the internet'));
    console.log(chalk.dim('    • Publish: agentbox publish .'));
    console.log('');
  } catch (err) {
    spinner.fail('Failed to pack agent');
    console.log(chalk.red(`  ${err.message}`));
    console.log('');
    process.exit(1);
  }
}

module.exports = pack;
