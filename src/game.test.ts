import { describe,expect,it } from 'vitest';
import { ACTIONS, advanceData, awardFocus, encounterFromSeed, generatePlaceSeed, normalizePlaceSeed, performAction, petOutcome, PLACE_WEIGHT_TOTAL, reactionFor, resolvePlaceSeed } from './game';
import type { EncounterState } from './types';
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
