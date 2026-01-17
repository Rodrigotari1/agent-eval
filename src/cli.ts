#!/usr/bin/env node

import { glob } from 'glob';
import { resolve, relative } from 'path';
import { DefaultReporter, VerboseReporter, MinimalReporter, JSONReporter, Reporter } from './reporter';
import { clearTests, runTests } from './index';
import { loadConfig, mergeConfig } from './config';

interface CLIOptions {
  pattern: string;
  reporter: 'default' | 'verbose' | 'minimal' | 'json';
  nameFilter?: string;
  bail: boolean;
  timeout: number;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    pattern: '**/*.test.{ts,js}',
    reporter: 'default',
    bail: false,
    timeout: 30000
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

async function main() {
  const fileConfig = loadConfig();
  const cliArgs = parseArgs();
  const options = mergeConfig(fileConfig, cliArgs);

  const reporter = createReporter(options.reporter || 'default');

  const files = await glob(options.pattern || '**/*.test.{ts,js}', {
    ignore: ['node_modules/**', 'dist/**', 'build/**'],
    absolute: false
  });

  if (files.length === 0) {
    console.error(`No test files found matching pattern: ${options.pattern}`);
    process.exit(1);
  }

  let allPassed = true;

  for (const file of files) {
    clearTests();

    await loadTestFile(file);

    const results = await runTests({
      reporter,
      nameFilter: options.nameFilter
    });

    if (results.some(r => !r.passed)) {
      allPassed = false;
      if (options.bail) {
        break;
      }
    }
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
