/* Дом — кэш приложения и уведомления по таймеру. Имя кэша меняем при каждой правке. */
var CACHE='dom-v3';
var TCACHE='dom-timers-v1';
var ASSETS=['./','./index.html','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png'];

self.addEventListener('install',function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS);}).catch(function(){}));
});

self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){
      return k!==CACHE&&k!==TCACHE;
    }).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}).then(restore));
});

/* ---------- запланированные сигналы ---------- */
var timers={};
var handles={};

function persist(){
  try{
    var plain={};
    Object.keys(timers).forEach(function(k){
      var t=timers[k];
      plain[k]={key:t.key,title:t.title,text:t.text,endAt:t.endAt};
    });
    return caches.open(TCACHE).then(function(c){
      return c.put(new Request('/__timers'),new Response(JSON.stringify(plain),{
        headers:{'Content-Type':'application/json'}
      }));
    }).catch(function(){});
  }catch(e){}
}
function restore(){
  return caches.open(TCACHE).then(function(c){return c.match('/__timers');}).then(function(r){
    if(!r)return null;
    return r.json();
  }).then(function(obj){
    if(!obj)return;
    var now=Date.now();
    Object.keys(obj).forEach(function(k){
      var t=obj[k];
      if(!t||!t.endAt)return;
      if(t.endAt>now){timers[k]=t;schedule(t);}
    });
  }).catch(function(){});
}
function schedule(t){
  if(handles[t.key])clearTimeout(handles[t.key]);
  var delay=t.endAt-Date.now();
  if(delay<0)delay=0;
  handles[t.key]=setTimeout(function(){fire(t.key);},delay+150);
}
function fire(key){
  var t=timers[key];
  if(!t)return;
  delete timers[key];
  if(handles[key]){clearTimeout(handles[key]);delete handles[key];}
  persist();
  show(t);
}
function show(t){
  return self.registration.showNotification(t.title||'Таймер',{
    body:t.text||'',
    tag:'dom-'+t.key,
    renotify:true,
    requireInteraction:true,
    vibrate:[400,200,400,200,400],
    icon:'icon-192.png',
    badge:'icon-192.png',
    lang:'ru',
    data:{key:t.key}
  }).catch(function(){});
}

self.addEventListener('message',function(e){
  var d=e.data||{};
  if(d.type==='arm'&&d.key&&d.endAt){
    var t={key:d.key,title:d.title||'Таймер',text:d.text||'',endAt:d.endAt};
    timers[t.key]=t;schedule(t);persist();
    e.waitUntil(persist());
  }else if(d.type==='disarm'&&d.key){
    delete timers[d.key];
    if(handles[d.key]){clearTimeout(handles[d.key]);delete handles[d.key];}
    persist();
    e.waitUntil(persist());
  }else if(d.type==='ping'){
    e.waitUntil(self.registration.showNotification(d.title||'Проверка сигнала',{
      body:d.text||'Уведомления работают. Так придёт сигнал таймера.',
      tag:'dom-ping',vibrate:[200,100,200],icon:'icon-192.png',lang:'ru'
    }).catch(function(){}));
  }
});

/* ---------- сеть и кэш ---------- */
function timeoutFetch(req,ms){
  return new Promise(function(resolve,reject){
    var t=setTimeout(function(){reject(new Error('timeout'));},ms);
    fetch(req).then(function(r){clearTimeout(t);resolve(r);},function(e){clearTimeout(t);reject(e);});
  });
}

self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url;
  try{url=new URL(req.url);}catch(err){return;}
  if(url.origin!==location.origin)return;
  if(req.mode==='navigate'){
    e.respondWith(
      timeoutFetch(req,3000).then(function(r){
        var copy=r.clone();
        caches.open(CACHE).then(function(c){c.put('./index.html',copy);}).catch(function(){});
        return r;
      }).catch(function(){
        return caches.match('./index.html').then(function(r){return r||caches.match('./');});
      })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function(hit){
      return hit||fetch(req).then(function(r){
        var copy=r.clone();
        caches.open(CACHE).then(function(c){c.put(req,copy);}).catch(function(){});
        return r;
      }).catch(function(){return hit;});
    })
  );
});

self.addEventListener('notificationclick',function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){
    for(var i=0;i<list.length;i++){
      if('focus' in list[i])return list[i].focus();
    }
    if(self.clients.openWindow)return self.clients.openWindow('./');
  }));
});
