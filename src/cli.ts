#!/usr/bin/env node

import { glob } from 'glob';
import { resolve, relative } from 'path';
import { DefaultReporter, VerboseReporter, MinimalReporter, JSONReporter, Reporter } from './reporter';
import { clearTests, runTests } from './index';
import { loadConfig, mergeConfig } from './config';
import { TestWatcher } from './watch';

interface CLIOptions {
  pattern: string;
  reporter: 'default' | 'verbose' | 'minimal' | 'json';
  nameFilter?: string;
  bail: boolean;
  timeout: number;
  watch: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    pattern: '**/*.test.{ts,js}',
    reporter: 'default',
    bail: false,
    timeout: 30000,
    watch: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--reporter':
      case '-r':
        options.reporter = args[++i] as CLIOptions['reporter'];
        break;
      case '--grep':
      case '-g':
        options.nameFilter = args[++i];
        break;
      case '--bail':
      case '-b':
        options.bail = true;
        break;
      case '--timeout':
      case '-t':
        options.timeout = parseInt(args[++i], 10);
        break;
      case '--watch':
      case '-w':
        options.watch = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          options.pattern = arg;
        }
    }
  }

  return options;
}

function createReporter(type: CLIOptions['reporter']): Reporter {
  switch (type) {
    case 'verbose':
      return new VerboseReporter();
    case 'minimal':
      return new MinimalReporter();
    case 'json':
      return new JSONReporter();
    default:
      return new DefaultReporter();
  }
}

async function loadTestFile(filePath: string): Promise<void> {
  const absolutePath = resolve(filePath);

  try {
    require(absolutePath);
  } catch (error) {
    console.error(`Failed to load ${relative(process.cwd(), filePath)}:`);
    console.error(error);
    throw error;
  }
}

async function executeTestFiles(
  filePathList: string[],
  reporter: Reporter,
  options: CLIOptions
): Promise<boolean> {
  let allPassed = true;

  for (const filePath of filePathList) {
    clearTests();
    await loadTestFile(filePath);

    const testResultList = await runTests({
      reporter,
      nameFilter: options.nameFilter,
      timeoutMs: options.timeout
    });

    if (testResultList.some(r => !r.passed)) {
      allPassed = false;
      if (options.bail) {
        break;
      }
    }
  }

  return allPassed;
}

async function main() {
  const fileConfig = loadConfig();
  const cliArgs = parseArgs();
  const mergedConfig = mergeConfig(fileConfig, cliArgs);

  const options: CLIOptions = {
    pattern: mergedConfig.pattern || '**/*.test.{ts,js}',
    reporter: mergedConfig.reporter || 'default',
    nameFilter: mergedConfig.nameFilter,
    bail: mergedConfig.bail || false,
    timeout: mergedConfig.timeout || 30000,
    watch: mergedConfig.watch || false
  };

  const reporter = createReporter(options.reporter);

  if (options.watch) {
    const watcher = new TestWatcher({
      pattern: options.pattern,
      reporter,
      nameFilter: options.nameFilter,
      timeoutMs: options.timeout
    });

    await watcher.start();
    return;
  }

  const filePathList = await glob(options.pattern, {
    ignore: ['node_modules/**', 'dist/**', 'build/**'],
    absolute: false
  });

  if (filePathList.length === 0) {
    console.error(`No test files found matching pattern: ${options.pattern}`);
    process.exit(1);
  }

  const allPassed = await executeTestFiles(filePathList, reporter, options);
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
