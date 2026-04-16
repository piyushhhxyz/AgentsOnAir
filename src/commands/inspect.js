const path = require('path');
const chalk = require('chalk');
const { inspectAgent } = require('../utils/agent-file');

async function inspect(file) {
  const filePath = path.resolve(file);
  
  console.log('');
  
  try {
    const info = inspectAgent(filePath);
    const m = info.manifest;
    
    console.log(chalk.bold('  🔍 Agent Inspection'));
    console.log(chalk.dim('  ─────────────────────────────────────────'));
    console.log('');
    console.log(`  ${chalk.dim('Name:')}        ${chalk.bold(m.name)}`);
    console.log(`  ${chalk.dim('Version:')}     ${m.version}`);
    console.log(`  ${chalk.dim('Author:')}      ${m.author || 'unknown'}`);
    console.log(`  ${chalk.dim('Description:')} ${m.description || 'none'}`);
    console.log(`  ${chalk.dim('Category:')}    ${m.metadata?.category || 'general'}`);
    console.log(`  ${chalk.dim('Tags:')}        ${(m.metadata?.tags || []).join(', ') || 'none'}`);
    console.log(`  ${chalk.dim('License:')}     ${m.metadata?.license || 'none'}`);
    console.log('');
    
    // Model info
    if (m.agent?.model) {
      console.log(chalk.bold('  Model Configuration'));
      console.log(`  ${chalk.dim('Provider:')}    ${m.agent.model.provider || 'openai'}`);
      console.log(`  ${chalk.dim('Model:')}       ${m.agent.model.name || 'gpt-4o-mini'}`);
      console.log(`  ${chalk.dim('Temperature:')} ${m.agent.model.temperature ?? 0.7}`);
      console.log(`  ${chalk.dim('Max Tokens:')}  ${m.agent.model.max_tokens ?? 2048}`);
      console.log('');
    }
    
    // System prompt preview
    if (m.agent?.system_prompt) {
      console.log(chalk.bold('  System Prompt'));
      const lines = m.agent.system_prompt.split('\n').slice(0, 5);
      for (const line of lines) {
        console.log(`  ${chalk.dim('│')} ${line}`);
      }
      if (m.agent.system_prompt.split('\n').length > 5) {
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
