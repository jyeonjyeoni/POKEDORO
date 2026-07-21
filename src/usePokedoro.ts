import { useEffect, useRef, useState } from 'react';
import type { AppData } from './types';
import { advanceData } from './game';
import { syncTimerNotification } from './pushNotifications';
import { createDailyBackup, loadData, runStoredAutoPetIfDue, saveData } from './store';

export function usePokedoro() {
  const [data,setData]=useState<AppData|null>(null);
  const [toast,setToast]=useState('');
  const alarmRef=useRef<HTMLAudioElement|null>(null);
  const syncChannelRef=useRef<BroadcastChannel|null>(null);
  const visibleSinceRef=useRef<number|null>(document.visibilityState==='visible'?Date.now():null);
  useEffect(()=>{
    loadData().then(setData);
    if(typeof BroadcastChannel!=='undefined'){
      const channel=new BroadcastChannel('pokedoro-state-sync');
      channel.onmessage=event=>{if(event.data?.type==='auto-pet'&&event.data.data)setData(event.data.data as AppData)};
      syncChannelRef.current=channel;
    }
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
      syncChannelRef.current?.close();
      syncChannelRef.current=null;
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
        const playLocally=document.visibilityState!=='visible'||!previous.settings.backgroundNotifications||(completedOnTime&&stayedVisibleUntilCompletion);
        if(playLocally){const audio=alarmRef.current;if(audio){audio.pause();audio.currentTime=0;audio.volume=previous.settings.muted?0:previous.settings.cryVolume/100;audio.play().catch(()=>{});}}
        if(!previous.settings.backgroundNotifications&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
          try{new Notification('POKEDORO',{body:previous.settings.language==='en'?'The timer is complete.':previous.settings.language==='ja'?'タイマーが終了しました。':'타이머가 완료되었습니다.',icon:'./assets/app-icon.png'})}catch{/* iOS browsers may expose Notification but reject direct construction. */}
        }
      }
      return result.data;
    }),500);
    return()=>clearInterval(id);
  },[]);
  useEffect(()=>{
    if(!data)return;
    let cancelled=false;
    const run=async()=>{
      const result=await runStoredAutoPetIfDue(Date.now());
      if(cancelled)return;
      setData(result.data);
      if(result.ran){
        const language=result.data.settings.language;
        setToast(language==='en'?'The Auto-Petting Machine cared for every friend.':language==='ja'?'自動なでなでマシンが全員をお世話しました。':'자동 쓰다듬기 기계가 모든 친구를 돌봤어요.');
        setTimeout(()=>setToast(''),2600);
        syncChannelRef.current?.postMessage({type:'auto-pet',data:result.data});
      }
    };
    void run();
    const id=window.setInterval(()=>void run(),60*1000);
    return()=>{cancelled=true;clearInterval(id)};
  },[data!==null]);
  return {data,setData,toast,setToast};
}
