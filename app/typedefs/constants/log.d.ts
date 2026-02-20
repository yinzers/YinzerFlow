import type { CreateEnum } from '@typedefs/internal/Generics.ts';
import type { logLevels } from '@constants/log.ts';

/**
 * YinzerFlow Logging Levels
 *
 * String-based logging levels for intuitive configuration:
 * - 'off': No logging at all
 * - 'error': Only errors
 * - 'warn': Warnings and errors (includes security warnings)
 * - 'info': Info, warnings, and errors (standard application logging)
 * - 'debug': All messages including verbose connection details
 *
 * Access logging is controlled separately via `logging.requests` config.
 */
export type LogLevel = CreateEnum<typeof logLevels>;
