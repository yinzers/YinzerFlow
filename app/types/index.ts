/**
 * Types Barrel File
 *
 * This file re-exports all common types from the types directory
 * to provide a cleaner import experience while maintaining tree-shakability.
 */

// Core types
export type { IRoute } from './Route.ts';
export type { TErrorFunction } from './Response.ts';

// HTTP types
export type { THttpStatusCode, TResponseBody } from './http/Response.ts';
export type { TJsonData, TXmlData, TUrlEncodedFormData, ICsvData, IPlainTextData, IMultipartFormData } from './http/Request.ts';
