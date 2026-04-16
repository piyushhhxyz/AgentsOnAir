const path = require('path');
const os = require('os');

// Directories
const BREWAGENT_HOME = path.join(os.homedir(), '.brewagent');
const REGISTRY_DIR = path.join(BREWAGENT_HOME, 'registry');
const INSTALLED_DIR = path.join(BREWAGENT_HOME, 'agents');

// File extensions
const AGENT_EXT = '.agent';
const AGENT_MANIFEST = 'agent.yaml';

module.exports = {
  BREWAGENT_HOME,
  REGISTRY_DIR,
  INSTALLED_DIR,
  AGENT_EXT,
  AGENT_MANIFEST,
};
