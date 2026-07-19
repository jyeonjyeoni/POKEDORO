import type { AppData, EncounterState, Friend, Language } from './types';
import { PythonRandom } from './pythonRandom';
import { sha256 } from './sha256';

export const PERSONALITIES = ['timid','glutton','curious','calm','playful','affectionate','aloof','sleepy'] as const;
export const ACTIONS = ['approach','wait','play','snack','petTry'] as const;
export type Action = typeof ACTIONS[number];
const favorite:Record<string,Action> = {timid:'wait',glutton:'snack',curious:'approach',calm:'wait',playful:'play',affectionate:'petTry',aloof:'approach',sleepy:'snack'};
const disliked:Record<string,Action> = {timid:'approach',glutton:'wait',curious:'wait',calm:'play',playful:'wait',affectionate:'wait',aloof:'petTry',sleepy:'play'};
const names:Record<Language,Record<string,string>> = {
 ko:{timid:'겁쟁이',glutton:'먹보',curious:'호기심쟁이',calm:'느긋함',playful:'장난꾸러기',affectionate:'애교쟁이',aloof:'새침함',sleepy:'잠꾸러기'},
 en:{timid:'Timid',glutton:'Glutton',curious:'Curious',calm:'Relaxed',playful:'Playful',affectionate:'Affectionate',aloof:'Aloof',sleepy:'Sleepy'},
 ja:{timid:'おくびょう',glutton:'くいしんぼう',curious:'こうきしん',calm:'のんびり',playful:'いたずらずき',affectionate:'あまえんぼう',aloof:'きまぐれ',sleepy:'ねぼすけ'}
};
export const personalityName = (p:string,l:Language) => names[l][p] ?? p;

export const PET_COOLDOWN_MS = 10 * 60 * 1000;
export function petOutcome(friend:Pick<Friend,'intimacy'|'lastPetAt'>,now=new Date()):{allowed:boolean;gain:number;intimacy:number} {
  const parsed=friend.lastPetAt?new Date(friend.lastPetAt):null;
  const last=parsed&&!Number.isNaN(parsed.getTime())?parsed:null;
  if(last&&now.getTime()-last.getTime()<PET_COOLDOWN_MS)return {allowed:false,gain:0,intimacy:friend.intimacy};
  const firstToday=!last||last.toDateString()!==now.toDateString();
  const gain=firstToday?3:1;
  return {allowed:true,gain,intimacy:Math.min(100,friend.intimacy+gain)};
}

export const PLACE_SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PLACE_SPECIES_COUNT = 1025;
export const PLACE_WEIGHT_TOTAL = 123508;
const PLACE_PREFIX = 'POKEDORO-PLACE-V1:';
const SPECIAL_WEIGHTS:Readonly<Record<number,number>> = {
  1:45,4:45,7:45,10:255,16:255,25:190,35:150,39:170,52:255,54:190,58:190,
  63:200,74:255,92:190,104:190,113:30,129:255,133:45,143:25,147:45,151:3
};
const PLACE_WEIGHTS = Array.from({length:PLACE_SPECIES_COUNT},(_,index)=>SPECIAL_WEIGHTS[index+1]??120);
if(PLACE_WEIGHTS.reduce((sum,weight)=>sum+weight,0)!==PLACE_WEIGHT_TOTAL)throw new Error('Invalid PLACE-V1 weight table');

export function normalizePlaceSeed(value:string):string {
  let raw=String(value).trim().toUpperCase();
  const shared=raw.match(/['\u2018\u2019\"]([A-Z0-9\s-]+)['\u2018\u2019\"]\s*\uC5D0\uC11C/);
  if(shared)raw=shared[1];
  const compact=raw.replace(/[\s-]/g,'');
  if(!/^[A-Z0-9]{8}$/.test(compact))throw new Error('INVALID_PLACE_SEED');
  return `${compact.slice(0,4)}-${compact.slice(4)}`;
}

export function generatePlaceSeed():string {
  const bytes=new Uint8Array(8);
  let filledSecurely=false;
  try{if(globalThis.crypto?.getRandomValues){globalThis.crypto.getRandomValues(bytes);filledSecurely=true}}catch{/* Compatibility fallback below. */}
  if(!filledSecurely)for(let index=0;index<bytes.length;index++)bytes[index]=Math.floor(Math.random()*256);
  const compact=Array.from(bytes,value=>PLACE_SEED_ALPHABET[value&31]).join('');
  return `${compact.slice(0,4)}-${compact.slice(4)}`;
}

function placeSeedWords(canonicalSeed:string):number[] {
  const digest=sha256(Uint8Array.from(`${PLACE_PREFIX}${canonicalSeed}`,character=>character.charCodeAt(0)));
  const words:number[]=[];
  for(let offset=digest.length-4;offset>=0;offset-=4){
    words.push(((digest[offset]<<24)|(digest[offset+1]<<16)|(digest[offset+2]<<8)|digest[offset+3])>>>0);
  }
  while(words.length>1&&words[words.length-1]===0)words.pop();
  return words;
}

export async function resolvePlaceSeed(value:string):Promise<{seed:string;roll:number;speciesId:number;personalityIndex:number;personality:typeof PERSONALITIES[number]}> {
  const seed=normalizePlaceSeed(value);
  const rng=new PythonRandom(placeSeedWords(seed));
  const roll=rng.randRange(PLACE_WEIGHT_TOTAL);
  let cumulative=0,speciesId=PLACE_SPECIES_COUNT;
  for(let index=0;index<PLACE_WEIGHTS.length;index++){
    cumulative+=PLACE_WEIGHTS[index];
    if(roll<cumulative){speciesId=index+1;break}
  }
  const personalityIndex=rng.randRange(PERSONALITIES.length);
  return {seed,roll,speciesId,personalityIndex,personality:PERSONALITIES[personalityIndex]};
}

export async function encounterFromSeed(seed:string,random=Math.random):Promise<EncounterState> {
  const place=await resolvePlaceSeed(seed.trim()?seed:generatePlaceSeed());
  return {...place,shiny:random()<1/2048,distance:0,turns:0,finished:false,befriended:false};
}
export function performAction(encounter:EncounterState, action:Action):EncounterState {
  if (encounter.finished) return encounter;
  const delta=action===favorite[encounter.personality]?34:action===disliked[encounter.personality]?-5:18;
  const distance=Math.max(0,Math.min(100,encounter.distance+delta));
  const turns=encounter.turns+1;
  return {...encounter,distance,turns,finished:distance>=100||turns>=5,befriended:distance>=100,reaction:delta>=30?'jump':delta<0?'shake':undefined};
}
export function hintFor(personality:string,language:Language):string {
  const hints:Record<Language,Record<string,string>>={
    ko:{timid:'작은 소리에도 어깨를 움츠리는 것 같다.',glutton:'가방 근처를 자꾸 힐끗거린다.',curious:'한 발 다가왔다가 고개를 갸웃한다.',calm:'서두를 생각은 없어 보인다.',playful:'주변의 잎사귀를 툭툭 건드린다.',affectionate:'손끝을 유심히 바라보고 있다.',aloof:'관심 없는 척하며 곁눈질한다.',sleepy:'눈꺼풀이 천천히 내려앉는다.'},
    en:{timid:'It flinches even at tiny sounds.',glutton:'It keeps glancing toward your bag.',curious:'It steps closer, then tilts its head.',calm:'It does not seem to be in a hurry.',playful:'It taps at the leaves around it.',affectionate:'It watches your fingertips closely.',aloof:'It pretends not to care, but peeks over.',sleepy:'Its eyelids are slowly drooping.'},
    ja:{timid:'小さな音にも肩をすくめている。',glutton:'バッグのあたりを何度も見ている。',curious:'一歩近づいて首をかしげた。',calm:'急ぐつもりはなさそうだ。',playful:'周りの葉っぱをつついている。',affectionate:'指先をじっと見つめている。',aloof:'興味のないふりで横目に見ている。',sleepy:'まぶたがゆっくり下がっている。'}
  };
  return hints[language][personality] ?? '';
}

export function awardFocus(tickets:number, bank:number, seconds:number):{tickets:number;bank:number;earned:number} {
  const total=bank+seconds; const available=Math.floor(total/1800); const earned=Math.min(available,Math.max(0,3-tickets));
  return {tickets:tickets+earned,bank: earned<available&&tickets+earned>=3 ? total%1800 : total-earned*1800,earned};
}
export const formatTime=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;

function creditFocus(data:AppData,seconds:number):AppData {
  if(seconds<=0)return data;
  const reward=awardFocus(data.tickets,data.focusBankSeconds,seconds);
  return {...data,tickets:reward.tickets,focusBankSeconds:reward.bank,totalFocusSeconds:data.totalFocusSeconds+seconds,todos:data.todos.map(x=>x.id===data.timer.selectedTodoId?{...x,focusSeconds:x.focusSeconds+seconds}:x),friends:data.friends.map(x=>x.inRoom?{...x,togetherSeconds:x.togetherSeconds+seconds}:x)};
}

function rewardRoomIntimacy(data:AppData,gain:number):AppData {
  if(gain<=0)return data;
  return {...data,friends:data.friends.map(friend=>friend.inRoom?{...friend,intimacy:Math.min(99,friend.intimacy+gain),mood:'proud'}:friend)};
}

export function advanceData(previous:AppData,now:number):{data:AppData;completed:boolean;earned:number} {
  if(!previous.timer.running)return {data:previous,completed:false,earned:0};
  const last=previous.timer.lastTickAt??now;
  let seconds=Math.max(0,Math.floor((now-last)/1000));
  if(!seconds)return {data:previous,completed:false,earned:0};
  const oldTickets=previous.tickets;
  let data:AppData={...previous,timer:{...previous.timer,lastTickAt:last+seconds*1000}};
  let completed=false;
  if(data.timer.type==='stopwatch'){
    const previousMilestones=Math.floor(data.timer.elapsedSeconds/1800);
    data=creditFocus(data,seconds);
    data={...data,timer:{...data.timer,elapsedSeconds:data.timer.elapsedSeconds+seconds}};
    const milestones=Math.floor(data.timer.elapsedSeconds/1800)-previousMilestones;
    data=rewardRoomIntimacy(data,milestones*2);
    return {data,completed:false,earned:data.tickets-oldTickets};
  }
  let guard=0;
  while(seconds>0&&data.timer.running&&guard++<200){
    const remaining=Math.max(1,data.timer.durationSeconds-data.timer.elapsedSeconds);
    const step=Math.min(seconds,remaining);
    if(data.timer.mode==='focus')data=creditFocus(data,step);
    data={...data,timer:{...data.timer,elapsedSeconds:data.timer.elapsedSeconds+step}};
    seconds-=step;
    if(data.timer.elapsedSeconds>=data.timer.durationSeconds){
      completed=true;
      const wasFocus=data.timer.mode==='focus';
      if(wasFocus){data={...data,todos:data.todos.map(x=>x.id===data.timer.selectedTodoId?{...x,pomodoroCount:x.pomodoroCount+1}:x)};data=rewardRoomIntimacy(data,2)}
      const mode=wasFocus?'break':'focus';
      const duration=(mode==='focus'?data.settings.focusMinutes:data.settings.breakMinutes)*60;
      data={...data,timer:{...data.timer,mode,elapsedSeconds:0,durationSeconds:duration,running:data.timer.autoStart,lastTickAt:data.timer.autoStart?now-seconds*1000:null}};
    }
  }
  return {data,completed,earned:data.tickets-oldTickets};
}
