/**
 * Sanitize a manifest field (e.g. author, name) to prevent path traversal.
 * Strips any path separators and ".." segments so a crafted manifest like
 * author: "../../outside" is reduced to a safe directory name.
 */
function sanitizeManifestField(value) {
  if (!value || typeof value !== 'string') return '_unknown';
  // Remove path separators and parent-directory references
  return value
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '')
    .replace(/^\.+/, '')   // strip leading dots
    || '_unknown';
}

module.exports = {
  sanitizeManifestField,
};
