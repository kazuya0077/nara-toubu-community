(() => {
  const root = new URL('../', document.currentScript.src);
  if (window.top !== window.self) return;
  const offline = document.createElement('p');
  offline.className = 'pwa-notice'; offline.setAttribute('role','status');
  offline.textContent = '通信が切れています。保存済みの情報を表示しています。最新の予定や地図の確認には接続が必要です。';
  document.body.prepend(offline);
  const connection = () => { offline.hidden = navigator.onLine; };
  connection(); window.addEventListener('online',connection); window.addEventListener('offline',connection);
  const button = document.getElementById('pwa-install');
  const status = document.getElementById('pwa-install-status');
  let prompt;
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const refresh = () => { if (button) button.hidden = !prompt || installed(); if (status && installed()) status.textContent = 'ホーム画面からアプリとして開いています。'; };
  refresh();
  window.addEventListener('beforeinstallprompt',e => { e.preventDefault(); prompt = e; refresh(); });
  button?.addEventListener('click',async () => {
    if (!prompt) return;
    try { await prompt.prompt(); const result = await prompt.userChoice;
      if (status) status.textContent = result.outcome === 'accepted' ? '追加の操作を受け付けました。ホーム画面をご確認ください。' : '追加を見送りました。いつでも下の手順から追加できます。';
    } catch { if(status) status.textContent = '下の手順から、ホーム画面に追加してください。'; }
    prompt = null; refresh();
  });
  window.addEventListener('appinstalled',() => { prompt = null; if(status) status.textContent = 'ホーム画面への追加が完了しました。'; refresh(); });
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.pathname,updateViaCache:'none'}).then(registration => {
    const showUpdate = () => {
      if (!registration.waiting || !navigator.serviceWorker.controller || document.getElementById('pwa-update')) return;
      const notice = document.createElement('div'); notice.id = 'pwa-update'; notice.className = 'pwa-notice'; notice.setAttribute('role','status');
      notice.append('新しい版があります。入力中の内容を保存してから更新してください。');
      const update = document.createElement('button'); update.type='button'; update.textContent='更新する';
      update.onclick = () => { navigator.serviceWorker.addEventListener('controllerchange',() => location.reload(),{once:true}); registration.waiting?.postMessage({type:'SKIP_WAITING'}); };
      notice.append(update); document.body.prepend(notice);
    };
    showUpdate(); registration.addEventListener('updatefound',() => registration.installing?.addEventListener('statechange',showUpdate));
  }).catch(() => { if(status) status.textContent = '追加方法は下をご覧ください。通信状態を確認して、もう一度開いてください。'; });
})();
