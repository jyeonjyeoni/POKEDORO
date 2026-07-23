import { describe,expect,it } from 'vitest';
import { canEvolve,evolutionOptionsFor,evolutionOptionsForForm } from './evolution';

describe('desktop v70 evolution table',()=>{
  it('includes every Eevee branch in desktop order',()=>expect(evolutionOptionsFor(133)).toEqual([134,135,136,196,197,470,471,700]));
  it('distinguishes evolvable and final species without network access',()=>{expect(canEvolve(1)).toBe(true);expect(canEvolve(678)).toBe(false);expect(evolutionOptionsFor(99999)).toEqual([])});
  it('routes Meowth evolutions by regional form',()=>{
    expect(evolutionOptionsForForm(52,'')).toEqual([53]);
    expect(evolutionOptionsForForm(52,'meowth-alola')).toEqual([53]);
    expect(evolutionOptionsForForm(52,'meowth-galar')).toEqual([863]);
  });
  it('only evolves form-exclusive regional lineages',()=>{
    expect(canEvolve(83,'')).toBe(false);
    expect(canEvolve(83,'farfetchd-galar')).toBe(true);
    expect(evolutionOptionsForForm(194,'wooper-paldea')).toEqual([980]);
    expect(evolutionOptionsForForm(215,'sneasel-hisui')).toEqual([903]);
    expect(evolutionOptionsForForm(550,'basculin-white-striped')).toEqual([902]);
    expect(canEvolve(550,'basculin-blue-striped')).toBe(false);
    expect(evolutionOptionsForForm(562,'yamask-galar')).toEqual([867]);
  });
});
