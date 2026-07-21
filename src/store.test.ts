import { describe, expect, it } from 'vitest';
import { defaultData, normalizeBackupData, normalizePersonality, portableBackupData } from './store';

describe('desktop backup personality compatibility', () => {
  it.each([
    ['timid','겁쟁이'], ['glutton','먹보'], ['curious','호기심쟁이'], ['calm','느긋함'],
    ['playful','장난꾸러기'], ['affectionate','애교쟁이'], ['aloof','새침함'], ['sleepy','잠꾸러기']
  ])('exports %s as %s and restores the web key', (web, desktop) => {
    const data = defaultData();
    data.friends = [{id:'friend',speciesId:677,personality:web,intimacy:1,mood:'happy',shiny:false,metAt:'',befriendedAt:'',togetherSeconds:0,inRoom:false}];
    data.encounter = {seed:'TEST-SEED',speciesId:677,personality:web,shiny:false,distance:0,turns:0,finished:false,befriended:false};
    const portable = portableBackupData(data);
    expect(portable.friends[0].personality).toBe(desktop);
    expect(portable.encounter?.personality).toBe(desktop);
    expect(normalizePersonality(desktop)).toBe(web);
  });
});

describe('v70 backup compatibility',()=>{
  it('fills all new fields when importing a version 1 backup',()=>{
    const old=defaultData();
    delete (old as Partial<typeof old>).items;delete (old as Partial<typeof old>).autoPetMachine;
    old.friends=[{id:'old',speciesId:133,personality:'호기심쟁이',intimacy:100,mood:'happy',shiny:false,metAt:'',befriendedAt:'',togetherSeconds:0,inRoom:false}];
    const normalized=normalizeBackupData(old);
    expect(normalized.items).toEqual({everstone:0});
    expect(normalized.autoPetMachine).toEqual({ticketsPaid:0,unlocked:false,enabled:false,lastRunAt:0});
    expect(normalized.friends[0]).toMatchObject({personality:'curious',heldEverstone:false});
  });
  it('clamps machine fields and honors unlocked backups',()=>{
    const data=defaultData();data.items.everstone=-5;data.autoPetMachine={ticketsPaid:17,unlocked:true,enabled:true,lastRunAt:1234.9};
    const normalized=normalizeBackupData(data);
    expect(normalized.items.everstone).toBe(0);
    expect(normalized.autoPetMachine).toEqual({ticketsPaid:30,unlocked:true,enabled:true,lastRunAt:1234});
  });
  it('keeps held stones, inventory, and machine progress in portable JSON',()=>{
    const data=defaultData();data.items.everstone=2;data.autoPetMachine={ticketsPaid:17,unlocked:false,enabled:false,lastRunAt:9000};
    data.friends=[{id:'friend',speciesId:133,personality:'curious',intimacy:20,mood:'happy',shiny:false,metAt:'',befriendedAt:'',togetherSeconds:0,inRoom:false,heldEverstone:true}];
    expect(portableBackupData(data)).toMatchObject({items:{everstone:2},autoPetMachine:{ticketsPaid:17,unlocked:false,enabled:false,lastRunAt:9000},friends:[{heldEverstone:true,personality:'호기심쟁이'}]});
  });
});
