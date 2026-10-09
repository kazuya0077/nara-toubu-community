(() => {
  function profile() { try { return JSON.parse(localStorage.getItem('toubu.user-preferences.v1') || '{}') || {}; } catch { return {}; } }
  function registered() { const p=profile(); return p.saved===true && typeof p.name==='string' && !!p.name.trim(); }
  function area() { const p=profile(); return registered() && ['月ヶ瀬','狭川','都祁','東里','柳生','大柳生','田原'].includes(p.area) ? p.area : ''; }
  function resources(a,b) { const preferred=area(); if(!preferred)return 0; return Number((b.areas||[]).includes(preferred))-Number((a.areas||[]).includes(preferred)); }
  function posts(a,b) { const preferred=area(); return (preferred ? Number(b.area===preferred)-Number(a.area===preferred) : 0) || Date.parse(b.created)-Date.parse(a.created); }
  function dateLabel(year,month,day) { return (month+1)+'月'+day+'日（'+'日月火水木金土'[new Date(year,month,day).getDay()]+'）'; }
  window.ToubuPreferences={profile,registered,area,resources,posts,dateLabel};
})();
