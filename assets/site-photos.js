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
    if (!data.photos.length) return;
    var hero=document.getElementById('hero-photo');
    var featured=data.photos.find(function(p){return p.featured;}) || data.photos[0];
    var first=figure(featured,0);
    hero.replaceChildren.apply(hero,Array.from(first.childNodes));hero.hidden=false;
    document.getElementById('hero-region').hidden=true;
    document.getElementById('photo-gallery').hidden=false;
    document.getElementById('photo-preview-note').hidden=!local;
    data.photos.forEach(function(p,i){document.getElementById('photo-grid').appendChild(figure(p,i));});
    document.getElementById('hero-photo-link').hidden=false;
  })();
})();
