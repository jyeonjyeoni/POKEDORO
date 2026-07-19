import { useEffect, useRef, useState } from 'react';
import type { AppData } from './types';
import { advanceData } from './game';
import { syncTimerNotification } from './pushNotifications';
import { createDailyBackup, loadData, saveData } from './store';

export function usePokedoro() {
  const [data,setData]=useState<AppData|null>(null);
  const [toast,setToast]=useState('');
  const alarmRef=useRef<HTMLAudioElement|null>(null);
  const visibleSinceRef=useRef<number|null>(document.visibilityState==='visible'?Date.now():null);
  useEffect(()=>{
    loadData().then(setData);
    const alarm=new Audio('./assets/timer-finished.mp3');
    alarm.preload='auto';
    alarmRef.current=alarm;
    const unlockAudio=()=>{
      alarm.volume=0;
      alarm.play().then(()=>{
        alarm.pause();
        alarm.currentTime=0;
        alarm.volume=1;
        document.removeEventListener('pointerdown',unlockAudio);
      }).catch(()=>undefined);
    };
    const handleVisibilityChange=()=>{
      if(document.visibilityState==='visible')visibleSinceRef.current=Date.now();
      else{
        visibleSinceRef.current=null;
        alarm.pause();
        alarm.currentTime=0;
      }
    };
    document.addEventListener('pointerdown',unlockAudio);
    document.addEventListener('visibilitychange',handleVisibilityChange);
    return()=>{
      document.removeEventListener('pointerdown',unlockAudio);
      document.removeEventListener('visibilitychange',handleVisibilityChange);
    };
  },[]);
  useEffect(()=>{ if(!data)return; const id=setTimeout(()=>{saveData(data);createDailyBackup(data);},250); return()=>clearTimeout(id); },[data]);
  useEffect(()=>{
    if(!data?.settings.backgroundNotifications)return;
    const id=window.setTimeout(()=>void syncTimerNotification(data).catch(()=>undefined),100);
    return()=>clearTimeout(id);
  },[
    data?.settings.backgroundNotifications,
    data?.settings.breakMinutes,
    data?.settings.focusMinutes,
    data?.settings.language,
    data?.settings.muted,
    data?.timer.autoStart,
    data?.timer.durationSeconds,
    data?.timer.mode,
    data?.timer.running,
    data?.timer.type
  ]);
  useEffect(()=>{
    const id=window.setInterval(()=>setData(previous=>{
      if(!previous?.timer.running)return previous;
      const now=Date.now();
      const remaining=previous.timer.type==='pomodoro'?Math.max(0,previous.timer.durationSeconds-previous.timer.elapsedSeconds):Number.POSITIVE_INFINITY;
      const expectedAt=(previous.timer.lastTickAt??now)+remaining*1000;
      const completedOnTime=now-expectedAt<4000;
      const result=advanceData(previous,now);
      if(result.earned){setToast('ticket');setTimeout(()=>setToast(''),2600);}
      if(result.completed){
        const visibleSince=visibleSinceRef.current;
        const stayedVisibleUntilCompletion=visibleSince!==null&&visibleSince<=expectedAt;
        const playLocally=!previous.settings.backgroundNotifications||(document.visibilityState==='visible'&&completedOnTime&&stayedVisibleUntilCompletion);
        if(playLocally){const audio=alarmRef.current;if(audio){audio.pause();audio.currentTime=0;audio.volume=previous.settings.muted?0:previous.settings.cryVolume/100;audio.play().catch(()=>{});}}
        if(!previous.settings.backgroundNotifications&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
          try{new Notification('POKEDORO',{body:previous.settings.language==='en'?'The timer is complete.':previous.settings.language==='ja'?'タイマーが終了しました。':'타이머가 완료되었습니다.',icon:'./assets/app-icon.png'})}catch{/* iOS browsers may expose Notification but reject direct construction. */}
        }
      }
      return result.data;
    }),500);
    return()=>clearInterval(id);
  },[]);
  return {data,setData,toast,setToast};
}
