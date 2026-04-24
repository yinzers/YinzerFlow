import type { CreateEnum } from '@typedefs/internal/Generics.ts';
import type { wsBackpressureStrategy, wsCloseCode, wsOpcode, wsReadyState } from '@constants/websocket.ts';

/**
 * WebSocket frame opcode values (0x0–0xA)
 */
export type InternalWsOpcode = CreateEnum<typeof wsOpcode>;

/**
 * WebSocket close status codes (1000–1011)
 */
export type InternalWsCloseCode = CreateEnum<typeof wsCloseCode>;

/**
 * WebSocket connection ready state (0–3)
 */
export type InternalWsReadyState = CreateEnum<typeof wsReadyState>;

/**
 * Backpressure handling strategy: 'buffer' or 'drop'
 */
export type InternalWsBackpressureStrategy = CreateEnum<typeof wsBackpressureStrategy>;
