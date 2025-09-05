import type { CreateEnum } from '@typedefs/internal/Generics.ts';
import type { logLevels } from '@constants/log.ts';

/**
 * YinzerFlow Logging Levels
 *
 * String-based logging levels for intuitive configuration:
 * - 'off': No logging at all. Mainly used for network logging internally, but feel free to use it for other purposes.
 * - 'error': Only errors
 * - 'warn': Warnings and errors (includes security warnings, slow requests)
 * - 'info': Info, warnings, and errors (standard application logging)
 *
 * Network logging is controlled separately via boolean networkLogging config.
 */
export type LogLevel = CreateEnum<typeof logLevels>;
