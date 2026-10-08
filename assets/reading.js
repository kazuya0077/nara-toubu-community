(function () {
  'use strict';
  var key = 'toubu.reading-size.v1';
  function apply(size) {
    document.documentElement.dataset.textSize = size === 'large' ? 'large' : 'standard';
    document.querySelectorAll('[data-text-size]').forEach(function (button) {
      if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.textSize === size));
    });
  }
  var saved = 'standard';
  try { saved = localStorage.getItem(key) || saved; } catch (e) { /* 保存できなくても切替は使える */ }
  apply(saved === 'large' ? 'large' : 'standard');
  document.querySelectorAll('button[data-text-size]').forEach(function (button) {
    button.addEventListener('click', function () {
      apply(button.dataset.textSize);
      try { localStorage.setItem(key, button.dataset.textSize); } catch (e) { /* このページ内で有効 */ }
      window.dispatchEvent(new Event('resize'));
    });
  });
})();
