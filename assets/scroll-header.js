(() => {
  const header=document.querySelector('.app-header'),profile=header?.querySelector('.site-header');
  if(!profile)return;
  let last=window.scrollY,travel=0,frame=0;
  const measure=()=>{
    document.documentElement.style.setProperty('--profile-header-height',(profile.getBoundingClientRect().height+3)+'px');
    document.documentElement.style.setProperty('--app-header-height',(header.querySelector('.app-tabs').getBoundingClientRect().height+12)+'px');
  };
  measure();new ResizeObserver(measure).observe(profile);
  const update=()=>{
    frame=0;
    const y=Math.max(0,window.scrollY),delta=y-last;last=y;
    if(y<40){header.classList.remove('profile-collapsed');travel=0;return;}
    if(header.contains(document.activeElement)&&document.activeElement.matches(':focus-visible'))return;
    if(Math.sign(delta)!==Math.sign(travel))travel=0;
    travel+=delta;
    if(travel>36){header.classList.add('profile-collapsed');travel=0;}
    else if(travel< -24){header.classList.remove('profile-collapsed');travel=0;}
  };
  window.addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(update);},{passive:true});
  header.addEventListener('focusin',()=>header.classList.remove('profile-collapsed'));
  window.addEventListener('hashchange',()=>{travel=0;last=window.scrollY;header.classList.remove('profile-collapsed');});
})();
