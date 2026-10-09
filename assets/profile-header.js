(() => {
  const validPhoto=value=>typeof value==='string' && value.length<=150000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);
  const render=()=>{
    const p=window.ToubuPreferences.profile(),registered=window.ToubuPreferences.registered();
    const img=document.getElementById('header-user-photo'),avatar=document.querySelector('.user-entry .user-avatar');
    if(img){const visible=registered&&validPhoto(p.photo);img.hidden=!visible;if(visible){img.src=p.photo;img.alt=window.ToubuPreferences.displayName(p.name)+'の写真';}else{img.removeAttribute('src');img.alt='';}if(avatar)avatar.toggleAttribute('hidden',visible);}
  };
  window.addEventListener('toubu-profile-change',render);window.addEventListener('storage',render);window.addEventListener('pageshow',render);render();
  const input=document.getElementById('user-photo');if(!input)return;
  const preview=document.getElementById('user-photo-preview'),remove=document.getElementById('user-photo-remove'),status=document.getElementById('user-status');
  let selected='',busy=false;
  function set(value){selected=validPhoto(value)?value:'';preview.hidden=!selected;remove.hidden=!selected;if(selected)preview.src=selected;else preview.removeAttribute('src');input.value='';}
  window.ToubuProfilePhoto={set,get:()=>selected,busy:()=>busy};
  set(window.ToubuPreferences.profile().photo);
  input.addEventListener('change',async()=>{
    const file=input.files[0];if(!file)return;busy=true;input.disabled=true;
    try{
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('JPEG・PNG・WebPの写真を20MB以内で選んでください。');
      const bitmap=await createImageBitmap(file);
      try{const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);const result=canvas.toDataURL('image/jpeg',.8);if(!validPhoto(result))throw Error('写真を小さくできませんでした。別の写真をお試しください。');set(result);status.textContent='写真を選びました。「登録して使う」で保存します。';}finally{bitmap.close();}
    }catch(error){input.value='';status.textContent=error.message;}finally{busy=false;input.disabled=false;}
  });
  remove.addEventListener('click',()=>{set('');status.textContent='写真を外しました。「登録して使う」で保存します。';});
  document.getElementById('open-user')?.addEventListener('click',()=>set(window.ToubuPreferences.profile().photo));
})();
