import rawCatalog from './pokemon-forms.json';
import type { Language } from './types';

export type FormCategory='default'|'common'|'rare';
export interface PokemonForm {
  speciesId:number;
  key:string;
  spriteRef:number|string;
  category:FormCategory;
  names:Partial<Record<Language,string>>;
}

interface RawForm { key?:unknown;sprite_ref?:unknown;category?:unknown;names?:unknown; }
interface RawCatalog { probabilities?:Partial<Record<FormCategory,number>>;species?:Record<string,RawForm[]>; }

const source=rawCatalog as RawCatalog;
export const FORM_PROBABILITIES={
  default:Math.max(0,Number(source.probabilities?.default??55)),
  common:Math.max(0,Number(source.probabilities?.common??35)),
  rare:Math.max(0,Number(source.probabilities?.rare??10))
} as const;

const catalog=new Map<number,readonly PokemonForm[]>();
for(const [rawSpeciesId,rawForms] of Object.entries(source.species??{})){
  const speciesId=Number(rawSpeciesId);
  if(!Number.isInteger(speciesId)||!Array.isArray(rawForms))continue;
  const forms=rawForms.map(raw=>{
    const key=String(raw.key??''),rawSprite=String(raw.sprite_ref??speciesId),category=String(raw.category??'common');
    const names=raw.names&&typeof raw.names==='object'?raw.names as Partial<Record<Language,string>>:{};
    return {speciesId,key,spriteRef:/^\d+$/.test(rawSprite)?Number(rawSprite):rawSprite,category:(category==='default'||category==='rare'?category:'common') as FormCategory,names};
  });
  if(forms.length&&forms[0].key==='')catalog.set(speciesId,forms);
}

const KO_FORM_PHRASES:Readonly<Record<string,string>>={
  alola:'알로라의 모습',galar:'가라르의 모습',hisui:'히스이의 모습',paldea:'팔데아의 모습',
  'paldea-combat-breed':'팔데아의 모습·컴뱃종','paldea-blaze-breed':'팔데아의 모습·블레이즈종','paldea-aqua-breed':'팔데아의 모습·워터종',
  origin:'오리진폼',therian:'영물폼',starter:'파트너','spiky-eared':'삐쭉귀','white-striped':'흰줄무늬','own-tempo':'마이페이스',
  'family-of-three':'3마리 가족','three-segment':'세 마디',antique:'진품폼',artisan:'진작폼',masterpiece:'걸작폼',roaming:'도보폼'
};
const KO_FORM_TOKENS:Readonly<Record<string,string>>={
  attack:'어택',defense:'디펜스',speed:'스피드',rock:'록',pop:'아이돌',star:'스타',belle:'마담',phd:'닥터',libre:'마스크드',cosplay:'옷갈아입기',
  fighting:'격투',flying:'비행',poison:'독',ground:'땅',bug:'벌레',ghost:'고스트',steel:'강철',fire:'불꽃',water:'물',grass:'풀',electric:'전기',psychic:'에스퍼',ice:'얼음',dragon:'드래곤',dark:'악',fairy:'페어리',unknown:'???',normal:'노말',type:'타입',
  male:'수컷',female:'암컷',sandy:'모래땅',trash:'슈레',polar:'설국',tundra:'설원',continental:'대륙',garden:'정원',elegant:'우아',meadow:'화원',modern:'모던',marine:'마린',archipelago:'군도',high:'고원',plains:'',sandstorm:'사막',river:'대하',monsoon:'스콜',savanna:'사바나',sun:'태양',ocean:'대양',jungle:'정글',fancy:'팬시',poke:'볼',ball:'모양',white:'흰색',striped:'줄무늬',
  vanilla:'바닐라',ruby:'루비',matcha:'말차',mint:'민트',lemon:'레몬',salted:'솔트',caramel:'캐러멜',rainbow:'레인보우',cream:'크림',swirl:'믹스',strawberry:'딸기',berry:'베리',love:'하트',clover:'네잎클로버',flower:'꽃',ribbon:'리본',sweet:'사탕공예',
  combat:'컴뱃',blaze:'블레이즈',aqua:'워터',breed:'종',yellow:'옐로',blue:'블루',plumage:'깃털',low:'로우',mode:'모드',gliding:'활공',swimming:'수영',sprinting:'질주',aquatic:'수중',drive:'드라이브',power:'파워',build:'빌드',glide:'글라이드',stretchy:'늘어진 모습',droopy:'처진 모습',segment:'마디',limited:'리미티드'
};

export function formsForSpecies(speciesId:number):readonly PokemonForm[]{
  return catalog.get(speciesId)??[{speciesId,key:'',spriteRef:speciesId,category:'default',names:{}}];
}

export function formForSpecies(speciesId:number,formKey:string|undefined|null=''):PokemonForm{
  const forms=formsForSpecies(speciesId),key=String(formKey??'');
  return forms.find(form=>form.key===key)??forms[0];
}

export function chooseForm(speciesId:number,random=Math.random):PokemonForm{
  const forms=formsForSpecies(speciesId);
  if(forms.length===1)return forms[0];
  const roll=Math.min(99,Math.floor(Math.max(0,random())*100));
  const category:FormCategory=roll<FORM_PROBABILITIES.default?'default':roll<FORM_PROBABILITIES.default+FORM_PROBABILITIES.common?'common':'rare';
  const candidates=forms.filter(form=>form.category===category);
  if(!candidates.length)return forms[0];
  const index=Math.min(candidates.length-1,Math.floor(Math.max(0,random())*candidates.length));
  return candidates[index];
}

function suffixFor(form:PokemonForm,baseSlug=''):string{
  const prefix=`${baseSlug.toLocaleLowerCase()}-`;
  return baseSlug&&form.key.toLocaleLowerCase().startsWith(prefix)?form.key.slice(prefix.length):form.key;
}

function koreanFallback(form:PokemonForm,baseSlug=''):string{
  const suffix=suffixFor(form,baseSlug);
  if(KO_FORM_PHRASES[suffix])return KO_FORM_PHRASES[suffix];
  return suffix.split('-').map(token=>KO_FORM_TOKENS[token]??`${token.slice(0,1).toLocaleUpperCase()}${token.slice(1)}`).filter(Boolean).join('·');
}

export function formLabel(form:PokemonForm,language:Language,baseSlug=''):string{
  if(!form.key)return language==='ko'?'기본 모습':language==='ja'?'通常の姿':'Default Form';
  if(form.names[language])return String(form.names[language]);
  if(language==='ko')return koreanFallback(form,baseSlug);
  return String(form.names.en??suffixFor(form,baseSlug).split('-').map(word=>`${word.slice(0,1).toLocaleUpperCase()}${word.slice(1)}`).join(' '));
}

const normalizedName=(value:string)=>value.toLocaleLowerCase().replace(/[^0-9a-z가-힣ぁ-んァ-ヶ一-龠]/g,'');
export function formDisplayName(baseName:string,baseSlug:string,speciesId:number,formKey:string|undefined|null,language:Language):string{
  const form=formForSpecies(speciesId,formKey);
  if(!form.key)return baseName;
  const label=formLabel(form,language,baseSlug);
  return normalizedName(baseName)&&normalizedName(label).includes(normalizedName(baseName))?label:`${baseName} · ${label}`;
}

export function inheritedFormKey(formKey:string|undefined|null,evolvedSpeciesId:number):string{
  const sourceKey=String(formKey??'');
  if(!sourceKey)return '';
  for(const region of ['alola','galar','hisui','paldea']){
    if(sourceKey.endsWith(`-${region}`))return formsForSpecies(evolvedSpeciesId).find(form=>form.key.includes(`-${region}`))?.key??'';
  }
  const sourceSuffix=sourceKey.split('-').slice(1).join('-');
  const matchingForm=formsForSpecies(evolvedSpeciesId).find(form=>form.key.endsWith(`-${sourceSuffix}`));
  if(matchingForm)return matchingForm.key;
  if(sourceKey==='rockruff-own-tempo'&&evolvedSpeciesId===745)return 'lycanroc-dusk';
  if(sourceKey==='poltchageist-artisan'&&evolvedSpeciesId===1013)return 'sinistcha-masterpiece';
  return '';
}

interface GenderEvolutionForm { evolvedSpeciesId:number; femaleFormKey:string; femaleRate:number; }
const GENDER_EVOLUTION_FORMS:Readonly<Record<number,GenderEvolutionForm>>={
  550:{evolvedSpeciesId:902,femaleFormKey:'basculegion-female',femaleRate:.5},
  667:{evolvedSpeciesId:668,femaleFormKey:'pyroar-female',femaleRate:.875},
  677:{evolvedSpeciesId:678,femaleFormKey:'meowstic-female',femaleRate:.5},
  915:{evolvedSpeciesId:916,femaleFormKey:'oinkologne-female',femaleRate:.5}
};

export function evolvedFormKey(sourceSpeciesId:number,sourceFormKey:string|undefined|null,evolvedSpeciesId:number,random=Math.random):string{
  const inherited=inheritedFormKey(sourceFormKey,evolvedSpeciesId);
  if(inherited)return inherited;
  const rule=GENDER_EVOLUTION_FORMS[sourceSpeciesId];
  if(!rule||rule.evolvedSpeciesId!==evolvedSpeciesId)return '';
  return Math.max(0,random())<rule.femaleRate?rule.femaleFormKey:'';
}

export function collectibleFormTotal(speciesCount=1025):number{
  let total=0;
  for(let speciesId=1;speciesId<=speciesCount;speciesId++)total+=formsForSpecies(speciesId).length;
  return total;
}
