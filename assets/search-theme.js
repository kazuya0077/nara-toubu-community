(function(){'use strict';
  function profile(){var p={};try{p=JSON.parse(localStorage.getItem('toubu.user-preferences.v1')||'{}')||{};}catch(e){}document.getElementById('search-user').textContent=p.saved?'登録内容を確認':'ユーザー登録を開く';document.getElementById('search-user-greeting').textContent=p.saved?p.name+'さん ／ '+(p.area||'地区未選択')+'で登録中':'地区を選ぶと、身近な予定を探せます。';}
  window.addEventListener('storage',function(e){if(e.key==='toubu.user-preferences.v1'||e.key===null)profile();});window.addEventListener('pageshow',profile);profile();
  function title(){var chosen=document.querySelector('.purpose-buttons [aria-pressed="true"]');document.getElementById('search-page-title').textContent=chosen?chosen.childNodes[0].textContent.trim():'地域の情報を探す';document.body.dataset.purpose=chosen?chosen.dataset.purpose:'all';}
  window.addEventListener('toubu-search-change',title);title();
})();
