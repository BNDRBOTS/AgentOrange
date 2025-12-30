#!/usr/bin/env node
import { cac } from 'cac';
import path from 'node:path';
import { CodebotEngine } from './core/engine.js';

const cli = cac('cbo');

cli
  .command('write <file> <content>', 'Write content to a file safely')
  .option('--root <path>', 'Workspace root', { default: process.cwd() })
  .action(async (file, content, options) => {
    try {
      const engine = new CodebotEngine({
        workspaceRoot: path.resolve(options.root),
        trusted: false // Default to restricted
      });

      await engine.checkTrust();
      console.log(`🔒 Acquiring lock for ${file}...`);
      
      const result = await engine.executeSafeWrite(file, content);
      
      console.log(`✅ Success! (Tx: ${result.txId})`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

cli.help();
cli.parse();
