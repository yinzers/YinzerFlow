import { colors } from '@constants/colors.ts';
import { logLevels } from '@constants/log.js';
import type { LogLevel } from '@typedefs/constants/log.ts';
import type { Logger, LoggerConfig } from '@typedefs/public/Logger.ts';
import type { Colors } from '@typedefs/constants/colors.js';

/**
 * YinzerFlow Main Logging System
 *
 * - Numeric levels (0=off, 1=error, 2=warn, 3=info, 4=debug)
 * - Smart formatting: prefix, timestamp, optional Pittsburgh personality
 * - Table support: Use log.table() for structured data display
 * - Custom logger as output sink: replaces console, raw args delegated
 * - Access logging is separate (see accessLog.ts)
 *
 * ## Config Cascade
 *
 * - `logging.personality` and `logging.prefix` on the framework config are the
 *   single source of truth for all framework log output.
 * - `createLogger({ level })` controls filtering per instance.
 * - `logging.logger` is an **output sink** — it replaces `console` as the
 *   destination. Raw args are always delegated to the custom logger.
 *   If the sink is a framework logger (has `loggerBrand`), its personality/prefix
 *   are overridden to match the framework config before delegation.
 *   If it's an external logger (Winston, Pino), args pass through
 *   untouched — the external logger handles its own formatting.
 */

/** Symbol brand for identifying framework-created loggers. Unforgeable — prevents duck-type collisions. */
export const loggerBrand = Symbol('YinzerFlowLogger');

const LOG_LEVELS = {
  off: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
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

const _pad = (n: number, len = 2): string => String(n).padStart(len, '0');

const _formatTimestamp = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${_pad(now.getMonth() + 1)}-${_pad(now.getDate())} ${_pad(now.getHours())}:${_pad(now.getMinutes())}:${_pad(now.getSeconds())}.${_pad(now.getMilliseconds(), 3)}`;
};

const _getPhraseType = (level: LogLevel): 'negative' | 'neutral' | 'positive' => {
  if (level === 'error') return 'negative';
  if (level === 'warn') return 'neutral';
  return 'positive';
};

interface LogStyleOpts {
  level: LogLevel;
  prefix: string;
  personality: boolean;
  output: Logger;
}

const _logWithStyle = (opts: LogStyleOpts, ...args: Array<unknown>): void => {
  const { level, prefix, personality, output } = opts;
  const timestamp = _formatTimestamp();
  let bodyColor: Colors = colors.reset;
  if (prefix === 'ACCESS' || prefix === 'DIAGNOSTIC') {
    bodyColor = colors.gray;
  }

  const phrase = personality ? ` - ${_getRandomPhrase(_getPhraseType(level))}` : '';

  if (level === 'error') {
    const logPrefix = `${colors.red}[${prefix}] ❌ [${timestamp}] [ERROR]${colors.reset}`;
    output.error(`${logPrefix}`, `${bodyColor}`, ...args, `${colors.reset}${phrase}`);
    return;
  }

  if (level === 'warn') {
    const logPrefix = `${colors.yellow}[${prefix}] ⚠️ [${timestamp}] [WARN]${colors.reset}`;
    output.warn(`${logPrefix}`, `${bodyColor}`, ...args, `${colors.reset}${phrase}`);
    return;
  }

  if (level === 'debug') {
    const logPrefix = `${colors.gray}[${prefix}] 🔍 [${timestamp}] [DEBUG]${colors.reset}`;
    (output.debug ?? output.info)(`${logPrefix}`, `${colors.gray}`, ...args, `${colors.reset}`);
    return;
  }

  if (level === 'off') {
    return;
  }

  const logPrefix = `${colors.cyan}[${prefix}] ✅ [${timestamp}] [INFO]${colors.reset}`;
  output.info(`${logPrefix}`, `${bodyColor}`, ...args, `${colors.reset}${phrase}`);
};

/** Default output — wraps console */
const _consoleOutput: Logger = {
  info: (...args: Array<unknown>) => console.info(...args),
  warn: (...args: Array<unknown>) => console.warn(...args),
  error: (...args: Array<unknown>) => console.error(...args),
  debug: (...args: Array<unknown>) => console.debug(...args),
};

const _logTable = (opts: { prefix: string; personality: boolean; output: Logger }, data: unknown, ...additionalArgs: Array<unknown>): void => {
  const { prefix, personality, output } = opts;
  const timestamp = _formatTimestamp();
  const phrase = personality ? ` - ${_getRandomPhrase('positive')}` : '';
  const logPrefix = `${colors.magenta}[${prefix}] 📊 [${timestamp}] [TABLE]${colors.reset}`;

  output.info(`${logPrefix}${phrase}`);
  console.table(data);

  if (additionalArgs.length > 0) {
    output.info(`${colors.gray}Additional context:${colors.reset}`, ...additionalArgs);
  }
};

/**
 * Creates a logger instance with isolated state.
 *
 * @param initialConfig.level - Log level threshold — messages at this severity and above are output (default: 'info')
 * @param initialConfig.prefix - Log line prefix (default: 'YINZER')
 * @returns Logger instance with logging methods and Symbol-branded state for framework use
 */
const createLogger = (
  initialConfig?: LoggerConfig & { personality?: boolean; logger?: Logger | null | undefined },
): {
  info: (...args: Array<unknown>) => void;
  warn: (...args: Array<unknown>) => void;
  error: (...args: Array<unknown>) => void;
  debug: (...args: Array<unknown>) => void;
  table: (data: unknown, ...additionalArgs: Array<unknown>) => void;
  levels: typeof LOG_LEVELS;
  [loggerBrand]: { level: string; prefix: string; personality: boolean };
} => {
  const state = {
    level: initialConfig?.level ?? initialConfig?.logLevel ?? logLevels.info,
    prefix: initialConfig?.prefix ?? 'YINZER',
    personality: initialConfig?.personality ?? true,
    logger: initialConfig?.logger ?? null,
  };

  const numericLevel = (LOG_LEVELS as Record<string, number>)[state.level] ?? LOG_LEVELS.info;

  /**
   * Route a log call. Three paths:
   * 1. Custom logger is a framework logger (has loggerBrand) → delegate raw (it formats itself)
   * 2. Custom logger is external (Winston/Pino) → pass raw args (it has its own formatter)
   * 3. No custom logger → format ourselves, output to console
   */
  const _emit = (level: 'debug' | 'error' | 'info' | 'warn', args: Array<unknown>): void => {
    if (state.logger) {
      // Path 1 & 2: custom logger (framework or external) — delegate raw args.
      // Framework loggers format with their own (mutated) state.
      // External loggers (Winston/Pino) have their own formatters — no ANSI wrapping.
      const method = level === 'debug' ? (state.logger.debug ?? state.logger.info) : state.logger[level];
      method.call(state.logger, ...args);
      return;
    }

    // Path 3: no custom logger — we format, output to console
    _logWithStyle({ level, prefix: state.prefix, personality: state.personality, output: _consoleOutput }, ...args);
  };

  const info = (...args: Array<unknown>): void => {
    if (numericLevel < LOG_LEVELS.info) return;
    _emit('info', args);
  };

  const warn = (...args: Array<unknown>): void => {
    if (numericLevel < LOG_LEVELS.warn) return;
    _emit('warn', args);
  };

  const error = (...args: Array<unknown>): void => {
    if (numericLevel < LOG_LEVELS.error) return;
    _emit('error', args);
  };

  const debug = (...args: Array<unknown>): void => {
    if (numericLevel < LOG_LEVELS.debug) return;
    _emit('debug', args);
  };

  const table = (data: unknown, ...additionalArgs: Array<unknown>): void => {
    if (numericLevel < LOG_LEVELS.info) return;

    if (state.logger) {
      // Custom logger — delegate raw (it handles its own formatting)
      state.logger.info('TABLE:', data, ...additionalArgs);
      return;
    }

    _logTable({ prefix: state.prefix, personality: state.personality, output: _consoleOutput }, data, ...additionalArgs);
  };

  return {
    info,
    warn,
    error,
    debug,
    table,
    levels: LOG_LEVELS,
    [loggerBrand]: state,
  };
};

// Default shared logger instance
export const log = createLogger();

// Factory for creating custom logger instances
export { createLogger };
