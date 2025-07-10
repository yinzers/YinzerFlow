import { existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import dts from 'bun-plugin-dts';

/**
 * Production Build Script for YinzerFlow
 *
 * This script:
 * 1. Runs quality checks (linting, testing, unused packages)
 * 2. Builds the main library with TypeScript definitions
 * 3. Validates bundle size
 * 4. Copies distribution files
 */

// Configuration
const BUILD_CONFIG = {
  entrypoints: ['./app/index.ts'],
  outdir: './lib',
  target: 'node' as const,
  minify: true,
  sourcemap: 'external' as const,
  maxBundleSize: 100000, // 100KB
} as const;

// Helper function to run command with better error reporting
const runCommand = (command: string, description: string): void => {
  console.log(`📋 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed`);
    throw error;
  }
};

// Helper function to copy files with error handling
const copyFiles = (): void => {
  console.log('📁 Copying distribution files...');

  const filesToCopy = [
    { src: 'docs', dest: 'lib/docs', type: 'directory' },
    { src: 'example', dest: 'lib/example', type: 'directory' },
    { src: 'LICENSE', dest: 'lib/LICENSE', type: 'file' },
    { src: 'README.md', dest: 'lib/README.md', type: 'file' },
    { src: 'package.json', dest: 'lib/package.json', type: 'file' },
  ];

  for (const { src, dest, type } of filesToCopy) {
    try {
      if (type === 'directory') {
        if (!existsSync(dest)) execSync(`mkdir -p ${dest}`);
        // Copy directory contents and remove unwanted files
        execSync(`cp -R ${src}/* ${dest}/ 2>/dev/null || true`);
        // Remove excluded files/directories
        try {
          execSync(`rm -rf ${dest}/node_modules ${dest}/bun.lock ${dest}/storage ${dest}/.gitignore`);
        } catch (_) {
          // Some files might not exist, that's fine
        }
      } else {
        execSync(`cp ${src} ${dest}`);
      }
      console.log(`✅ Copied ${src} → ${dest}`);
    } catch (_) {
      console.warn(`⚠️  Warning: Could not copy ${src} to ${dest}`);
    }
  }
};

const qualityChecks = (): void => {
  console.log('🔍 Running quality checks...');
  runCommand('bun run find-unused-packages', 'Checking for unused packages');
  runCommand('bun run lint', 'Running linter');
  runCommand('bun run lint:format', 'Checking code formatting');
  runCommand('bun run lint:spelling', 'Checking spelling');
  runCommand('bun run test:production', 'Running production tests');
  console.log('✅ All quality checks passed!\n');
};

const cleanOutputDirectory = (): void => {
  console.log('🧹 Cleaning output directory...');
  execSync('rm -rf lib');

  if (!existsSync('lib')) {
    mkdirSync('lib');
    console.log('✅ Created output directory\n');
  }
};

const buildMainLibrary = async (): Promise<void> => {
  console.log('🔨 Building main library...');
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
  console.log('✅ Main library built successfully\n');
};

const validateBundleSize = (): number => {
  console.log('📏 Validating bundle size...');
  const { size } = Bun.file('lib/index.js');
  const sizeKB = Math.round(size / 1024);
  const maxSizeKB = Math.round(BUILD_CONFIG.maxBundleSize / 1024);

  if (size > BUILD_CONFIG.maxBundleSize) {
    console.error(`❌ Bundle size: ${sizeKB}KB exceeds limit of ${maxSizeKB}KB`);
    process.exit(1);
  }
  console.log(`✅ Bundle size: ${sizeKB}KB (within ${maxSizeKB}KB limit)\n`);
  return sizeKB;
};

// Main build function
const buildProduction = async (): Promise<void> => {
  const startTime = Date.now();
  console.log('🚀 Starting YinzerFlow production build...\n');

  try {
    // Step 1: Quality checks
    qualityChecks();

    // Step 2: Clean and prepare output directory
    cleanOutputDirectory();

    // Step 3: Build the main library
    await buildMainLibrary();

    // Step 4: Validate bundle size
    const sizeKB = validateBundleSize();

    // Step 5: Copy distribution files
    copyFiles();

    // Success summary
    const duration = Date.now() - startTime;
    console.log(`\n🎉 Production build completed successfully in ${duration}ms!`);
    console.log(`📦 Output: ./lib/index.js (${sizeKB}KB)`);
  } catch (error: unknown) {
    console.error('\n❌ Production build failed:');
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }
};

// Run the build
await buildProduction();
