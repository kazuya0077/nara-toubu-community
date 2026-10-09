(function () {
  'use strict';
  var data = window.TOUBU_DATA;
  var districtColors={'月ヶ瀬':'#7753a4','狭川':'#246da1','都祁':'#317954','東里':'#94620d','柳生':'#ad4760','大柳生':'#147c83','田原':'#9f4d26'};
  var panels = Array.from(document.querySelectorAll('[data-app-panel]'));
  var tabs = Array.from(document.querySelectorAll('[data-panel]'));
  var previous = location.hash || '#top', backStack = [], returning = false;
  function showPanel() {
    var hash = location.hash.slice(1), key = ['districts','bulletin','region-map','places','timeline'].includes(hash) ? hash : 'top';
    var destination=document.getElementById(hash);
    if(destination && destination.closest('[data-app-panel="about"]'))key='about';
    panels.forEach(function (panel) { panel.hidden = panel.dataset.appPanel !== key; });
    tabs.forEach(function (tab) { if (tab.dataset.panel === key) tab.setAttribute('aria-current','page'); else tab.removeAttribute('aria-current'); });
    if (key === 'region-map') {
      var frame = document.querySelector('#app-region-map iframe');
      if (!frame.getAttribute('src')) frame.src = frame.dataset.src;
    }
    document.getElementById('bottom-home').setAttribute('aria-current',key==='top'?'page':'false');
    ['places','timeline'].forEach(function(item){document.getElementById('bottom-'+item).setAttribute('aria-current',key===item?'page':'false');});
    var target = key === 'top' || key === 'about' ? destination : document.getElementById('app-' + key);
    if (!target || hash === 'top' || ['districts','bulletin','region-map','places','timeline'].includes(key)) window.scrollTo(0,0); else target.scrollIntoView({block:'start'});
  }
  tabs.forEach(function(tab){tab.addEventListener('click',function(e){if(location.hash===tab.getAttribute('href')){e.preventDefault();showPanel();}});});
  document.querySelectorAll('.app-bottom a').forEach(function(link){link.addEventListener('click',function(e){if(location.hash===link.getAttribute('href')){e.preventDefault();showPanel();}});});
  window.addEventListener('hashchange',function () {
    if (!returning) backStack.push(previous);
    returning = false; previous = location.hash || '#top'; showPanel();
  });
  document.getElementById('app-back').addEventListener('click',function () {
    var target = backStack.pop() || '#top';
    if (location.hash === target) { showPanel(); return; }
    returning = true; location.hash = target;
  });
  function element(tag,text,className) { var n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; }
  data.districts.forEach(function (area) {
    var card = element('article','','district-card'); card.appendChild(element('h2',area));
    card.appendChild(element('p', data.resources.filter(function (r) { return (r.areas || []).includes(area); }).length + '件の地域情報'));
    [['地区の情報を見る','search.html?v=24751641e154#?area=' + encodeURIComponent(area)],['通いの場を見る','search.html?v=24751641e154#?cat=tsudoi&area=' + encodeURIComponent(area)]].forEach(function (pair) {var a=element('a',pair[0]+' →','text-link');a.href=pair[1];card.appendChild(a);});
    document.getElementById('district-cards').appendChild(card);
  });
  ['cafe-04','tsudoi-02','cafe-05'].forEach(function (id) {
    var r = data.resources.find(function (item) {return item.id === id;}); if (!r) return;
    var card=element('article','','featured-card'), body=element('div','','featured-body');
    card.appendChild(element('p',(r.areas || []).join('・') + ' ／ 活動の案内','featured-top'));
    body.appendChild(element('h2',r.name));body.appendChild(element('p',r.address));
    var a=element('a','日時・詳しい内容を見る →');a.href='search.html?v=24751641e154#?id='+encodeURIComponent(id);body.appendChild(a);card.appendChild(body);document.getElementById('bulletin-list').appendChild(card);
  });
  var profileKey='toubu.user-preferences.v1', profile={};
  try { profile=JSON.parse(localStorage.getItem(profileKey) || '{}') || {}; } catch (e) {}
  var dialog=document.getElementById('user-dialog'), areaInput=document.getElementById('calendar-area');
  var legend=element('div','','district-legend');legend.setAttribute('role','group');legend.setAttribute('aria-label','地区の色と絞り込み');
  var legendTitle=element('p','7地区の色（地区名を押して絞り込み）','legend-title');
  areaInput.after(legendTitle,legend);
  [''].concat(data.districts).forEach(function(area){
    var b=element('button',area || '全地区');b.type='button';b.dataset.area=area;
    if(area){var dot=element('span','','district-dot');dot.style.backgroundColor=districtColors[area];dot.setAttribute('aria-hidden','true');b.prepend(dot);}
    b.addEventListener('click',function(){areaInput.value=area;selectedDay=null;renderMonth();});legend.appendChild(b);
  });
  function showProfile() {
    document.getElementById('user-greeting').textContent=profile.saved ? profile.name+'さん ／ '+(profile.area||'地区未選択')+'で登録中' : '東部地域の情報を、あなたの手元に。';
    document.getElementById('open-user').textContent=profile.saved ? '登録内容を確認' : '押すとユーザー登録';
    document.getElementById('user-name').value=typeof profile.name==='string' ? profile.name : '';
    document.getElementById('user-area').value=data.districts.concat('それ以外').includes(profile.area) ? profile.area : '';
    areaInput.value=data.districts.includes(profile.area) ? profile.area : '';
    window.dispatchEvent(new Event('toubu-profile-change'));
  }
  document.getElementById('open-user').addEventListener('click',function () {document.getElementById('user-status').textContent='';dialog.showModal();});
  document.getElementById('close-user').addEventListener('click',function () {dialog.close();});
  var clearProfile=element('button','この端末の登録を解除','outline-link');clearProfile.type='button';clearProfile.id='clear-user';document.querySelector('.dialog-actions').appendChild(clearProfile);
  clearProfile.addEventListener('click',function(){try{localStorage.removeItem(profileKey);profile={};showProfile();selectedDay=null;renderMonth();document.getElementById('user-status').textContent='この端末の登録を解除しました。';}catch(e){document.getElementById('user-status').textContent='解除できませんでした。ブラウザの保存設定をご確認ください。';}});
  document.getElementById('user-form').addEventListener('submit',function (e) {
    e.preventDefault(); var next={name:document.getElementById('user-name').value.trim(),area:document.getElementById('user-area').value,saved:true};
    if(!next.name){document.getElementById('user-status').textContent='呼び名を入力してください。';return;}
    try {localStorage.setItem(profileKey,JSON.stringify(next));profile=next;showProfile();selectedDay=null;renderMonth();dialog.close();document.getElementById('open-user').focus();}
    catch (error) {document.getElementById('user-status').textContent='保存できませんでした。登録せずにそのまま情報を探せます。';}
  });
  var parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric'}).formatToParts(new Date());
  var year=Number(parts.find(function(p){return p.type==='year';}).value), month=Number(parts.find(function(p){return p.type==='month';}).value)-1, selectedDay=null;
  var resources=data.resources.filter(function(r){return ['tsudoi','cafe','event'].includes(r.category);});
  function renderMonth() {
    var count=new Date(year,month+1,0).getDate(), area=areaInput.value;
    var filtered=resources.filter(function(r){return !area || (r.areas || []).includes(area);});
    legend.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.area===area));});
    var scheduled=filtered.map(function(r){var dates=[];for(var d=1;d<=count;d++){if(window.ToubuCalendar.occurs(r.schedule,new Date(year,month,d)))dates.push(d);}return {resource:r,dates:dates};});
    document.getElementById('month-label').textContent=year+'年'+(month+1)+'月';
    document.getElementById('season-month').textContent=(month+1)+'月の予定';
    var season=month>=2&&month<=4?['🌸','🌱']:month>=5&&month<=7?['🌻','🌿']:month>=8&&month<=10?['🍂','🌾']:['❄','🌲'];
    document.querySelectorAll('.season-banner>span').forEach(function(n,i){n.textContent=season[i];});
    var grid=document.getElementById('calendar-days');grid.replaceChildren();
    for(var pad=0;pad<new Date(year,month,1).getDay();pad++) grid.appendChild(element('span','','calendar-empty'));
    for(var day=1;day<=count;day++) {
      var onDay=scheduled.filter(function(item){return item.dates.includes(day);}), amount=onDay.length;
      var button=element('button','','calendar-day');button.type='button';button.dataset.day=String(day);
      button.appendChild(element('strong',String(day)));button.appendChild(element('small',amount+'件'));
      var marks=element('span','','calendar-district-marks'),dayAreas=[];marks.setAttribute('aria-hidden','true');
      data.districts.forEach(function(district){
        if(area && district!==area)return;
        var districtCount=onDay.filter(function(item){return (item.resource.areas || []).includes(district);}).length;
        if(!districtCount)return;dayAreas.push(district);
        var mark=element('span','','district-dot');mark.style.backgroundColor=districtColors[district];mark.title=district+'：'+districtCount+'件';marks.appendChild(mark);
      });
      button.appendChild(marks);
      button.setAttribute('aria-label',(month+1)+'月'+day+'日、'+amount+'件の開催予定'+(dayAreas.length?'。利用できる地区：'+dayAreas.join('・'):''));button.setAttribute('aria-pressed',String(day===selectedDay));
      button.addEventListener('click',function(e){selectedDay=Number(e.currentTarget.dataset.day);renderMonth();document.getElementById('month-list-title').focus({preventScroll:true});document.getElementById('month-list-title').scrollIntoView({block:'start'});});grid.appendChild(button);
    }
    var list=document.getElementById('month-list');list.replaceChildren();
    list.classList.remove('show-all');
    document.getElementById('month-list-title').textContent=selectedDay ? (month+1)+'月'+selectedDay+'日の開催予定' : (month+1)+'月の集まり';
    document.getElementById('calendar-all').hidden=!selectedDay;
    scheduled.filter(function(item){return selectedDay ? item.dates.includes(selectedDay) : item.dates.length;}).forEach(function(item){
      var r=item.resource,card=element('article','','month-card'),badges=element('div','','district-badges');
      (r.areas || []).forEach(function(district){var badge=element('span',district,'district-badge');badge.style.setProperty('--district-color',districtColors[district] || '#52624d');badges.appendChild(badge);});
      card.appendChild(badges);card.appendChild(element('h4',r.name));
      if(r.schedule.start)card.appendChild(element('p',r.schedule.start+(r.schedule.end?'〜'+r.schedule.end:'〜')));
      if(r.schedule.note)card.appendChild(element('p',r.schedule.note));
      if(!selectedDay){var details=element('details',''),summary=element('summary','開催予定日（'+item.dates.length+'日）');details.appendChild(summary);details.appendChild(element('p',item.dates.map(function(d){return d+'日';}).join('・')));card.appendChild(details);}
      var a=element('a','場所・料金・連絡先を見る →','text-link');a.href='search.html?v=24751641e154#?id='+encodeURIComponent(r.id);card.appendChild(a);list.appendChild(card);
    });
    if(!list.children.length)list.appendChild(element('p','この条件で日付を表示できる集まりはありません。日程が未定の集まりは、下のリンクから探せます。'));
    document.getElementById('month-more').hidden=list.children.length<=6;
    var unknown=scheduled.filter(function(item){return !item.dates.length;}).length;
    document.getElementById('unscheduled-note').textContent='日程が不定期・未記載の集まり：'+unknown+'件（日付には表示していません）';
  }
  document.getElementById('month-list-title').tabIndex=-1;
  function changeMonth(step){var date=new Date(year,month+step,1);year=date.getFullYear();month=date.getMonth();selectedDay=null;renderMonth();}
  document.getElementById('month-prev').addEventListener('click',function(){changeMonth(-1);});document.getElementById('month-next').addEventListener('click',function(){changeMonth(1);});
  areaInput.addEventListener('change',function(){selectedDay=null;renderMonth();});
  document.getElementById('calendar-all').addEventListener('click',function(){selectedDay=null;renderMonth();});
  document.getElementById('month-more').addEventListener('click',function(){document.getElementById('month-list').classList.add('show-all');this.hidden=true;});
  document.getElementById('calendar-toggle').addEventListener('click',function(){var view=document.getElementById('calendar-view');view.hidden=!view.hidden;this.setAttribute('aria-expanded',String(!view.hidden));this.textContent=view.hidden?'カレンダーを開く':'カレンダーを閉じる';});
  showProfile();renderMonth();showPanel();
  window.addEventListener('storage',function(e){if(e.key===profileKey||e.key===null){try{profile=JSON.parse(localStorage.getItem(profileKey)||'{}')||{};}catch(error){profile={};}showProfile();selectedDay=null;renderMonth();}});
  if(location.hash==='#register')dialog.showModal();
})();
