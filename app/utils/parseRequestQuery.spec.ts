import { describe, expect, it } from 'bun:test';
import parseRequestQueryUtils from 'utils/parseRequestQuery.utils.ts';

describe('parseRequestQuery', () => {
  it('should return a TRequestBody object', () => {
    const path = '/?key=value&key2=value2';
    const result = parseRequestQueryUtils(path);

    expect(result).toEqual({ key: 'value', key2: 'value2' });
  });
});
