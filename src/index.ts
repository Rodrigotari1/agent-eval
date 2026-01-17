import { AgentFunction, TestCase, TestResult } from './types';
import { AgentRunner } from './runner';
import { AssertionImpl } from './assertions';
import { Reporter } from './reporter';

let currentRunner: AgentRunner | null = null;
let currentTimeoutMs: number | undefined;
const testCaseList: TestCase[] = [];
const beforeEachHookList: (() => Promise<void> | void)[] = [];
const afterEachHookList: (() => Promise<void> | void)[] = [];

export function test(name: string, fn: () => Promise<void>): void {
  testCaseList.push({ name, fn });
}

export function beforeEach(fn: () => Promise<void> | void): void {
  beforeEachHookList.push(fn);
}

export function afterEach(fn: () => Promise<void> | void): void {
  afterEachHookList.push(fn);
}

export async function runAgent(agent: AgentFunction, prompt: string): Promise<void> {
  currentRunner = new AgentRunner(agent);
  await currentRunner.run(prompt, currentTimeoutMs);
}

export function expect(): AssertionImpl {
  if (!currentRunner) {
    throw new Error('No agent has been run. Call runAgent() first');
  }
  const result = currentRunner.getResult();
  if (!result) {
    throw new Error('No result available from agent run');
  }
  return new AssertionImpl(result);
}

export interface RunTestsOptions {
  reporter?: Reporter;
  nameFilter?: string;
  timeoutMs?: number;
}

function filterTestsByName(nameFilter: string | undefined): TestCase[] {
  if (!nameFilter) return testCaseList;
  return testCaseList.filter(t => t.name.includes(nameFilter));
}

async function executeTestHooks(hookList: (() => Promise<void> | void)[]): Promise<void> {
  for (const hook of hookList) {
    await hook();
  }
}

function createPassedResult(testName: string, durationMs: number): TestResult {
  return {
    name: testName,
    passed: true,
    durationMs,
    tokens: currentRunner?.getResult()?.tokens
  };
}

function createFailedResult(testName: string, durationMs: number, error: Error): TestResult {
  return {
    name: testName,
    passed: false,
    error,
    durationMs,
    tokens: currentRunner?.getResult()?.tokens
  };
}

async function executeTestCase(testCase: TestCase): Promise<TestResult> {
  const startTime = Date.now();

  try {
    await executeTestHooks(beforeEachHookList);
    await testCase.fn();
    await executeTestHooks(afterEachHookList);

    return createPassedResult(testCase.name, Date.now() - startTime);
  } catch (error) {
    return createFailedResult(testCase.name, Date.now() - startTime, error as Error);
  }
}

export async function runTests(options?: Reporter | RunTestsOptions): Promise<TestResult[]> {
  let reporter: Reporter | undefined;
  let nameFilter: string | undefined;

  if (options && 'onStart' in options) {
    reporter = options;
  } else if (options) {
    reporter = options.reporter;
    nameFilter = options.nameFilter;
    currentTimeoutMs = options.timeoutMs;
  }

  const filteredTests = filterTestsByName(nameFilter);
  const testResultList: TestResult[] = [];

  reporter?.onStart(filteredTests.length);

  for (const testCase of filteredTests) {
    reporter?.onTestStart(testCase.name);
    const result = await executeTestCase(testCase);
    testResultList.push(result);
    reporter?.onTestComplete(result);
  }

  reporter?.onComplete(testResultList);
  return testResultList;
}

export function clearTests(): void {
  testCaseList.length = 0;
  beforeEachHookList.length = 0;
  afterEachHookList.length = 0;
}

export * from './types';
export * from './reporter';
