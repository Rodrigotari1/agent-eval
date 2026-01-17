import { AgentFunction, AgentResult, ExecutionTrace } from './types';

function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Test timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

export class AgentRunner {
  private result: AgentResult | null = null;
  private trace: ExecutionTrace | null = null;

  constructor(private agent: AgentFunction) {}

  async run(prompt: string, timeoutMs?: number): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const agentPromise = this.agent(prompt);

      this.result = timeoutMs
        ? await Promise.race([agentPromise, createTimeoutPromise(timeoutMs)])
        : await agentPromise;

      const endTime = Date.now();
      const durationMs = endTime - startTime;

      if (!this.result.durationMs) {
        this.result.durationMs = durationMs;
      }

      this.trace = {
        prompt,
        result: this.result,
        startTime,
        endTime,
        durationMs
      };

      return this.result;
    } catch (error) {
      const endTime = Date.now();
      this.trace = {
        prompt,
        result: { output: '', toolCalls: [] },
        startTime,
        endTime,
        durationMs: endTime - startTime
      };
      throw error;
    }
  }

  getResult(): AgentResult | null {
    return this.result;
  }

  getTrace(): ExecutionTrace | null {
    return this.trace;
  }
}
