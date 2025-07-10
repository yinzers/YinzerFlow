import type { CreateEnum } from '@typedefs/internal/Generics.ts';
import type { contentType, httpEncoding, httpHeaders, httpMethod, httpStatus, httpStatusCode } from '@constants/http.ts';

export type InternalHttpStatus = CreateEnum<typeof httpStatus>;
export type InternalHttpStatusCode = CreateEnum<typeof httpStatusCode>;
export type InternalHttpMethod = CreateEnum<typeof httpMethod>;
export type InternalContentType = CreateEnum<typeof contentType>;
export type InternalHttpEncoding = CreateEnum<typeof httpEncoding>;

export type InternalHttpHeaders = Lowercase<CreateEnum<typeof httpHeaders>> | string;
