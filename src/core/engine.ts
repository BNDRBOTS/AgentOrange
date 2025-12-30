import { AgentConfig, AgentConfigSchema } from '../types/schema.js';
import { PathGuard } from '../tools/fs/path-guard.js';
import { TransactionManager } from '../tools/fs/transaction.js';
import { AuditLogger } from '../storage/audit.js';

export class CodebotEngine {
  public readonly config: AgentConfig;
  private guard: PathGuard;
  private txManager: TransactionManager;
  private audit: AuditLogger;

  constructor(configInput: unknown) {
    // Validate config immediately
    this.config = AgentConfigSchema.parse(configInput);
    
    // Initialize components
    this.guard = new PathGuard(this.config);
    this.txManager = new TransactionManager(this.config.workspaceRoot, this.guard);
    this.audit = new AuditLogger(this.config.workspaceRoot, this.config.maxAuditLogSizeMB);
  }

  async executeSafeWrite(relativePath: string, content: string) {
    // 1. Audit Start
    const txId = await this.txManager.beginTransaction();
    await this.audit.log('TRANSACTION_START', { operation: 'write', path: relativePath }, txId);

    try {
      // 2. Perform Write
      await this.txManager.writeFile(relativePath, content);
      
      // 3. Commit
      await this.txManager.commit();
      await this.audit.log('TRANSACTION_COMMIT', { path: relativePath }, txId);
      return { success: true, txId };
      
    } catch (error: any) {
      // 4. Rollback on Error
      await this.txManager.rollback();
      await this.audit.log('TRANSACTION_ROLLBACK', { error: error.message }, txId);
      throw error;
    }
  }

  async checkTrust() {
    // Restricted Mode logic
    if (!this.config.trusted) {
      console.warn("⚠️  Running in RESTRICTED MODE. Sensitive plugins disabled.");
    }
  }
}
