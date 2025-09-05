import dayjs from 'dayjs';
import { colors } from '@constants/colors.ts';
import { logLevels } from '@constants/log.js';
import type { LogLevel } from '@typedefs/constants/log.ts';
import type { LoggerConfig } from '@typedefs/public/Logger.ts';
import type { Colors } from '@typedefs/constants/colors.js';

/**
 * YinzerFlow Main Logging System 🏗️
 *
 * Simple, clean logging with Pittsburgh personality!
 * - Numeric levels (0=off, 1=error, 2=warn, 3=info)
 * - Smart formatting: Objects get pretty JSON, strings get YinzerFlow colors
 * - Network logging is separate (see networkLog.ts)
 */

const LOG_LEVELS = {
  off: 0,
  error: 1,
  warn: 2,
  info: 3,
} as const;

const YINZER_PHRASES = {
  positive: ["n'at!", 'yinz are good!', "that's the way!", 'right on!', "lookin' good!", 'way to go!', 'keep it up!'],
  neutral: ["n'at", 'yinz know', "just sayin'", "that's how it is", 'what can ya do', 'it happens'],
  negative: ['aw jeez', "that ain't right", 'what a jagoff move', "that's terrible n'at", 'somebody messed up', 'this is bad news', 'yinz better fix this'],
} as const;

const _getRandomPhrase = (type: 'negative' | 'neutral' | 'positive'): string => {
  const phrases = YINZER_PHRASES[type];
  return phrases[Math.floor(Math.random() * phrases.length)] ?? '';
};

const _formatTimestamp = (): string => dayjs().format('YYYY-MM-DD HH:mm:ss.SSS');

const _logWithStyle = (level: LogLevel, prefix: string, ...args: Array<unknown>): void => {
  const timestamp = _formatTimestamp();
  let bodyColor: Colors = colors.reset;
  if (prefix === 'NETWORK') {
    bodyColor = colors.gray;
  }

  if (level === 'error') {
    const logPrefix = `${colors.red}[${prefix}] ❌ [${timestamp}] [ERROR]${colors.reset}`;
    console.error(`${logPrefix}`, `${bodyColor}`, ...args, `${colors.reset} - ${_getRandomPhrase('negative')}`);
    return;
  }

  if (level === 'warn') {
    const logPrefix = `${colors.yellow}[${prefix}] ⚠️ [${timestamp}] [WARN]${colors.reset}`;
    console.warn(`${logPrefix}`, `${bodyColor}`, ...args, `${colors.reset} - ${_getRandomPhrase('neutral')}`);
    return;
  }

  if (level === 'off') {
    return;
  }

  const logPrefix = `${colors.cyan}[${prefix}] ✅ [${timestamp}] [INFO]${colors.reset}`;
  console.info(`${logPrefix}`, `${bodyColor}`, ...args, `${colors.reset} - ${_getRandomPhrase('positive')}`);
};

/**
 * Creates a logger instance with isolated state
 *
 * @param initialConfig - Optional configuration for the logger
 * @returns Logger instance with logging methods
 */
const createLogger = (
  initialConfig?: LoggerConfig,
): {
  info: (...args: Array<unknown>) => void;
  warn: (...args: Array<unknown>) => void;
  error: (...args: Array<unknown>) => void;
  levels: typeof LOG_LEVELS;
} => {
  const state = {
    logLevel: initialConfig?.logLevel ?? logLevels.info,
    prefix: initialConfig?.prefix ?? 'YINZER',
    logger: initialConfig?.logger ?? null,
  };

  const _getNumericLevel = (level: string): number => (LOG_LEVELS as Record<string, number>)[level] ?? LOG_LEVELS.info;

  const info = (...args: Array<unknown>): void => {
    if (_getNumericLevel(state.logLevel) < LOG_LEVELS.info) return;

    if (state.logger) {
      state.logger.info(...args);
      return;
    }

    _logWithStyle('info', state.prefix, ...args);
  };

  const warn = (...args: Array<unknown>): void => {
    if (_getNumericLevel(state.logLevel) < LOG_LEVELS.warn) return;

    if (state.logger) {
      state.logger.warn(...args);
      return;
    }

    _logWithStyle('warn', state.prefix, ...args);
  };

  const error = (...args: Array<unknown>): void => {
    if (_getNumericLevel(state.logLevel) < LOG_LEVELS.error) return;

    if (state.logger) {
      state.logger.error(...args);
      return;
    }

    _logWithStyle('error', state.prefix, ...args);
  };

  return {
    info,
    warn,
    error,
    levels: LOG_LEVELS,
  };
};

// Default shared logger instance
export const log = createLogger();

// Factory for creating custom logger instances
export { createLogger };
