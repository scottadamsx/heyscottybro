import { gameHead, reward } from "./shell.js";
function blockcascade(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Block Cascade", "Arrow keys move/rotate, Space hard-drops \u2014 clear 10 lines to unlock Claim", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Lines: 0 / 10</div>
  <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><span class="k-chip" id="levelChip">Level 1</span><span class="k-chip" id="nextChip">Next \u2014</span></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="reset" class="k-press">Restart</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="cascadeStage"><canvas id="cv" width="200" height="340" tabindex="0" style="background:var(--bg);border-radius:10px;outline:none;display:block"></canvas></div>
  </div>
  <script>
    var cv=document.getElementById('cv'),x=cv.getContext('2d'),statusEl=document.getElementById('status'),done=document.getElementById('done');
    var levelChip=document.getElementById('levelChip'),nextChip=document.getElementById('nextChip'),stage=document.getElementById('cascadeStage');
    var COLS=10,ROWS=17,CELL=20,goal=10,bonusGoal=25;
    var SHAPES={
      I:{n:4,cells:[[0,1],[1,1],[2,1],[3,1]],c:'#6F9A4E'},
      O:{n:2,cells:[[0,0],[1,0],[0,1],[1,1]],c:'#D9A65C'},
      T:{n:3,cells:[[0,1],[1,1],[2,1],[1,0]],c:'#D97757'},
      S:{n:3,cells:[[1,0],[2,0],[0,1],[1,1]],c:'#8bc34a'},
      Z:{n:3,cells:[[0,0],[1,0],[1,1],[2,1]],c:'#C26343'},
      J:{n:3,cells:[[0,0],[0,1],[1,1],[2,1]],c:'#557F38'},
      L:{n:3,cells:[[2,0],[0,1],[1,1],[2,1]],c:'#caa23a'}
    };
    var KEYS=Object.keys(SHAPES);
    var grid,cur,nextKey,lines,level,score,over,unlocked=false,dropTimer,clearing=null;
    function rndKey(){return KEYS[Math.floor(Math.random()*KEYS.length)];}
    function newPiece(key){var s=SHAPES[key];return {key:key,cells:s.cells.map(function(p){return p.slice();}),n:s.n,c:s.c,px:Math.floor((COLS-s.n)/2),py:0};}
    function collides(piece,dx,dy,cells){var cs=cells||piece.cells;for(var i=0;i<cs.length;i++){var bx=piece.px+cs[i][0]+dx,by=piece.py+cs[i][1]+dy;if(bx<0||bx>=COLS||by>=ROWS)return true;if(by>=0&&grid[by][bx])return true;}return false;}
    function rotated(piece){var n=piece.n;return piece.cells.map(function(p){return [n-1-p[1],p[0]];});}
    function tryRotate(){var rc=rotated(cur);if(!collides(cur,0,0,rc)){cur.cells=rc;draw();return;}
      if(!collides(cur,-1,0,rc)){cur.px--;cur.cells=rc;draw();return;}
      if(!collides(cur,1,0,rc)){cur.px++;cur.cells=rc;draw();return;}}
    function spawn(){cur=newPiece(nextKey||rndKey());nextKey=rndKey();nextChip.textContent='Next '+nextKey;
      if(collides(cur,0,0)){gameOver();return;}}
    function lockPiece(){for(var i=0;i<cur.cells.length;i++){var bx=cur.px+cur.cells[i][0],by=cur.py+cur.cells[i][1];if(by>=0&&by<ROWS)grid[by][bx]=cur.c;}
      var full=[];for(var r=0;r<ROWS;r++){var ok=true;for(var c=0;c<COLS;c++)if(!grid[r][c]){ok=false;break;}if(ok)full.push(r);}
      if(full.length){clearing={rows:full,t:Date.now()};draw();setTimeout(function(){finishClear(full);},170);}
      else{spawn();}
    }
    function finishClear(full){var kept=grid.filter(function(row,i){return full.indexOf(i)<0;});var blank=[];for(var i=0;i<full.length;i++){var row=[];for(var c=0;c<COLS;c++)row.push(null);blank.push(row);}
      grid=blank.concat(kept);lines+=full.length;score+=[0,10,30,60,100][full.length]||full.length*30;kScore(score);
      level=1+Math.floor(lines/6);levelChip.textContent='Level '+level;clearInterval(dropTimer);dropTimer=setInterval(tick,Math.max(120,520-level*40));
      statusEl.textContent='Lines: '+lines+' / '+goal+(lines>=goal?' \xB7 claim below!':'');
      if(lines>=goal&&!unlocked){unlocked=true;done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}
      clearing=null;spawn();draw();}
    function gameOver(){over=true;clearInterval(dropTimer);statusEl.textContent='Topped out \u2014 '+lines+' lines. '+(unlocked?'Claim below, or Restart.':'Restart to try again.');stage.classList.remove('k-winglow');stage.classList.add('k-shake-soft');setTimeout(function(){stage.classList.remove('k-shake-soft');},420);draw();}
    function tick(){if(over||clearing)return;if(!collides(cur,0,1)){cur.py++;}else{lockPiece();}draw();}
    function hardDrop(){if(over||clearing)return;while(!collides(cur,0,1))cur.py++;lockPiece();draw();}
    function draw(){x.clearRect(0,0,COLS*CELL,ROWS*CELL);
      x.strokeStyle='rgba(46,43,37,.06)';x.lineWidth=1;
      for(var gx=0;gx<=COLS;gx++){x.beginPath();x.moveTo(gx*CELL,0);x.lineTo(gx*CELL,ROWS*CELL);x.stroke();}
      for(var gy=0;gy<=ROWS;gy++){x.beginPath();x.moveTo(0,gy*CELL);x.lineTo(COLS*CELL,gy*CELL);x.stroke();}
      var flashRows=clearing?clearing.rows:[];
      for(var r=0;r<ROWS;r++)for(var c=0;c<COLS;c++){var col=grid[r][c];if(!col)continue;
        x.fillStyle=(flashRows.indexOf(r)>=0)?'#ffffff':col;x.fillRect(c*CELL+1,r*CELL+1,CELL-2,CELL-2);
        x.fillStyle='rgba(255,255,255,.22)';x.fillRect(c*CELL+1,r*CELL+1,CELL-2,3);}
      if(cur&&!clearing){x.fillStyle=cur.c;for(var i=0;i<cur.cells.length;i++){var bx=cur.px+cur.cells[i][0],by=cur.py+cur.cells[i][1];if(by>=0)x.fillRect(bx*CELL+1,by*CELL+1,CELL-2,CELL-2);}}
    }
    function init(){grid=[];for(var r=0;r<ROWS;r++){var row=[];for(var c=0;c<COLS;c++)row.push(null);grid.push(row);}
      lines=0;level=1;score=0;over=false;clearing=null;unlocked=false;done.disabled=true;done.classList.remove('k-earn-ready');
      levelChip.textContent='Level 1';statusEl.textContent='Lines: 0 / '+goal;nextKey=rndKey();spawn();
      if(dropTimer)clearInterval(dropTimer);dropTimer=setInterval(tick,480);cv.focus();draw();}
    cv.addEventListener('keydown',function(e){if(over)return;var k=e.key;
      if(k==='ArrowLeft'){e.preventDefault();if(!collides(cur,-1,0))cur.px--;draw();}
      else if(k==='ArrowRight'){e.preventDefault();if(!collides(cur,1,0))cur.px++;draw();}
      else if(k==='ArrowDown'){e.preventDefault();if(!collides(cur,0,1)){cur.py++;score++;}draw();}
      else if(k==='ArrowUp'){e.preventDefault();tryRotate();}
      else if(k===' '){e.preventDefault();hardDrop();}});
    document.getElementById('reset').addEventListener('click',init);
    done.addEventListener('click',function(){var bonus=lines>=bonusGoal?8:(lines>=goal?4:0);kiwiComplete(bonus,lines,lines>=goal);});
    init();
  <\/script>
</div>`;
}
export {
  blockcascade
};
