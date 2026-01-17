import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export interface Config {
  pattern?: string;
  reporter?: 'default' | 'verbose' | 'minimal' | 'json';
  timeout?: number;
  bail?: boolean;
  nameFilter?: string;
  watch?: boolean;
}

export function loadConfig(): Config {
  const cwd = process.cwd();

  const jsonConfigPath = resolve(cwd, '.agent-eval.json');
  if (existsSync(jsonConfigPath)) {
    const content = readFileSync(jsonConfigPath, 'utf-8');
    return JSON.parse(content);
  }

  const jsConfigPath = resolve(cwd, 'agent-eval.config.js');
  if (existsSync(jsConfigPath)) {
    return require(jsConfigPath);
  }

  const packageJsonPath = resolve(cwd, 'package.json');
  if (existsSync(packageJsonPath)) {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    if (packageJson['agent-eval']) {
      return packageJson['agent-eval'];
    }
  }

  return {};
}

export function mergeConfig(config: Config, cliArgs: Partial<Config>): Config {
  return {
    ...config,
    ...Object.fromEntries(
      Object.entries(cliArgs).filter(([, value]) => value !== undefined)
    )
  };
}
