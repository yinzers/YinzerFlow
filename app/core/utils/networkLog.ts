import { colors } from '@constants/colors.ts';
import { logLevels } from '@constants/log.ts';
import { createLogger } from '@core/utils/log.ts';
import type { Logger, LoggerConfig } from '@typedefs/public/Logger.ts';

const baseConfig: LoggerConfig = {
  prefix: 'NETWORK',
  logLevel: 'off',
  logger: undefined,
};

export const networkLog = {
  log: createLogger(baseConfig),
  enable: (customLogger?: Logger): void => {
    networkLog.log = createLogger({ ...baseConfig, logLevel: logLevels.info, logger: customLogger });
  },
};

/**
 * Get status emoji for response codes
 */
export const getStatusEmoji = (statusCode: number): string => {
  if (statusCode >= 200 && statusCode < 300) return '✅';
  if (statusCode >= 300 && statusCode < 400) return '🔄';
  if (statusCode >= 400 && statusCode < 500) return '❌';
  if (statusCode >= 500) return '💥';
  return '❓';
};

/**
 * Performance thresholds with Pittsburgh personality
 */
const PERFORMANCE_THRESHOLDS = [
  { maxTime: 50, emoji: '⚡', phrase: 'faster than a Stillers touchdown!' },
  { maxTime: 100, emoji: '🔥', phrase: "smooth as butter n'at!" },
  { maxTime: 200, emoji: '✅', phrase: 'not bad yinz!' },
  { maxTime: 500, emoji: '⚠️', phrase: "slowin' down a bit there" },
  { maxTime: 1000, emoji: '🐌', phrase: "that's draggin' n'at" },
  { maxTime: Infinity, emoji: '💥', phrase: 'what a jagoff response time!' },
] as const;

/**
 * Get performance details for response time with Pittsburgh personality
 */
export const logPerformanceDetails = (timeMs: number): void => {
  const threshold = PERFORMANCE_THRESHOLDS.find((t) => timeMs < t.maxTime) ?? PERFORMANCE_THRESHOLDS[PERFORMANCE_THRESHOLDS.length - 1];
  if (!threshold) throw new Error('No threshold found for performance details');

  networkLog.log.warn(`${colors.magenta} ${threshold.emoji} Response time: ${timeMs}ms - ${threshold.phrase}${colors.reset}`);
};
