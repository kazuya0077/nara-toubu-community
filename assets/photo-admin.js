(function() {
  'use strict';
  var store=window.ToubuPhotoStore,photos=[],busy=false,dirty=false;
  var editor=document.getElementById('photo-editor'),status=document.getElementById('photo-status');
  function tell(message) {status.textContent=message;}
  function controls(disabled){busy=disabled;document.querySelectorAll('#main button,#main input,#main textarea,#main select').forEach(function(n){n.disabled=disabled;});}
  function make(tag,text){var n=document.createElement(tag);if(text)n.textContent=text;return n;}
  function preview(){
    var holder=document.getElementById('photo-home-preview');holder.replaceChildren();
    if(!photos.length){holder.appendChild(make('p','写真を追加すると、ここでホームの見え方を確認できます。'));return;}
    var normalized=store.validate({version:1,photos:photos}).photos,featured=normalized.find(function(p){return p.featured;}) || normalized[0];
    holder.appendChild(window.ToubuPhotoFigure(featured,0));
    var link=make('p','地域の写真をすべて見る →（'+photos.length+'枚）');link.className='photo-preview-link';holder.appendChild(link);
  }
  function draw() {
    if(photos.length && !photos.some(function(p){return p.featured;}))photos[0].featured=true;
    editor.replaceChildren();
    photos.forEach(function(p,i){
      var article=make('article'),img=make('img');article.className='photo-edit-item';img.src=p.src;img.alt=p.alt||'編集する写真 '+(i+1);article.appendChild(img);
      var info=make('div');info.appendChild(make('h2',(i+1)+'枚目'+(p.featured?'：ホームの紹介写真':'')));
      var featured=make('button',p.featured?'ホームの紹介写真に選択中':'この写真をホームの紹介に使う');featured.type='button';featured.className='outline-link';featured.setAttribute('aria-pressed',String(!!p.featured));featured.addEventListener('click',function(){photos.forEach(function(other){other.featured=other===p;});dirty=true;draw();tell('ホームの紹介写真を変更しました。保存前に下のプレビューで確認できます。');});info.appendChild(featured);
      [['title','写真の見出し（80文字まで）',80],['caption','写真の説明（300文字まで）',300],['alt','写真の内容（読み上げ用・180文字まで）',180]].forEach(function(field){
        var label=make('label',field[1]),input=make('input');input.type='text';input.value=p[field[0]]||'';input.maxLength=field[2];input.addEventListener('input',function(){p[field[0]]=input.value;dirty=true;preview();});label.appendChild(input);info.appendChild(label);
      });
      [['area','写真の地区',[['','地区を選ばない'],['月ヶ瀬','月ヶ瀬'],['狭川','狭川'],['都祁','都祁'],['東里','東里'],['柳生','柳生'],['大柳生','大柳生'],['田原','田原']]],['fit','写真の見せ方',[['cover','枠に合わせる（端が切れることがあります）'],['contain','写真全体を見せる']]],['position','枠に合わせるとき、見せたい位置',[['25','上側を中心に'],['50','中央を中心に'],['75','下側を中心に']]]].forEach(function(field){
        var label=make('label',field[1]),select=make('select');field[2].forEach(function(pair){var option=make('option',pair[1]);option.value=pair[0];select.appendChild(option);});select.value=p[field[0]] || (field[0]==='position'?'50':field[0]==='fit'?'cover':'');select.addEventListener('change',function(){p[field[0]]=select.value;dirty=true;img.style.objectFit=p.fit || 'cover';img.style.objectPosition='50% '+(p.position || '50')+'%';preview();});label.appendChild(select);info.appendChild(label);
      });
      img.style.objectFit=p.fit || 'cover';img.style.objectPosition='50% '+(p.position || '50')+'%';
      var actions=make('div');actions.className='photo-item-actions';
      [['前へ',-1],['後ろへ',1]].forEach(function(a){var b=make('button',a[0]);b.type='button';b.disabled=i+a[1]<0||i+a[1]>=photos.length;b.addEventListener('click',function(){var other=i+a[1];var tmp=photos[i];photos[i]=photos[other];photos[other]=tmp;dirty=true;draw();tell('順番を変更しました。この端末に保存するとHPへ反映されます。');});actions.appendChild(b);});
      var remove=make('button','この写真を外す');remove.type='button';remove.addEventListener('click',function(){photos.splice(i,1);dirty=true;draw();tell('写真を外しました。保存するまでは元の保存内容が残っています。');});actions.appendChild(remove);info.appendChild(actions);article.appendChild(info);editor.appendChild(article);
    });
    if(!photos.length)editor.appendChild(make('p','写真はまだありません。上の「写真を選ぶ」から追加できます。'));
    preview();
  }
  function resize(file) {
    return new Promise(function(resolve,reject){
      if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>20*1024*1024){reject(new Error('JPEG・PNG・WebPの20MB以内の写真を選んでください。'));return;}
      var url=URL.createObjectURL(file),img=new Image();
      img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('写真を読み込めません。別の形式で保存した写真をお試しください。'));};
      img.onload=function(){
        try {
          if(img.naturalWidth*img.naturalHeight>40000000)throw new Error('画像の寸法が大きすぎます。縮小してから追加してください。');
          var scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),cv=document.createElement('canvas');
          cv.width=Math.max(1,Math.round(img.naturalWidth*scale));cv.height=Math.max(1,Math.round(img.naturalHeight*scale));cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
          var src=cv.toDataURL('image/webp',0.82);
          if(src.length>1500000)src=cv.toDataURL('image/webp',0.6);
          if(src.length>1500000)throw new Error('写真を十分に軽くできませんでした。小さくした写真をお試しください。');
          resolve({src:src,alt:'',caption:'',title:'',area:'',featured:false,fit:'cover',position:'50'});
        }catch(e){reject(e);}finally{URL.revokeObjectURL(url);}
      };img.src=url;
    });
  }
  function payload(){return store.validate({version:1,photos:photos});}
  function download(name,content,type){var blob=new Blob([content],{type:type}),url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},2000);}
  document.getElementById('photo-add-form').addEventListener('submit',async function(e){
    e.preventDefault();if(busy)return;
    var input=document.getElementById('photo-files'),files=Array.from(input.files);
    if(!files.length){tell('追加する写真を選んでください。');return;}
    if(photos.length+files.length>6){tell('写真は6枚までです。いまある写真を外すか、選ぶ枚数を減らしてください。');return;}
    controls(true);tell('写真を読み込み、サイズを調整しています。');
    try {var added=[];for(var f of files)added.push(await resize(f));photos=photos.concat(added);dirty=true;input.value='';draw();tell('写真を追加しました。説明文を入力し、「この端末に保存」を選んでください。');}catch(e){tell(e.message);}finally{controls(false);draw();}
  });
  document.getElementById('photo-save').addEventListener('click',async function(){if(busy)return;controls(true);try{await store.save(payload());dirty=false;tell('この端末に保存しました。同じブラウザのHPで写真を確認できます。');}catch(e){tell(e.message);}finally{controls(false);draw();}});
  document.getElementById('photo-save-preview').addEventListener('click',async function(){if(busy)return;controls(true);try{await store.save(payload());dirty=false;location.href='about.html?v=6c0511d69ef7#top';}catch(e){tell(e.message);}finally{controls(false);draw();}});
  document.getElementById('photo-revert').addEventListener('click',async function(){if(busy)return;controls(true);try{var saved=await store.load();photos=store.validate(saved || window.TOUBU_SITE_PHOTOS).photos;dirty=false;tell('編集を取り消し、保存済みの写真に戻しました。');}catch(e){tell(e.message);}finally{controls(false);draw();}});
  document.getElementById('photo-export').addEventListener('click',function(){try{var data=payload();download('site-photos.js','window.TOUBU_SITE_PHOTOS = '+JSON.stringify(data).replace(/</g,'\\u003c')+';\n','text/javascript');tell('公開用データを書き出しました。サイトのdata/site-photos.jsに差し替えて公開すると、ほかの方にも表示されます。');}catch(e){tell(e.message);}});
  document.getElementById('photo-backup').addEventListener('click',function(){try{download('site-photos-backup.json',JSON.stringify(payload()),'application/json');tell('編集内容のバックアップを書き出しました。');}catch(e){tell(e.message);}});
  document.getElementById('photo-import').addEventListener('change',async function(){var file=this.files[0];if(!file)return;if(file.size>10*1024*1024){tell('バックアップは10MB以内のファイルを選んでください。');this.value='';return;}try{photos=store.validate(JSON.parse(await file.text())).photos;dirty=true;draw();tell('バックアップを読み込みました。保存するとこの端末のHPへ反映されます。');}catch(e){tell('読み込めませんでした：'+e.message);}this.value='';});
  document.getElementById('photo-reset').addEventListener('click',async function(){if(busy)return;controls(true);try{await store.reset();photos=store.validate(window.TOUBU_SITE_PHOTOS).photos;dirty=false;draw();tell('この端末のプレビューを解除しました。公開用データの写真に戻ります。');}catch(e){tell(e.message);}finally{controls(false);draw();}});
  window.addEventListener('beforeunload',function(e){if(dirty){e.preventDefault();e.returnValue='';}});
  (async function(){controls(true);try{var saved=await store.load();photos=store.validate(saved||window.TOUBU_SITE_PHOTOS).photos;tell(saved?'この端末に保存した写真を読み込みました。':'公開用データを読み込みました。');}catch(e){tell(e.message);try{photos=store.validate(window.TOUBU_SITE_PHOTOS).photos;}catch(ignore){}}finally{controls(false);draw();}})();
})();
