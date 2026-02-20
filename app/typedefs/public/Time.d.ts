/**
 Time duration string format

 Format: number followed by unit (ms, s, m, h, d)

 Units:
 - ms: milliseconds
 - s: seconds
 - m: minutes
 - h: hours
 - d: days

 @example
 ```typescript
 '500ms' // 500 milliseconds
 '30s'   // 30 seconds
 '15m'   // 15 minutes
 '2h'    // 2 hours
 '1d'    // 1 day
 ```
 */
export type TimeString = `${number}${'d' | 'h' | 'm' | 'ms' | 's'}`;
