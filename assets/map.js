/* 東部地域マップ
 *
 * 東部7地区を強調し、伊賀・木津川などを含む全資源の座標まで表示する。
 *
 *   実データ
 *     - 枠のかたち   … 提供された東部地域図をトレース（data/boundary.js）
 *     - 資源の位置   … data/resources.js の lat / lng（国土地理院の住所検索で取得）
 *     - 地区名の位置 … 図のラベル位置を同じ変換で緯度経度に移したもの
 *
 *   注意
 *     - 枠は概略であって、測量に基づく行政境界ではない。
 *     - 東部の外にある事業所も、登録された緯度経度に置く。
 */
(function () {
  "use strict";

  var BD = window.TOUBU_BOUNDARY || { ring: [], labels: {} };
  var RING = BD.ring || [];

  /* --- 表示範囲は枠から決める（＝東部だけが映る） --- */
  function bboxOf(ring) {
    var w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
    ring.forEach(function (p) {
      if (p[0] < w) w = p[0];
      if (p[0] > e) e = p[0];
      if (p[1] < s) s = p[1];
      if (p[1] > n) n = p[1];
    });
    return { w: w, e: e, s: s, n: n };
  }
  var RESOURCE_POINTS = ((window.TOUBU_DATA || {}).resources || []).filter(function (r) { return Number.isFinite(r.lat) && Number.isFinite(r.lng); }).map(function (r) { return [r.lng, r.lat]; });
  var ALL = RING.concat(BD.outside || [], RESOURCE_POINTS);
  var RB = ALL.length ? bboxOf(ALL) : { w: 135.75, e: 136.10, s: 34.57, n: 34.76 };
  var PAD_LNG = (RB.e - RB.w) * 0.04;
  var PAD_LAT = (RB.n - RB.s) * 0.06;
  var BBOX = { w: RB.w - PAD_LNG, e: RB.e + PAD_LNG, s: RB.s - PAD_LAT, n: RB.n + PAD_LAT };

  function mercY(lat) {
    var s = Math.sin(lat * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  }
  function mercYInv(y) {
    var n = Math.PI * (1 - 2 * y);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }
  function mercX(lng) { return (lng + 180) / 360; }
  function mercXInv(x) { return x * 360 - 180; }

  var MX0 = mercX(BBOX.w), MX1 = mercX(BBOX.e);
  var MY0 = mercY(BBOX.n), MY1 = mercY(BBOX.s);
  var VW = 1000;
  var VH = Math.round(VW * (MY1 - MY0) / (MX1 - MX0));

  function centroidOf(ring) {
    var x = 0, y = 0, n = ring.length;
    ring.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / n, y / n];
  }

  function svg(tag, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    return e;
  }

  var uid = 0;

  window.createToubuMap = function (container, opts) {
    opts = opts || {};
    var onPick = opts.onPick || null, onSelect = opts.onSelect || null;
    var onHover = opts.onHover || null;
    var view = { k: 1, tx: 0, ty: 0 };
    var pickMode = false;
    var pins = [], selectedId = null, hoveredId = null;
    var nodeById = {};
    var myId = "tb" + (++uid);

    var root = svg("svg", {
      viewBox: "0 0 " + VW + " " + VH, class: "dmap",
      preserveAspectRatio: "xMidYMid meet"
    });
    root.setAttribute("role", "application");
    root.setAttribute("aria-label", "奈良市東部地域の地図");
    container.appendChild(root);

    var schematic = false;
    var popup = document.createElement("section"); popup.className = "map-preview"; popup.hidden = true;
    popup.setAttribute("aria-label", "選んだ地点の地域資源"); container.appendChild(popup);

    /* 地点カードの見出し帯。ここを掴んで動かす。小さくする／閉じるもここに置く。 */
    var pvBar = document.createElement("div"); pvBar.className = "preview-bar";
    var pvGrip = document.createElement("span"); pvGrip.className = "preview-grip"; pvGrip.textContent = "⠿";
    pvGrip.setAttribute("aria-hidden", "true");
    var pvTitle = document.createElement("span"); pvTitle.className = "preview-title";
    var pvMin = document.createElement("button"); pvMin.className = "preview-min"; pvMin.type = "button";
    pvMin.textContent = "−"; pvMin.title = "小さくする"; pvMin.setAttribute("aria-label", "小さくする");
    var pvClose = document.createElement("button"); pvClose.className = "preview-close"; pvClose.type = "button";
    pvClose.textContent = "×"; pvClose.title = "閉じる"; pvClose.setAttribute("aria-label", "地点の情報を閉じる");
    pvBar.appendChild(pvGrip); pvBar.appendChild(pvTitle); pvBar.appendChild(pvMin); pvBar.appendChild(pvClose);
    var pvBody = document.createElement("div"); pvBody.className = "preview-body";
    popup.appendChild(pvBar); popup.appendChild(pvBody);

    pvMin.addEventListener("click", function () {
      var小 = popup.classList.toggle("collapsed");
      pvMin.textContent =小 ? "＋" : "−";
      pvMin.title =小 ? "元の大きさに戻す" : "小さくする";
      pvMin.setAttribute("aria-label", pvMin.title);
    });

    /* 見出し帯をドラッグして好きな位置へ。動かしたら以後はその位置に留める。 */
    (function () {
      var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
      pvBar.addEventListener("pointerdown", function (e) {
        if (e.target.closest("button")) return;
        var box = popup.getBoundingClientRect(), base = container.getBoundingClientRect();
        popup.style.right = "auto"; popup.style.bottom = "auto";
        popup.style.left = (box.left - base.left) + "px";
        popup.style.top = (box.top - base.top) + "px";
        ox = box.left - base.left; oy = box.top - base.top;
        sx = e.clientX; sy = e.clientY; dragging = true;
        popup.classList.add("dragging"); pvBar.setPointerCapture(e.pointerId);
      });
      pvBar.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var base = container.getBoundingClientRect(), box = popup.getBoundingClientRect();
        var x = ox + (e.clientX - sx), y = oy + (e.clientY - sy);
        // 画面の外へ出て戻せなくならないよう、端で止める
        x = Math.max(4, Math.min(base.width - box.width - 4, x));
        y = Math.max(4, Math.min(base.height - 40, y));
        popup.style.left = x + "px"; popup.style.top = y + "px";
      });
      pvBar.addEventListener("pointerup", function (e) {
        dragging = false; popup.classList.remove("dragging");
        try { pvBar.releasePointerCapture(e.pointerId); } catch (err) { }
      });
    })();
    var status = document.createElement("div"); status.className = "tile-status"; status.setAttribute("role", "status"); container.appendChild(status);
    var attribution = document.createElement("a"); attribution.className = "map-attribution";
    attribution.href = "https://maps.gsi.go.jp/development/ichiran.html";
    attribution.target = "_blank"; attribution.rel = "noopener noreferrer"; attribution.textContent = "出典：国土地理院"; container.appendChild(attribution);
    var defs = svg("defs");
    root.appendChild(defs);

    var gWorld = svg("g", { class: "dmap-world" });
    root.appendChild(gWorld);

    var gTiles = svg("g", {class: "dmap-tiles", "pointer-events": "none"}); gWorld.appendChild(gTiles);
    var gRegion = svg("g", { class: "dmap-region" });
    var gLabels = svg("g", { class: "dmap-labels" });
    var gRim = svg("g", { class: "dmap-rim" });
    var gPins = svg("g", { class: "dmap-pins" });
    gWorld.appendChild(gRegion); gWorld.appendChild(gLabels);
    gWorld.appendChild(gRim); gWorld.appendChild(gPins);

    function proj(lng, lat) {
      return [(mercX(lng) - MX0) / (MX1 - MX0) * VW, (mercY(lat) - MY0) / (MY1 - MY0) * VH];
    }
    function unproj(x, y) {
      return {
        lng: mercXInv(MX0 + (x / VW) * (MX1 - MX0)),
        lat: mercYInv(MY0 + (y / VH) * (MY1 - MY0))
      };
    }

    /* 枠の内側かどうかは、トレースした形そのもので判定する */
    function inside(lat, lng) {
      if (!RING.length) return false;
      var c = false;
      for (var i = 0, j = RING.length - 1; i < RING.length; j = i++) {
        var xi = RING[i][0], yi = RING[i][1], xj = RING[j][0], yj = RING[j][1];
        if (((yi > lat) !== (yj > lat)) &&
            (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) c = !c;
      }
      return c;
    }

    /* ---- 面を描く ---- */
    function dOf(ll) {
      return ll.map(function (p, i) {
        var q = proj(p[0], p[1]);
        return (i ? "L" : "M") + q[0].toFixed(1) + "," + q[1].toFixed(1);
      }).join("") + "Z";
    }

    // 1) 東部地域の外（奈良市西部・中心部）。位置関係を示すための背景で、目立たせない。
    if ((BD.outside || []).length) {
      var od = dOf(BD.outside);
      gRegion.appendChild(svg("path", { d: od, class: "dmap-outside-fill" }));
      gRegion.appendChild(svg("path", { d: od, class: "dmap-outside-edge" }));
      // 左のパネルに隠れないよう、面の東寄りに置く
      var ob = bboxOf(BD.outside);
      var oc = centroidOf(BD.outside);
      var op = proj(ob.w + (ob.e - ob.w) * 0.84, oc[1]);
      var ot = svg("text", {
        x: op[0].toFixed(1), y: op[1].toFixed(1), "text-anchor": "middle",
        class: "dmap-outside-label"
      });
      ot.textContent = "東部地域外";
      gRegion.appendChild(ot);
      var ot2 = svg("text", {
        x: op[0].toFixed(1), y: (op[1] + 20).toFixed(1), "text-anchor": "middle",
        class: "dmap-outside-sub"
      });
      ot2.textContent = "（奈良市 西部・中心部）";
      gRegion.appendChild(ot2);
    }

    // 2) 東部地域。ここを目立たせる。
    var ringD = RING.length ? dOf(RING) : "";
    if (RING.length) {
      gRegion.appendChild(svg("path", { d: ringD, class: "dmap-region-shadow" }));
      gRegion.appendChild(svg("path", { d: ringD, class: "dmap-region-fill" }));
    }

    // 3) 7地区の区切り（目安）
    var DIST = BD.districts || {};
    var toneOf = {};
    Object.keys(DIST).forEach(function (nm, i) { toneOf[nm] = i % 5; });
    Object.keys(DIST).forEach(function (nm) {
      var g = svg("g", { class: "dmap-district", "data-area": nm, tabindex: "0", role: "button" });
      g.setAttribute("aria-label", nm + "地区");
      g.appendChild(svg("path", { d: dOf(DIST[nm]), class: "dmap-district-fill tone" + toneOf[nm] }));
      g.appendChild(svg("path", { d: dOf(DIST[nm]), class: "dmap-district-edge" }));
      g.addEventListener("click", function (e) { e.stopPropagation(); if (opts.onArea) opts.onArea(nm); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" && opts.onArea) opts.onArea(nm); });
      gRegion.appendChild(g);
    });

    // 4) 東部地域の外わくを最後にもう一度、太く
    if (RING.length) {
      gRegion.appendChild(svg("path", { d: ringD, class: "dmap-region-edge" }));
    }

    /* ---- 地区名 ---- */
    Object.keys(BD.labels || {}).forEach(function (nm) {
      var ll = BD.labels[nm];
      var p = proj(ll[0], ll[1]);
      var g = svg("g", { class: "dmap-arealabel", "data-area": nm, tabindex: "0", role: "button" });
      g.setAttribute("aria-label", nm + "地区");
      var t = svg("text", { x: p[0].toFixed(1), y: p[1].toFixed(1), "text-anchor": "middle", class: "dmap-label" });
      t.textContent = nm;
      g.appendChild(t);
      g.addEventListener("click", function (e) { e.stopPropagation(); if (opts.onArea) opts.onArea(nm); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" && opts.onArea) opts.onArea(nm); });
      gLabels.appendChild(g);
    });

    var gRealLabels = svg("g", {class: "real-district-labels"}); gWorld.insertBefore(gRealLabels, gPins);
    Object.keys(opts.districts || {}).forEach(function (name) {
      var d = opts.districts[name], p = proj(d.lng, d.lat);
      var label = svg("text", {x:p[0], y:p[1] - 28, class:"real-district", "data-area":name});
      label.textContent = name; gRealLabels.appendChild(label);
    });
    var tileNodes = new Map(), tileTimer = null, tileFailures = new Set();
    function drawTiles() {
      if (schematic || !root.getScreenCTM()) return;
      var rect = root.getBoundingClientRect(); if (!rect.width || !rect.height) return;
      var scale = Math.min(rect.width / VW, rect.height / VH) * view.k;
      var z = Math.min(17, Math.max(8, Math.ceil(Math.log2(scale * VW / ((MX1 - MX0) * 256)))));
      var n = Math.pow(2,z);
      var p0 = root.createSVGPoint(); p0.x=rect.left; p0.y=rect.top;
      var p1 = root.createSVGPoint(); p1.x=rect.right; p1.y=rect.bottom;
      var inv = gWorld.getScreenCTM().inverse(); var a=p0.matrixTransform(inv), b=p1.matrixTransform(inv);
      var x0=Math.floor((MX0+a.x/VW*(MX1-MX0))*n), x1=Math.floor((MX0+b.x/VW*(MX1-MX0))*n);
      var y0=Math.floor((MY0+a.y/VH*(MY1-MY0))*n), y1=Math.floor((MY0+b.y/VH*(MY1-MY0))*n);
      var needed=new Set();
      for(var x=x0;x<=x1;x++) for(var y=y0;y<=y1;y++) {
        if(x<0||y<0||x>=n||y>=n) continue;
        var key=z+"/"+x+"/"+y; needed.add(key);
        if(tileNodes.has(key)) continue;
        var tile=svg("image", {x:(x/n-MX0)/(MX1-MX0)*VW, y:(y/n-MY0)/(MY1-MY0)*VH,
          width:VW/(n*(MX1-MX0))+.05, height:VH/(n*(MY1-MY0))+.05,
          href:"https://cyberjapandata.gsi.go.jp/xyz/pale/"+key+".png", "data-tile":key});
        tile.addEventListener("error", function () {tileFailures.add(this.getAttribute("data-tile")); status.textContent="背景地図を読み込めません。通信をご確認いただくか、7地区の概略図に切り替えてください。";});
        tileNodes.set(key,tile); gTiles.appendChild(tile);
      }
      tileNodes.forEach(function (tile,key) {if(!needed.has(key)){tile.remove();tileNodes.delete(key);tileFailures.delete(key);}});
      if(!tileFailures.size) status.textContent="";
    }
    function scheduleTiles(){clearTimeout(tileTimer);tileTimer=setTimeout(drawTiles,80);}
    function coverage(areas) {
      container.querySelectorAll("[data-area]").forEach(function (node) {node.classList.toggle("service-area", (areas || []).indexOf(node.getAttribute("data-area"))>=0);});
    }
    function dismissPreview(){popup.hidden=true;pvBody.innerHTML="";popup.classList.remove("collapsed");container.classList.remove("preview-open");coverage([]);container.querySelectorAll(".preview-target").forEach(function(node){node.classList.remove("preview-target");});}
    function preview(group, recenter) {
      if(pickMode) return;
      pvBody.innerHTML=""; popup.hidden=false;
      container.querySelectorAll(".preview-target").forEach(function(node){node.classList.remove("preview-target");});
      var pin=nodeById[group[0].id]; if(pin)pin.classList.add("preview-target");
      var bounds=container.getBoundingClientRect(), pos=pin ? pin.getBoundingClientRect() : bounds;
      container.classList.add("preview-open");
      popup.style.left="";popup.style.top="";popup.style.right="";popup.style.bottom="";
      if(bounds.width>600){
        // 左は地区パネル、左下は「固定所在地なし」ボタンと凡例が居るので、地点カードは右側に固定する
        popup.style.left="auto";popup.style.right="";popup.style.top="";popup.style.bottom="";
      }else{
        popup.style.left="";popup.style.right="";popup.style.top="";popup.style.bottom="";
        // Keep the tapped location above the mobile information card.
        var p=proj(group[0].lng,group[0].lat), screenScale=Math.min(bounds.width/VW,bounds.height/VH);
        var desiredY=(bounds.height*.22-(bounds.height-VH*screenScale)/2)/screenScale;
        if(recenter){view.tx=VW/2-p[0]*view.k;view.ty=desiredY-p[1]*view.k;apply();}
      }
      pvClose.onclick=dismissPreview;

      var cats={}; ((window.TOUBU_DATA || {}).categories || []).forEach(function(c){cats[c.id]=c.label;});

      /* 1件ぶんの中身 */
      function block(r){
        var section=document.createElement("div");section.className="preview-resource";
        var address=document.createElement("p"); address.className="preview-address";
        address.textContent="所在地："+(r.address || "未確認");section.appendChild(address);
        var label=document.createElement("strong");label.textContent="東部7地区のうち利用できる地区";section.appendChild(label);
        var chips=document.createElement("div");chips.className="coverage-chips";
        ((window.TOUBU_DATA || {}).districts || []).forEach(function(name){
          var chip=document.createElement("span");var eligible=(r.areas||[]).indexOf(name)>=0;
          chip.className=eligible?"eligible":"not-listed";chip.textContent=(eligible?"✓ ":"")+name;
          chip.setAttribute("aria-label",name+(eligible?"：利用可能として掲載":"：提供地区の記載なし"));chips.appendChild(chip);});
        section.appendChild(chips);
        var note=document.createElement("p");note.className="coverage-note";
        note.textContent=r.areaNote || "色付き：利用可能として掲載。灰色：記載なし（利用可否は要確認）。";section.appendChild(note);
        var more=document.createElement("button");more.className="btn primary";
        more.textContent="営業時間・連絡先など詳細を見る";
        more.onclick=function(){dismissPreview();if(onSelect)onSelect(r.id);};section.appendChild(more);
        return section;
      }

      /* --- 1件だけ --- */
      if(group.length===1){
        pvTitle.textContent=group[0].name;
        pvBody.appendChild(block(group[0]));
        coverage(group[0].areas||[]);
        return;
      }

      /* --- 複数件: どれを見るかプルダウンで選ばせる --- */
      pvTitle.textContent="ここの資源 "+group.length+"件";

      var pickWrap=document.createElement("div");pickWrap.className="preview-pick";
      var pickLabel=document.createElement("label");
      pickLabel.textContent="どれを見ますか";
      pickLabel.htmlFor="preview-pick-select";
      var sel=document.createElement("select");sel.id="preview-pick-select";
      group.forEach(function(r,i){
        var o=document.createElement("option");o.value=String(i);
        o.textContent=(i+1)+". "+r.name+(cats[r.category]?"（"+cats[r.category]+"）":"");
        sel.appendChild(o);
      });
      pickWrap.appendChild(pickLabel);pickWrap.appendChild(sel);
      pvBody.appendChild(pickWrap);

      var holder=document.createElement("div");pvBody.appendChild(holder);
      function show(i){
        var r=group[i];
        holder.innerHTML="";
        var h=document.createElement("h3");h.textContent=r.name;holder.appendChild(h);
        holder.appendChild(block(r));
        coverage(r.areas||[]);
      }
      sel.addEventListener("change",function(){show(Number(this.value));});
      show(0);


    }
    gRegion.style.display="none";gLabels.style.display="none";
    var resizeObserver=new ResizeObserver(function(){scheduleTiles();});resizeObserver.observe(container);
    container._destroyToubuMap=function(){resizeObserver.disconnect();clearTimeout(tileTimer);};
    scheduleTiles();

    /* ---- ピン ---- */
    function pinNode(r, color, isOutside, group) {
      var big = (r.id === selectedId);
      var g = svg("g", {
        class: "dmap-pin" + (isOutside ? " outside" : "")
          + (big ? " active" : "") + (r.id === hoveredId ? " hover" : ""),
        tabindex: "0", role: "button"
      });
      g.setAttribute("aria-label", r.name + " ／ " + (r.address || "所在地未確認") + " ／ 利用可能地区：" + (r.areas || []).join("・"));
      var hit = svg("circle", {cx:0,cy:-15,r:23,fill:"transparent"});g.appendChild(hit);
      if (isOutside) {
        g.appendChild(svg("circle", { cx: 0, cy: 0, r: 6.5, class: "dmap-dot", style: "fill:" + color }));
      } else {
        var s = big ? 1.5 : 1;
        g.appendChild(svg("path", {
          d: "M0 0 C-3.2 -5.6 -11 -12.4 -11 -18.4 A11 11 0 1 1 11 -18.4 C11 -12.4 3.2 -5.6 0 0 Z",
          class: "dmap-mark", style: "fill:" + color,
          transform: "scale(" + s + ")"
        }));
        g.appendChild(svg("circle", {
          cx: 0, cy: -18.4 * s, r: 4 * s, class: "dmap-mark-in"
        }));
        // 名前は数が多いと読めなくなるので、選んだ資源と、種類を絞り込んだときだけ出す
        if (big || r._showName) {
          var t2 = svg("text", {
            x: 0, y: (big ? -34 * s : -30), class: "dmap-pinlabel", "text-anchor": "middle"
          });
          t2.textContent = r.name.length > 12 ? r.name.slice(0, 11) + "…" : r.name;
          g.appendChild(t2);
        }
      }
      g.addEventListener("click", function (e) {
        e.stopPropagation(); if (moved) return;
        selectedId = r.id; drawPins();   // 選んだ印を付ける。名前はここで出る
        preview(group || [r], true);
      });
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (onSelect) onSelect(r.id); }
      });
      g.addEventListener("pointerenter", function (e) { if (e.pointerType !== "touch" && container.clientWidth > 600) preview(group || [r]); if (onHover) onHover(r.id); });
      g.addEventListener("focus", function () { preview(group || [r]); });
      g.addEventListener("pointerleave", function () { if (onHover) onHover(null); });
      return g;
    }

    /* 画面の上でこれより近いピンは、ひとつの丸にまとめる（単位は画面の px） */
    var CLUSTER_PX = 40;

    function drawPins() {
      gPins.innerHTML = ""; gRim.innerHTML = ""; nodeById = {};

      var rect = root.getBoundingClientRect();
      // world 単位 1 が画面で何 px になるか。これで「画面上の距離」を world 単位に直す。
      var pxPerUnit = rect.width ? (rect.width / VW) * view.k : view.k;
      var cell = pxPerUnit > 0 ? CLUSTER_PX / pxPerUnit : 0;

      var groups = {}, outsideCount = 0, mappedCount = 0;
      pins.forEach(function (r) {
        if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return;
        mappedCount++; if (!inside(r.lat, r.lng)) outsideCount++;
        r._p = proj(r.lng, r.lat);
        // 選んでいるものは束ねない（名前を出したいので、いつも単独で描く）
        var key = (r.id === selectedId) ? "sel:" + r.id
          : (cell > 0 ? Math.round(r._p[0] / cell) + ":" + Math.round(r._p[1] / cell)
                      : r.lat.toFixed(5) + "," + r.lng.toFixed(5));
        (groups[key] || (groups[key] = [])).push(r);
      });

      Object.keys(groups).forEach(function (key) {
        var group = groups[key];

        /* --- 1件だけ: これまでどおりのピン --- */
        if (group.length === 1) {
          var r = group[0], p = r._p;
          var node = pinNode(r, r._color || "#D93025", false, group);
          node.setAttribute("data-resource-id", r.id);
          node.setAttribute("data-lat", r.lat); node.setAttribute("data-lng", r.lng);
          node.setAttribute("transform", "translate(" + p[0].toFixed(1) + "," + p[1].toFixed(1) + ")");
          nodeById[r.id] = node;
          if (r.id === selectedId) gRim.appendChild(node); else gPins.appendChild(node);
          return;
        }

        /* --- まとまり: 丸ひとつにして数を出す --- */
        var cx = 0, cy = 0;
        group.forEach(function (x) { cx += x._p[0]; cy += x._p[1]; });
        cx /= group.length; cy /= group.length;

        // 同じ座標に重なっているだけなら、ズームしても分かれない
        var samePoint = group.every(function (x) {
          return Math.abs(x.lat - group[0].lat) < 1e-6 && Math.abs(x.lng - group[0].lng) < 1e-6;
        });

        var rad = group.length < 5 ? 13 : (group.length < 20 ? 16 : 19);
        var g = svg("g", {
          class: "dmap-cluster-pin" + (samePoint ? " same-point" : ""),
          role: "button", tabindex: "0",
          transform: "translate(" + cx.toFixed(1) + "," + cy.toFixed(1) + ")"
        });
        g.setAttribute("aria-label",
          (samePoint ? "同じ地点の資源 " : "このあたりの資源 ") + group.length + "件。押すと選べます");
        g.appendChild(svg("circle", { cx: 0, cy: 0, r: rad + 4, class: "dmap-cluster-halo" }));
        g.appendChild(svg("circle", { cx: 0, cy: 0, r: rad, class: "dmap-cluster-body" }));
        var t = svg("text", { x: 0, y: 4, "text-anchor": "middle", class: "dmap-cluster-count" });
        t.textContent = group.length;
        g.appendChild(t);

        // 押したら、まず中身を選べるようにする（拡大はカードの中のボタンから）
        function open(e) { e.stopPropagation(); preview(group, true); }
        g.addEventListener("click", open);
        g.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); }
        });
        group.forEach(function (x) { nodeById[x.id] = g; });
        gPins.appendChild(g);
      });

      if (opts.onCounts) opts.onCounts({ outside: outsideCount, inside: mappedCount - outsideCount, mapped: mappedCount });
    }

    /* ---- 表示位置 ---- */
    function apply() {
      gWorld.setAttribute("transform", "translate(" + view.tx + "," + view.ty + ") scale(" + view.k + ")");
      root.style.setProperty("--k", view.k);
      scheduleTiles();
    }
    function clientToView(ev) {
      var point = root.createSVGPoint(); point.x = ev.clientX; point.y = ev.clientY;
      var local = point.matrixTransform(gWorld.getScreenCTM().inverse());
      return { x: local.x, y: local.y };
    }

    /* 画面の座標を viewBox の座標に直す（世界の変形をかける前） */
    function toBox(cx, cy) {
      var r = root.getBoundingClientRect();
      return { x: (cx - r.left) * (VW / r.width), y: (cy - r.top) * (VH / r.height) };
    }
    function clampK(k) { return Math.min(8, Math.max(0.8, k)); }

    var pointers = new Map();          // 触れている指
    var dragging = false, moved = false, last = null;
    var pinch = null;                  // 2本指のとき
    var lastTap = 0, lastTapPos = null;

    function startPinch() {
      var pts = Array.from(pointers.values());
      var mid = toBox((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        k: view.k,
        // 指のまん中にある「世界の点」。ここを動かさないように拡大する
        wx: (mid.x - view.tx) / view.k,
        wy: (mid.y - view.ty) / view.k
      };
    }

    root.addEventListener("pointerdown", function (e) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { dragging = false; startPinch(); return; }
      if (pointers.size > 2) return;
      dragging = true; moved = false; last = { x: e.clientX, y: e.clientY };
      if (e.target === root || pickMode) root.setPointerCapture(e.pointerId);
    });

    root.addEventListener("pointermove", function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // 2本指: つまんで拡大・縮小
      if (pointers.size >= 2 && pinch) {
        var pts = Array.from(pointers.values());
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (!d) return;
        var k2 = clampK(pinch.k * (d / pinch.dist));
        var mid = toBox((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        view.k = k2;
        view.tx = mid.x - pinch.wx * k2;
        view.ty = mid.y - pinch.wy * k2;
        moved = true; apply();
        return;
      }

      // 1本指: 動かす
      if (!dragging) return;
      var rect = root.getBoundingClientRect();
      view.tx += (e.clientX - last.x) * (VW / rect.width);
      view.ty += (e.clientY - last.y) * (VH / rect.height);
      if (Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y) > 3) moved = true;
      last = { x: e.clientX, y: e.clientY };
      apply();
    });

    function endPointer(e) {
      var wasPinching = !!pinch;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size > 0) return;      // まだ指が残っている
      dragging = false;
      try { root.releasePointerCapture(e.pointerId); } catch (err) { }
      if (wasPinching) { drawPins(); return; }
      if (moved) return;

      if (pickMode && onPick) {
        var v = clientToView(e);
        onPick(unproj(v.x, v.y));
        return;
      }

      // 素早く2回叩いたら拡大（指で拡大するもう一つの手）
      var now = Date.now();
      if (lastTapPos && now - lastTap < 320 &&
          Math.hypot(e.clientX - lastTapPos.x, e.clientY - lastTapPos.y) < 32) {
        var b = toBox(e.clientX, e.clientY);
        var wx = (b.x - view.tx) / view.k, wy = (b.y - view.ty) / view.k;
        view.k = clampK(view.k * 1.9);
        view.tx = b.x - wx * view.k; view.ty = b.y - wy * view.k;
        apply(); drawPins();
        lastTap = 0; lastTapPos = null;
        return;
      }
      lastTap = now; lastTapPos = { x: e.clientX, y: e.clientY };

      if (!e.target.closest("[role=button]")) {
        dismissPreview();
        if (!opts.onBlank) return;
        opts.onBlank();
      }
    }
    root.addEventListener("pointerup", endPointer);
    root.addEventListener("pointercancel", endPointer);

    root.addEventListener("wheel", function (e) {
      e.preventDefault();
      var v = clientToView(e);
      var k2 = clampK(view.k * (e.deltaY < 0 ? 1.18 : 1 / 1.18));
      view.tx -= (k2 - view.k) * v.x; view.ty -= (k2 - view.k) * v.y;
      view.k = k2; apply();
      drawPins();   // 倍率が変わるとまとめ方も変わる
    }, { passive: false });

    return {
      el: root,
      dismissPreview: dismissPreview,
      setSchematic: function(on){schematic=!!on;gRegion.style.display=schematic?"":"none";gLabels.style.display=schematic?"":"none";gRealLabels.style.display=schematic?"none":"";gTiles.style.display=schematic?"none":"";attribution.hidden=schematic;status.hidden=schematic;dismissPreview();scheduleTiles();},
      setPins: function (list, sel) { dismissPreview(); pins = list; selectedId = sel || null; drawPins(); },
      setSelected: function (id) { selectedId = id; drawPins(); },
      setHover: function (id) {
        if (hoveredId === id) return;
        // 描き直すとホバー中の要素が差し替わってしまうので、クラスだけ入れ替える
        if (hoveredId && nodeById[hoveredId]) nodeById[hoveredId].classList.remove("hover");
        hoveredId = id;
        if (id && nodeById[id]) {
          nodeById[id].classList.add("hover");
          // 手前に出す
          var n = nodeById[id];
          if (n.parentNode) n.parentNode.appendChild(n);
        }
      },
      setPickMode: function (on) { pickMode = !!on; root.classList.toggle("picking", !!on); },
      focus: function (lat, lng, k) {
        if (typeof lat !== "number") return;
        var p = proj(lng, lat);
        var was = view.k;
        view.k = k || Math.max(view.k, 2.6);
        view.tx = VW / 2 - p[0] * view.k;
        view.ty = VH / 2 - p[1] * view.k;
        apply();
        drawPins();
      },
      /* 画面の左半分がパネルで隠れるので、その分だけ右に寄せて中央に見せる */
      focusOffset: function (lat, lng, k, offsetPx) {
        if (typeof lat !== "number") return;
        var rect = root.getBoundingClientRect();
        var shift = rect.width ? (offsetPx / rect.width) * VW : 0;
        var p = proj(lng, lat);
        var was = view.k;
        view.k = k || Math.max(view.k, 2.6);
        view.tx = VW / 2 + shift / 2 - p[0] * view.k;
        view.ty = VH / 2 - p[1] * view.k;
        apply();
        drawPins();
      },
      reset: function () {
        var was = view.k;
        view = { k: 1, tx: 0, ty: 0 }; apply();
        drawPins();
      },
      zoomBy: function (f) {
        var was = view.k;
        var k2 = Math.min(8, Math.max(0.8, view.k * f));
        view.tx -= (k2 - view.k) * (VW / 2 - view.tx) / view.k;
        view.ty -= (k2 - view.k) * (VH / 2 - view.ty) / view.k;
        view.k = k2; apply();
        drawPins();
      },
      // 隠れていた地図を出し直すとき（スマホのタブ切替）に呼ぶ
      redraw: function () { drawPins(); scheduleTiles(); },
      isInside: inside,
      boundary: BD,
      bbox: BBOX
    };
  };
})();
