const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { parseAgentId, ensureDirs, getAgentDir } = require('../utils/fs');
const { unpackAgent, inspectAgent } = require('../utils/agent-file');
const { REGISTRY_DIR, INSTALLED_DIR, AGENT_EXT } = require('../utils/constants');

async function install(nameOrPath, options) {
  console.log('');
  ensureDirs();
  
  // Case 1: Installing from a .agent file path
  if (nameOrPath.endsWith(AGENT_EXT) || fs.existsSync(nameOrPath)) {
    return installFromFile(nameOrPath);
  }
  
  // Case 2: Installing from registry by name
  return installFromRegistry(nameOrPath);
}

async function installFromFile(filePath) {
  const resolvedPath = path.resolve(filePath);
  
  if (!fs.existsSync(resolvedPath)) {
    console.log(chalk.red(`  Error: File not found: ${filePath}`));
    console.log('');
    process.exit(1);
  }
  
  const spinner = ora({
    text: `Installing from ${chalk.bold(path.basename(filePath))}...`,
    prefixText: ' ',
  }).start();
  
  try {
    // Create a temp dir to inspect
    const manifest = inspectAgent(resolvedPath).manifest;
    const targetDir = path.join(INSTALLED_DIR, manifest.author || '_local', manifest.name);
    
    // Unpack
    const result = unpackAgent(resolvedPath, targetDir);
    
    spinner.succeed(`Installed ${chalk.bold(result.name)} v${result.version}`);
    console.log(`  ${chalk.dim('from')} ${path.basename(filePath)}`);
    console.log(`  ${chalk.dim('to')}   ${targetDir}`);
    console.log('');
    console.log(`  Run it: ${chalk.cyan(`agentbox run ${result.name}`)}`);
    console.log('');
  } catch (err) {
    spinner.fail('Installation failed');
    console.log(chalk.red(`  ${err.message}`));
    console.log('');
    process.exit(1);
  }
}

async function installFromRegistry(name) {
  const { scope, name: agentName, fullName } = parseAgentId(name);
  
  const spinner = ora({
    text: `Looking up ${chalk.bold(fullName)} in registry...`,
    prefixText: ' ',
  }).start();
  
  // Search registry for matching .agent file
  let agentFile = null;
  
  if (scope) {
    // Look in scope directory
    const scopeDir = path.join(REGISTRY_DIR, scope);
    if (fs.existsSync(scopeDir)) {
      const files = fs.readdirSync(scopeDir);
      agentFile = files.find(f => f.startsWith(agentName) && f.endsWith(AGENT_EXT));
      if (agentFile) {
        agentFile = path.join(scopeDir, agentFile);
      }
    }
  }
  
  // Also search flat registry
  if (!agentFile) {
    const allFiles = fs.readdirSync(REGISTRY_DIR).filter(f => !fs.statSync(path.join(REGISTRY_DIR, f)).isDirectory());
    const match = allFiles.find(f => f.startsWith(agentName) && f.endsWith(AGENT_EXT));
    if (match) {
      agentFile = path.join(REGISTRY_DIR, match);
    }
  }
  
  // Deep search in subdirectories
  if (!agentFile) {
    function findInDir(dir) {
      if (!fs.existsSync(dir)) return null;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = findInDir(fullPath);
          if (found) return found;
        } else if (entry.name.startsWith(agentName) && entry.name.endsWith(AGENT_EXT)) {
          return fullPath;
        }
      }
      return null;
    }
    agentFile = findInDir(REGISTRY_DIR);
  }
  
  if (!agentFile) {
    spinner.fail(`Agent ${chalk.bold(fullName)} not found in registry`);
    console.log('');
    console.log(chalk.dim('  Available agents:'));
    console.log(chalk.dim(`    agentbox list`));
    console.log('');
    console.log(chalk.dim('  Or install from a .agent file:'));
    console.log(chalk.dim(`    agentbox install ./path/to/agent.agent`));
    console.log('');
    process.exit(1);
  }
  
  spinner.text = `Installing ${chalk.bold(fullName)}...`;
  
  try {
    const targetDir = getAgentDir(scope, agentName);
    const manifest = unpackAgent(agentFile, targetDir);
    
    spinner.succeed(`Installed ${chalk.bold(fullName)} v${manifest.version}`);
    console.log('');
    console.log(`  ${chalk.dim('Author:')}   ${manifest.author || 'unknown'}`);
    console.log(`  ${chalk.dim('Category:')} ${manifest.metadata?.category || 'general'}`);
    console.log(`  ${chalk.dim('Location:')} ${targetDir}`);
    console.log('');
    console.log(`  Run it: ${chalk.cyan(`agentbox run ${agentName}`)}`);
    console.log('');
  } catch (err) {
    spinner.fail('Installation failed');
    console.log(chalk.red(`  ${err.message}`));
    console.log('');
    process.exit(1);
  }
}

module.exports = install;
