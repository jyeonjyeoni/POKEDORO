import type { Language, SpriteStyle } from './types';

export interface CatalogEntry { id:number; slug:string; names:Record<Language,string>; }
let catalogPromise: Promise<CatalogEntry[]> | null = null;
const catalogSlugs = new Map<number,string>();
const activeCries = new Set<HTMLAudioElement>();

export function loadCatalog(): Promise<CatalogEntry[]> {
  if (catalogPromise) return catalogPromise;
  catalogPromise = Promise.all([
    fetch('./assets/national-pokedex.json').then(r => r.json()),
    fetch('./assets/pokemon-species-names.csv').then(r => r.text())
  ]).then(([dex, csv]) => {
    const localized = new Map<number,Partial<Record<Language,string>>>();
    const languageIds: Record<number,Language> = {1:'ja',3:'ko',9:'en'};
    for (const line of csv.replace(/^\uFEFF/, '').split(/\r?\n/).slice(1)) {
      const [idRaw, languageRaw, name] = line.split(',', 4);
      const language = languageIds[Number(languageRaw)];
      if (!language || !name) continue;
      const id = Number(idRaw);
      localized.set(id, {...localized.get(id), [language]:name.replace(/^"|"$/g,'')});
    }
    const entries = dex.pokemon_entries.map((entry: {entry_number:number;pokemon_species:{name:string}}) => {
      const names = localized.get(entry.entry_number) ?? {};
      return { id:entry.entry_number, slug:entry.pokemon_species.name, names:{ko:names.ko ?? names.en ?? entry.pokemon_species.name,en:names.en ?? entry.pokemon_species.name,ja:names.ja ?? names.en ?? entry.pokemon_species.name} };
    });
    for (const entry of entries) catalogSlugs.set(entry.id, entry.slug);
    return entries;
  });
  return catalogPromise;
}

export function spriteUrl(id:number, shiny:boolean, style:SpriteStyle):string {
  const root = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
  if (style === 'home') return `${root}/other/home/${shiny ? 'shiny/' : ''}${id}.png`;
  if (style === 'official') return `${root}/other/official-artwork/${shiny ? 'shiny/' : ''}${id}.png`;
  return `${root}/${shiny ? 'shiny/' : ''}${id}.png`;
}
export function cryUrl(id:number):string { return `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`; }
export function mp3CryUrl(slug:string):string { return `https://play.pokemonshowdown.com/audio/cries/${slug.toLowerCase().replace(/[^a-z0-9]/g,'')}.mp3`; }

export function playCry(id:number, volume:number):void {
  if (typeof Audio === 'undefined') return;
  const slug = catalogSlugs.get(id);
  const sources = [...(slug ? [mp3CryUrl(slug)] : []), cryUrl(id)];
  const audio = new Audio();
  activeCries.add(audio);
  audio.preload = 'auto';
  audio.volume = Math.max(0, Math.min(1, volume));
  const cleanup = () => {
    audio.onerror = null;
    audio.onended = null;
    activeCries.delete(audio);
  };
  const attempt = (index:number) => {
    if (index >= sources.length) { cleanup(); return; }
    let advanced = false;
    const fallback = () => {
      if (advanced) return;
      advanced = true;
      attempt(index + 1);
    };
    audio.onerror = fallback;
    audio.src = sources[index];
    audio.play().catch(fallback);
  };
  audio.onended = cleanup;
  attempt(0);
}

interface ChainNode { species:{url:string}; evolves_to:ChainNode[] }
function idFromUrl(url:string):number { return Number(url.match(/\/(\d+)\/?$/)?.[1] ?? 0); }
function findChildren(node:ChainNode, id:number):number[] | null {
  if (idFromUrl(node.species.url) === id) return node.evolves_to.map(x => idFromUrl(x.species.url));
  for (const child of node.evolves_to) { const found = findChildren(child,id); if (found) return found; }
  return null;
}
export async function evolutionOptions(id:number):Promise<number[]> {
  try {
    const species = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`).then(r => r.json());
    const chain = await fetch(species.evolution_chain.url).then(r => r.json());
    return findChildren(chain.chain,id) ?? [];
  } catch { return []; }
}
