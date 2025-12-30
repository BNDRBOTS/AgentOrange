import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { AgentConfig } from '../types/schema.js';

export class TrustManager {
  private markerPath: string;

  constructor(private config: AgentConfig) {
    this.markerPath = path.join(config.workspaceRoot, '.codebot-orange', 'trust.lock');
  }

  /**
   * Generates a hash of the current configuration and root path.
   */
  private generateHash(): string {
    const data = `${this.config.workspaceRoot}:${JSON.stringify(this.config.denyPatterns)}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Checks if the workspace is trusted.
   * Trust requires the existence of a trust.lock file containing 
   * the correct hash of the current config.
   */
  async verifyTrust(): Promise<boolean> {
    try {
      const storedHash = await fs.readFile(this.markerPath, 'utf-8');
      const currentHash = this.generateHash();
      
      // Strict equality check
      return storedHash.trim() === currentHash;
    } catch (e) {
      return false; // File doesn't exist or read error = Untrusted
    }
  }

  /**
   * Explicitly grants trust by writing the lock file.
   * This should only be called by a user-initiated "allow" command.
   */
  async grantTrust(): Promise<void> {
    const hash = this.generateHash();
    await fs.mkdir(path.dirname(this.markerPath), { recursive: true });
    await fs.writeFile(this.markerPath, hash);
  }
}
