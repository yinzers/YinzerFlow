import { existsSync, mkdirSync, watch } from 'fs';
import dts from 'bun-plugin-dts';

/**
 * Development Build Watcher for YinzerFlow
 *
 * This script provides intelligent file watching for development:
 * 1. Performs an initial build when started
 * 2. Watches ./app directory for TypeScript/JavaScript changes
 * 3. Debounces rebuilds to prevent rapid-fire builds
 * 4. Provides clear feedback on build status and timing
 * 5. Gracefully handles errors and shutdown
 *
 * Usage: bun run build-watch.ts
 * Stop: Ctrl+C
 */

// Build configuration - optimized for development with readable stack traces
const BUILD_CONFIG = {
  entrypoints: ['./app/index.ts'],
  outdir: './lib',
  target: 'node' as const,
  minify: false, // Disabled for readable stack traces during development
  sourcemap: 'inline' as const, // Inline sourcemaps for better debugging
  watchPath: './app', // Directory to watch for changes
  debounceMs: 300, // Delay before rebuilding (prevents rapid rebuilds)
  watchExtensions: ['.ts', '.js'], // File types that trigger rebuilds
} as const;

/**
 * Initialize output directory
 * Creates the lib directory if it doesn't exist
 */
const initializeOutputDirectory = (): void => {
  if (!existsSync('lib')) {
    mkdirSync('lib');
    console.log('📁 Created output directory');
  }
};

/**
 * Build the project with error handling and performance timing
 *
 * Features:
 * - Performance timing for optimization insights
 * - Comprehensive error handling
 * - Clear success/failure feedback
 */
const buildProject = async (): Promise<void> => {
  const startTime = Date.now();
  console.log('🔨 Building YinzerFlow...');

  try {
    await Bun.build({
      entrypoints: [...BUILD_CONFIG.entrypoints],
      outdir: BUILD_CONFIG.outdir,
      target: BUILD_CONFIG.target,
      minify: BUILD_CONFIG.minify,
      sourcemap: BUILD_CONFIG.sourcemap,
      plugins: [
        dts({
          output: {
            noBanner: true,
            exportReferencedTypes: true,
          },
        }),
      ],
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Build completed successfully in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Build failed after ${duration}ms:`, error);
  }
};

/**
 * Debounce utility function
 *
 * Prevents rapid successive function calls by delaying execution until
 * a specified wait period has passed without new calls. Essential for
 * file watching to avoid rebuilding on every keystroke.
 *
 * @param func - Function to debounce
 * @param wait - Milliseconds to wait before executing
 * @returns Debounced version of the function
 */
const debounce = <T extends (...args: Array<any>) => any>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
  let timeout: Timer | undefined = undefined;
  return (...args: Parameters<T>): void => {
    const later = (): void => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Check if file should trigger a rebuild
 *
 * Only rebuilds for relevant file types to avoid unnecessary work.
 * Ignores changes to docs, tests, config files, etc.
 *
 * @param filename - Name of the changed file
 * @returns True if file should trigger rebuild
 */
const shouldRebuildForFile = (filename: string): boolean => BUILD_CONFIG.watchExtensions.some((ext) => filename.endsWith(ext));

/**
 * Start file system watcher with intelligent filtering
 *
 * Features:
 * - Recursive watching of the entire app directory
 * - File type filtering (only TS/JS files trigger rebuilds)
 * - Debounced rebuilds (prevents rapid successive builds)
 * - Graceful shutdown handling
 * - Clear feedback on what triggered each rebuild
 */
const startFileWatcher = (): void => {
  console.log(`👀 Watching for changes in ${BUILD_CONFIG.watchPath}...`);
  console.log(`🔍 Monitoring: ${BUILD_CONFIG.watchExtensions.join(', ')} files`);
  console.log(`⏱️  Debounce delay: ${BUILD_CONFIG.debounceMs}ms`);
  console.log('🛑 Press Ctrl+C to stop watching\n');

  // Create debounced build function
  const debouncedBuild = debounce(buildProject, BUILD_CONFIG.debounceMs);

  try {
    const watcher = watch(
      BUILD_CONFIG.watchPath,
      { recursive: true }, // Watch all subdirectories
      (eventType, filename) => {
        if (filename && shouldRebuildForFile(filename)) {
          console.log(`📝 File changed: ${filename}`);
          debouncedBuild();
        }
        // Silently ignore non-TS/JS files (no noise for docs, configs, etc.)
      },
    );

    // Graceful shutdown handling
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping file watcher...');
      watcher.close();
      console.log('👋 File watcher stopped. See you later!');
      process.exit(0);
    });

    // Handle any watcher errors
    watcher.on('error', (error) => {
      console.error('❌ File watcher error:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start file watcher:', error);
    process.exit(1);
  }
};

/**
 * Main execution flow
 *
 * 1. Initialize output directory
 * 2. Perform initial build
 * 3. Start file watcher for continuous development
 */
const main = async (): Promise<void> => {
  console.log('🚀 Starting YinzerFlow development watcher...\n');

  // Setup
  initializeOutputDirectory();

  // Initial build
  console.log('📋 Performing initial build...');
  await buildProject();
  console.log();

  // Start watching
  startFileWatcher();
};

// Start the development watcher
await main();
