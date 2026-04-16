const fs = require('fs');
const path = require('path');
const { BREWAGENT_HOME, REGISTRY_DIR, INSTALLED_DIR } = require('./constants');

/**
 * Ensure all brewagent directories exist
 */
function ensureDirs() {
  for (const dir of [BREWAGENT_HOME, REGISTRY_DIR, INSTALLED_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get the installed agent directory for a given scope/name
 */
function getAgentDir(scope, name) {
  if (scope) {
    return path.join(INSTALLED_DIR, scope, name);
  }
  return path.join(INSTALLED_DIR, name);
}

/**
 * Parse an agent identifier like @piyush/tax-agent
 * Returns { scope, name, fullName }
 */
function parseAgentId(id) {
  const match = id.match(/^@([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
  if (match) {
    return { scope: match[1], name: match[2], fullName: `@${match[1]}/${match[2]}` };
  }
  // No scope — just a name
  return { scope: null, name: id, fullName: id };
}

/**
 * List all .agent files in the registry
 */
function listRegistryAgents() {
  ensureDirs();
  const agents = [];
  
  // Walk registry dir recursively
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.agent')) {
        agents.push(fullPath);
      }
    }
  }
  
  walk(REGISTRY_DIR);
  return agents;
}

/**
 * List all installed agents
 */
function listInstalledAgents() {
  ensureDirs();
  const agents = [];
  
  function walk(dir, depth = 0) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Check if this dir has an agent.yaml
        const manifestPath = path.join(fullPath, 'agent.yaml');
        if (fs.existsSync(manifestPath)) {
          agents.push(fullPath);
        } else if (depth < 2) {
          walk(fullPath, depth + 1);
        }
      }
    }
  }
  
  walk(INSTALLED_DIR);
  return agents;
}

module.exports = {
  ensureDirs,
  getAgentDir,
  parseAgentId,
  listRegistryAgents,
  listInstalledAgents,
};
