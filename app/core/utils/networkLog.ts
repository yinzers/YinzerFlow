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
 * Get performance details for response time with Pittsburgh personality
 */
export const logPerformanceDetails = (timeMs: number): void => {
  let emoji = '';
  let phrase = '';

  // < 50ms: Truly instant, users can't perceive any delay
  if (timeMs < 50) {
    emoji = '⚡';
    phrase = 'faster than a Stillers touchdown!';
  }
  // 50-100ms: Still feels instant for most interactions
  if (timeMs < 100) {
    emoji = '🔥';
    phrase = "smooth as butter n'at!";
  }
  // 100-200ms: Google's "good" threshold, still very responsive
  if (timeMs < 200) {
    emoji = '✅';
    phrase = 'not bad yinz!';
  }
  // 200-500ms: Noticeable but acceptable for complex operations
  if (timeMs < 500) {
    emoji = '⚠️';
    phrase = "slowin' down a bit there";
  }
  // 500ms-1s: Users start getting impatient
  if (timeMs < 1000) {
    emoji = '🐌';
    phrase = "that's draggin' n'at";
  }
  // > 1s: Definitely problematic, needs attention
  emoji = '💥';
  phrase = 'what a jagoff response time!';

  networkLog.log.warn(`${colors.magenta} ${emoji} Response time: ${timeMs}ms - ${phrase}${colors.reset}`);
};
