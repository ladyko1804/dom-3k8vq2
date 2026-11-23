/* Дом — кэш приложения. Меняем имя при каждой правке. */
var CACHE='dom-v1';
var ASSETS=['./','./index.html','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png'];

self.addEventListener('install',function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS);}).catch(function(){}));
});

self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});

function timeoutFetch(req,ms){
  return new Promise(function(resolve,reject){
    var t=setTimeout(function(){reject(new Error('timeout'));},ms);
    fetch(req).then(function(r){clearTimeout(t);resolve(r);},function(e){clearTimeout(t);reject(e);});
  });
}

self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);
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
