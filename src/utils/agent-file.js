const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const chalk = require('chalk');
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
 * Read, parse, and validate an agent.yaml manifest from a directory.
 * Exits the process with user-friendly errors on failure.
 */
function readAndValidateManifest(sourceDir) {
  let manifest;
  try {
    manifest = readManifest(sourceDir);
  } catch (err) {
    console.log(chalk.red(`  Error: ${err.message}`));
    console.log(chalk.dim('  Make sure you\'re in an agent directory with an agent.yaml file.'));
    console.log('');
    process.exit(1);
  }

  const validation = validateManifest(manifest);
  if (!validation.valid) {
    console.log(chalk.red('  Validation errors:'));
    for (const err of validation.errors) {
      console.log(chalk.red(`    • ${err}`));
    }
    console.log('');
    process.exit(1);
  }

  return manifest;
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
      outputPath = path.join(process.cwd(), `${name}${AGENT_EXT}`);
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
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name.endsWith(AGENT_EXT)) continue;
      
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
  
  // Clear the target directory first so that files removed between versions
  // (e.g. knowledge/old.md) don't persist and leak stale data into prompts.
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  zip.extractAllTo(targetDir, true);
  
  // Ensure standard subdirectories always exist after extraction.
  // Empty knowledge/ and tools/ directories are not preserved in the zip
  // archive (archiver skips empty dirs), so we recreate them here so that
  // users can add knowledge files without extra manual steps.
  fs.mkdirSync(path.join(targetDir, 'knowledge'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'tools'), { recursive: true });
  
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
  
  // Build file listing, totalSize, and compressedSize in a single pass
  let totalSize = 0;
  let compressedSize = 0;
  const files = entries.map(e => {
    totalSize += e.header.size;
    compressedSize += e.header.compressedSize;
    return { name: e.entryName, size: e.header.size, compressed: e.header.compressedSize };
  });
  
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
  readAndValidateManifest,
  writeManifest,
  packAgent,
  unpackAgent,
  inspectAgent,
  validateManifest,
};
