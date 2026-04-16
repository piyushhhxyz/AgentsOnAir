const path = require('path');
const os = require('os');

// Directories
const AGENTBOX_HOME = path.join(os.homedir(), '.agentbox');
const REGISTRY_DIR = path.join(AGENTBOX_HOME, 'registry');
const INSTALLED_DIR = path.join(AGENTBOX_HOME, 'agents');
const CONFIG_FILE = path.join(AGENTBOX_HOME, 'config.json');

// File extensions
const AGENT_EXT = '.agent';
const AGENT_MANIFEST = 'agent.yaml';

// Default agent.yaml template
const DEFAULT_AGENT_YAML = `# Agent manifest — this is the heart of your .agent file
# Docs: https://github.com/piyushhhxyz/AgentsOnAir

name: "my-agent"
version: "1.0.0"
description: "A helpful AI agent"
author: "your-name"

# Agent behavior
agent:
  system_prompt: |
    You are a helpful AI assistant. Answer questions clearly and concisely.
  
  # Model preferences (user can override at runtime)
  model:
    provider: "openai"       # openai | anthropic | ollama
    name: "gpt-4o-mini"     # model name
    temperature: 0.7
    max_tokens: 2048

  # Tools this agent can use
  tools: []

  # Knowledge files bundled with this agent
  knowledge: []

# Metadata
metadata:
  category: "general"        # general | research | coding | writing | data | automation
  tags: []
  license: "MIT"
`;

module.exports = {
  AGENTBOX_HOME,
  REGISTRY_DIR,
  INSTALLED_DIR,
  CONFIG_FILE,
  AGENT_EXT,
  AGENT_MANIFEST,
  DEFAULT_AGENT_YAML,
};
