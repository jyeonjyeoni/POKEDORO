let fallbackSequence=0;

/** Creates an ID even on browsers that do not implement crypto.randomUUID(). */
export function createId(source:Crypto|null=globalThis.crypto??null):string {
  try{const value=source?.randomUUID?.();if(value)return value}catch{/* Continue with compatible generation. */}
  const bytes=new Uint8Array(16);
  try{
    if(source?.getRandomValues){source.getRandomValues(bytes);bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`}
  }catch{/* Continue with the final local fallback. */}
  fallbackSequence++;
  return `${Date.now().toString(36)}-${fallbackSequence.toString(36)}-${Math.random().toString(36).slice(2,12)}`;
}
