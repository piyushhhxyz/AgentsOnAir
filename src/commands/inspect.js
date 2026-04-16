const path = require('path');
const chalk = require('chalk');
const { inspectAgent } = require('../utils/agent-file');

async function inspect(file) {
  const filePath = path.resolve(file);
  
  console.log('');
  
  try {
    const info = inspectAgent(filePath);
    const manifest = info.manifest;
    
    console.log(chalk.bold('  🔍 Agent Inspection'));
    console.log(chalk.dim('  ─────────────────────────────────────────'));
    console.log('');
    console.log(`  ${chalk.dim('Name:')}        ${chalk.bold(manifest.name)}`);
    console.log(`  ${chalk.dim('Version:')}     ${manifest.version}`);
    console.log(`  ${chalk.dim('Author:')}      ${manifest.author || 'unknown'}`);
    console.log(`  ${chalk.dim('Description:')} ${manifest.description || 'none'}`);
    console.log(`  ${chalk.dim('Category:')}    ${manifest.metadata?.category || 'general'}`);
    console.log(`  ${chalk.dim('Tags:')}        ${(manifest.metadata?.tags || []).join(', ') || 'none'}`);
    console.log(`  ${chalk.dim('License:')}     ${manifest.metadata?.license || 'none'}`);
    console.log('');
    
    // Model info
    if (manifest.agent?.model) {
      console.log(chalk.bold('  Model Configuration'));
      console.log(`  ${chalk.dim('Provider:')}    ${manifest.agent.model.provider || 'openai'}`);
      console.log(`  ${chalk.dim('Model:')}       ${manifest.agent.model.name || 'gpt-4o-mini'}`);
      console.log(`  ${chalk.dim('Temperature:')} ${manifest.agent.model.temperature ?? 0.7}`);
      console.log(`  ${chalk.dim('Max Tokens:')}  ${manifest.agent.model.max_tokens ?? 2048}`);
      console.log('');
    }
    
    // System prompt preview
    if (manifest.agent?.system_prompt) {
      console.log(chalk.bold('  System Prompt'));
      const lines = manifest.agent.system_prompt.split('\n').slice(0, 5);
      for (const line of lines) {
        console.log(`  ${chalk.dim('│')} ${line}`);
      }
      if (manifest.agent.system_prompt.split('\n').length > 5) {
        console.log(`  ${chalk.dim('│ ...(truncated)')}`);
      }
      console.log('');
    }
    
    // Files
    console.log(chalk.bold('  Contents'));
    const totalKB = (info.totalSize / 1024).toFixed(1);
    const compressedKB = (info.compressedSize / 1024).toFixed(1);
    console.log(`  ${chalk.dim('Total:')}      ${totalKB} KB (${compressedKB} KB compressed)`);
    console.log('');
    
    for (const f of info.files) {
      const sizeStr = f.size > 1024 ? `${(f.size / 1024).toFixed(1)} KB` : `${f.size} B`;
      const isManifest = f.name === 'agent.yaml';
      const prefix = isManifest ? chalk.cyan('★') : chalk.dim('•');
      console.log(`  ${prefix} ${isManifest ? chalk.cyan(f.name) : f.name} ${chalk.dim(`(${sizeStr})`)}`);
    }
    console.log('');
    
    console.log(chalk.dim('  Install: agentbox install ' + path.basename(filePath)));
    console.log('');
  } catch (err) {
    console.log(chalk.red(`  Error: ${err.message}`));
    console.log('');
    process.exit(1);
  }
}

module.exports = inspect;
