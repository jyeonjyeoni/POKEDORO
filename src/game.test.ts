import { describe,expect,it } from 'vitest';
import { ACTIONS, advanceData, awardFocus, encounterFromSeed, generatePlaceSeed, giveEverstone, normalizePlaceSeed, payAutoPetTickets, performAction, petFriend, petOutcome, PLACE_WEIGHT_TOTAL, reactionFor, recordDexEncounter, recordDexFriend, releaseFriend, resolvePlaceSeed, rollEverstone, runAutoPetIfDue, setAutoPetEnabled, takeEverstone } from './game';
import type { EncounterState, Friend } from './types';
import { defaultData } from './store';

describe('exploration seed',()=>{
 const vectors=[
  ['POKE-DORO',12740,100,4,'playful'],['AAAA-AAAA',57458,475,4,'playful'],
  ['2345-6789',115335,957,7,'sleepy'],['TEST-SEED',36918,304,7,'sleepy'],
  ['ABCD-EFGH',54834,453,6,'aloof'],['ZZZZ-ZZZZ',52937,437,0,'timid']
 ] as const;
 it.each(vectors)('matches desktop PLACE-V1 for %s',async(seed,roll,speciesId,personalityIndex,personality)=>{
  expect(await resolvePlaceSeed(seed)).toEqual({seed,roll,speciesId,personalityIndex,personality});
 });
 it('normalizes direct and shared seeds exactly like desktop',()=>{
  expect(normalizePlaceSeed(' po ke-do ro ')).toBe('POKE-DORO');
  expect(normalizePlaceSeed("'POKE-DORO'에서 '피카츄'를 만났어! #포케도로")).toBe('POKE-DORO');
  expect(normalizePlaceSeed('IO01-IO01')).toBe('IO01-IO01');
  expect(()=>normalizePlaceSeed('short')).toThrow('INVALID_PLACE_SEED');
 });
 it('generates canonical seeds from the desktop alphabet',()=>{for(let i=0;i<20;i++)expect(generatePlaceSeed()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/)});
 it('starts a random exploration when the seed field is empty',async()=>{const encounter=await encounterFromSeed('',()=>1);expect(encounter.seed).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);expect(encounter.speciesId).toBeGreaterThanOrEqual(1);expect(encounter.speciesId).toBeLessThanOrEqual(1025)});
 it('keeps shiny independent from place species and personality',async()=>{const a=await encounterFromSeed('POKE-DORO',()=>0);const b=await encounterFromSeed('POKE-DORO',()=>1);expect(a.speciesId).toBe(b.speciesId);expect(a.personality).toBe(b.personality);expect(a.shiny).toBe(true);expect(b.shiny).toBe(false)});
 it('keeps form rolls independent from existing seed and shiny results',async()=>{const a=await encounterFromSeed('POKE-DORO',()=>1,()=>0);const b=await encounterFromSeed('POKE-DORO',()=>1,()=>.6);expect(a.speciesId).toBe(b.speciesId);expect(a.personality).toBe(b.personality);expect(a.shiny).toBe(b.shiny);expect(a.formKey).toBe('');expect(b.formKey).toBe('voltorb-hisui')});
 it('freezes the PLACE-V1 total weight',()=>expect(PLACE_WEIGHT_TOTAL).toBe(123508));
});
describe('encounter friendship difficulty',()=>{
 const encounter=(personality='timid',distance=0,turns=0):EncounterState=>({seed:'TEST-SEED',speciesId:1,personality,shiny:false,distance,turns,finished:false,befriended:false});
 const preferences={
  timid:{liked:['wait','snack'],disliked:'petTry'},glutton:{liked:['approach','snack'],disliked:'wait'},curious:{liked:['approach','play'],disliked:'wait'},calm:{liked:['wait','petTry'],disliked:'play'},
  playful:{liked:['approach','play'],disliked:'wait'},affectionate:{liked:['play','petTry'],disliked:'wait'},aloof:{liked:['wait','snack'],disliked:'approach'},sleepy:{liked:['wait','petTry'],disliked:'play'}
 } as const;
 it('matches every desktop personality preference',()=>{for(const [personality,preference] of Object.entries(preferences)){for(const action of ACTIONS){const expected=(preference.liked as readonly string[]).includes(action)?'liked':preference.disliked===action?'disliked':'neutral';expect(reactionFor(personality,action)).toBe(expected)}}});
 it('draws inclusive integer scores from the desktop ranges',()=>{
  expect(performAction(encounter('timid'),'wait',()=>0).distance).toBe(24);expect(performAction(encounter('timid'),'wait',()=>0.999999).distance).toBe(38);
  expect(performAction(encounter('timid'),'approach',()=>0).distance).toBe(10);expect(performAction(encounter('timid'),'approach',()=>0.999999).distance).toBe(22);
  expect(performAction(encounter('timid',20),'petTry',()=>0).distance).toBe(12);expect(performAction(encounter('timid',20),'petTry',()=>0.999999).distance).toBe(25);
 });
 it('uses preference gestures even when disliked points happen to rise',()=>{expect(performAction(encounter('timid',20),'petTry',()=>0.999999).reaction).toBe('shake');expect(performAction(encounter('timid'),'wait',()=>0).reaction).toBe('jump')});
 it('guarantees success with five minimum liked actions',()=>{let current=encounter('timid');for(let turn=0;turn<5&&!current.finished;turn++)current=performAction(current,'wait',()=>0);expect(current).toMatchObject({distance:100,turns:5,finished:true,befriended:true})});
 it('counts reaching 100 on turn five as success',()=>expect(performAction(encounter('timid',76,4),'wait',()=>0)).toMatchObject({distance:100,turns:5,finished:true,befriended:true}));
 it('fails after turn five when distance remains below 100',()=>expect(performAction(encounter('timid',75,4),'wait',()=>0)).toMatchObject({distance:99,turns:5,finished:true,befriended:false}));
});
describe('focus rewards',()=>{
 it('awards at every 30 minutes and caps tickets at three',()=>{expect(awardFocus(0,0,5400)).toEqual({tickets:3,bank:0,earned:3});expect(awardFocus(3,1700,200)).toEqual({tickets:3,bank:100,earned:0})});
 it('awards a ticket before a 45 minute pomodoro ends',()=>{const d=defaultData();d.settings.focusMinutes=45;d.timer={...d.timer,running:true,durationSeconds:2700,lastTickAt:1000};const r=advanceData(d,1801000);expect(r.data.tickets).toBe(1);expect(r.data.timer.running).toBe(true);expect(r.data.timer.elapsedSeconds).toBe(1800)});
 it('reconciles a background pomodoro boundary without overcounting',()=>{const d=defaultData();d.timer={...d.timer,running:true,durationSeconds:1500,lastTickAt:1000,autoStart:false};const r=advanceData(d,2701000);expect(r.data.totalFocusSeconds).toBe(1500);expect(r.data.timer.running).toBe(false);expect(r.data.timer.mode).toBe('break')});
 it('continues focus and break cycles in auto mode',()=>{const d=defaultData();d.settings.focusMinutes=1;d.settings.breakMinutes=1;d.timer={...d.timer,running:true,durationSeconds:60,lastTickAt:1000,autoStart:true};const r=advanceData(d,181000);expect(r.data.totalFocusSeconds).toBe(120);expect(r.data.timer.mode).toBe('break')});
 it('rewards room friends only when a focus cycle completes',()=>{const d=defaultData();d.friends=[{id:'f',speciesId:1,personality:'calm',intimacy:10,mood:'happy',shiny:false,metAt:'',befriendedAt:'',togetherSeconds:0,inRoom:true}];d.timer={...d.timer,running:true,durationSeconds:60,lastTickAt:1000};const r=advanceData(d,61000);expect(r.data.friends[0].intimacy).toBe(12)});
 it('rewards stopwatch friends at each 30 minute milestone',()=>{const d=defaultData();d.friends=[{id:'f',speciesId:1,personality:'calm',intimacy:10,mood:'happy',shiny:false,metAt:'',befriendedAt:'',togetherSeconds:0,inRoom:true}];d.timer={...d.timer,type:'stopwatch',running:true,lastTickAt:1000};const r=advanceData(d,1801000);expect(r.data.friends[0].intimacy).toBe(12)});
 it('awards a stopwatch ticket immediately at the 30 minute boundary',()=>{const d=defaultData();d.focusBankSeconds=1799;d.timer={...d.timer,type:'stopwatch',running:true,elapsedSeconds:1799,lastTickAt:1000};const r=advanceData(d,2000);expect(r.earned).toBe(1);expect(r.data.tickets).toBe(1);expect(r.data.focusBankSeconds).toBe(0)});
});
describe('pet friendship',()=>{
 it('matches the desktop cooldown and daily bonus rules',()=>{const morning=new Date(2026,6,20,9,0,0);expect(petOutcome({intimacy:10},morning)).toEqual({allowed:true,gain:3,intimacy:13});const recent={intimacy:13,lastPetAt:morning.toISOString()};expect(petOutcome(recent,new Date(2026,6,20,9,5,0)).allowed).toBe(false);expect(petOutcome(recent,new Date(2026,6,20,9,11,0))).toEqual({allowed:true,gain:1,intimacy:14});expect(petOutcome(recent,new Date(2026,6,21,9,0,0))).toEqual({allowed:true,gain:3,intimacy:16})});
});

describe('v70 evolution and Everstone rules',()=>{
 const friend=(overrides:Partial<Friend>={}):Friend=>({id:'friend',speciesId:133,personality:'curious',intimacy:99,mood:'happy',shiny:true,metAt:'2026-01-01T00:00:00.000Z',befriendedAt:'2026-01-02T00:00:00.000Z',togetherSeconds:42,inRoom:false,...overrides});
 it('chooses Eevee branches uniformly from the static desktop table',()=>{
  const first=petFriend(friend(),new Date('2026-07-22T00:00:00.000Z'),()=>0);
  const last=petFriend(friend({id:'last'}),new Date('2026-07-22T00:00:00.000Z'),()=>0.999999);
  expect(first.friend.speciesId).toBe(134);expect(last.friend.speciesId).toBe(700);
  expect(first.friend).toMatchObject({intimacy:1,personality:'curious',shiny:true,metAt:'2026-01-01T00:00:00.000Z',togetherSeconds:42});
 });
 it('inherits a regional form when the evolved species supports it',()=>expect(petFriend(friend({speciesId:19,formKey:'rattata-alola'}),new Date('2026-07-22T00:00:00.000Z'),()=>0).friend).toMatchObject({speciesId:20,formKey:'raticate-alola',intimacy:1}));
 it('evolves Alolan Meowth only into Alolan Persian',()=>{
  const evolved=petFriend(friend({speciesId:52,formKey:'meowth-alola'}),new Date('2026-07-22T00:00:00.000Z'),()=>0.999999);
  expect(evolved.friend).toMatchObject({speciesId:53,formKey:'persian-alola',intimacy:1});
 });
 it('evolves Galarian Meowth only into Perrserker',()=>{
  const evolved=petFriend(friend({speciesId:52,formKey:'meowth-galar'}),new Date('2026-07-22T00:00:00.000Z'),()=>0);
  expect(evolved.friend).toMatchObject({speciesId:863,formKey:'',intimacy:1});
 });
 it('evolves Espurr into both Meowstic gender forms',()=>{
  const female=petFriend(friend({speciesId:677,formKey:''}),new Date('2026-07-22T00:00:00.000Z'),()=>0);
  const male=petFriend(friend({id:'male',speciesId:677,formKey:''}),new Date('2026-07-22T00:00:00.000Z'),()=>0.999999);
  expect(female.friend).toMatchObject({speciesId:678,formKey:'meowstic-female',intimacy:1});
  expect(male.friend).toMatchObject({speciesId:678,formKey:'',intimacy:1});
 });
 it('does not evolve final species',()=>expect(petFriend(friend({speciesId:678}),new Date('2026-07-22T00:00:00.000Z')).friend).toMatchObject({speciesId:678,intimacy:100}));
 it('blocks at 100 while held and evolves on the next valid pet after recovery',()=>{
  const blocked=petFriend(friend({heldEverstone:true}),new Date('2026-07-22T00:00:00.000Z'),()=>0);
  expect(blocked.friend).toMatchObject({speciesId:133,intimacy:100,heldEverstone:true});
  const data=defaultData();data.items.everstone=0;data.friends=[blocked.friend];
  const recovered=takeEverstone(data,'friend');
  const evolved=petFriend(recovered.friends[0],new Date('2026-07-22T00:11:00.000Z'),()=>0);
  expect(recovered.items.everstone).toBe(1);expect(evolved.friend).toMatchObject({speciesId:134,intimacy:1,heldEverstone:false});
 });
 it('rolls Everstones independently at exactly one percent',()=>{expect(rollEverstone(()=>0)).toBe(true);expect(rollEverstone(()=>0.009999)).toBe(true);expect(rollEverstone(()=>0.01)).toBe(false)});
 it('moves one stone atomically and returns it when releasing a friend',()=>{
  const data=defaultData();data.items.everstone=1;data.friends=[friend({intimacy:1,heldEverstone:false})];
  const given=giveEverstone(data,'friend');expect(given.items.everstone).toBe(0);expect(given.friends[0].heldEverstone).toBe(true);
  const taken=takeEverstone(given,'friend');expect(taken.items.everstone).toBe(1);expect(taken.friends[0].heldEverstone).toBe(false);
  const regiven=giveEverstone(taken,'friend'),released=releaseFriend(regiven,'friend');expect(released.friends).toHaveLength(0);expect(released.items.everstone).toBe(1);
 });
});

describe('v71 form Pokédex records',()=>{
 it('records species and forms independently while preserving legacy totals',()=>{
  const met='2026-07-22T12:00:00.000Z';let dex=recordDexEncounter({},479,'rotom-wash',false,met);
  expect(dex[479]).toMatchObject({befriendedCount:0,shinySeen:false,forms:[{formKey:'rotom-wash',befriendedCount:0,shinySeen:false}]});
  dex=recordDexEncounter(dex,479,'rotom-heat',true,met);
  dex=recordDexFriend(dex,479,'rotom-wash',true,met);
  expect(dex[479]).toMatchObject({befriendedCount:1,shinySeen:true,shinyFriend:true});
  expect(dex[479].forms).toEqual(expect.arrayContaining([expect.objectContaining({formKey:'rotom-wash',befriendedCount:1,shinyFriend:true}),expect.objectContaining({formKey:'rotom-heat',befriendedCount:0,shinySeen:true})]));
 });
});

describe('v70 Auto-Petting Machine',()=>{
 const friend=(id:string,inRoom:boolean,intimacy=10,lastPetAt?:string):Friend=>({id,speciesId:1,personality:'calm',intimacy,mood:'happy',shiny:false,metAt:'',befriendedAt:'',togetherSeconds:0,inRoom,lastPetAt});
 it('accepts partial payments and unlocks on the transaction reaching 30',()=>{
  const data=defaultData();data.tickets=20;
  const first=payAutoPetTickets(data,1000);expect(first).toMatchObject({tickets:0,autoPetMachine:{ticketsPaid:20,unlocked:false,enabled:false,lastRunAt:0}});
  first.tickets=12;const second=payAutoPetTickets(first,2000);expect(second).toMatchObject({tickets:2,autoPetMachine:{ticketsPaid:30,unlocked:true,enabled:true,lastRunAt:2000}});
 });
 it('starts a fresh cycle only when switched from OFF to ON',()=>{
  const data=defaultData();data.autoPetMachine={ticketsPaid:30,unlocked:true,enabled:false,lastRunAt:100};
  const on=setAutoPetEnabled(data,true,200);expect(on.autoPetMachine.lastRunAt).toBe(200);
  expect(setAutoPetEnabled(on,true,300).autoPetMachine.lastRunAt).toBe(200);
  expect(setAutoPetEnabled(on,false,400).autoPetMachine.lastRunAt).toBe(200);
 });
 it('runs once after 30 minutes for every friend regardless of room placement',()=>{
  const now=Date.parse('2026-07-22T01:00:00.000Z'),data=defaultData();
  data.autoPetMachine={ticketsPaid:30,unlocked:true,enabled:true,lastRunAt:now-30*60*1000};
  data.friends=[friend('room',true,99),friend('storage',false,10),friend('cooldown',false,10,new Date(now-5*60*1000).toISOString())];
  const result=runAutoPetIfDue(data,now,()=>0);
  expect(result.ran).toBe(true);expect(result.data.autoPetMachine.lastRunAt).toBe(now);
  expect(result.data.friends[0]).toMatchObject({speciesId:2,intimacy:1});
  expect(result.data.dex[2]).toMatchObject({speciesId:2,befriendedCount:1});
  expect(result.data.friends[1].intimacy).toBe(13);expect(result.data.friends[2].intimacy).toBe(10);
  expect(runAutoPetIfDue(result.data,now+1000,()=>0).ran).toBe(false);
 });
 it('does not catch up multiple missed runs and initializes a missing clock without reward',()=>{
  const data=defaultData();data.autoPetMachine={ticketsPaid:30,unlocked:true,enabled:true,lastRunAt:0};data.friends=[friend('f',false)];
  const initialized=runAutoPetIfDue(data,10_000);expect(initialized.ran).toBe(false);expect(initialized.data.friends[0].intimacy).toBe(10);
  const overdue={...initialized.data,autoPetMachine:{...initialized.data.autoPetMachine,lastRunAt:1}};
  const once=runAutoPetIfDue(overdue,10_000_000);expect(once.ran).toBe(true);expect(once.data.friends[0].intimacy).toBe(13);
 });
});
