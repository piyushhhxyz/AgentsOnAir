const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { packAgent, readManifest, validateManifest } = require('../utils/agent-file');
const { ensureDirs } = require('../utils/fs');
const { REGISTRY_DIR } = require('../utils/constants');

async function publish(dir) {
  const sourceDir = dir ? path.resolve(dir) : process.cwd();
  
  console.log('');
  ensureDirs();
  
  // Read and validate manifest
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
  
  const author = manifest.author || '_local';
  const scopeDir = path.join(REGISTRY_DIR, author);
  
  if (!fs.existsSync(scopeDir)) {
    fs.mkdirSync(scopeDir, { recursive: true });
  }
  
  const outputPath = path.join(scopeDir, `${manifest.name}-${manifest.version}.agent`);
  
  const spinner = ora({
    text: `Publishing ${chalk.bold(`@${author}/${manifest.name}`)} v${manifest.version}...`,
    prefixText: ' ',
  }).start();
  
  try {
    const result = await packAgent(sourceDir, outputPath);
    const sizeKB = (result.size / 1024).toFixed(1);
    
    spinner.succeed(`Published ${chalk.bold(`@${author}/${manifest.name}`)} v${manifest.version}`);
    console.log('');
    console.log(`  ${chalk.dim('Package:')}  ${path.basename(outputPath)} (${sizeKB} KB)`);
    console.log(`  ${chalk.dim('Registry:')} ${scopeDir}`);
    console.log('');
    console.log(chalk.dim('  Others can now install it:'));
    console.log(`    ${chalk.cyan(`agentbox install @${author}/${manifest.name}`)}`);
    console.log('');
  } catch (err) {
    spinner.fail('Publish failed');
    console.log(chalk.red(`  ${err.message}`));
    console.log('');
    process.exit(1);
  }
}

module.exports = publish;
