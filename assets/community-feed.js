(function(){
  'use strict';
  var districts=window.TOUBU_DATA.districts;
  function node(tag,text,cls){var el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;}
  function getProfile(){try{return JSON.parse(localStorage.getItem('toubu.user-preferences.v1')||'{}')||{};}catch(e){return {};}}
  function isRegistered(){var p=getProfile();return p.saved===true&&typeof p.name==='string'&&!!p.name.trim();}
  function syncRegistration(){var p=getProfile(),registered=isRegistered();document.getElementById('timeline-registration').hidden=registered;document.getElementById('timeline-member-content').hidden=!registered;document.getElementById('timeline-name').value=registered?p.name:'';document.getElementById('timeline-area').value=districts.includes(p.area)?p.area:'';document.getElementById('places-area').value=districts.includes(p.area)?p.area:'';places();if(!registered){document.getElementById('timeline-list').replaceChildren();}else render();}
  document.getElementById('timeline-register').addEventListener('click',function(){document.getElementById('open-user').click();});
  window.addEventListener('toubu-profile-change',function(){document.getElementById('timeline-filter').value='';syncRegistration();});window.addEventListener('storage',function(e){if(e.key==='toubu.user-preferences.v1'||e.key===null)syncRegistration();});
  function scheduleLabel(schedule){var label='';if(schedule.freq==='daily')label='毎日';else if(schedule.freq==='weekly'){var days=Array.isArray(schedule.weekday)?schedule.weekday:[schedule.weekday];label='毎週 '+days.filter(function(day){return Number.isInteger(day)&&day>=0&&day<=6;}).map(function(day){return ['日','月','火','水','木','金','土'][day]+'曜日';}).join('・');}return [label,schedule.note].filter(Boolean).join(' ／ ')||'開催日は窓口へご確認ください。';}
  ['places-area','timeline-area','timeline-filter'].forEach(function(id){districts.forEach(function(area){var option=node('option',area);option.value=area;document.getElementById(id).appendChild(option);});});
  function places(){
    var keyword=document.getElementById('places-keyword').value.trim().normalize('NFKC').toLocaleLowerCase('ja'),area=document.getElementById('places-area').value;
    var items=window.TOUBU_DATA.resources.filter(function(r){return r.category==='tsudoi'&&(!area||(r.areas||[]).includes(area))&&(!keyword||[r.name,r.address,(r.areas||[]).join(' '),r.schedule&&r.schedule.note].join(' ').normalize('NFKC').toLocaleLowerCase('ja').includes(keyword));});
    items.sort(window.ToubuPreferences.resources);
    document.getElementById('places-count').textContent=items.length+'件の通いの場';var list=document.getElementById('places-list');list.replaceChildren();
    if(!items.length)list.appendChild(node('p','該当する場所はありません。地区やキーワードを変えてお試しください。','empty-feed'));
    items.forEach(function(r){var card=node('article','','place-card');card.appendChild(node('p',(r.areas||[]).join('・'),'photo-area'));card.appendChild(node('h2',r.name));if(r.schedule){var schedule=r.schedule;card.appendChild(node('p',scheduleLabel(schedule)));if(schedule.start)card.appendChild(node('p',schedule.start+(schedule.end?'〜'+schedule.end:'')));}card.appendChild(node('p',r.address||'場所は窓口へご確認ください。'));var link=node('a','詳しい内容・連絡先を見る →','text-link');link.href='search.html?v=fb4dc180f806#?cat=tsudoi&id='+encodeURIComponent(r.id);card.appendChild(link);list.appendChild(card);});
  }
  document.getElementById('places-search').addEventListener('submit',function(e){e.preventDefault();places();});
  document.getElementById('places-area').addEventListener('change',places);
  document.getElementById('places-clear').addEventListener('click',function(){document.getElementById('places-keyword').value='';document.getElementById('places-area').value='';places();});places();
  function validate(value){
    if(!value||value.version!==1||!Array.isArray(value.posts)||value.posts.length>40)throw new Error('投稿データの形式が違います。');
    var ids=new Set();return {version:1,posts:value.posts.map(function(p){
      if(!p||typeof p.id!=='string'||!/^[-\w]{1,80}$/.test(p.id)||ids.has(p.id)||!districts.includes(p.area)||!Number.isFinite(Date.parse(p.created)))throw new Error('投稿データを確認してください。');ids.add(p.id);
      var photo='';if(p.photo){if(typeof p.photo!=='string'||p.photo.length>1000000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo))throw new Error('対応していない写真データです。');photo=p.photo;}
      var name=String(p.name||'').trim().slice(0,30),text=String(p.text||'').trim().slice(0,500);if(!name||!text)throw new Error('名前と本文が必要です。');return {id:p.id,name:name,area:p.area,text:text,created:new Date(p.created).toISOString(),photo:photo,selected:p.selected===true};
    })};
  }
  var posts=[],selectedPhoto='',busy=false,exportURL='';
  function downloadPosts(result,output){
    if(exportURL)URL.revokeObjectURL(exportURL);
    exportURL=URL.createObjectURL(new Blob(['window.TOUBU_TIMELINE = '+JSON.stringify(result).replace(/</g,'\\u003c')+';\n'],{type:'text/javascript'}));
    var link=document.getElementById('timeline-download');if(!link){link=node('a','公開用ファイルをダウンロード','text-link');link.id='timeline-download';output.after(link);}
    link.href=exportURL;link.download='timeline.js';link.click();
  }
  function storage(mode,value){return new Promise(function(resolve,reject){var request=indexedDB.open('toubu.timeline.v1',1);request.onupgradeneeded=function(){request.result.createObjectStore('feed');};request.onerror=request.onblocked=function(){reject(new Error('投稿の保存領域を開けません。'));};request.onsuccess=function(){var db=request.result,tx=db.transaction('feed',mode==='get'?'readonly':'readwrite'),store=tx.objectStore('feed'),req=mode==='get'?store.get('posts'):store.put(validate(value),'posts');tx.oncomplete=function(){db.close();resolve(mode==='get'?req.result:undefined);};tx.onerror=tx.onabort=function(){db.close();reject(new Error('保存できませんでした。端末の空き容量をご確認ください。'));};};});}
  window.ToubuFeedStore={validate:validate};
  function tell(message){document.getElementById('timeline-status').textContent=message;}
  function render(){
    if(!isRegistered()){document.getElementById('timeline-list').replaceChildren();return;}
    var published=[];try{published=validate(window.TOUBU_TIMELINE).posts;}catch(e){document.getElementById('timeline-export-status').textContent='公開データを読み込めませんでした。';}
    var ids=new Set(posts.map(function(p){return p.id;})),all=posts.map(function(p){return {post:p,local:true};}).concat(published.filter(function(p){return !ids.has(p.id);}).map(function(p){return {post:p,local:false};}));
    var area=document.getElementById('timeline-filter').value;all=all.filter(function(item){return !area||item.post.area===area;}).sort(function(a,b){return window.ToubuPreferences.posts(a.post,b.post);});
    var list=document.getElementById('timeline-list');list.replaceChildren();document.getElementById('timeline-count').textContent=all.length+'件の投稿'+(!area&&window.ToubuPreferences.area()?' ／ '+window.ToubuPreferences.area()+'の投稿を先に表示':'');
    if(!all.length){var empty=node('div','','empty-feed');empty.appendChild(node('h2','地域の写真や活動を、ここに。'));empty.appendChild(node('p','まだ投稿はありません。「写真・ひとことを追加する」から、活動の様子を残せます。'));list.appendChild(empty);}
    all.forEach(function(item){var p=item.post,card=node('article','','timeline-post'),head=node('div','','post-author');head.appendChild(node('span',p.name.slice(0,1),'post-avatar'));var author=node('div');author.appendChild(node('h2',p.name));author.appendChild(node('p',p.area+' ／ '+(item.local?'この端末の投稿':'公開された投稿'),'post-meta'));var time=node('time',new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'medium',timeStyle:'short'}).format(new Date(p.created)));time.dateTime=p.created;time.className='post-meta';author.appendChild(time);head.appendChild(author);card.appendChild(head);card.appendChild(node('p',p.text,'post-text'));if(p.photo){var image=node('img');image.src=p.photo;image.alt=p.name+'さんの活動写真';image.loading='lazy';image.decoding='async';card.appendChild(image);}
      if(item.local){var actions=node('div','','post-actions'),label=node('label'),check=node('input');check.type='checkbox';check.checked=p.selected;label.appendChild(check);label.appendChild(node('span','運営へ渡す投稿に選ぶ'));check.addEventListener('change',async function(){var previous=p.selected;p.selected=check.checked;try{await storage('put',{version:1,posts:posts});}catch(e){p.selected=previous;check.checked=previous;tell(e.message);}});actions.appendChild(label);var remove=node('button','この投稿を削除','outline-link');remove.type='button';remove.addEventListener('click',async function(){remove.disabled=true;var next=posts.filter(function(other){return other.id!==p.id;});try{await storage('put',{version:1,posts:next});posts=next;render();tell('この端末の投稿を削除しました。');}catch(e){remove.disabled=false;tell(e.message);}});actions.appendChild(remove);card.appendChild(actions);}list.appendChild(card);
    });
  }
  async function photo(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('JPEG・PNG・WebPの写真を20MB以内で選んでください。');
    var bitmap=await createImageBitmap(file);try{var ratio=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));var ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);var result=canvas.toDataURL('image/jpeg',.8);if(result.length>1000000)result=canvas.toDataURL('image/jpeg',.6);if(result.length>1000000)throw new Error('写真が大きすぎます。小さい写真を選んでください。');return result;}finally{bitmap.close();}
  }
  function clearPhoto(){selectedPhoto='';document.getElementById('timeline-photo').value='';document.getElementById('timeline-photo-preview').hidden=true;document.getElementById('timeline-photo-remove').hidden=true;}
  var form=document.getElementById('timeline-form'),upload=document.getElementById('timeline-photo'),submit=form.querySelector('[type=submit]');
  upload.addEventListener('change',async function(){var file=this.files[0];if(!file){clearPhoto();return;}busy=true;submit.disabled=true;upload.disabled=true;try{selectedPhoto=await photo(file);var preview=document.getElementById('timeline-photo-preview');preview.querySelector('img').src=selectedPhoto;preview.hidden=false;document.getElementById('timeline-photo-remove').hidden=false;tell('写真を軽くして読み込みました。内容を確認して保存してください。');}catch(e){clearPhoto();tell(e.message);}finally{busy=false;submit.disabled=false;upload.disabled=false;}});
  document.getElementById('timeline-photo-remove').addEventListener('click',clearPhoto);
  form.addEventListener('submit',async function(e){e.preventDefault();if(!isRegistered()){tell('ユーザー登録をしてください。');return;}if(busy)return;if(posts.length>=40){tell('この端末には40件まで保存できます。不要な投稿を削除してください。');return;}busy=true;submit.disabled=true;try{var next={id:crypto.randomUUID(),name:getProfile().name,area:document.getElementById('timeline-area').value,text:document.getElementById('timeline-text').value,created:new Date().toISOString(),photo:selectedPhoto,selected:false};var valid=validate({version:1,posts:[next].concat(posts)});await storage('put',valid);posts=valid.posts;document.getElementById('timeline-text').value='';document.getElementById('timeline-consent').checked=false;clearPhoto();document.getElementById('timeline-filter').value='';render();tell('この端末に保存しました。ほかの方にはまだ公開されていません。');}catch(error){tell(error.message);}finally{busy=false;submit.disabled=false;}});
  document.getElementById('timeline-filter').addEventListener('change',render);
  document.getElementById('timeline-export').addEventListener('click',function(){try{var output=document.getElementById('timeline-export-status'),chosen=posts.filter(function(p){return p.selected;});if(!chosen.length){output.textContent='投稿の「運営へ渡す投稿に選ぶ」にチェックを入れてください。';return;}var published=validate(window.TOUBU_TIMELINE).posts,merged=new Map(published.map(function(p){return [p.id,p];}));chosen.forEach(function(p){merged.set(p.id,p);});var result=validate({version:1,posts:Array.from(merged.values())});downloadPosts(result,output);output.textContent=chosen.length+'件を書き出しました。運営が確認し、data/timeline.jsを更新して公開します。';}catch(e){document.getElementById('timeline-export-status').textContent='書き出せませんでした：'+e.message;}});
  (async function(){try{var saved=await storage('get');if(saved)posts=validate(saved).posts;try{var profile=JSON.parse(localStorage.getItem('toubu.user-preferences.v1')||'{}');document.getElementById('timeline-name').value=profile.name||'';document.getElementById('timeline-area').value=districts.includes(profile.area)?profile.area:'';}catch(ignore){}}catch(e){tell(e.message);}syncRegistration();})();
})();
