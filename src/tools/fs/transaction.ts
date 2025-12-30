import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PathGuard } from './path-guard.js';
import { JournalEntry } from '../../types/schema.js';

export class TransactionManager {
  private activeTx: string | null = null;
  private journal: JournalEntry[] = [];
  private journalDir: string;
  private backupDir: string;
  private stagingDir: string;

  constructor(private root: string, private guard: PathGuard) {
    const baseDir = path.join(root, '.codebot-orange');
    this.journalDir = path.join(baseDir, 'journal');
    this.backupDir = path.join(baseDir, 'backups');
    this.stagingDir = path.join(baseDir, 'staging');
  }

  private async ensureDirs() {
    await fs.mkdir(this.journalDir, { recursive: true });
    await fs.mkdir(this.backupDir, { recursive: true });
    await fs.mkdir(this.stagingDir, { recursive: true });
  }

  async beginTransaction(): Promise<string> {
    if (this.activeTx) throw new Error("Transaction already in progress");
    await this.ensureDirs();
    
    this.activeTx = crypto.randomUUID();
    this.journal = [];
    
    // Write "PENDING" marker
    await fs.writeFile(
      path.join(this.journalDir, `${this.activeTx}.pending`), 
      JSON.stringify({ start: Date.now() })
    );

    return this.activeTx;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.activeTx) throw new Error("No active transaction");
    
    const safePath = this.guard.validate(filePath);
    
    // 2. Backup Phase
    const backupPath = path.join(this.backupDir, this.activeTx, path.basename(safePath) + '_' + Date.now());
    await fs.mkdir(path.dirname(backupPath), { recursive: true });

    let entryType: 'write' | 'create' = 'create';

    try {
      await fs.access(safePath, constants.F_OK);
      entryType = 'write';
      await fs.copyFile(safePath, backupPath);
    } catch {
      // File doesn't exist
    }

    this.journal.push({
      type: entryType,
      path: safePath,
      backupPath: entryType === 'write' ? backupPath : undefined,
      timestamp: Date.now(),
      txId: this.activeTx
    });

    // 4. Staging Phase (Explicit Sync)
    const tempFileName = `${this.activeTx}_${path.basename(safePath)}.tmp`;
    const tempPath = path.join(this.stagingDir, tempFileName);
    
    const fileHandle = await fs.open(tempPath, 'w');
    try {
        await fileHandle.writeFile(content);
        await fileHandle.sync(); // Force flush to disk
    } finally {
        await fileHandle.close();
    }
    
    // 5. Commit Phase (Atomic Rename)
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.rename(tempPath, safePath);
  }

  async commit(): Promise<void> {
    if (!this.activeTx) return;

    // Update Journal to COMMITTED state
    const journalPath = path.join(this.journalDir, `${this.activeTx}.json`);
    const finalLog = {
        status: "COMMITTED",
        entries: this.journal,
        timestamp: Date.now()
    };
    
    await fs.writeFile(journalPath, JSON.stringify(finalLog, null, 2));
    await fs.unlink(path.join(this.journalDir, `${this.activeTx}.pending`)).catch(() => {});
    
    this.activeTx = null;
    this.journal = [];
  }

  async rollback(): Promise<void> {
    if (!this.activeTx) return;

    console.warn(`[Tx: ${this.activeTx}] Rolling back changes...`);

    for (const entry of this.journal.reverse()) {
      try {
        if (entry.type === 'write' && entry.backupPath) {
          await fs.copyFile(entry.backupPath, entry.path);
        } else if (entry.type === 'create') {
          await fs.unlink(entry.path).catch(() => {});
        }
      } catch (e) {
        console.error(`Failed to rollback entry for ${entry.path}`, e);
      }
    }

    await fs.unlink(path.join(this.journalDir, `${this.activeTx}.pending`)).catch(() => {});
    this.activeTx = null;
    this.journal = [];
  }
}
