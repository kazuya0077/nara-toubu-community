(function(){'use strict';
  try{var p=JSON.parse(localStorage.getItem('toubu.user-preferences.v1')||'{}');if(p.saved){document.getElementById('search-user').textContent='登録内容を確認';document.getElementById('search-user-greeting').textContent=p.name+'さん ／ '+(p.area||'地区未選択')+'で登録中';}}catch(e){}
  function title(){var chosen=document.querySelector('.purpose-buttons [aria-pressed="true"]');document.getElementById('search-page-title').textContent=chosen?chosen.childNodes[0].textContent.trim():'地域の情報を探す';document.body.dataset.purpose=chosen?chosen.dataset.purpose:'all';}
  window.addEventListener('toubu-search-change',title);title();
})();
