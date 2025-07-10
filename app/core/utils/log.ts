import { colors, formatTimestamp, logPrefix } from '@core/utils/networkLog.ts';
import type { Logger } from '@typedefs/public/Logger.js';

/**
 * YinzerFlow Main Logging System 🏗️
 *
 * Simple, clean logging with Pittsburgh personality!
 * - Numeric levels (0=off, 1=error, 2=warn, 3=info)
 * - Smart formatting: Objects get pretty JSON, strings get YinzerFlow colors
 * - Network logging is separate (see networkLog.ts)
 */

// logPrefix imported from networkLog.ts

// Internal numeric log levels for main logging
const internalLogLevels = {
  off: 0,
  error: 1,
  warn: 2,
  info: 3,
} as const;

// Colors are imported from networkLog.ts for consistency

const yinzerPhrases = {
  positive: ["n'at!", 'yinz are good!', "that's the way!", 'right on!', "lookin' good!", 'way to go!', 'keep it up!'],
  neutral: ["n'at", 'yinz know', "just sayin'", "that's how it is", 'what can ya do', 'it happens'],
  negative: ['aw jeez', "that ain't right", 'what a jagoff move', "that's terrible n'at", 'somebody messed up', 'this is bad news', 'yinz better fix this'],
} as const;

// Global configuration
let currentLogLevel: number = internalLogLevels.warn;
let customLogger: Logger | null = null;

// Helper functions (formatTimestamp imported from networkLog.ts)

const getRandomPhrase = (type: 'negative' | 'neutral' | 'positive'): string => {
  const phrases = yinzerPhrases[type];
  return phrases[Math.floor(Math.random() * phrases.length)] ?? '';
};

// formatData function removed - using console.log's native formatting instead

// =============================================================================
// MAIN LOGGING SYSTEM (Numeric Levels)
// =============================================================================

const info = (...args: Array<unknown>): void => {
  if (currentLogLevel < internalLogLevels.info) return;

  if (customLogger) {
    // Route to user's custom logger
    customLogger.info(...args);
  } else {
    // Use built-in YinzerFlow styling
    logWithStyle('info', ...args);
  }
};

const warn = (...args: Array<unknown>): void => {
  if (currentLogLevel < internalLogLevels.warn) return;

  if (customLogger) {
    // Route to user's custom logger
    customLogger.warn(...args);
  } else {
    // Use built-in YinzerFlow styling
    logWithStyle('warn', ...args);
  }
};

const error = (...args: Array<unknown>): void => {
  if (currentLogLevel < internalLogLevels.error) return;

  if (customLogger) {
    // Route to user's custom logger
    customLogger.error(...args);
  } else {
    // Use built-in YinzerFlow styling
    logWithStyle('error', ...args);
  }
};

// Verbose logging removed - just use info for detailed logging

const perf = (message: string, timeMs: number, data?: unknown): void => {
  if (currentLogLevel < internalLogLevels.info) return;
  const timestamp = formatTimestamp();

  // Performance-based emojis and phrases
  let emoji = '❓ ';
  let phrase = '';

  // < 50ms: Truly instant, users can't perceive any delay
  if (timeMs < 50) {
    emoji = '⚡ ';
    phrase = Math.random() < 0.5 ? "lightning quick n'at!" : 'faster than a Stillers touchdown!';
    // 50-100ms: Still feels instant for most interactions
  } else if (timeMs < 100) {
    emoji = '🔥 ';
    phrase = Math.random() < 0.5 ? "that's the way!" : "smooth as butter n'at!";
    // 100-200ms: Google's "good" threshold, still very responsive
  } else if (timeMs < 200) {
    emoji = '✅ ';
    phrase = Math.random() < 0.5 ? 'not bad yinz!' : "keepin' up just fine!";
    // 200-500ms: Noticeable but acceptable for complex operations
  } else if (timeMs < 500) {
    emoji = '⚠️ ';
    phrase = Math.random() < 0.5 ? 'eh, could be better' : "slowin' down a bit there";
    // 500ms-1s: Users start getting impatient
  } else if (timeMs < 1000) {
    emoji = '🐌 ';
    phrase = Math.random() < 0.5 ? "that's draggin' n'at" : "c'mon, pick up the pace!";
    // > 1s: Definitely problematic, needs attention
  } else {
    emoji = '💥 ';
    phrase = Math.random() < 0.5 ? 'what a jagoff response time!' : 'slower than traffic on the Parkway!';
  }

  const prefix = `${colors.magenta}[${logPrefix}] ${emoji} [${timestamp}] [PERF]${colors.reset}`;

  // Include timing in the data object for console.log's native formatting
  const perfData = data ? { ...data, executionTime: `${timeMs}ms` } : { executionTime: `${timeMs}ms` };
  console.log(`${prefix} ${message} -`, perfData, `- ${phrase}`);
};

// Network logging moved to networkLog.ts

// =============================================================================
// CONFIGURATION & EXPORTS
// =============================================================================

/**
 * Set the main log level using string values for intuitive configuration
 */
const setLogLevel = (level: 'error' | 'info' | 'off' | 'warn'): void => {
  const levelMap = {
    off: 0,
    error: 1,
    warn: 2,
    info: 3,
  } as const;

  currentLogLevel = levelMap[level];
};

/**
 * Set a custom logger for output routing
 */
const setCustomLogger = (logger: Logger): void => {
  customLogger = logger;
};

/**
 * Simple logging that mimics console.log behavior but with YinzerFlow styling
 */
const logWithStyle = (level: 'error' | 'info' | 'warn', ...args: Array<unknown>): void => {
  const timestamp = formatTimestamp();

  // Determine emoji, color, and phrase type based on level
  let emoji = '✅ ';
  let color: string = colors.cyan;
  let phraseType: 'negative' | 'neutral' | 'positive' = 'positive';
  let consoleMethod: 'error' | 'log' | 'warn' = 'log';

  if (level === 'error') {
    emoji = '❌ ';
    color = colors.red;
    phraseType = 'negative';
    consoleMethod = 'error';
  } else if (level === 'warn') {
    emoji = '⚠️ ';
    color = colors.yellow;
    phraseType = 'neutral';
    consoleMethod = 'warn';
  } else {
    emoji = '✅ ';
    color = colors.cyan;
    phraseType = 'positive';
    consoleMethod = 'log';
  }

  const phrase = getRandomPhrase(phraseType);
  const prefix = `${color}[${logPrefix}] ${emoji}[${timestamp}] [${level.toUpperCase()}]${colors.reset}`;

  // Let console.log handle all arguments naturally - just like console.log does
  // In production, this could be replaced with a no-op for zero bundle impact
  console[consoleMethod](`${prefix}`, ...args, `- ${phrase}`);
};

export const log = {
  // Configuration
  setLogLevel,
  setCustomLogger,

  // Main logging functions with Pittsburgh personality
  info,
  warn,
  error,
  perf,

  // Constants for convenience
  levels: internalLogLevels,
};

// Export the Logger interface for custom implementations
export type { Logger } from '@typedefs/public/Logger.js';
