const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const yaml = require('js-yaml');
const AdmZip = require('adm-zip');
const { ensureDirs, listRegistryAgents, listInstalledAgents } = require('../utils/fs');
const { readManifest, inspectAgent } = require('../utils/agent-file');

const CATEGORY_ICONS = {
  general: '🤖',
  research: '🔬',
  coding: '💻',
  writing: '✍️',
  data: '📊',
  automation: '⚙️',
};

async function list(options) {
  console.log('');
  ensureDirs();
  
  if (options.installed) {
    return listInstalled();
  }
  
  return listRegistry();
}

function listRegistry() {
  const agentFiles = listRegistryAgents();
  
  if (agentFiles.length === 0) {
    console.log(chalk.dim('  No agents in the registry yet.'));
    console.log('');
    console.log(chalk.dim('  Publish your first agent:'));
    console.log(chalk.dim('    agentbox init my-agent'));
    console.log(chalk.dim('    cd my-agent'));
    console.log(chalk.dim('    agentbox publish .'));
    console.log('');
    return;
  }
  
  console.log(chalk.bold('  📦 Agent Registry'));
  console.log(chalk.dim('  ─────────────────────────────────────────'));
  console.log('');
  
  for (const agentFile of agentFiles) {
    try {
      const info = inspectAgent(agentFile);
      const m = info.manifest;
      const icon = CATEGORY_ICONS[m.metadata?.category] || '🤖';
      const sizeKB = (info.compressedSize / 1024).toFixed(1);
      const author = m.author || 'unknown';
      
      console.log(`  ${icon} ${chalk.bold(`@${author}/${m.name}`)} ${chalk.dim(`v${m.version}`)} ${chalk.dim(`(${sizeKB} KB)`)}`);
      console.log(`    ${chalk.dim(m.description || 'No description')}`);
      
      if (m.metadata?.tags?.length) {
        const tags = m.metadata.tags.map(t => chalk.dim(`#${t}`)).join(' ');
        console.log(`    ${tags}`);
      }
      console.log('');
    } catch (e) {
      console.log(`  ${chalk.dim('?')} ${chalk.dim(path.basename(agentFile))} ${chalk.red('(invalid)')}`);
      console.log('');
    }
  }
  
  console.log(chalk.dim('  Install: agentbox install @author/agent-name'));
  console.log('');
}

function listInstalled() {
  const agentDirs = listInstalledAgents();
  
  if (agentDirs.length === 0) {
    console.log(chalk.dim('  No agents installed.'));
    console.log('');
    console.log(chalk.dim('  Install one:'));
    console.log(chalk.dim('    agentbox install @piyush/tax-agent'));
    console.log('');
    return;
  }
  
  console.log(chalk.bold('  📥 Installed Agents'));
  console.log(chalk.dim('  ─────────────────────────────────────────'));
  console.log('');
  
  for (const agentDir of agentDirs) {
    try {
      const m = readManifest(agentDir);
      const icon = CATEGORY_ICONS[m.metadata?.category] || '🤖';
      
      console.log(`  ${icon} ${chalk.bold(m.name)} ${chalk.dim(`v${m.version}`)}`);
      console.log(`    ${chalk.dim(m.description || 'No description')}`);
      console.log(`    ${chalk.dim('Run:')} ${chalk.cyan(`agentbox run ${m.name}`)}`);
      console.log('');
    } catch (e) {
      console.log(`  ${chalk.dim('?')} ${chalk.dim(path.basename(agentDir))} ${chalk.red('(invalid)')}`);
      console.log('');
    }
  }
}

module.exports = list;
