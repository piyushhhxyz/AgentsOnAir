const path = require('path');
const os = require('os');

// Directories
const AGENTBOX_HOME = path.join(os.homedir(), '.agentbox');
const REGISTRY_DIR = path.join(AGENTBOX_HOME, 'registry');
const INSTALLED_DIR = path.join(AGENTBOX_HOME, 'agents');

// File extensions
const AGENT_EXT = '.agent';
const AGENT_MANIFEST = 'agent.yaml';

module.exports = {
  AGENTBOX_HOME,
  REGISTRY_DIR,
  INSTALLED_DIR,
  AGENT_EXT,
  AGENT_MANIFEST,
};
