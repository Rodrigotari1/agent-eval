import { watch, FSWatcher } from 'fs';
import { glob } from 'glob';
import { resolve, relative } from 'path';
import { Reporter } from './reporter';
import { clearTests, runTests } from './index';

interface WatcherOptions {
  pattern: string;
  reporter: Reporter;
  nameFilter?: string;
  timeoutMs?: number;
}

export class TestWatcher {
  private fileWatcherList: FSWatcher[] = [];
  private debounceTimerId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private options: WatcherOptions) {}

  async start(): Promise<void> {
    console.log(`\nWatching for changes in ${this.options.pattern}...\n`);

    const filePathList = await this.findTestFiles();

    for (const filePath of filePathList) {
      this.watchFile(filePath);
    }

    await this.executeTests();
  }

  private async findTestFiles(): Promise<string[]> {
    return glob(this.options.pattern, {
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
      absolute: false
    });
  }

  private watchFile(filePath: string): void {
    const absolutePath = resolve(filePath);

    const fileWatcher = watch(absolutePath, () => {
      this.scheduleTestRun(filePath);
    });

    this.fileWatcherList.push(fileWatcher);
  }

  private scheduleTestRun(changedFilePath: string): void {
    if (this.debounceTimerId) {
      clearTimeout(this.debounceTimerId);
    }

    this.debounceTimerId = setTimeout(() => {
      this.handleFileChange(changedFilePath);
    }, 100);
  }

  private async handleFileChange(filePath: string): Promise<void> {
    if (this.isRunning) return;

    this.clearScreen();
    console.log(`\nFile changed: ${relative(process.cwd(), filePath)}`);
    console.log('Re-running tests...\n');

    await this.executeTests();
  }

  private clearScreen(): void {
    console.clear();
  }

  private clearModuleCache(filePath: string): void {
    const absolutePath = resolve(filePath);
    delete require.cache[absolutePath];
  }

  private async executeTests(): Promise<void> {
    this.isRunning = true;

    try {
      const filePathList = await this.findTestFiles();

      for (const filePath of filePathList) {
        this.clearModuleCache(filePath);
        clearTests();

        try {
          require(resolve(filePath));
        } catch (error) {
          console.error(`Failed to load ${filePath}:`);
          console.error(error);
          continue;
        }

        await runTests({
          reporter: this.options.reporter,
          nameFilter: this.options.nameFilter,
          timeoutMs: this.options.timeoutMs
        });
      }
    } catch (error) {
      console.error('Error running tests:', error);
    } finally {
      this.isRunning = false;
      console.log('\nWatching for changes...');
    }
  }

  stop(): void {
    for (const fileWatcher of this.fileWatcherList) {
      fileWatcher.close();
    }
    this.fileWatcherList = [];
  }
}
