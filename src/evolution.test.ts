import { describe,expect,it } from 'vitest';
import { canEvolve,evolutionOptionsFor } from './evolution';

describe('desktop v70 evolution table',()=>{
  it('includes every Eevee branch in desktop order',()=>expect(evolutionOptionsFor(133)).toEqual([134,135,136,196,197,470,471,700]));
  it('distinguishes evolvable and final species without network access',()=>{expect(canEvolve(1)).toBe(true);expect(canEvolve(678)).toBe(false);expect(evolutionOptionsFor(99999)).toEqual([])});
});
