(function () {
  'use strict';
  var data = window.TOUBU_DATA, list = document.getElementById('featured-list');
  if (!data || !list) return;
  function node(tag, text, className) {
    var n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n;
  }
  // 内容は正本から取得する。架空の活動、開催実績、写真は掲載しない。
  function renderFeatured(){list.replaceChildren();var chosen=window.ToubuPreferences.area()?data.resources.filter(function(r){return ['cafe','tsudoi','event'].includes(r.category);}).sort(window.ToubuPreferences.resources).slice(0,3).map(function(r){return r.id;}):['cafe-04','tsudoi-02','cafe-05'];
  chosen.forEach(function (id) {
    var item = data.resources.find(function (r) { return r.id === id; });
    if (!item) return;
    var article = node('article', '', 'featured-card');
    var top = node('div', '', 'featured-top');
    var category = data.categories.find(function (c) { return c.id === item.category; });
    top.appendChild(node('span', (item.areas || []).join('・')));
    top.appendChild(node('span', category ? category.label : '地域の集まり'));
    article.appendChild(top);
    var body = node('div', '', 'featured-body'); body.appendChild(node('h3', item.name));
    var s = item.schedule;
    if (s) {
      var days = s.weekday == null ? [] : Array.isArray(s.weekday) ? s.weekday : [s.weekday];
      var dayText = days.map(function (d) { return '日月火水木金土'[d]; }).join('・');
      var when = s.freq === 'daily' ? '毎日' : s.freq === 'weekly' ? '毎週' + dayText + '曜日' : s.freq === 'monthly_nth' ? '毎月第' + s.nth + dayText + '曜日' : '日時はお問い合わせください';
      body.appendChild(node('p', when + (s.start ? ' ' + s.start + (s.end ? '〜' + s.end : '〜') : '')));
    }
    if (item.fee) body.appendChild(node('p', '料金：' + item.fee));
    var link = node('a', '詳しい内容を見る →'); link.href = 'search.html?v=3d8555a467be#?id=' + encodeURIComponent(item.id);
    link.setAttribute('aria-label', item.name + 'の詳しい内容を見る'); body.appendChild(link); article.appendChild(body); list.appendChild(article);
  });
  document.getElementById('featured').hidden = !list.children.length;
  }
  window.addEventListener('toubu-profile-change',renderFeatured);window.addEventListener('storage',function(e){if(e.key==='toubu.user-preferences.v1'||e.key===null)renderFeatured();});renderFeatured();
})();
