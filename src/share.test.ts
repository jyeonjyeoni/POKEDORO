import { describe,expect,it } from 'vitest';
import { encounterShareText } from './share';

describe('encounter sharing',()=>{
 it('includes the complete seed, Pokémon name, and all hashtags',()=>expect(encounterShareText('68NT-SSGF','맘복치','ko')).toBe("'68NT-SSGF'에서 '맘복치'을 만났어!\n#POKEDORO #ポケドロ #포케도로"));
});
