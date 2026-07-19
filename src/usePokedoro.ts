import { useEffect, useRef, useState } from 'react';
import type { AppData } from './types';
import { advanceData } from './game';
import { createDailyBackup, loadData, saveData } from './store';

export function usePokedoro() {
  const [data,setData]=useState<AppData|null>(null);
  const [toast,setToast]=useState('');
  const alarmRef=useRef<HTMLAudioElement|null>(null);
  useEffect(()=>{ loadData().then(setData); alarmRef.current=new Audio('./assets/timer-finished.mp3'); },[]);
  useEffect(()=>{ if(!data)return; const id=setTimeout(()=>{saveData(data);createDailyBackup(data);},250); return()=>clearTimeout(id); },[data]);
  useEffect(()=>{
    const id=window.setInterval(()=>setData(previous=>{
      if(!previous?.timer.running)return previous;
      const result=advanceData(previous,Date.now());
      if(result.earned){setToast('ticket');setTimeout(()=>setToast(''),2600);}
      if(result.completed){
        const audio=alarmRef.current; if(audio){audio.volume=previous.settings.muted?0:previous.settings.cryVolume/100;audio.play().catch(()=>{});}
        if(Notification.permission==='granted')new Notification('POKEDORO',{body:previous.settings.language==='en'?'The timer is complete.':previous.settings.language==='ja'?'タイマーが完了しました。':'타이머가 완료되었습니다.',icon:'./assets/app-icon.png'});
      }
      return result.data;
    }),500);
    return()=>clearInterval(id);
  },[]);
  return {data,setData,toast,setToast};
}
