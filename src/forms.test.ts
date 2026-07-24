import { describe,expect,it } from 'vitest';
import { chooseForm,collectibleFormTotal,evolvedFormKey,FORM_PROBABILITIES,formDisplayName,formForSpecies,formLabel,formsForSpecies,inheritedFormKey } from './forms';

const sequence=(...values:number[])=>{let index=0;return()=>values[Math.min(index++,values.length-1)]};

describe('desktop v71 collectible form catalog',()=>{
  it('uses the exact 55/35/10 buckets',()=>{
    expect(FORM_PROBABILITIES).toEqual({default:55,common:35,rare:10});
    expect(chooseForm(479,sequence(.54,0)).key).toBe('');
    expect(chooseForm(479,sequence(.55,0)).category).toBe('common');
    expect(chooseForm(25,sequence(.9,0)).category).toBe('rare');
  });
  it('falls back to the default when the rolled category does not exist',()=>expect(chooseForm(479,()=>.9).key).toBe(''));
  it('keeps all Unown letters but treats Spinda as one default form',()=>{expect(formsForSpecies(201)).toHaveLength(28);expect(formsForSpecies(327)).toHaveLength(1);expect(formForSpecies(327).key).toBe('')});
  it('excludes battle-only, Mega, Gigantamax, Primal, and Totem forms',()=>{const keys=Array.from({length:1025},(_,index)=>formsForSpecies(index+1)).flat().map(form=>form.key);expect(keys.some(key=>/(mega|gmax|primal|totem|battle|eternamax)/i.test(key))).toBe(false)});
  it('contains 1,403 collectible appearances across the 1,025 species',()=>expect(collectibleFormTotal(1025)).toBe(1403));
  it('uses stable PokeAPI form keys, sprite references, and localized labels',()=>{
    expect(formForSpecies(479,'rotom-wash')).toMatchObject({key:'rotom-wash',spriteRef:10009,category:'common'});
    expect(formDisplayName('로토무','rotom',479,'rotom-wash','ko')).toBe('워시로토무');
    expect(formLabel(formForSpecies(58,'growlithe-hisui'),'ko','growlithe')).toBe('히스이의 모습');
  });
  it('inherits only supported regional lineages during evolution',()=>{expect(inheritedFormKey('rattata-alola',20)).toBe('raticate-alola');expect(inheritedFormKey('rotom-wash',20)).toBe('')});
  it('preserves visible gender and appearance lineages',()=>{
    expect(inheritedFormKey('frillish-female',593)).toBe('jellicent-female');
    expect(inheritedFormKey('shellos-east',423)).toBe('gastrodon-east');
    expect(inheritedFormKey('burmy-trash',413)).toBe('wormadam-trash');
    expect(inheritedFormKey('scatterbug-polar',665)).toBe('spewpa-polar');
  });
  it('does not mistake a location costume for a regional form',()=>expect(inheritedFormKey('pikachu-alola-cap',26)).toBe(''));
  it('rolls hidden-gender evolution forms at canonical rates',()=>{
    expect(evolvedFormKey(677,'',678,()=>0)).toBe('meowstic-female');
    expect(evolvedFormKey(677,'',678,()=>.5)).toBe('');
    expect(evolvedFormKey(667,'',668,()=>.8749)).toBe('pyroar-female');
    expect(evolvedFormKey(667,'',668,()=>.875)).toBe('');
    expect(evolvedFormKey(915,'',916,()=>0)).toBe('oinkologne-female');
    expect(evolvedFormKey(550,'basculin-white-striped',902,()=>0)).toBe('basculegion-female');
  });
});
