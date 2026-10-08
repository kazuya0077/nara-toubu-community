/* 東部社会資源マップ — アプリ本体
 *
 * 方針
 *   - 座標は推測で作らない。data/resources.js に無いものは「位置未確定」として一覧に出す。
 *   - 地図はデフォルメ（assets/map.js のコメント参照）。実測とデフォルメの区別を画面にも書く。
 *   - バックエンドはまだ無い（要件定義 Phase 2）。登録した内容は端末に保存し、申請ファイルに書き出す。
 */
(function () {
  "use strict";

  var D = window.TOUBU_DATA;
  var DISTRICTS = window.TOUBU_DISTRICTS || {};
  var CATS = {}; D.categories.forEach(function (c) { CATS[c.id] = c; });
  var WEEK = ["日", "月", "火", "水", "木", "金", "土"];

  var LS_COORDS = "toubu.coords.v1";
  var LS_DRAFTS = "toubu.drafts.v1";

  function lsGet(k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { toast("保存できませんでした（写真が大きすぎるかもしれません）"); return false; }
  }

  var coords = lsGet(LS_COORDS, {});
  var drafts = lsGet(LS_DRAFTS, []);

  var items = D.resources.map(function (r) {
    var o = Object.assign({}, r);
    var c = coords[o.id];
    if (c && typeof c.lat === "number") { o.lat = c.lat; o.lng = c.lng; o.coordAt = c.at; o.coordBy = c.by; }
    o._color = (CATS[o.category] || {}).color || "#D2564B";
    return o;
  });
  drafts.forEach(function (d) {
    var o = Object.assign({}, d, { isDraft: true });
    var c = coords[o.id];
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) { o.lat = c.lat; o.lng = c.lng; }
    o._color = (CATS[o.category] || {}).color || "#D2564B";
    var index = items.findIndex(function (r) { return r.id === o.id; });
    if (index >= 0) items[index] = o; else items.push(o);
  });

  function hasPin(r) { return typeof r.lat === "number" && typeof r.lng === "number"; }
  function needsPin(r) { return !hasPin(r) && !r.noPin; }

  var state = { cats: new Set(), areas: new Set(), days: new Set(), q: "", today: false, sel: null };
  var PURPOSES = { consult: ["consult"], meet: ["tsudoi", "cafe", "event"], life: ["meal", "mobileshop", "transport", "helper", "volunteer"] };
  var listScroll = 0, previousFocus = null;
  var $app = document.getElementById("app");
  var $mapwrap = document.getElementById("mapwrap");
  document.getElementById("ui").insertBefore($mapwrap, document.getElementById("panel"));
  function setView(view) {
    document.body.classList.toggle("map-view", view === "map");
    $mapwrap.hidden = view !== "map";
    document.getElementById("btn-view-list").setAttribute("aria-pressed", view !== "map" ? "true" : "false");
    document.getElementById("btn-view-map").setAttribute("aria-pressed", view === "map" ? "true" : "false");
    window.dispatchEvent(new Event("resize"));
  }

  function readURL() {
    state.cats.clear(); state.areas.clear(); state.days.clear();
    var p = new URLSearchParams(location.hash.replace(/^#\??/, ""));
    (p.get("cat") || "").split(",").filter(Boolean).forEach(function (v) { state.cats.add(v); });
    (p.get("area") || "").split(",").filter(Boolean).forEach(function (v) { state.areas.add(v); });
    (p.get("day") || "").split(",").filter(Boolean).forEach(function (v) { state.days.add(Number(v)); });
    state.q = p.get("q") || "";
    state.today = p.get("today") === "1";
    state.sel = p.get("id") || null;
  }
  function writeURL() {
    var p = new URLSearchParams();
    if (state.cats.size) p.set("cat", Array.from(state.cats).join(","));
    if (state.areas.size) p.set("area", Array.from(state.areas).join(","));
    if (state.days.size) p.set("day", Array.from(state.days).join(","));
    if (state.q) p.set("q", state.q);
    if (state.today) p.set("today", "1");
    if (state.sel) p.set("id", state.sel);
    var s = p.toString();
    history.replaceState(null, "", s ? "#?" + s : location.pathname);
  }

  /* ---------------- 開催曜日 ---------------- */
  function weekdaysOf(r) {
    var s = r.schedule; if (!s) return null;
    if (s.freq === "once" && s.date) return [new Date(s.date + "T12:00:00").getDay()];
    if (s.freq === "daily") return [0, 1, 2, 3, 4, 5, 6];
    if (s.weekday === undefined || s.weekday === null) return null;
    return Array.isArray(s.weekday) ? s.weekday : [s.weekday];
  }
  function scheduleText(r) {
    var s = r.schedule; if (!s) return null;
    var days = weekdaysOf(r), head = "";
    if (s.freq === "once") head = s.date || "開催日未確認";
    else if (s.freq === "daily") head = "毎日";
    else if (s.freq === "weekly" && days) head = "毎週" + days.map(function (d) { return WEEK[d]; }).join("・") + "曜";
    else if (s.freq === "monthly_nth" && days) head = "毎月第" + s.nth + " " + days.map(function (d) { return WEEK[d]; }).join("・") + "曜";
    else if (s.freq === "irregular") head = "不定期";
    else if (days) head = days.map(function (d) { return WEEK[d]; }).join("・") + "曜";
    var time = s.start ? (s.start + (s.end ? "〜" + s.end : "〜")) : "";
    return [head, time, s.note].filter(Boolean).join(" ");
  }
  function openToday(r) {
    if (r.schedule && r.schedule.freq === "once") return r.schedule.date === today();
    if (!r.schedule || ["daily", "weekly", "monthly_nth"].indexOf(r.schedule.freq) < 0) return false;
    var days = weekdaysOf(r); if (!days) return false;
    var t = new Date().getDay();
    if (days.indexOf(t) < 0) return false;
    if (r.schedule.freq === "monthly_nth") {
      return Math.floor((new Date().getDate() - 1) / 7) + 1 === r.schedule.nth;
    }
    return true;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return items.filter(function (r) {
      if (state.cats.size && !state.cats.has(r.category)) return false;
      if (state.areas.size) {
        var as = r.areas || [];
        if (!as.some(function (a) { return state.areas.has(a); })) return false;
      }
      if (state.days.size) {
        var ds = weekdaysOf(r);
        if (!ds || !ds.some(function (d) { return state.days.has(d); })) return false;
      }
      if (state.today && !openToday(r)) return false;
      if (q) {
        var hay = [r.name, r.address, r.note, r.activity, r.fee, r.hours, r.areaNote, r.contactPerson,
          (r.areas || []).join(" "), (CATS[r.category] || {}).label, r.category === "cafe" ? "認知症カフェ" : ""].filter(Boolean).join(" ").toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  /* ---------------- 地図 ---------------- */
  var map = window.createToubuMap(document.getElementById("map"), {
    districts: DISTRICTS,
    onSelect: function (id) { select(id); },
    onCluster: function (group) {
      var m = openModal("この地点の地域資源", "同じ座標に複数の資源があります。町名の代表点の場合は、住所も確認してください。");
      group.forEach(function (r) {
        var b = el("button", "btn cluster-resource", r.name + " ／ " + CATS[r.category].label);
        b.addEventListener("click", function () { closeModal(); select(r.id); }); m.appendChild(b);
      });
    },
    onHover: function (id) { setHover(id, "map"); },
    onArea: function (name) {
      state.areas.has(name) ? state.areas.delete(name) : state.areas.add(name);
      syncChips(); refresh();
    },
    onPick: function (ll) { finishPick(ll); },
    onBlank: function () { if (state.sel) select(null); },
    onCounts: function (c) {
      var n = document.getElementById("rim-count");
      if (n) n.textContent = c.outside ? "（いま " + c.outside + " 件）" : "";
    }
  });

  /* 一覧とピンのホバーを連動させる */
  var hoverId = null;
  function setHover(id, from) {
    if (hoverId === id) return;
    hoverId = id;
    map.setHover(id);
    document.querySelectorAll("#list .card").forEach(function (c) {
      c.classList.toggle("hover", c.dataset.id === id);
    });
    if (from === "map" && id && $detail.hidden) {
      var card = document.querySelector('#list .card[data-id="' + id + '"]');
      if (card) {
        // offsetTop は基準の要素が #list とは限らないのでずれる。実寸で測る。
        var lr = $list.getBoundingClientRect(), cr = card.getBoundingClientRect();
        if (cr.top < lr.top) $list.scrollTop += cr.top - lr.top - 8;
        else if (cr.bottom > lr.bottom) $list.scrollTop += cr.bottom - lr.bottom + 8;
      }
    }
  }
  var legend = document.querySelector(".map-legend .rimnote");
  if (legend) { var sp = document.createElement("span"); sp.id = "rim-count"; legend.appendChild(sp); }

  /* ---------------- 一覧 ---------------- */
  var $list = document.getElementById("list");
  var $count = document.getElementById("count");

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  var IC = {
    place: '<path d="M12 21.5c4.6-7 7.4-9.9 7.4-13.4A7.4 7.4 0 0 0 4.6 8c0 3.6 2.9 6.5 7.4 13.5Z"/><circle cx="12" cy="8.2" r="2.6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.2v5l3.2 2"/>',
    yen: '<path d="M7 5.5 12 12l5-6.5M8.4 12.6h7.2M8.4 15.8h7.2M12 12v6.6"/>',
    tel: '<path d="M6.5 3.8h3.2l1.6 4-2 1.4a11 11 0 0 0 5.4 5.4l1.4-2 4 1.6v3.2a1.6 1.6 0 0 1-1.8 1.6C10.6 18.4 5.5 13.3 4.9 5.6a1.6 1.6 0 0 1 1.6-1.8Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    person: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>',
    area: '<path d="M9 3.5 3.5 6v14.5L9 18l6 2.5 5.5-2.5V3.5L15 6Z"/><path d="M9 3.5V18M15 6v14.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.6"/>'
  };
  function icon(d) {
    return '<svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  function row(iconPath, text) {
    var e = el("div", "row"); e.innerHTML = icon(iconPath); e.appendChild(el("span", null, text)); return e;
  }

  function renderList() {
    var list = filtered();
    var located = list.filter(hasPin).length;
    document.getElementById("location-summary").textContent = "所在地あり " + located + "件 ／ 固定所在地なし " + list.filter(function (r) { return r.noPin; }).length + "件 ／ 位置未確認 " + list.filter(needsPin).length + "件";
    $count.textContent = list.length;
    document.getElementById("results-count").textContent = "（" + list.length + "件）";
    $list.innerHTML = "";
    if (!list.length) {
      $list.appendChild(el("p", "empty", "条件に合うものがありませんでした。条件をへらしてみてください。"));
      var clearAreas = el("button", "btn", "地区の条件を解除する");
      clearAreas.addEventListener("click", function () { state.areas.clear(); refresh(); document.getElementById("panel").focus(); });
      $list.appendChild(clearAreas);
      var consult = el("button", "btn", "全地区の相談窓口を見る");
      consult.addEventListener("click", function () { state.cats = new Set(["consult"]); state.areas.clear(); state.days.clear(); state.q = ""; state.today = false; document.getElementById("q").value = ""; document.getElementById("btn-today").setAttribute("aria-pressed", "false"); refresh(); document.getElementById("panel").focus(); });
      $list.appendChild(consult);
      map.setPins([], null);
      return;
    }
    // 項目ごとにまとめて、見出しを挟む（126件を続けて並べると読めないため）
    var order = [], byCat = {};
    list.forEach(function (r) {
      if (!byCat[r.category]) { byCat[r.category] = []; order.push(r.category); }
      byCat[r.category].push(r);
    });
    order.sort(function (a, b) {
      var ia = D.categories.findIndex(function (c) { return c.id === a; });
      var ib = D.categories.findIndex(function (c) { return c.id === b; });
      return ia - ib;
    });
    var sorted = [];
    order.forEach(function (id) { byCat[id].forEach(function (r) { sorted.push(r); }); });

    var lastCat = null;
    sorted.forEach(function (r) {
      // 項目が変わったところで見出しを挟む
      if (r.category !== lastCat) {
        lastCat = r.category;
        var c = CATS[r.category] || { label: r.category, color: "#999" };
        var head = el("div", "list-group");
        head.innerHTML = '<span class="dot" style="background:' + c.color + '"></span>';
        head.appendChild(document.createTextNode(c.label + " " + byCat[r.category].length + "件"));
        $list.appendChild(head);
      }
      var cat = CATS[r.category] || { label: r.category, color: "#999" };
      var card = el("div", "card" + (state.sel === r.id ? " active" : ""));
      card.tabIndex = 0; card.setAttribute("role", "button");
      card.dataset.id = r.id;
      card.addEventListener("pointerenter", function () { setHover(r.id, "list"); });
      card.addEventListener("pointerleave", function () { setHover(null, "list"); });
      card.addEventListener("focus", function () { setHover(r.id, "list"); });

      if (r.photos && r.photos.length) {
        var img = document.createElement("img");
        img.className = "thumb"; img.loading = "lazy"; img.src = r.photos[0].src;
        img.alt = r.photos[0].alt || r.name + "の様子";
        card.appendChild(img);
      }
      card.appendChild(el("h3", null, r.name));
      var badge = el("span", "cat");
      badge.innerHTML = '<span class="dot" style="background:' + cat.color + '"></span>';
      badge.appendChild(document.createTextNode(cat.label + (r.isDraft ? "（この端末で登録）" : "")));
      card.appendChild(badge);

      if (r.address) card.appendChild(row(IC.place, r.address));
      card.appendChild(row(IC.area, "利用できる地区：" + ((r.areas || []).join("・") || "未確認")));
      var st = [scheduleText(r), r.hours].filter(Boolean).join(" ／ ");
      card.appendChild(row(IC.clock, st || "開催日時・営業時間はお問い合わせください"));
      if (r.tel) card.appendChild(row(IC.tel, r.tel));
      if (r.fee) card.appendChild(row(IC.yen, r.fee));
      card.appendChild(el("span", "card-open", "日時・料金など、詳しく見る →"));

      if (r.noPin) card.appendChild(el("div", "outside-note", "巡回・配達など固定の所在地がないサービス"));
      if (needsPin(r)) card.appendChild(el("div", "warn", "※ 地図の位置が未確定です"));
      else if (hasPin(r) && !map.isInside(r.lat, r.lng)) card.appendChild(el("div", "outside-note", "所在地と利用できる地区は異なる場合があります"));

      card.addEventListener("click", function () { select(r.id); });
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(r.id); } });
      $list.appendChild(card);
    });
    // 種類を絞り込んでいるときだけ、ピンに名前を出す（全部出すと文字だらけになる）
    var showNames = state.cats.size > 0;
    list.forEach(function (r) { r._showName = showNames; });
    map.setPins(list, state.sel);
  }

  /* ---------------- 詳細 ---------------- */
  var $detail = document.getElementById("detail");
  document.body.appendChild($detail);
  $detail.setAttribute("role", "dialog");
  $detail.setAttribute("aria-modal", "true");
  $detail.setAttribute("aria-labelledby", "resource-title");
  function safeURL(u) {
    try { var x = new URL(u); return (x.protocol === "http:" || x.protocol === "https:") ? x.href : null; }
    catch (e) { return null; }
  }

  function renderDetail(r) {
    var cat = CATS[r.category] || { label: r.category, color: "#999" };
    $detail.hidden = false; $detail.innerHTML = "";

    var bar = el("div", "backbar");
    var back = el("button", "back");
    back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    back.appendChild(document.createTextNode("一覧にもどる"));
    back.addEventListener("click", function () { select(null); });
    bar.appendChild(back);
    $detail.appendChild(bar);

    var head = el("div", "dhead");
    var detailTitle = el("h2", null, r.name); detailTitle.id = "resource-title"; head.appendChild(detailTitle);
    var badge = el("span", "cat");
    badge.innerHTML = '<span class="dot" style="background:' + cat.color + '"></span>';
    badge.appendChild(document.createTextNode(
      cat.label + (r.subtype ? " ・ " + r.subtype : "") + (r.isDraft ? "（この端末で登録）" : "")));
    head.appendChild(badge);
    $detail.appendChild(head);
    var coverageBox=el("section", "detail-coverage");coverageBox.appendChild(el("h3",null,"東部7地区のどこで利用できる？"));
    var coverageChips=el("div","coverage-chips");
    D.districts.forEach(function(name){var listed=(r.areas||[]).indexOf(name)>=0;var mark=el("span",listed?"eligible":"not-listed",(listed?"✓ ":"")+name);mark.setAttribute("aria-label",name+(listed?"：利用可能として掲載":"：提供地区の記載なし"));coverageChips.appendChild(mark);});
    coverageBox.appendChild(coverageChips);coverageBox.appendChild(el("p","coverage-note",r.areaNote || "チェック付きは利用可能として掲載されている地区です。その他の地区は記載がないため、利用可否をお問い合わせください。"));

    if (r.photos && r.photos.length) {
      var ph = el("div", "photos");
      r.photos.forEach(function (p) {
        var fig = document.createElement("figure");
        var im = document.createElement("img");
        im.src = p.src; im.alt = p.alt || r.name + "の様子"; im.loading = "lazy";
        fig.appendChild(im);
        if (p.caption) fig.appendChild(el("figcaption", null,
          p.caption + (p.takenOn ? "（" + p.takenOn + "）" : "")));
        ph.appendChild(fig);
      });
      $detail.appendChild(ph);
    }

    /* 操作ボタンの列 */
    var manageActions = el("details", "detail-management");
    manageActions.appendChild(el("summary", null, "情報の修正・報告（この端末に保存）"));
    manageActions.appendChild(el("p", null, "修正や報告は運営へ送信されません。申請ファイルを書き出して共有する必要があります。"));
    var act = el("div", "actions");
    if (hasPin(r)) {
      var route = document.createElement("a");
      // 何のボタンか分かるよう、行き先を名前に入れる。塗りつぶしはやめて他と並びを揃える
      route.className = "act";
      route.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(r.address || (r.lat + "," + r.lng));
      route.target = "_blank"; route.rel = "noopener noreferrer";
      route.textContent = "Googleマップで道順 ↗";
      act.appendChild(route);
      var here = el("button", "act", "地図で見る");
      here.addEventListener("click", function () {
        select(null); setView("map");
        $mapwrap.scrollIntoView({ block: "start" });
        var ui = document.getElementById("ui");
        var off = 0;
        map.focusOffset(r.lat, r.lng, 4.2, off);
      });
      act.appendChild(here);
    } else if (!r.noPin) {
      var pick = el("button", "act primary", "地図で位置を指定");
      pick.addEventListener("click", function () { startPick(r); });
      manageActions.appendChild(pick);
    }
    if (r.tel) {
      var call = document.createElement("a");
      call.className = "act primary call-action"; call.href = "tel:" + r.tel.replace(/[^0-9+]/g, "");
      call.textContent = "電話で問い合わせる：" + r.tel;
      act.prepend(call);
    }
    var edit = el("button", "act", "内容を直す");
    edit.addEventListener("click", function () { openRegister(r); });
    manageActions.appendChild(edit);
    var rep = el("button", "act", "情報が古い");
    rep.addEventListener("click", function () { reportStale(r); });
    manageActions.appendChild(rep);
    $detail.appendChild(act);
    if (needsPin(r)) $detail.appendChild(el("p", "note-box warn", "地図の位置が未確定です。会場や集合場所は、掲載されている住所と各窓口への問い合わせで確認してください。"));
    if (r.noPin) $detail.appendChild(el("p", "note-box", "巡回・配達など、固定の所在地がないサービスです。利用できる地区と申し込み方法を各窓口へご確認ください。"));

    /* 情報の行 */
    var dl = document.createElement("dl");
    function put(iconPath, key, v) {
      if (!v) return;
      var dt = el("dt");
      dt.innerHTML = icon(iconPath);
      dl.appendChild(dt);
      var dd = el("dd");
      if (key) dd.appendChild(el("span", "k", key));
      if (typeof v === "string") dd.appendChild(document.createTextNode(v));
      else dd.appendChild(v);
      dl.appendChild(dd);
    }
    put(IC.place, null, r.address);
    if (r.tel) {
      var a = document.createElement("a");
      a.href = "tel:" + r.tel.replace(/[^0-9+]/g, ""); a.textContent = r.tel;
      put(IC.tel, null, a);
    }
    if (r.email) {
      var m = document.createElement("a"); m.href = "mailto:" + r.email; m.textContent = r.email;
      put(IC.mail, null, m);
    }
    put(IC.person, "窓口", r.contactPerson);
    put(IC.clock, "受付時間", r.contactHours);
    put(IC.area, "利用できる地区（所在地とは別）",
      (r.areas && r.areas.length ? r.areas.join("・") : "未記載")
      + (r.areaNote ? "（" + r.areaNote + "）" : ""));
    put(IC.clock, "開催日時", scheduleText(r));
    put(IC.clock, "営業時間・休業日", r.hours || (!r.schedule ? "未確認。利用前にお問い合わせください。" : null));
    put(IC.info, "内容", r.activity);
    put(IC.person, "対象", r.target);
    put(IC.yen, "料金", r.fee);
    put(IC.info, "体験利用", r.trial);
    put(IC.info, "備考", r.note);
    $detail.appendChild(dl);
    $detail.appendChild(coverageBox);

    if (r.links && r.links.length) {
      var lw = el("div", "links");
      r.links.forEach(function (l) {
        var u = safeURL(l.url); if (!u) return;
        var b = document.createElement("a");
        b.className = "act"; b.href = u; b.target = "_blank"; b.rel = "noopener noreferrer";
        b.textContent = (l.label || "リンク") + " ↗";
        lw.appendChild(b);
      });
      if (lw.children.length) $detail.appendChild(lw);
    }

    if (hasPin(r) && !map.isInside(r.lat, r.lng)) {
      var on = el("div", "note-box");
      on.appendChild(el("b", null, "所在地と利用できる地区について"));
      on.appendChild(document.createTextNode(
        "地図は施設の所在地を表示しています。サービスを利用できる地区は、上の地区表示をご確認ください。"));
      $detail.appendChild(on);
    }
    if (hasPin(r)) $detail.appendChild(el("p", "note-box", "地図の座標には町名の代表点を含みます。建物の位置は住所・経路案内で確認してください。"));
    if (r.needsVerification) {
      var vn = el("div", "note-box warn");
      vn.appendChild(el("b", null, "確認が必要です"));
      vn.appendChild(document.createTextNode(r.needsVerification));
      $detail.appendChild(vn);
    }

    var dis = el("div", "disclaimer");
    dis.textContent = (r.updated ? "情報更新日: " + r.updated : "資料の転記日: " + D.meta.transcribed + "（掲載先への最新確認日は未記録）")
      + "（出典: " + (r.isDraft ? "この端末での登録" : D.meta.source) + "）"
      + " ／ 情報は掲載時点のものです。ご利用の前に各事業所へお問い合わせください。";
    $detail.appendChild(dis);
    $detail.appendChild(manageActions);
    $detail.scrollTop = 0;
  }

  function select(id) {
    if (id && !state.sel) { listScroll = window.scrollY; previousFocus = document.activeElement; }
    var closingId = state.sel;
    state.sel = id; writeURL();
    var r = id ? items.filter(function (x) { return x.id === id; })[0] : null;
    if (!r) {
      $detail.hidden = true; $detail.innerHTML = ""; $app.inert = false; map.setSelected(null); renderList();
      if (closingId) {
        window.scrollTo(0, listScroll);
        var restored = Array.from($list.querySelectorAll(".card")).find(function (c) { return c.dataset.id === closingId; });
        (restored || (previousFocus && previousFocus.isConnected ? previousFocus : document.getElementById("panel"))).focus({ preventScroll: true });
      }
      return;
    }
    renderDetail(r); renderList();
    $app.inert = true; $detail.querySelector(".back").focus();
    if (hasPin(r)) {
      var ui = document.getElementById("ui");
      var off = (window.innerWidth >= 900) ? ui.getBoundingClientRect().right : 0;
      map.focusOffset(r.lat, r.lng, 2.8, off);
    }
  }

  /* ---------------- チップ ---------------- */
  function chip(label, pressed, color) {
    var b = el("button", "chip"); b.type = "button";
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
    if (color) { var d = el("span", "dot"); d.style.background = color; b.appendChild(d); }
    b.appendChild(document.createTextNode(label));
    return b;
  }
  function buildChips() {
    var cc = document.getElementById("cat-chips");
    var quick = document.getElementById("quick-category");
    D.categories.forEach(function (c) { var o = el("option", null, c.label); o.value = c.id; quick.appendChild(o); });
    D.categories.forEach(function (c) {
      var n = items.filter(function (r) { return r.category === c.id; }).length;
      var b = chip(c.label + " " + n, state.cats.has(c.id), c.color);
      b.dataset.cat = c.id;
      b.addEventListener("click", function () {
        state.cats.has(c.id) ? state.cats.delete(c.id) : state.cats.add(c.id);
        syncChips(); refresh();
      });
      cc.appendChild(b);
    });
    var ac = document.getElementById("area-chips");
    D.districts.forEach(function (a) {
      var b = chip(a, state.areas.has(a));
      b.dataset.area = a;
      b.addEventListener("click", function () {
        state.areas.has(a) ? state.areas.delete(a) : state.areas.add(a);
        syncChips(); refresh();
      });
      ac.appendChild(b);
    });
    var dc = document.getElementById("day-chips");
    WEEK.forEach(function (w, i) {
      var b = chip(w, state.days.has(i));
      b.dataset.day = i;
      b.addEventListener("click", function () {
        state.days.has(i) ? state.days.delete(i) : state.days.add(i);
        syncChips(); refresh();
      });
      dc.appendChild(b);
    });
  }
  function syncChips() {
    document.querySelectorAll("[data-purpose]").forEach(function (b) {
      var cats = PURPOSES[b.dataset.purpose];
      b.setAttribute("aria-pressed", state.cats.size === cats.length && cats.every(function (c) { return state.cats.has(c); }) ? "true" : "false");
    });
    var labels = D.categories.filter(function(c) { return state.cats.has(c.id); }).map(function(c) { return c.label; });
    document.getElementById("search-summary").textContent = "検索条件：" + (labels.join("・") || "すべての種類") + " ／ " + (Array.from(state.areas).join("・") || "全地区") + (state.q ? " ／ キーワード「" + state.q + "」" : "") + (state.days.size ? " ／ " + Array.from(state.days).map(function(d) { return WEEK[d]; }).join("・") + "曜" : "") + (state.today ? " ／ 今日の開催予定" : "");
    document.getElementById("quick-category").value = state.cats.size === 1 ? Array.from(state.cats)[0] : "";
    document.getElementById("btn-cafe").setAttribute("aria-pressed", state.cats.has("cafe") ? "true" : "false");
    document.querySelectorAll("#cat-chips .chip").forEach(function (b) {
      b.setAttribute("aria-pressed", state.cats.has(b.dataset.cat) ? "true" : "false");
    });
    document.querySelectorAll("#area-chips .chip").forEach(function (b) {
      b.setAttribute("aria-pressed", state.areas.has(b.dataset.area) ? "true" : "false");
    });
    document.querySelectorAll("#day-chips .chip").forEach(function (b) {
      b.setAttribute("aria-pressed", state.days.has(Number(b.dataset.day)) ? "true" : "false");
    });
  }
  function refresh() {
    if (state.sel && !filtered().some(function (r) { return r.id === state.sel; })) {
      state.sel = null; $detail.hidden = true; $app.inert = false;
    }
    syncChips(); writeURL(); renderList(); updatePendingCount();
  }

  /* ---------------- 位置の指定 ---------------- */
  var picking = null, pickBanner = null;
  function startPick(r) {
    closeModal(); picking = r; $detail.hidden = true; $app.inert = false; setView("map"); $mapwrap.scrollIntoView({block:"start"});
    if (pickBanner) pickBanner.remove();
    pickBanner = el("div", "hint-banner");
    pickBanner.textContent = "「" + r.name + "」の場所を地図でタップしてください（やめるには Esc）";
    document.getElementById("mapwrap").appendChild(pickBanner);
    map.setPickMode(true);
  }
  function stopPick() {
    picking = null; map.setPickMode(false);
    if (pickBanner) { pickBanner.remove(); pickBanner = null; }
  }
  function finishPick(ll) {
    if (!picking) return;
    var r = picking;
    coords[r.id] = { lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6), at: today(), by: "手動指定" };
    lsSet(LS_COORDS, coords);
    var t = items.filter(function (x) { return x.id === r.id; })[0];
    t.lat = coords[r.id].lat; t.lng = coords[r.id].lng; t.coordAt = coords[r.id].at;
    stopPick();
    toast("「" + r.name + "」の位置を記録しました。書き出しをお忘れなく。");
    select(r.id); updatePendingCount();
  }
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (picking) { stopPick(); return; }
    if (document.getElementById("modal-root").firstChild) { closeModal(); return; }
    if (state.sel) select(null);
  });

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------------- モーダル ---------------- */
  var $modalRoot = document.getElementById("modal-root");
  var modalReturn = null;
  function closeModal() {
    var wasOpen = !!$modalRoot.firstChild;
    $modalRoot.querySelectorAll(".pickmap").forEach(function(box){if(box._destroyToubuMap)box._destroyToubuMap();}); $modalRoot.innerHTML = "";
    $detail.inert = false; $app.inert = !$detail.hidden;
    if (wasOpen && modalReturn && modalReturn.isConnected) modalReturn.focus({preventScroll:true});
  }
  function openModal(title, lede) {
    closeModal();
    modalReturn = document.activeElement;
    $app.inert = true; $detail.inert = true;
    var back = el("div", "modal-back");
    back.addEventListener("click", function (e) { if (e.target === back) closeModal(); });
    var m = el("div", "modal");
    m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", title);
    m.addEventListener("keydown", function(e) {
      if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
      if (e.key !== "Tab") return;
      var nodes = Array.from(m.querySelectorAll("button,a[href],input,select,textarea,summary")).filter(function(n) {return n.getClientRects().length && !n.disabled;});
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    var c = el("button", "btn close", "×");
    c.setAttribute("aria-label", "閉じる");
    c.addEventListener("click", closeModal);
    m.appendChild(c);
    m.appendChild(el("h2", null, title));
    if (lede) m.appendChild(el("p", "lede", lede));
    back.appendChild(m); $modalRoot.appendChild(back);
    c.focus();
    return m;
  }
  function toast(msg) {
    var t = el("div", "toast", msg);
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4200);
  }

  /* ---------------- 位置未確定 ---------------- */
  function updatePendingCount() {
    document.getElementById("pending-count").textContent = "(" + items.filter(needsPin).length + ")";
  }
  function download(name, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function openPending() {
    var pend = items.filter(needsPin);
    var done = items.filter(hasPin).length;
    var total = items.filter(function (r) { return !r.noPin; }).length;
    var m = openModal("位置未確定 " + pend.length + " 件",
      "現在 " + done + " / " + total + " 件（" + Math.round(done / Math.max(total, 1) * 100) + "%）が確定しています。"
      + "元データに緯度経度はありません。住所検索で当たらなかったものは、地図で指定してください。");

    var bar = el("div", "modal-foot"); bar.style.justifyContent = "flex-start";
    var exp = el("button", "btn small primary", "座標を書き出す（JSON）");
    exp.addEventListener("click", function () {
      if (!Object.keys(coords).length) { toast("書き出す座標がまだありません。"); return; }
      download("coords-" + today() + ".json", JSON.stringify(coords, null, 2));
    });
    bar.appendChild(exp);
    var imp = el("button", "btn small", "座標を読み込む");
    imp.addEventListener("click", importCoords);
    bar.appendChild(imp);
    m.appendChild(bar);

    if (!pend.length) { m.appendChild(el("p", null, "すべて位置が確定しています。")); return; }
    pend.forEach(function (r) {
      var it = el("div", "pending-item");
      var left = el("div");
      left.appendChild(el("div", "nm", r.name));
      left.appendChild(el("div", "ad", (CATS[r.category] || {}).label + " ／ " + (r.address || "住所なし")));
      it.appendChild(left);
      var b = el("button", "btn small", "地図で指定");
      b.addEventListener("click", function () { startPick(r); });
      it.appendChild(b);
      m.appendChild(it);
    });
  }
  function importCoords() {
    var f = document.createElement("input");
    f.type = "file"; f.accept = "application/json,.json";
    f.addEventListener("change", function () {
      var file = f.files[0]; if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var obj = JSON.parse(fr.result);
          Object.keys(obj).forEach(function (k) { coords[k] = obj[k]; });
          lsSet(LS_COORDS, coords);
          items.forEach(function (r) {
            var c = coords[r.id];
            if (c && typeof c.lat === "number") { r.lat = c.lat; r.lng = c.lng; r.coordAt = c.at; }
          });
          toast(Object.keys(obj).length + " 件の座標を読み込みました。");
          closeModal(); refresh();
        } catch (e) { toast("読み込めませんでした。JSON の中身をご確認ください。"); }
      };
      fr.readAsText(file);
    });
    f.click();
  }

  function reportStale(r) {
    var m = openModal("情報が古いと知らせる", "「" + r.name + "」について、気づいたことを書いてください。ログインは要りません。");
    var f = el("div", "field");
    f.appendChild(el("label", null, "どこが違いますか"));
    var ta = document.createElement("textarea");
    ta.placeholder = "例：木曜の開催が第2・第4だけになりました";
    f.appendChild(ta); m.appendChild(f);
    var foot = el("div", "modal-foot");
    var cancel = el("button", "btn", "やめる"); cancel.addEventListener("click", closeModal);
    var send = el("button", "btn primary", "報告をファイルに書き出す");
    send.addEventListener("click", function () {
      if (!ta.value.trim()) { toast("内容を書いてください。"); return; }
      download("report-" + r.id + "-" + today() + ".json", JSON.stringify({
        type: "stale-report", targetId: r.id, targetName: r.name, body: ta.value.trim(), reportedAt: today()
      }, null, 2));
      closeModal();
      toast("書き出しました。東部包括へお渡しください（送信は Phase 2 で追加します）。");
    });
    foot.appendChild(cancel); foot.appendChild(send); m.appendChild(foot);
  }

  /* ---------------- 住所から座標を引く ---------------- */
  /* 国土地理院の住所検索は CORS を返さないので、/api/geocode の中継ごしに呼ぶ */
  function geocode(address, cb) {
    var q = String(address || "").trim();
    if (!q) { cb(null); return; }
    fetch("/api/geocode?q=" + encodeURIComponent(q))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { cb(j && j.hits && j.hits.length ? j.hits[0] : null); })
      .catch(function () { cb(null); });
  }

  /* ---------------- 写真（EXIF は再エンコードで落とす） ---------------- */
  function readPhoto(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 1600, w = img.width, h = img.height;
        if (Math.max(w, h) > max) { var k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
        var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        var out = cv.toDataURL("image/webp", 0.8);
        if (out.length > 900000) out = cv.toDataURL("image/webp", 0.55);
        cb({ src: out, takenOn: today(), caption: "", alt: "" });
      };
      img.onerror = function () { toast("この画像は読み込めませんでした。"); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* ---------------- 登録フロー（6手順） ---------------- */
  function openRegister(base) {
    var editing = !!base;
    var draft = Object.assign({}, base ? JSON.parse(JSON.stringify(base)) : {}, {
      id: editing ? base.id : "draft-" + Date.now(),
      category: base ? base.category : (state.cats.size === 1 ? Array.from(state.cats)[0] : ""),
      name: base ? base.name : "",
      address: base ? base.address || "" : "",
      tel: base ? base.tel || "" : "",
      email: base ? base.email || "" : "",
      contactPerson: base ? base.contactPerson || "" : "",
      contactHours: base ? base.contactHours || "" : "",
      hours: base ? base.hours || "" : "",
      target: base ? base.target || "" : "",
      areas: base ? (base.areas || []).slice() : Array.from(state.areas),
      fee: base ? base.fee || "" : "",
      note: base ? base.note || "" : "",
      links: base ? JSON.parse(JSON.stringify(base.links || [])) : [],
      photos: base ? JSON.parse(JSON.stringify(base.photos || [])) : [],
      lat: base ? base.lat : null, lng: base ? base.lng : null,
      schedule: base ? base.schedule || null : null,
      submittedAt: today()
    });
    var step = 0;
    var STEPS = ["場所", "位置あわせ", "種類", "名前と連絡先", "写真とリンク", "確認"];
    var m, body, foot, mini = null;

    function shell() {
      m = openModal(editing ? "内容を直す" : "あたらしく登録する",
        "保存するとこの端末の地図に反映されます。他の端末には共有されません。保存前に閉じると入力は破棄されます。");
      var ol = el("ol", "steps");
      STEPS.forEach(function (s, i) {
        var li = el("li", i < step ? "done" : "", (i + 1) + ". " + s);
        if (i === step) li.setAttribute("aria-current", "step");
        li.addEventListener("click", function () { if (i < step) { step = i; render(); } });
        ol.appendChild(li);
      });
      m.appendChild(ol);
      body = el("div"); m.appendChild(body);
      foot = el("div", "modal-foot"); m.appendChild(foot);
    }
    function nav(nextLabel, onNext) {
      foot.innerHTML = "";
      if (step > 0) {
        var b = el("button", "btn", "もどる");
        b.addEventListener("click", function () { step--; render(); });
        foot.appendChild(b);
      }
      var n = el("button", "btn primary", nextLabel || "つぎへ");
      n.addEventListener("click", onNext);
      foot.appendChild(n);
    }
    function field(label, hint, node) {
      var f = el("div", "field");
      var lab = el("label", null, label);
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(node.tagName)) {
        node.id = "field-" + Math.random().toString(36).slice(2); lab.htmlFor = node.id;
      }
      f.appendChild(lab);
      if (hint) f.appendChild(el("span", "hint", hint));
      f.appendChild(node);
      return f;
    }
    function input(val, ph, type) {
      var i = document.createElement("input");
      i.type = type || "text"; i.value = val || ""; i.placeholder = ph || "";
      return i;
    }

    function render() {
      shell();

      if (step === 0) {
        var addr = input(draft.address, "例：奈良市茗荷町806-1");
        body.appendChild(field("住所や目印", "分かる範囲で大丈夫です。あとで地図で直せます。", addr));
        body.appendChild(el("p", "hint", "住所が分からなくても、つぎの画面で地図をタップして場所を決められます。"));
        nav("地図であわせる", function () {
          var v = addr.value.trim();
          var changed = v && v !== draft.address;
          draft.address = v;
          if (!changed) { step = 1; render(); return; }
          // 住所を入れたら、その場所を探してピンを立てておく
          toast("住所から場所を探しています…");
          geocode(v, function (hit) {
            if (hit) {
              draft.lat = hit.lat; draft.lng = hit.lng;
              draft._geo = hit;
            }
            step = 1; render();
          });
        });
        return;
      }

      if (step === 1) {
        if (draft.noPin) {
          body.appendChild(el("p", null, "巡回・配達など固定の所在地がないサービスです。提供地区を登録します。"));
          nav("つぎへ", function () { step = 2; render(); }); return;
        }
        var box = el("div", "pickmap");
        body.appendChild(box);
        body.appendChild(el("p", "hint", "地図をタップするとピンが立ちます。もう一度タップすれば動かせます。"));
        var readout = el("p", "hint", draft.lat ? "いまの位置: " + draft.lat + ", " + draft.lng : "位置はまだ決まっていません");
        body.appendChild(readout);

        function markHere() {
          mini.setPins([{ id: draft.id, lat: draft.lat, lng: draft.lng, name: draft.name || "ここ", _color: "#D2564B" }], draft.id);
          readout.textContent = "いまの位置: " + draft.lat + ", " + draft.lng
            + (draft._geo ? "（" + draft._geo.title + " ／ " + draft._geo.precision + "）" : "");
        }

        mini = window.createToubuMap(box, {
          districts: DISTRICTS,
          onPick: function (ll) {
            draft.lat = +ll.lat.toFixed(6); draft.lng = +ll.lng.toFixed(6);
            draft._geo = null;      // 手で置いたので、住所から引いた印は消す
            markHere();
          }
        });
        mini.setSchematic(true);    // 7地区の図で選ぶ
        mini.setPickMode(true);
        if (draft.lat) { markHere(); mini.focus(draft.lat, draft.lng, 2.6); }

        // 住所を直してから引き直せるように
        var again = el("div", "geo-again");
        var gi = input(draft.address, "住所を入れて探す");
        var gb = el("button", "btn small", "住所から探す");
        gb.addEventListener("click", function () {
          var v = gi.value.trim();
          if (!v) { toast("住所を入れてください。"); return; }
          draft.address = v;
          gb.disabled = true; gb.textContent = "探しています…";
          geocode(v, function (hit) {
            gb.disabled = false; gb.textContent = "住所から探す";
            if (!hit) { toast("その住所は見つかりませんでした。地図をタップして置いてください。"); return; }
            draft.lat = hit.lat; draft.lng = hit.lng; draft._geo = hit;
            markHere(); mini.focus(hit.lat, hit.lng, 3.2);
          });
        });
        again.appendChild(gi); again.appendChild(gb);
        body.insertBefore(again, box);
        body.appendChild(el("p", "hint",
          "住所から探した点は、番地まで当たらないことがあります（町の代表点）。ずれていたら地図をタップして直してください。"));

        nav("つぎへ", function () {
          if (draft.lat === null) { toast("地図をタップして位置を決めてください。"); return; }
          step = 2; render();
        });
        return;
      }

      if (step === 2) {
        var wrap = el("div", "chip-group");
        D.categories.forEach(function (c) {
          var b = chip(c.label, draft.category === c.id, c.color);
          b.addEventListener("click", function () {
            draft.category = c.id;
            Array.prototype.forEach.call(wrap.children, function (x) { x.setAttribute && x.setAttribute("aria-pressed", "false"); });
            b.setAttribute("aria-pressed", "true");
          });
          wrap.appendChild(b);
        });
        body.appendChild(field("どの種類ですか", "ひとつ選んでください。", wrap));
        nav("つぎへ", function () {
          if (!draft.category) { toast("種類を選んでください。"); return; }
          step = 3; render();
        });
        return;
      }

      if (step === 3) {
        var nm = input(draft.name, "例：〇〇カフェ／〇〇デイサービス");
        body.appendChild(field("名前（タイトル） ＊必須", "地図と一覧に、いちばん大きく出ます。", nm));

        var ad = input(draft.address, "奈良市…");
        body.appendChild(field("住所 ＊必須", "番地まで書けると、地図の位置が正確になります。", ad));

        var g1 = el("div", "grid2");
        var te = input(draft.tel, "0742-00-0000", "tel");
        var em = input(draft.email, "info@example.jp");
        g1.appendChild(field("電話番号", "公表している代表番号を書いてください。", te));
        g1.appendChild(field("メールアドレス", "任意です。", em));
        body.appendChild(g1);

        var g2 = el("div", "grid2");
        var cp = input(draft.contactPerson, "例：地域包括支援センター 相談担当");
        var ch = input(draft.contactHours, "例：平日 9:00〜17:00");
        g2.appendChild(field("窓口の名前", "個人名ではなく、係や役職で書いてください。", cp));
        g2.appendChild(field("受付時間", null, ch));
        body.appendChild(g2);
        var hours = input(draft.hours, "例：平日9:00〜17:00／土日祝休み");
        body.appendChild(field("営業時間・休業日", "カフェの開催日時は下の頻度・曜日・時間でも登録できます。", hours));

        var areaWrap = el("div", "chip-group");
        D.districts.forEach(function (a) {
          var b = chip(a, draft.areas.indexOf(a) >= 0);
          b.addEventListener("click", function () {
            var i = draft.areas.indexOf(a);
            if (i >= 0) draft.areas.splice(i, 1); else draft.areas.push(a);
            b.setAttribute("aria-pressed", i >= 0 ? "false" : "true");
          });
          areaWrap.appendChild(b);
        });
        body.appendChild(field("どの地区の人が使えますか ＊必須", "7地区から1つ以上選んでください（複数可）。", areaWrap));

        /* いつ開くか。押して選ぶだけにする（頻度の選択肢は無くした）。 */
        var when = el("div", "when");
        var sc0 = draft.schedule || {};
        var pick = {
          weekdays: (weekdaysOf(draft) || []).slice(),
          nth: sc0.nth || null,
          date: sc0.date || "",
          start: sc0.start || "",
          end: sc0.end || "",
          daily: sc0.freq === "daily",
          irregular: sc0.freq === "irregular"
        };

        // 曜日（押して選ぶ・複数可）
        var wdRow = el("div", "chip-group when-days");
        WEEK.forEach(function (w, i) {
          var b = chip(w, pick.weekdays.indexOf(i) >= 0);
          b.addEventListener("click", function () {
            var at = pick.weekdays.indexOf(i);
            if (at >= 0) pick.weekdays.splice(at, 1); else pick.weekdays.push(i);
            pick.daily = false; pick.irregular = false;
            b.setAttribute("aria-pressed", at >= 0 ? "false" : "true");
            syncWhen();
          });
          wdRow.appendChild(b);
        });
        when.appendChild(field("開く曜日", "あてはまるものを押してください（いくつでも）。", wdRow));

        // 毎週 / 第何週（押して選ぶ・ひとつだけ）
        var nthRow = el("div", "chip-group when-nth");
        [["", "毎週"], ["1", "第1"], ["2", "第2"], ["3", "第3"], ["4", "第4"], ["5", "第5"]]
          .forEach(function (o) {
            var b = chip(o[1], String(pick.nth || "") === o[0]);
            b.addEventListener("click", function () {
              pick.nth = o[0] ? Number(o[0]) : null;
              Array.prototype.forEach.call(nthRow.children, function (x) {
                if (x.setAttribute) x.setAttribute("aria-pressed", "false");
              });
              b.setAttribute("aria-pressed", "true");
              syncWhen();
            });
            nthRow.appendChild(b);
          });
        when.appendChild(field("どの週", "毎月第◯週だけのときは、その週を選んでください。", nthRow));

        // 時間（時計の入力欄）
        var timeRow = el("div", "when-time");
        var t1 = input(pick.start, "", "time");
        var t2 = input(pick.end, "", "time");
        timeRow.appendChild(t1);
        timeRow.appendChild(el("span", "when-tilde", "〜"));
        timeRow.appendChild(t2);
        when.appendChild(field("時間", null, timeRow));

        // 毎日／不定期／日付指定
        var otherRow = el("div", "chip-group when-other");
        var bDaily = chip("毎日", pick.daily);
        bDaily.addEventListener("click", function () {
          pick.daily = !pick.daily;
          if (pick.daily) { pick.irregular = false; pick.weekdays = []; pick.nth = null; syncChipRows(); }
          bDaily.setAttribute("aria-pressed", String(pick.daily)); syncWhen();
        });
        var bIrr = chip("不定期", pick.irregular);
        bIrr.addEventListener("click", function () {
          pick.irregular = !pick.irregular;
          if (pick.irregular) { pick.daily = false; pick.weekdays = []; pick.nth = null; syncChipRows(); }
          bIrr.setAttribute("aria-pressed", String(pick.irregular)); syncWhen();
        });
        otherRow.appendChild(bDaily); otherRow.appendChild(bIrr);
        when.appendChild(field("そのほか", null, otherRow));

        var eventDate = input(pick.date, "", "date");
        when.appendChild(field("日付が決まっている催しのとき", "1日だけの催しは、ここに日付を入れてください。", eventDate));

        var whenNote = el("p", "when-preview");
        when.appendChild(whenNote);
        body.appendChild(when);

        function syncChipRows() {
          Array.prototype.forEach.call(wdRow.children, function (b, i) {
            if (b.setAttribute) b.setAttribute("aria-pressed", String(pick.weekdays.indexOf(i) >= 0));
          });
          Array.prototype.forEach.call(nthRow.children, function (b, i) {
            if (b.setAttribute) b.setAttribute("aria-pressed", String((i === 0 && !pick.nth) || String(pick.nth) === String(i)));
          });
        }
        /* いま何を選んだのか、文にして見せる */
        function buildSchedule() {
          pick.start = t1.value; pick.end = t2.value; pick.date = eventDate.value;
          if (pick.date) return { freq: "once", date: pick.date, start: pick.start || undefined, end: pick.end || undefined };
          if (pick.daily) return { freq: "daily", start: pick.start || undefined, end: pick.end || undefined };
          if (pick.weekdays.length) {
            return {
              freq: pick.nth ? "monthly_nth" : "weekly",
              weekday: pick.weekdays.slice().sort(),
              nth: pick.nth || undefined,
              start: pick.start || undefined, end: pick.end || undefined
            };
          }
          if (pick.irregular) return { freq: "irregular", start: pick.start || undefined, end: pick.end || undefined };
          return null;
        }
        function syncWhen() {
          var sc = buildSchedule();
          whenNote.textContent = sc ? "こう出ます： " + scheduleText({ schedule: sc })
                                    : "開催日時の指定はありません（「お問い合わせください」と出ます）";
        }
        t1.addEventListener("change", syncWhen);
        t2.addEventListener("change", syncWhen);
        eventDate.addEventListener("change", syncWhen);
        syncWhen();

        var g5 = el("div", "grid2");
        var tg = input(draft.target, "例：65歳以上の方");
        var fee = input(draft.fee, "例：ドリンク100円");
        g5.appendChild(field("対象", null, tg));
        g5.appendChild(field("料金", null, fee));
        body.appendChild(g5);

        var note = document.createElement("textarea");
        note.value = draft.note; note.placeholder = "そのほか伝えたいこと（送迎の有無、駐車場、持ち物など）";
        body.appendChild(field("備考", null, note));

        nav("つぎへ", function () {
          if (!nm.value.trim()) { toast("名前を入れてください。"); return; }
          if (!ad.value.trim()) { toast("住所を入れてください。"); return; }
          if (!draft.areas.length) { toast("利用できる地区を1つ以上選んでください。"); return; }
          if (pick.nth && !pick.weekdays.length) { toast("第◯週を選んだときは、曜日も選んでください。"); return; }
          draft.name = nm.value.trim(); draft.address = ad.value.trim();
          draft.tel = te.value.trim(); draft.email = em.value.trim();
          draft.contactPerson = cp.value.trim(); draft.contactHours = ch.value.trim();
          draft.hours = hours.value.trim();
          draft.target = tg.value.trim(); draft.fee = fee.value.trim(); draft.note = note.value.trim();
          var built = buildSchedule();
          if (built && draft.schedule && draft.schedule.note) built.note = draft.schedule.note;
          draft.schedule = built;
          step = 4; render();
        });
        return;
      }

      if (step === 4) {
        var fi = document.createElement("input");
        fi.type = "file"; fi.accept = "image/*"; fi.multiple = true;
        var strip = el("div", "photo-strip");
        function drawStrip() {
          strip.innerHTML = "";
          draft.photos.forEach(function (p, i) {
            var fig = document.createElement("figure");
            var im = document.createElement("img"); im.src = p.src; im.alt = p.alt || "登録する写真";
            fig.appendChild(im);
            var cap = input(p.caption, "ひとこと説明");
            cap.addEventListener("input", function () { p.caption = cap.value; });
            fig.appendChild(cap);
            var alt = input(p.alt, "読み上げ用の説明");
            alt.addEventListener("input", function () { p.alt = alt.value; });
            fig.appendChild(alt);
            var rm = el("button", "btn small danger", "けす");
            rm.addEventListener("click", function () { draft.photos.splice(i, 1); drawStrip(); });
            fig.appendChild(rm);
            strip.appendChild(fig);
          });
        }
        drawStrip();
        fi.addEventListener("change", function () {
          var files = Array.prototype.slice.call(fi.files);
          if (draft.photos.length + files.length > 5) { toast("写真は5枚までです。"); return; }
          files.forEach(function (f2) { readPhoto(f2, function (p) { draft.photos.push(p); drawStrip(); }); });
        });
        body.appendChild(field("写真（5枚まで）",
          "撮影位置の情報（EXIF）は取り込むときに消しています。顔がわかる写真は、写っている方の同意を得たものだけにしてください。", fi));
        body.appendChild(strip);

        var lw = el("div");
        function drawLinks() {
          lw.innerHTML = "";
          draft.links.forEach(function (l, i) {
            var r2 = el("div", "linkrow");
            var sel = document.createElement("select");
            ["公式サイト", "申込・予約", "SNS", "チラシ・資料", "地図"].forEach(function (t) {
              var o = document.createElement("option"); o.value = t; o.textContent = t;
              if (l.label === t) o.selected = true; sel.appendChild(o);
            });
            sel.addEventListener("change", function () { l.label = sel.value; });
            var u = input(l.url, "https://…", "url");
            u.addEventListener("input", function () { l.url = u.value; });
            var rm = el("button", "btn small danger", "けす");
            rm.addEventListener("click", function () { draft.links.splice(i, 1); drawLinks(); });
            r2.appendChild(sel); r2.appendChild(u); r2.appendChild(rm);
            lw.appendChild(r2);
          });
          var add = el("button", "btn small", "＋ リンクを足す");
          add.addEventListener("click", function () { draft.links.push({ label: "公式サイト", url: "" }); drawLinks(); });
          lw.appendChild(add);
        }
        drawLinks();
        body.appendChild(field("リンク", "http:// か https:// で始まるものだけ登録できます。", lw));

        nav("確認する", function () {
          if (draft.links.some(function (l) { return l.url.trim() && !safeURL(l.url); })) { toast("リンクは http:// または https:// で入力してください。"); return; }
          draft.links = draft.links.filter(function (l) { return safeURL(l.url); });
          step = 5; render();
        });
        return;
      }

      if (step === 5) {
        var prev = el("div", "preview-card");
        prev.appendChild(el("div", "cat", (CATS[draft.category] || {}).label));
        prev.appendChild(el("h3", null, draft.name));
        if (draft.address) prev.appendChild(row(IC.place, draft.address));
        if (draft.tel) prev.appendChild(row(IC.tel, draft.tel));
        if (draft.email) prev.appendChild(el("div", "row", draft.email));
        if (draft.contactPerson) prev.appendChild(el("div", "row", "窓口: " + draft.contactPerson + (draft.contactHours ? "（" + draft.contactHours + "）" : "")));
        if (draft.areas.length) prev.appendChild(el("div", "row", "提供地域: " + draft.areas.join("・")));
        var s = scheduleText(draft); if (s) prev.appendChild(row(IC.clock, s));
        if (draft.hours) prev.appendChild(row(IC.clock, draft.hours));
        if (draft.target) prev.appendChild(el("div", "row", "対象: " + draft.target));
        if (draft.fee) prev.appendChild(row(IC.yen, draft.fee));
        if (draft.note) prev.appendChild(el("div", "row", draft.note));
        if (draft.photos.length) prev.appendChild(el("div", "row", "写真 " + draft.photos.length + " 枚"));
        if (draft.links.length) prev.appendChild(el("div", "row", "リンク " + draft.links.length + " 件"));
        prev.appendChild(el("div", "row", "位置: " + draft.lat + ", " + draft.lng));
        body.appendChild(field("この内容で登録します",
          "承認のしくみはまだありません。いまは自分の端末に保存され、ファイルとして書き出せます。", prev));

        foot.innerHTML = "";
        var back = el("button", "btn", "もどる");
        back.addEventListener("click", function () { step = 4; render(); });
        foot.appendChild(back);
        var out = el("button", "btn", "申請ファイルを書き出す");
        out.addEventListener("click", function () { download("shinsei-" + draft.id + ".json", JSON.stringify(draft, null, 2)); });
        foot.appendChild(out);
        var save = el("button", "btn primary", "保存して地図に出す");
        save.addEventListener("click", function () {
          if (coords[draft.id]) {
            var nextCoords = Object.assign({}, coords); delete nextCoords[draft.id];
            if (!lsSet(LS_COORDS, nextCoords)) return; coords = nextCoords;
          }
          draft.updated = today(); draft.updatedBy = "この端末の登録者";
          var nextDrafts = drafts.filter(function (d) { return d.id !== draft.id; }).concat([draft]);
          if (!lsSet(LS_DRAFTS, nextDrafts)) return;
          drafts = nextDrafts;
          var i2 = items.findIndex(function (x) { return x.id === draft.id; });
          var obj = Object.assign({}, draft, { isDraft: true, _color: (CATS[draft.category] || {}).color });
          if (i2 >= 0) items[i2] = obj; else items.push(obj);
          state.cats.clear(); state.areas.clear(); state.days.clear(); state.q = ""; state.today = false;
          document.getElementById("q").value = "";
          document.getElementById("btn-today").setAttribute("aria-pressed", "false");
          closeModal(); refresh(); select(draft.id);
          toast("この端末に保存し、地図に反映しました。");
        });
        foot.appendChild(save);
        return;
      }
    }
    render();
  }

  /* ---------------- ボタン ---------------- */
  document.getElementById("btn-basemap").addEventListener("click",function(){var on=this.getAttribute("aria-pressed")!=="true";this.setAttribute("aria-pressed",String(on));this.textContent=on?"広域地図に戻る":"7地区の概略図に切替";document.getElementById("map-mode-label").textContent=on?"概略図：行政境界ではありません":"広域地図：伊賀・木津川なども表示";map.setSchematic(on);});
  document.getElementById("quick-category").addEventListener("change", function () {
    state.cats.clear(); if (this.value) state.cats.add(this.value); refresh();
  });
  document.getElementById("btn-cafe").addEventListener("click", function () {
    var active = state.cats.has("cafe"); state.cats.clear();
    if (!active) state.cats.add("cafe");
    refresh();
  });
  document.getElementById("q").addEventListener("input", function (e) { state.q = e.target.value; refresh(); });
  document.getElementById("btn-today").addEventListener("click", function () {
    state.today = !state.today;
    this.setAttribute("aria-pressed", state.today ? "true" : "false");
    refresh();
  });
  var $fp = document.getElementById("filterpanel");
  document.getElementById("btn-filters").addEventListener("click", function () {
    var open = $fp.hidden;
    $fp.hidden = !open;
    this.setAttribute("aria-expanded", open ? "true" : "false");
  });
  // 種類の選択は画面幅によらず「探す条件」の中に置く。

  /* スマホの一覧は下から引き上げるシート。つまみを掴んで高さを変える。 */
  (function () {
    var panel = document.getElementById("panel");
    var grip = panel.querySelector(".sheet-grip");
    if (!grip) return;
    var SNAP = [0.26, 0.55, 0.88];      // 画面の高さに対する割合
    var idx = 0, dragging = false, startY = 0, startH = 0;

    function setSnap(i) {
      idx = Math.max(0, Math.min(SNAP.length - 1, i));
      setHeight((SNAP[idx] * 100) + "dvh");
    }
    // 地図の操作ボタンがシートの上に乗るよう、高さを :root にも伝える
    function setHeight(v) {
      panel.style.setProperty("--sheet", v);
      document.documentElement.style.setProperty("--sheet", v);
    }
    grip.addEventListener("click", function () { setSnap(idx >= SNAP.length - 1 ? 0 : idx + 1); });
    grip.addEventListener("pointerdown", function (e) {
      if (window.innerWidth > 900) return;
      dragging = true; startY = e.clientY; startH = panel.getBoundingClientRect().height;
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var h = Math.max(80, Math.min(window.innerHeight * 0.92, startH - (e.clientY - startY)));
      setHeight(h + "px");
    });
    grip.addEventListener("pointerup", function (e) {
      if (!dragging) return;
      dragging = false;
      try { grip.releasePointerCapture(e.pointerId); } catch (err) { }
      var ratio = panel.getBoundingClientRect().height / window.innerHeight;
      var best = 0, diff = Infinity;
      SNAP.forEach(function (v, i) { if (Math.abs(v - ratio) < diff) { diff = Math.abs(v - ratio); best = i; } });
      setSnap(best);
    });
    setSnap(0);
  })();

  document.getElementById("btn-register").addEventListener("click", function () { openRegister(null); });
  document.getElementById("btn-unmapped").addEventListener("click", function () {
    var m = openModal("固定所在地なし・位置未確認の資源", "巡回・配達サービスは提供地区で確認できます。位置未確認の資源は詳細から地図に指定できます。");
    items.filter(function (r) { return !hasPin(r); }).forEach(function (r) {
      var b = el("button", "btn cluster-resource", r.name + " ／ " + (r.noPin ? "固定所在地なし" : "位置未確認") + " ／ " + r.areas.join("・"));
      b.addEventListener("click", function () { closeModal(); select(r.id); }); m.appendChild(b);
    });
  });
  document.getElementById("btn-pending").addEventListener("click", openPending);
  document.getElementById("btn-print").addEventListener("click", function () { window.print(); });
  document.getElementById("btn-mapfit").addEventListener("click", function () { map.reset(); });
  document.getElementById("zoom-in").addEventListener("click", function () { map.zoomBy(1.3); });
  document.getElementById("zoom-out").addEventListener("click", function () { map.zoomBy(1 / 1.3); });
  document.getElementById("btn-reset").addEventListener("click", function () {
    state.cats.clear(); state.areas.clear(); state.days.clear();
    state.q = ""; state.today = false; state.sel = null;
    document.getElementById("q").value = "";
    document.getElementById("btn-today").setAttribute("aria-pressed", "false");
    syncChips(); $detail.hidden = true; refresh(); map.reset();
  });

  /* ---------------- 起動 ---------------- */
  document.querySelectorAll("[data-purpose]").forEach(function (b) {
    b.addEventListener("click", function () { state.cats = new Set(PURPOSES[b.dataset.purpose]); refresh(); });
  });
  document.getElementById("btn-show-results").addEventListener("click", function () {
    document.getElementById("search-options").open = false;
    var panel = document.getElementById("panel");
    panel.focus({preventScroll:true});
    panel.scrollIntoView({block:"start"});
  });
  document.getElementById("btn-edit-conditions").addEventListener("click", function () {
    var options = document.getElementById("search-options");
    options.open = true;
    options.querySelector("summary").focus();
    options.scrollIntoView({block:"start"});
  });
  document.getElementById("btn-all-purpose").addEventListener("click", function () { state.cats.clear(); refresh(); });
  document.getElementById("btn-all-areas").addEventListener("click", function () { state.areas.clear(); refresh(); });
  document.getElementById("btn-view-list").addEventListener("click", function () { setView("list"); });
  document.getElementById("btn-view-map").addEventListener("click", function () { setView("map"); });
  document.getElementById("btn-clear").addEventListener("click", function () { document.getElementById("btn-reset").click(); });
  $detail.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); select(null); }
    if (e.key === "Tab") {
      var focusable = Array.from($detail.querySelectorAll("button, a[href], summary, input, select, textarea")).filter(function(n) { return n.getClientRects().length && !n.disabled; });
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  readURL();
  if (state.cats.size || state.areas.size || state.q || state.sel || state.today || state.days.size) document.getElementById("search-options").open = false;
  document.getElementById("q").value = state.q;
  document.getElementById("btn-today").setAttribute("aria-pressed", state.today ? "true" : "false");
  buildChips();
  syncChips();
  renderList();

  // 最初は7地区の概略図を出す（切替ボタンは「広域地図に戻る」から始まる）
  var $basemap = document.getElementById("btn-basemap");
  $basemap.setAttribute("aria-pressed", "true");
  $basemap.textContent = "広域地図に戻る";
  document.getElementById("map-mode-label").textContent = "概略図：行政境界ではありません";
  map.setSchematic(true);
  updatePendingCount();
  window.addEventListener("hashchange",function () {
    // 同じ検索ページ内のリンクでも、URLと一覧の条件を一致させる。
    readURL();
    var nextSelection = state.sel;
    document.getElementById("q").value = state.q;
    document.getElementById("btn-today").setAttribute("aria-pressed",String(state.today));
    syncChips();
    select(null);
    if (nextSelection) select(nextSelection);
    else {
      document.getElementById("search-options").open = false;
      setView("list");
      document.getElementById("search-summary").scrollIntoView({block:"start"});
    }
  });
  document.getElementById("search-back").addEventListener("click",function (event) {
    try {
      var ref = new URL(document.referrer);
      if (ref.origin === location.origin && /\/(about|index|map)\.html$/.test(ref.pathname) && history.length > 1) {event.preventDefault();history.back();}
    } catch (error) { /* 直接開いた場合はホームへ戻る */ }
  });
  setView("list");
  if (state.sel) select(state.sel);
  else if (!document.getElementById("search-options").open) {
    // ホームで選んだ内容の結果から読み始められるようにする。
    requestAnimationFrame(function () {
      var summary = document.getElementById("search-summary");
      summary.focus({preventScroll:true});
      summary.scrollIntoView({block:"start"});
    });
  }
})();
