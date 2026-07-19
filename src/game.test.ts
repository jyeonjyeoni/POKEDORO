import { describe,expect,it } from 'vitest';
import { advanceData, awardFocus, encounterFromSeed, performAction, petOutcome } from './game';
import { defaultData } from './store';

describe('exploration seed',()=>{
 it('reproduces species and personality but not shiny',()=>{const a=encounterFromSeed('launch-eevee',1025,()=>0);const b=encounterFromSeed('launch-eevee',1025,()=>1);expect(a.speciesId).toBe(b.speciesId);expect(a.personality).toBe(b.personality);expect(a.shiny).not.toBe(b.shiny)});
 it('finishes a compatible friendship within five actions',()=>{let e=encounterFromSeed('friendly',1025,()=>1);for(let i=0;i<5&&!e.finished;i++)e=performAction(e,'snack');expect(e.turns).toBeLessThanOrEqual(5)});
});
describe('focus rewards',()=>{
 it('awards at every 30 minutes and caps tickets at three',()=>{expect(awardFocus(0,0,5400)).toEqual({tickets:3,bank:0,earned:3});expect(awardFocus(3,1700,200)).toEqual({tickets:3,bank:100,earned:0})});
 it('awards a ticket before a 45 minute pomodoro ends',()=>{const d=defaultData();d.settings.focusMinutes=45;d.timer={...d.timer,running:true,durationSeconds:2700,lastTickAt:1000};const r=advanceData(d,1801000);expect(r.data.tickets).toBe(1);expect(r.data.timer.running).toBe(true);expect(r.data.timer.elapsedSeconds).toBe(1800)});
 it('reconciles a background pomodoro boundary without overcounting',()=>{const d=defaultData();d.timer={...d.timer,running:true,durationSeconds:1500,lastTickAt:1000,autoStart:false};const r=advanceData(d,2701000);expect(r.data.totalFocusSeconds).toBe(1500);expect(r.data.timer.running).toBe(false);expect(r.data.timer.mode).toBe('break')});
 it('continues focus and break cycles in auto mode',()=>{const d=defaultData();d.settings.focusMinutes=1;d.settings.breakMinutes=1;d.timer={...d.timer,running:true,durationSeconds:60,lastTickAt:1000,autoStart:true};const r=advanceData(d,181000);expect(r.data.totalFocusSeconds).toBe(120);expect(r.data.timer.mode).toBe('break')});
 it('rewards room friends only when a focus cycle completes',()=>{const d=defaultData();d.friends=[{id:'f',speciesId:1,personality:'calm',intimacy:10,mood:'happy',shiny:false,metAt:'',befriendedAt:'',togetherSeconds:0,inRoom:true}];d.timer={...d.timer,running:true,durationSeconds:60,lastTickAt:1000};const r=advanceData(d,61000);expect(r.data.friends[0].intimacy).toBe(12)});
 it('rewards stopwatch friends at each 30 minute milestone',()=>{const d=defaultData();d.friends=[{id:'f',speciesId:1,personality:'calm',intimacy:10,mood:'happy',shiny:false,metAt:'',befriendedAt:'',togetherSeconds:0,inRoom:true}];d.timer={...d.timer,type:'stopwatch',running:true,lastTickAt:1000};const r=advanceData(d,1801000);expect(r.data.friends[0].intimacy).toBe(12)});
});
describe('pet friendship',()=>{
 it('matches the desktop cooldown and daily bonus rules',()=>{const morning=new Date(2026,6,20,9,0,0);expect(petOutcome({intimacy:10},morning)).toEqual({allowed:true,gain:3,intimacy:13});const recent={intimacy:13,lastPetAt:morning.toISOString()};expect(petOutcome(recent,new Date(2026,6,20,9,5,0)).allowed).toBe(false);expect(petOutcome(recent,new Date(2026,6,20,9,11,0))).toEqual({allowed:true,gain:1,intimacy:14});expect(petOutcome(recent,new Date(2026,6,21,9,0,0))).toEqual({allowed:true,gain:3,intimacy:16})});
});
