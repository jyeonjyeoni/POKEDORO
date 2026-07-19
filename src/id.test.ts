import { describe,expect,it } from 'vitest';
import { createId } from './id';

describe('compatible IDs',()=>{
 it('still creates unique IDs when Web Crypto is unavailable',()=>{const first=createId(null),second=createId(null);expect(first).toBeTruthy();expect(second).toBeTruthy();expect(first).not.toBe(second)});
});
