const CACHE='pokedoro-web-v13';
const CORE=['./manifest.webmanifest','./assets/meadow.jpg','./assets/exploration-background.jpg','./assets/timer-finished.mp3','./assets/national-pokedex.json','./assets/pokemon-species-names.csv'];

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));

self.addEventListener('push',event=>{
  if(!event.data)return;
  event.waitUntil((async()=>{
    let payload;
    try{payload=event.data.json()}catch{payload={title:'POKEDORO',body:event.data.text()}}
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(windows.some(client=>client.visibilityState==='visible')){
      windows.forEach(client=>client.postMessage({type:'timer-push',data:payload.data||{}}));
      return;
    }
    const options={
      body:payload.body||'',
      icon:payload.icon||'./assets/app-icon.png',
      badge:payload.badge||'./assets/app-icon.png',
      data:payload.data||{url:'./'},
      tag:payload.tag||'pokedoro-timer',
      renotify:true,
      requireInteraction:true,
      silent:Boolean(payload.silent)
    };
    if(!payload.silent)options.vibrate=[300,120,300,120,600];
    await self.registration.showNotification(payload.title||'POKEDORO',options);
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=new URL(event.notification.data?.url||'./',self.registration.scope).href;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(client=>client.url.startsWith(self.registration.scope));
    if(existing){await existing.focus();if('navigate' in existing&&existing.url!==target)await existing.navigate(target);return}
    await self.clients.openWindow(target);
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response})));
});
