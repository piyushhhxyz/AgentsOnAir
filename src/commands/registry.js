const chalk = require('chalk');
const { listRegistryAgents, listInstalledAgents } = require('../utils/fs');
const { AGENTBOX_HOME, REGISTRY_DIR, INSTALLED_DIR } = require('../utils/constants');

async function registry() {
  console.log('');
  
  const registryAgents = listRegistryAgents();
  const installedAgents = listInstalledAgents();
  
  console.log(chalk.bold('  📊 Registry Info'));
  console.log(chalk.dim('  ─────────────────────────────────────────'));
  console.log('');
  console.log(`  ${chalk.dim('Home:')}       ${AGENTBOX_HOME}`);
  console.log(`  ${chalk.dim('Registry:')}   ${REGISTRY_DIR}`);
  console.log(`  ${chalk.dim('Installed:')}  ${INSTALLED_DIR}`);
  console.log('');
  console.log(`  ${chalk.dim('Published agents:')} ${chalk.bold(registryAgents.length)}`);
  console.log(`  ${chalk.dim('Installed agents:')} ${chalk.bold(installedAgents.length)}`);
  console.log('');
  
  if (registryAgents.length === 0) {
    console.log(chalk.dim('  The registry is empty. Publish your first agent!'));
    console.log(chalk.dim('    agentbox init my-agent && cd my-agent && agentbox publish .'));
  } else {
    console.log(chalk.dim('  Browse: agentbox list'));
    console.log(chalk.dim('  Install: agentbox install @author/agent-name'));
  }
  console.log('');
}

module.exports = registry;
