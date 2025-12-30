import { z } from 'zod';
import { AgentConfig } from '../types/schema.js';

// Minimal Plugin Manifest Schema
export const PluginManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  permissions: z.array(z.string()).default([]),
  entry: z.string()
});

export type PluginContext = {
  config: Pick<AgentConfig, 'workspaceRoot'>;
  logger: { info: (msg: string) => void; error: (msg: string) => void };
  fs: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
  };
};

export class PluginSandbox {
  /**
   * Creates a proxied context that prevents access to global
   * system objects like 'process', 'eval', or 'require'.
   */
  static createSafeContext(baseContext: PluginContext): any {
    const handler: ProxyHandler<any> = {
      get(target, prop) {
        // Explicitly block access to dangerous globals if the plugin tries to walk up the scope
        if (prop === 'process' || prop === 'eval' || prop === 'Function' || prop === 'require') {
            throw new Error(`Security Violation: Access to '${String(prop)}' is forbidden in plugins.`);
        }
        return Reflect.get(target, prop);
      },
      has(target, prop) {
        if (prop === 'process' || prop === 'require') return false;
        return Reflect.has(target, prop);
      }
    };

    return new Proxy(baseContext, handler);
  }

  /**
   * validating the manifest structure before loading
   */
  static validateManifest(json: unknown) {
    return PluginManifestSchema.parse(json);
  }
}
