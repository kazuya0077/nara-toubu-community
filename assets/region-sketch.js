(function(){
 'use strict';
 var box=document.getElementById('region-sketch'),data=window.TOUBU_BOUNDARY;
 if(!box||!data||!data.ring.length)return;
 var points=data.ring.concat(data.outside||[]),xs=points.map(function(p){return p[0];}),ys=points.map(function(p){return p[1];});
 var minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs),minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys);
 var ns='http://www.w3.org/2000/svg';
 function node(tag,attributes){var n=document.createElementNS(ns,tag);Object.keys(attributes).forEach(function(k){n.setAttribute(k,attributes[k]);});return n;}
 function xy(p){return [24+(p[0]-minX)/(maxX-minX)*352,20+(maxY-p[1])/(maxY-minY)*290];}
 function polygon(ring,fill,stroke){return node('polygon',{points:ring.map(function(p){return xy(p).join(',');}).join(' '),fill:fill,stroke:stroke,'stroke-width':'2','stroke-linejoin':'round'});}
 var svg=node('svg',{viewBox:'0 0 400 330',role:'img','aria-label':'提供された東部地域図から作成した概略図。正確な行政境界ではありません。'});
 if(data.outside)svg.appendChild(polygon(data.outside,'#e5e2d5','#b6b7a3'));
 svg.appendChild(polygon(data.ring,'#d29b78','#805c45'));
 box.appendChild(svg);
})();
