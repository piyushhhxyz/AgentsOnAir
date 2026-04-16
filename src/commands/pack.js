const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { packAgent, readAndValidateManifest } = require('../utils/agent-file');

async function pack(dir, options) {
  const sourceDir = dir ? path.resolve(dir) : process.cwd();
  
  console.log('');
  
  // Read and validate manifest (shared helper)
  const manifest = readAndValidateManifest(sourceDir);
  
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
