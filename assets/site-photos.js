(function () {
  'use strict';
  var dbName = 'toubu.site-photos.v1';
  function validate(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.photos) || value.photos.length > 6) throw new Error('写真データの形式が違います。');
    return {version:1, photos:value.photos.map(function(p,i) {
      if (!p || typeof p.src !== 'string' || p.src.length > 1500000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.src)) throw new Error('対応していない写真データです。');
      return {src:p.src, alt:String(p.alt || '').slice(0,180), caption:String(p.caption || '').slice(0,300),title:String(p.title || '').slice(0,80),area:['月ヶ瀬','狭川','都祁','東里','柳生','大柳生','田原'].includes(p.area)?p.area:'',featured:typeof p.featured==='boolean'?p.featured:i===0,fit:p.fit==='contain'?'contain':'cover',position:['25','50','75'].includes(p.position)?p.position:'50'};
    })};
  }
  function openDB() {
    return new Promise(function(resolve,reject) {
      var request = indexedDB.open(dbName,1);
      request.onupgradeneeded = function() {request.result.createObjectStore('photos');};
      request.onsuccess = function() {resolve(request.result);};
      request.onerror = function() {reject(new Error('写真の保存領域を開けません。ブラウザの保存設定をご確認ください。'));};
      request.onblocked = function() {reject(new Error('ほかの写真編集画面を閉じて、もう一度お試しください。'));};
    });
  }
  async function storage(mode,value) {
    var db = await openDB();
    try {return await new Promise(function(resolve,reject) {
      var tx = db.transaction('photos',mode === 'get' ? 'readonly' : 'readwrite');
      var store=tx.objectStore('photos');
      var req = mode === 'get' ? store.get('current') : mode === 'delete' ? store.delete('current') : store.put(validate(value),'current');
      tx.oncomplete=function() {resolve(mode==='get' ? req.result : undefined);};
      tx.onerror=tx.onabort=function() {reject(new Error('保存できませんでした。容量やブラウザの保存設定をご確認ください。'));};
    });} finally {db.close();}
  }
  window.ToubuPhotoStore = {validate:validate,load:function(){return storage('get');},save:function(v){return storage('put',v);},reset:function(){return storage('delete');}};
  function figure(p,i) {
    var fig=document.createElement('figure'),img=document.createElement('img');
    img.src=p.src;img.alt=p.alt || p.caption || p.title || '東部地域の風景・活動写真 '+(i+1);img.decoding='async';img.loading=p.featured?'eager':'lazy';
    img.style.objectFit=p.fit || 'cover';img.style.objectPosition='50% '+(p.position || '50')+'%';fig.appendChild(img);
    if(p.area || p.title || p.caption){var cap=document.createElement('figcaption');if(p.area){var area=document.createElement('span');area.className='photo-area';area.textContent=p.area;cap.appendChild(area);}if(p.title){var title=document.createElement('strong');title.textContent=p.title;cap.appendChild(title);}if(p.caption){var description=document.createElement('p');description.textContent=p.caption;cap.appendChild(description);}fig.appendChild(cap);}
    return fig;
  }
  window.ToubuPhotoFigure=figure;
  if (!document.getElementById('photo-grid')) return;
  (async function() {
    var source=window.TOUBU_SITE_PHOTOS,local=false;
    try {var saved=await storage('get'); if(saved){source=saved;local=true;}}catch(e) {/* 公開データを表示 */}
    var data;
    try {data=validate(source);}catch(e){return;}
    if (!data.photos.length) {document.querySelector('.photo-post-link').hidden=true;return;}
    const preferred=window.ToubuPreferences?.area();
    if(preferred)data.photos.sort((a,b)=>Number(b.area===preferred)-Number(a.area===preferred));
    var hero=document.getElementById('hero-photo');
    var featured=data.photos.find(function(p){return p.featured;}) || data.photos[0];
    var first=figure(featured,0);
    hero.replaceChildren.apply(hero,Array.from(first.childNodes));hero.hidden=false;
    document.getElementById('hero-region').hidden=true;
    document.getElementById('photo-gallery').hidden=false;
    document.getElementById('photo-preview-note').hidden=!local;
    const grid=document.getElementById('photo-grid');
    data.photos.forEach(function(p,i){grid.appendChild(figure(p,i));});
    document.getElementById('photo-empty').hidden=true;
    const controls=document.getElementById('photo-controls'),previous=document.getElementById('photo-prev'),next=document.getElementById('photo-next'),position=document.getElementById('photo-position');
    controls.hidden=data.photos.length<2;
    document.getElementById('photo-swipe-hint').hidden=data.photos.length<2;
    function current(){return Array.from(grid.children).reduce((best,card,i,cards)=>Math.abs(card.offsetLeft-cards[0].offsetLeft-grid.scrollLeft)<Math.abs(cards[best].offsetLeft-cards[0].offsetLeft-grid.scrollLeft)?i:best,0);}
    function sync(){const i=current();previous.disabled=i===0;next.disabled=i===data.photos.length-1;position.textContent=(i+1)+' / '+data.photos.length;}
    function move(step){const i=Math.max(0,Math.min(data.photos.length-1,current()+step));grid.scrollTo({left:grid.children[i].offsetLeft-grid.children[0].offsetLeft,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
    grid.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}});
    let scrollTimer;grid.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(sync,150);},{passive:true});
    new ResizeObserver(sync).observe(grid);sync();
    document.getElementById('hero-photo-link').hidden=false;
  })();
})();
