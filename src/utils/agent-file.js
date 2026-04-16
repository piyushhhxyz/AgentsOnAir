const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const { AGENT_MANIFEST, AGENT_EXT } = require('./constants');

/**
 * Read and parse an agent.yaml manifest from a directory
 */
function readManifest(dir) {
  const manifestPath = path.join(dir, AGENT_MANIFEST);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No ${AGENT_MANIFEST} found in ${dir}`);
  }
  const content = fs.readFileSync(manifestPath, 'utf-8');
  return yaml.load(content);
}

/**
 * Write an agent.yaml manifest to a directory
 */
function writeManifest(dir, manifest) {
  const manifestPath = path.join(dir, AGENT_MANIFEST);
  const content = yaml.dump(manifest, { lineWidth: -1, noRefs: true });
  fs.writeFileSync(manifestPath, content, 'utf-8');
}

/**
 * Pack a directory into a .agent file (zip with metadata)
 * The .agent file is a zip containing:
 *   - agent.yaml (manifest)
 *   - knowledge/ (optional knowledge files)
 *   - tools/ (optional tool scripts)
 */
function packAgent(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    // Validate manifest exists
    const manifest = readManifest(sourceDir);
    
    if (!outputPath) {
      const name = manifest.name || 'agent';
      const version = manifest.version || '1.0.0';
      outputPath = path.join(process.cwd(), `${name}-${version}${AGENT_EXT}`);
    }
    
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      resolve({ path: outputPath, size: archive.pointer(), manifest });
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    
    // Add all files from the source directory
    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(sourceDir, entry.name);
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      
      if (entry.isDirectory()) {
        archive.directory(fullPath, entry.name);
      } else {
        archive.file(fullPath, { name: entry.name });
      }
    }
    
    archive.finalize();
  });
}

/**
 * Unpack a .agent file to a target directory
 */
function unpackAgent(agentFilePath, targetDir) {
  const zip = new AdmZip(agentFilePath);
  
  // Extract to target
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  zip.extractAllTo(targetDir, true);
  
  // Read and return manifest
  return readManifest(targetDir);
}

/**
 * Inspect a .agent file without extracting
 */
function inspectAgent(agentFilePath) {
  const zip = new AdmZip(agentFilePath);
  const entries = zip.getEntries();
  
  // Find and parse agent.yaml
  const manifestEntry = entries.find(e => e.entryName === AGENT_MANIFEST);
  if (!manifestEntry) {
    throw new Error('Invalid .agent file: no agent.yaml found');
  }
  
  const manifest = yaml.load(manifestEntry.getData().toString('utf-8'));
  
  // Collect file listing
  const files = entries.map(e => ({
    name: e.entryName,
    size: e.header.size,
    compressed: e.header.compressedSize,
  }));
  
  const totalSize = entries.reduce((sum, e) => sum + e.header.size, 0);
  const compressedSize = entries.reduce((sum, e) => sum + e.header.compressedSize, 0);
  
  return { manifest, files, totalSize, compressedSize };
}

/**
 * Validate an agent.yaml manifest
 */
function validateManifest(manifest) {
  const errors = [];
  
  if (!manifest.name) errors.push('Missing required field: name');
  if (!manifest.version) errors.push('Missing required field: version');
  if (!manifest.agent) errors.push('Missing required section: agent');
  if (manifest.agent && !manifest.agent.system_prompt) {
    errors.push('Missing required field: agent.system_prompt');
  }
  
  return { valid: errors.length === 0, errors };
}

module.exports = {
  readManifest,
  writeManifest,
  packAgent,
  unpackAgent,
  inspectAgent,
  validateManifest,
};
