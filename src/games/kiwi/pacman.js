import { gameHead } from "./shell.js";
function pacman(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Pac-Kiwi", "Eat dots, dodge ghosts. One life \u2014 the longer you last, the more you earn", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Dots: 0 \xB7 earning 0 pts</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="done" disabled>Cash out</button></div>
  </div>
  <div class="k-right"><canvas id="cv" width="286" height="242" tabindex="0" style="background:var(--card);border-radius:6px;outline:none;max-width:100%"></canvas></div>
  </div>
  <script>
    var KBEST=(window.__KIWI_BEST|0)||0;
    var DIM=KBEST>40?[19,15]:(KBEST>=15?[13,11]:[11,9]);
    var C=DIM[0],R=DIM[1],S=22;
    function genGrid(){var g=[];for(var r=0;r<R;r++){g[r]=[];for(var c=0;c<C;c++)g[r][c]=1;}
      function carve(c,r){g[r][c]=2;var ds=[[2,0],[-2,0],[0,2],[0,-2]];for(var i=3;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=ds[i];ds[i]=ds[j];ds[j]=t;}for(var d=0;d<4;d++){var nc=c+ds[d][0],nr=r+ds[d][1];if(nc>0&&nc<C-1&&nr>0&&nr<R-1&&g[nr][nc]===1){g[r+ds[d][1]/2][c+ds[d][0]/2]=2;carve(nc,nr);}}}
      carve(1,1);
      for(var k=0;k<Math.floor(C*R/16);k++){var rc=1+Math.floor(Math.random()*(C-2)),rr=1+Math.floor(Math.random()*(R-2));if(g[rr][rc]===1&&((g[rr][rc-1]===2&&g[rr][rc+1]===2)||(g[rr-1][rc]===2&&g[rr+1][rc]===2)))g[rr][rc]=2;}
      return g;}
    var cv=document.getElementById('cv'),ctx=cv.getContext('2d'),statusEl=document.getElementById('status'),done=document.getElementById('done');
    var cs=getComputedStyle(document.body);
    function v(n,f){var x=cs.getPropertyValue(n);return (x&&x.trim())||f;}
    var GREEN=v('--green','#5a8f3c'),MUTED=v('--muted','#8a8474'),LINE=v('--line','#cdbfa6'),FG=v('--fg','#36402a');
    var grid,pellets,eaten,over,won,px,py,pdir,pnext,ghosts;
    function reset(){grid=genGrid();ghosts=[];pellets=0;eaten=0;over=false;won=false;pdir=[0,0];pnext=[0,0];
      var floors=[];for(var r=0;r<R;r++)for(var c=0;c<C;c++){if(grid[r][c]===2){pellets++;floors.push([c,r]);}}
      px=floors[0][0];py=floors[0][1];if(grid[py][px]===2){grid[py][px]=0;pellets--;}
      floors.sort(function(a,b){return (Math.abs(b[0]-px)+Math.abs(b[1]-py))-(Math.abs(a[0]-px)+Math.abs(a[1]-py));});
      var gc=C>15?3:2,cols=['#c8772e','#3a8a6f','#9a5bb0'];for(var i=0;i<gc&&i<floors.length;i++){ghosts.push({x:floors[i][0],y:floors[i][1],col:cols[i%3]});}
      cv.width=C*S;cv.height=R*S;}
    function wall(x,y){return x<0||y<0||x>=C||y>=R||grid[y][x]===1;}
    function bonus(){return Math.min(12,Math.round(eaten/4)+(won?4:0));}
    function upd(){statusEl.textContent='Dots: '+eaten+' \xB7 earning '+bonus()+' pts';}
    function end(msg){over=true;statusEl.textContent=msg+' ('+bonus()+' pts)';done.disabled=false;}
    function hit(){for(var i=0;i<ghosts.length;i++){if(ghosts[i].x===px&&ghosts[i].y===py){end('A ghost got you!');return;}}}
    function pstep(){if(over)return;if((pnext[0]||pnext[1])&&!wall(px+pnext[0],py+pnext[1])){pdir=pnext.slice();}var nx=px+pdir[0],ny=py+pdir[1];if(!wall(nx,ny)){px=nx;py=ny;if(grid[ny][nx]===2){grid[ny][nx]=0;eaten++;pellets--;upd();if(pellets===0){won=true;end('Cleared the board!');}}}hit();}
    function gstep(){if(over)return;for(var i=0;i<ghosts.length;i++){var g=ghosts[i];var opts=[[1,0],[-1,0],[0,1],[0,-1]].filter(function(d){return !wall(g.x+d[0],g.y+d[1]);});if(!opts.length)continue;var best;if(Math.random()<0.3){best=opts[Math.floor(Math.random()*opts.length)];}else{var bd=1e9;best=opts[0];for(var k=0;k<opts.length;k++){var dd=Math.abs(g.x+opts[k][0]-px)+Math.abs(g.y+opts[k][1]-py);if(dd<bd){bd=dd;best=opts[k];}}}g.x+=best[0];g.y+=best[1];}hit();}
    function draw(){ctx.clearRect(0,0,cv.width,cv.height);for(var r=0;r<R;r++)for(var c=0;c<C;c++){var cell=grid[r][c];if(cell===1){ctx.fillStyle=LINE;ctx.fillRect(c*S+1,r*S+1,S-2,S-2);}else if(cell===2){ctx.fillStyle=GREEN;ctx.beginPath();ctx.arc(c*S+S/2,r*S+S/2,2.5,0,6.2832);ctx.fill();}}
      ctx.fillStyle=GREEN;ctx.beginPath();ctx.arc(px*S+S/2,py*S+S/2,S*0.42,0.25,6.033);ctx.lineTo(px*S+S/2,py*S+S/2);ctx.fill();
      for(var i=0;i<ghosts.length;i++){ctx.fillStyle=ghosts[i].col;ctx.beginPath();ctx.arc(ghosts[i].x*S+S/2,ghosts[i].y*S+S/2,S*0.4,0,6.2832);ctx.fill();}}
    document.addEventListener('keydown',function(e){var m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}[e.key];if(m){e.preventDefault();pnext=m;}});
    done.addEventListener('click',function(){kiwiComplete(bonus(),eaten);});
    reset();upd();draw();setInterval(function(){pstep();draw();},200);setInterval(function(){gstep();draw();},260);cv.focus();
  <\/script>
</div>`;
}
export {
  pacman
};
