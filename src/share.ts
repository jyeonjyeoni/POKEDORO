import type { Language } from './types';

export function encounterShareText(seed:string,name:string,language:Language):string {
  const ending=language==='ja'?'に出会った！':language==='en'?' met me!':'을 만났어!';
  return `'${seed}'에서 '${name}'${ending}\n#POKEDORO #ポケドロ #포케도로`;
}

function legacyCopy(text:string):boolean {
  const area=document.createElement('textarea');
  area.value=text;area.readOnly=true;area.style.position='fixed';area.style.inset='0';area.style.opacity='0';area.style.pointerEvents='none';
  document.body.appendChild(area);area.focus();area.select();area.setSelectionRange(0,text.length);
  let copied=false;try{copied=Boolean(document.execCommand?.('copy'))}catch{/* Try the modern API below. */}finally{area.remove()}
  return copied;
}

export async function copyPlainText(text:string):Promise<boolean> {
  if(legacyCopy(text))return true;
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch{/* Report failure to the caller. */}
  return false;
}
