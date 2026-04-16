const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { parseAgentId, getAgentDir, listRegistryAgents } = require('../utils/fs');
const { unpackAgent, inspectAgent } = require('../utils/agent-file');
const { INSTALLED_DIR, AGENT_EXT } = require('../utils/constants');
const { sanitizeManifestField } = require('../utils/validate');

async function install(nameOrPath, options) {
  console.log('');
  
  // Case 1: Installing from a .agent file path — only match regular files
  // (not directories) to avoid EISDIR errors when a directory shares the name
  if (nameOrPath.endsWith(AGENT_EXT) ||
      (fs.existsSync(nameOrPath) && fs.statSync(nameOrPath).isFile())) {
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
    // Inspect once and reuse the manifest (avoids parsing the zip twice)
    const info = inspectAgent(resolvedPath);
    const manifest = info.manifest;
    const author = sanitizeManifestField(manifest.author || '_local');
    const name = sanitizeManifestField(manifest.name);
    const targetDir = path.join(INSTALLED_DIR, author, name);
    
    // Unpack (extracts the zip; manifest already known from inspect)
    unpackAgent(resolvedPath, targetDir);
    
    spinner.succeed(`Installed ${chalk.bold(manifest.name)} v${manifest.version}`);
    console.log(`  ${chalk.dim('from')} ${path.basename(filePath)}`);
    console.log(`  ${chalk.dim('to')}   ${targetDir}`);
    console.log('');
    console.log(`  Run it: ${chalk.cyan(`agentbox run ${manifest.name}`)}`);
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
  
  // Use listRegistryAgents() to find agents, then do an exact match on the
  // filename pattern "<name>-<version>.agent". This avoids partial matches
  // (e.g. "foo" matching "foo-bar-1.0.0.agent") and respects scope.
  const allAgents = listRegistryAgents();

  // Build an exact-match pattern: the basename must start with "<name>-"
  // followed by a version and end with AGENT_EXT.
  const exactPattern = new RegExp(`^${escapeRegex(agentName)}-[^/]+\\${AGENT_EXT}$`);

  let agentFile = null;

  if (scope) {
    // Prioritise the scoped directory
    const scopePrefix = path.sep + scope + path.sep;
    agentFile = allAgents.find(f => f.includes(scopePrefix) && exactPattern.test(path.basename(f)));
  }

  // Fallback: search all registry agents (only when no scope was requested,
  // to avoid silently installing a different scope's package)
  if (!agentFile && !scope) {
    agentFile = allAgents.find(f => exactPattern.test(path.basename(f)));
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

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = install;
