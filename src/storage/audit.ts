import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';

export class AuditLogger {
  private logger: pino.Logger;
  private logPath: string;
  private maxMB: number;

  constructor(root: string, maxMB: number = 10) {
    this.logPath = path.join(root, '.codebot-orange', 'audit.log.jsonl');
    this.maxMB = maxMB;

    // Initialize pino with a file destination
    this.logger = pino({
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      }
    }, pino.destination({ dest: this.logPath, sync: true })); // Sync for audit reliability
  }

  async log(event: string, details?: Record<string, unknown>, txId?: string) {
    await this.rotateIfNeeded();
    this.logger.info({ event, details, txId });
  }

  private async rotateIfNeeded() {
    try {
      const stats = await fs.stat(this.logPath);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB >= this.maxMB) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${this.logPath}.${timestamp}.bak`;
        
        // Rename current log
        await fs.rename(this.logPath, backupPath);
        
        // Re-initialize logger to point to new file (Pino destination needs refresh logic in long-running process)
        // For CLI one-off runs, this might not hit often, but vital for daemon mode.
        this.logger = pino({
            timestamp: pino.stdTimeFunctions.isoTime,
            formatters: { level: (label) => ({ level: label }) }
        }, pino.destination({ dest: this.logPath, sync: true }));
      }
    } catch (e) {
      // File likely doesn't exist yet
    }
  }
}
