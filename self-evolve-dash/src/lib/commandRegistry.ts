// src/lib/commandRegistry.ts
// Centralized Command Registry for Autonomous Operations

export interface Command {
  name: string;
  description: string;
  execute: (args: any, context?: any) => Promise<any>;
  metadata?: {
    category: string;
    requiredCapabilities?: string[];
    timeout?: number;
  };
}

class CommandRegistry {
  private commands = new Map<string, Command>();
  private logger: any; // Will connect to universalLogger

  constructor() {
    this.logger = { info: console.log, error: console.error }; // Placeholder until logger integration
  }

  register(command: Command): void {
    this.commands.set(command.name, command);
    this.logger.info(`Registered command: ${command.name}`, { category: command.metadata?.category });
  }

  async execute(name: string, args: any = {}, context: any = {}): Promise<any> {
    const cmd = this.commands.get(name);
    if (!cmd) {
      throw new Error(`Command not found: ${name}`);
    }

    const start = Date.now();
    try {
      const result = await cmd.execute(args, context);
      const duration = Date.now() - start;
      this.logger.info(`Command executed: ${name}`, { duration, success: true });
      return result;
    } catch (error) {
      this.logger.error(`Command failed: ${name}`, { error: (error as Error).message });
      throw error;
    }
  }

  list(): Command[] {
    return Array.from(this.commands.values());
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }
}

export const registry = new CommandRegistry();

export default registry;
