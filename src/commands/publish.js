const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { packAgent, readAndValidateManifest } = require('../utils/agent-file');
const { ensureDirs } = require('../utils/fs');
const { REGISTRY_DIR } = require('../utils/constants');
const { sanitizeManifestField } = require('../utils/validate');

async function publish(dir) {
  const sourceDir = dir ? path.resolve(dir) : process.cwd();
  
  console.log('');
  ensureDirs();
  
  // Read and validate manifest (shared helper)
  const manifest = readAndValidateManifest(sourceDir);
  
  const author = sanitizeManifestField(manifest.author || '_local');
  const agentName = sanitizeManifestField(manifest.name);
  const scopeDir = path.join(REGISTRY_DIR, author);
  
  fs.mkdirSync(scopeDir, { recursive: true });
  
  const outputPath = path.join(scopeDir, `${agentName}-${manifest.version}.agent`);
  
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
