// brewagent — the npm for AI agents
// Programmatic API for using brewagent as a library
//
// Note: internal helpers like getAgentDir (from utils/fs) and
// sanitizeManifestField (from utils/validate) are intentionally
// omitted from the public API — they are implementation details
// used only by the CLI commands.

const { readManifest, writeManifest, packAgent, unpackAgent, inspectAgent, validateManifest } = require('./utils/agent-file');
const { parseAgentId, ensureDirs, listRegistryAgents, listInstalledAgents } = require('./utils/fs');
const { BREWAGENT_HOME, REGISTRY_DIR, INSTALLED_DIR, AGENT_EXT, AGENT_MANIFEST } = require('./utils/constants');

module.exports = {
  // Core operations
  readManifest,
  writeManifest,
  packAgent,
  unpackAgent,
  inspectAgent,
  validateManifest,
  
  // Utilities
  parseAgentId,
  ensureDirs,
  listRegistryAgents,
  listInstalledAgents,
  
  // Constants
  BREWAGENT_HOME,
  REGISTRY_DIR,
  INSTALLED_DIR,
  AGENT_EXT,
  AGENT_MANIFEST,
};
