// Shared ANSI Color codes (reused from main log system)
export const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[96m', // Cyan for info
  yellow: '\x1b[93m', // Yellow for warn
  red: '\x1b[91m', // Red for error
  green: '\x1b[92m', // Green for success
  magenta: '\x1b[95m', // Magenta for performance
  gray: '\x1b[90m', // Gray for network logs
} as const;
