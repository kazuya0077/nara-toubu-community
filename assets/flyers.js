(function(){
  'use strict';
  var track=document.getElementById('timeline-notice-track'),form=document.getElementById('flyer-form');
  if(!track||!form)return;
  var flyers=[],urls=[],busy=false,dirty=false,local=false;
  var kinds={shakyo:'市社会福祉協議会',houkatsu:'地域包括支援センター',hospital:'病院・診療所',other:'地域の団体'};
  function make(tag,text,cls){var el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;}
  function tell(text){document.getElementById('flyer-status').textContent=text;}
  function validate(data){
    if(!data||data.version!==1||!Array.isArray(data.flyers)||data.flyers.length>12)throw new Error('チラシは12件までです。');
    var ids=new Set(),total=0;
    return {version:1,flyers:data.flyers.map(function(p){
      if(!p||typeof p.id!=='string'||!/^[-\w]{1,80}$/.test(p.id)||ids.has(p.id)||!Object.hasOwn(kinds,p.kind))throw new Error('チラシの形式を確認してください。');
      ids.add(p.id);
      if(typeof p.file!=='string'||(!/^data:(application\/pdf|image\/(jpeg|png|webp));base64,[A-Za-z0-9+/]+={0,2}$/.test(p.file)&&!/^assets\/flyer-samples\/[a-z0-9-]+\.png$/.test(p.file))||p.file.length>14000000)throw new Error('JPEG・PNG・WebP・PDFの10MB以内のファイルを選んでください。');
      total+=p.file.length;if(total>28000000)throw new Error('チラシ全体で20MB以内になるよう、枚数やファイルサイズを減らしてください。');
      var title=String(p.title||'').trim().slice(0,80),publisher=String(p.publisher||'').trim().slice(0,80);
      if(!title||!publisher)throw new Error('チラシの名前と発行元を入力してください。');
      return {id:p.id,kind:p.kind,title:title,publisher:publisher,text:String(p.text||'').trim().slice(0,300),file:p.file,sample:p.sample===true};
    })};
  }
  function storage(mode,value){return new Promise(function(resolve,reject){
    var request=indexedDB.open('toubu.flyers.v1',1);
    request.onupgradeneeded=function(){request.result.createObjectStore('flyers');};
    request.onerror=request.onblocked=function(){reject(new Error('端末の保存領域を開けません。公開用ファイルの書き出しをご利用ください。'));};
    request.onsuccess=function(){var db=request.result,tx=db.transaction('flyers',mode==='get'?'readonly':'readwrite'),store=tx.objectStore('flyers'),op=mode==='get'?store.get('data'):mode==='reset'?store.delete('data'):store.put(validate(value),'data');
      tx.oncomplete=function(){db.close();resolve(mode==='get'?op.result:undefined);};tx.onerror=tx.onabort=function(){db.close();reject(new Error('保存できませんでした。端末の空き容量を確認してください。'));};};
  });}
  function fileURL(data){if(data.startsWith('assets/flyer-samples/'))return data;var parts=data.split(','),bytes=atob(parts[1]),array=new Uint8Array(bytes.length);for(var i=0;i<bytes.length;i++)array[i]=bytes.charCodeAt(i);var url=URL.createObjectURL(new Blob([array],{type:parts[0].slice(5,-7)}));urls.push(url);return url;}
  var viewer=make('dialog','','flyer-viewer'),viewerTitle=make('h2'),viewerHead=make('div','','flyer-viewer-head'),close=make('button','閉じる ×','flyer-close'),tools=make('div','','flyer-viewer-tools'),stage=make('div','','flyer-viewer-stage'),fullImage=make('img'),zoom=100,lastFocus=null,oldOverflow='';
  viewer.id='flyer-viewer';viewerTitle.id='flyer-viewer-title';viewer.setAttribute('aria-labelledby',viewerTitle.id);viewerHead.appendChild(viewerTitle);close.type='button';close.autofocus=true;viewerHead.appendChild(close);viewer.appendChild(viewerHead);
  var zoomOut=make('button','− 縮小'),zoomIn=make('button','＋ 拡大'),zoomFit=make('button','全体を見る'),zoomStatus=make('span','100%'),original=make('a','別のタブで開く ↗');zoomStatus.setAttribute('role','status');zoomStatus.setAttribute('aria-live','polite');original.target='_blank';original.rel='noopener';
  [zoomOut,zoomIn,zoomFit].forEach(function(button){button.type='button';tools.appendChild(button);});tools.appendChild(zoomStatus);tools.appendChild(original);viewer.appendChild(tools);stage.tabIndex=0;stage.setAttribute('role','region');stage.setAttribute('aria-label','チラシの拡大画像。拡大後は上下左右にスクロールできます');stage.appendChild(fullImage);viewer.appendChild(stage);viewer.appendChild(make('p','拡大したら、画像の上を上下・左右に動かして読めます。','flyer-viewer-help'));document.body.appendChild(viewer);
  function setZoom(value){zoom=Math.max(100,Math.min(250,value));if(viewer.open&&fullImage.naturalWidth){var style=getComputedStyle(stage),width=stage.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=parseFloat(style.maxHeight)-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom),base=Math.min(width,height*fullImage.naturalWidth/fullImage.naturalHeight);fullImage.style.width=Math.max(1,Math.round(base*zoom/100))+'px';}zoomStatus.textContent=zoom+'%';zoomOut.disabled=zoom===100;zoomIn.disabled=zoom===250;}
  fullImage.addEventListener('load',function(){setZoom(zoom);});window.addEventListener('resize',function(){if(viewer.open)setZoom(zoom);});
  function closeViewer(){if(viewer.open)viewer.close();}
  close.addEventListener('click',closeViewer);viewer.addEventListener('click',function(event){if(event.target===viewer){var bounds=viewer.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeViewer();}});
  viewer.addEventListener('close',function(){document.documentElement.style.overflow=oldOverflow;fullImage.removeAttribute('src');if(lastFocus&&lastFocus.isConnected)lastFocus.focus({preventScroll:true});});window.addEventListener('hashchange',closeViewer);
  zoomOut.addEventListener('click',function(){setZoom(zoom-50);});zoomIn.addEventListener('click',function(){setZoom(zoom+50);});zoomFit.addEventListener('click',function(){setZoom(100);stage.scrollTo(0,0);});
  function showImage(p,url,trigger){lastFocus=trigger;viewerTitle.textContent=p.title+(p.sample?'（テスト用の見本）':'');fullImage.src=url;fullImage.alt=p.title+'（'+p.publisher+'）';original.href=url;oldOverflow=document.documentElement.style.overflow;viewer.showModal();setZoom(100);document.documentElement.style.overflow='hidden';stage.scrollTo(0,0);}
  function render(){
    closeViewer();
    urls.forEach(function(url){URL.revokeObjectURL(url);});urls=[];
    track.querySelectorAll('[data-flyer]').forEach(function(el){el.remove();});
    var editor=document.getElementById('flyer-editor');editor.replaceChildren();
    var fragment=document.createDocumentFragment();
    flyers.forEach(function(p,index){
      var card=make('article','','notice-card notice-flyer notice-'+p.kind);card.dataset.flyer=p.id;card.style.setProperty('--flyer-order',Math.min(index,3));
      var url=fileURL(p.file),pdf=p.file.startsWith('data:application/pdf;'),open=make(pdf?'a':'button',pdf?'PDFのチラシを開く ↗':null,'flyer-cover');
      if(pdf){open.href=url;open.target='_blank';open.rel='noopener';open.setAttribute('aria-label',p.title+'のPDFを開く（新しいタブ）');}else{open.type='button';open.setAttribute('aria-label',p.title+'のチラシを拡大する');open.setAttribute('aria-haspopup','dialog');open.addEventListener('click',function(){showImage(p,url,open);});}
      if(!pdf){var image=make('img');image.src=url;image.alt=p.title+'（'+p.publisher+'）';image.loading=index<2?'eager':'lazy';image.decoding='async';open.appendChild(image);open.appendChild(make('span','＋ タップして拡大','flyer-image-hint'));}else{open.appendChild(make('span',p.title));}
      if(p.sample)open.appendChild(make('span','テスト用の見本','flyer-sample-badge'));
      card.appendChild(open);var body=make('div','','notice-body');body.appendChild(make('p',kinds[p.kind]+(local?' ／ 端末プレビュー':''),'notice-category'));body.appendChild(make('h3',p.title));body.appendChild(make('p','発行元：'+p.publisher,'flyer-publisher'));if(p.text)body.appendChild(make('p',p.text,'flyer-description'));
      var link=make(pdf?'a':'button',pdf?'PDFを開く・印刷する ↗':'チラシを大きく見る ＋','flyer-read');if(pdf){link.href=url;link.target='_blank';link.rel='noopener';}else{link.type='button';link.setAttribute('aria-haspopup','dialog');link.addEventListener('click',function(){showImage(p,url,link);});}body.appendChild(link);card.appendChild(body);fragment.appendChild(card);
      var row=make('div','','flyer-edit-row');row.appendChild(make('span',p.title+' ／ '+p.publisher));var remove=make('button','このチラシを外す');remove.type='button';remove.disabled=busy;remove.addEventListener('click',function(){flyers=flyers.filter(function(other){return other.id!==p.id;});dirty=true;local=true;render();tell('プレビューから外しました。保存または公開用ファイルの書き出しで反映できます。');});row.appendChild(remove);editor.appendChild(row);
    });
    track.prepend(fragment);
    var sampleNote=document.getElementById('flyer-sample-note');if(sampleNote)sampleNote.hidden=!flyers.some(function(p){return p.sample;});
    document.getElementById('flyer-preview-note').hidden=!local;
    track.scrollLeft=0;track.dispatchEvent(new Event('scroll'));
  }
  function controls(value){busy=value;document.querySelectorAll('#flyer-manager button,#flyer-manager input,#flyer-manager select,#flyer-manager textarea').forEach(function(el){el.disabled=value;});}
  form.addEventListener('submit',async function(event){event.preventDefault();if(busy)return;controls(true);try{
    var file=document.getElementById('flyer-file').files[0];if(!file||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('JPEG・PNG・WebP・PDFの10MB以内のファイルを選んでください。');
    tell('チラシを読み込んでいます。');var data=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=function(){reject(new Error('ファイルを読み込めませんでした。'));};reader.readAsDataURL(file);});
    var next={id:crypto.randomUUID(),kind:document.getElementById('flyer-kind').value,title:document.getElementById('flyer-title').value,publisher:document.getElementById('flyer-publisher').value,text:document.getElementById('flyer-text').value,file:data};
    flyers=validate({version:1,flyers:[next].concat(flyers)}).flyers;dirty=true;local=true;form.reset();tell('チラシを追加しました。上のお知らせ欄で確認し、この端末に保存してください。');
  }catch(error){tell(error.message);}finally{controls(false);render();}});
  document.getElementById('flyer-save').addEventListener('click',async function(){if(busy)return;controls(true);try{await storage('put',{version:1,flyers:flyers});dirty=false;local=true;tell('この端末に保存しました。ほかの方への公開には、公開用ファイルを運営へ渡してください。');}catch(error){tell(error.message);}finally{controls(false);render();}});
  document.getElementById('flyer-reset').addEventListener('click',async function(){if(busy)return;controls(true);try{await storage('reset');flyers=validate(window.TOUBU_FLYERS).flyers;dirty=false;local=false;tell('この端末のプレビューを解除し、公開中のチラシに戻しました。');}catch(error){tell(error.message);}finally{controls(false);render();}});
  document.getElementById('flyer-export').addEventListener('click',function(){try{var data=validate({version:1,flyers:flyers}),url=URL.createObjectURL(new Blob(['window.TOUBU_FLYERS = '+JSON.stringify(data).replace(/</g,'\\u003c')+';\n'],{type:'text/javascript'})),link=make('a');link.href=url;link.download='flyers.js';document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},2000);tell('公開用ファイルを書き出しました。運営が確認して掲載すると、ほかの方にも表示されます。');}catch(error){tell(error.message);}});
  window.addEventListener('beforeunload',function(event){if(dirty){event.preventDefault();event.returnValue='';}});
  window.ToubuFlyers={validate:validate};
  (async function(){controls(true);try{flyers=validate(window.TOUBU_FLYERS).flyers;render();try{var saved=await storage('get');if(saved){flyers=validate(saved).flyers;local=true;}}catch(error){tell(error.message);}}catch(error){tell('公開チラシを読み込めませんでした：'+error.message);}finally{controls(false);render();}})();
})();
