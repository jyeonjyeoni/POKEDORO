import { describe, expect, it } from 'vitest';
import { defaultData, normalizePersonality, portableBackupData } from './store';

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
