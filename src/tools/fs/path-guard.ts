import path from 'node:path';
import { minimatch } from 'minimatch';
import { AgentConfig } from '../../types/schema.js';

export class PathGuard {
  constructor(private config: AgentConfig) {}

  /**
   * Validates a path against security constraints.
   * Returns the absolute, resolved path if valid.
   * Throws Error if invalid.
   */
  validate(targetPath: string): string {
    // 1. Prevent Null Byte Poisoning
    if (targetPath.indexOf('\0') !== -1) {
      throw new Error('Security: Null byte detected in path');
    }

    // 2. Resolve and Normalize
    const absoluteTarget = path.resolve(this.config.workspaceRoot, targetPath);
    
    // 3. Root Jail Check
    if (!absoluteTarget.startsWith(this.config.workspaceRoot)) {
      throw new Error(`Security: Path traversal detected. ${targetPath} is outside workspace.`);
    }

    // 4. Deny Patterns (Check relative path against glob patterns)
    const relativePath = path.relative(this.config.workspaceRoot, absoluteTarget);
    
    // Ensure we check against forward slash paths for minimatch consistency across OS
    const normalizedRelative = relativePath.split(path.sep).join('/');

    for (const pattern of this.config.denyPatterns) {
      if (minimatch(normalizedRelative, pattern, { dot: true })) {
        throw new Error(`Security: Access denied to protected path '${normalizedRelative}' matching pattern '${pattern}'`);
      }
    }

    return absoluteTarget;
  }
}
