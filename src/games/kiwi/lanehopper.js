import { gameHead, reward } from "./shell.js";
function lanehopper(usd) {
  return `<style>
    #lhStage{position:relative;overflow:hidden}
    @keyframes lhflash{0%{box-shadow:inset 0 0 0 0 rgba(192,57,43,.7)}35%{box-shadow:inset 0 0 0 16px rgba(192,57,43,.55)}100%{box-shadow:inset 0 0 0 0 rgba(192,57,43,0)}}
    .lh-flash{animation:lhflash .55s ease-out}
    #lhDeath{display:none;position:absolute;inset:8px;border-radius:14px;background:rgba(251,250,244,.95);
             flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center}
    @media (prefers-reduced-motion:reduce){ .lh-flash{animation:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Lane Hopper", "Hop across scrolling lanes without getting hit", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Crossings: 0 / 5</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="reset" class="k-press">Restart</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="lhStage">
    <canvas id="cv" width="306" height="340" tabindex="0" style="background:var(--tile);border-radius:10px;outline:none;display:block"></canvas>
    <div id="lhDeath">
      <div class="k-label">Hit!</div>
      <div id="lhDeathScore" style="font-family:var(--display);font-size:26px;color:var(--fg)"></div>
      <button id="lhAgain" class="k-press">Play again</button>
    </div>
  </div>
  </div>
  <script>
    var cv=document.getElementById('cv'),x=cv.getContext('2d'),statusEl=document.getElementById('status'),done=document.getElementById('done');
    var stageEl=document.getElementById('lhStage'),deathEl=document.getElementById('lhDeath'),deathScoreEl=document.getElementById('lhDeathScore');
    var COLS=9,ROWS=10,CW=34,CH=34,GOAL_ROW=0,START_ROW=ROWS-1;
    var player,lanes,crossings,unlocked,dead,timer;
    var BASE_SPEED=[1.1,1.5,1.0,1.7,1.3,1.9,1.2,1.6];
    function laneRowIndex(row){return row-1;}
    function makeLanes(){var arr=[];for(var i=0;i<ROWS-2;i++){var dir=i%2===0?1:-1;var speed=BASE_SPEED[i%BASE_SPEED.length]*(1+crossings*0.14);
      var n=2+(i%2);var cars=[];for(var k=0;k<n;k++)cars.push({off:k*(COLS*CW/n)});
      arr.push({dir:dir,speed:speed,n:n,cars:cars,carW:46});}return arr;}
    function reset(){player={row:START_ROW,col:Math.floor(COLS/2)};crossings=0;dead=false;
      lanes=makeLanes();done.disabled=!unlocked;deathEl.style.display='none';
      statusEl.textContent='Crossings: 0 / 5'+(unlocked?' \u2014 Claim unlocked':'');cv.focus();draw();}
    function rampLanes(){lanes=makeLanes();}
    function die(){dead=true;stageEl.classList.remove('lh-flash');void stageEl.offsetWidth;stageEl.classList.add('lh-flash');
      deathScoreEl.textContent='Crossings: '+crossings;deathEl.style.display='flex';}
    function laneCarRects(li){var lane=lanes[li];var rowY=(li+1)*CH;var rects=[];
      for(var k=0;k<lane.cars.length;k++){var totalW=COLS*CW;var raw=(lane.cars[k].off+lane.phase*lane.dir)%totalW;if(raw<0)raw+=totalW;
        rects.push({x:raw-lane.carW/2,y:rowY+4,w:lane.carW,h:CH-8});}
      return rects;}
    function checkCollision(){if(player.row===GOAL_ROW||player.row===START_ROW)return false;
      var li=laneRowIndex(player.row);var rects=laneCarRects(li);
      var px=player.col*CW,pw=CW,py=player.row*CH,ph=CH;
      for(var i=0;i<rects.length;i++){var r=rects[i];var rx=r.x,rw=r.w;
        // account for wraparound near edges
        for(var shift=-1;shift<=1;shift++){var sx=rx+shift*COLS*CW;
          if(sx<px+pw-6&&sx+rw>px+6&&r.y<py+ph-4&&r.y+r.h>py+4)return true;}}
      return false;}
    function move(dr,dc){if(dead)return;var nr=player.row+dr,nc=player.col+dc;
      if(nc<0||nc>=COLS)return;if(nr<0)nr=0;if(nr>=ROWS)nr=ROWS-1;
      player.row=nr;player.col=nc;
      if(player.row===GOAL_ROW){crossings++;
        if(crossings>=5&&!unlocked){unlocked=true;done.disabled=false;done.classList.add('k-earn-ready');}
        statusEl.textContent='Crossings: '+crossings+(crossings>=5?' \u2014 Claim unlocked':' / 5');
        rampLanes();player.row=START_ROW;player.col=Math.floor(COLS/2);}
      draw();
      if(checkCollision())die();}
    function tick(){if(dead)return;for(var i=0;i<lanes.length;i++){var lane=lanes[i];lane.phase=(lane.phase||0)+lane.speed;}
      draw();if(checkCollision())die();}
    function draw(){x.clearRect(0,0,COLS*CW,ROWS*CH);
      x.fillStyle='#8bc48f';x.fillRect(0,GOAL_ROW*CH,COLS*CW,CH);
      x.fillStyle='#c9bd9c';x.fillRect(0,START_ROW*CH,COLS*CW,CH);
      for(var li=0;li<lanes.length;li++){var rowY=(li+1)*CH;
        x.fillStyle=li%2===0?'#5c5850':'#4a473f';x.fillRect(0,rowY,COLS*CW,CH);
        var rects=laneCarRects(li);
        x.fillStyle=['#D97757','#D9A65C','#6F9A4E','#557F38'][li%4];
        for(var k=0;k<rects.length;k++){var r=rects[k];
          for(var shift=-1;shift<=1;shift++){var sx=r.x+shift*COLS*CW;if(sx+r.w<0||sx>COLS*CW)continue;
            x.beginPath();if(x.roundRect){x.roundRect(sx,r.y,r.w,r.h,6);}else{x.rect(sx,r.y,r.w,r.h);}x.fill();}}}
      x.font='22px system-ui';x.textAlign='center';x.textBaseline='middle';
      x.fillText('\u{1F95D}',player.col*CW+CW/2,player.row*CH+CH/2+1);}
    cv.addEventListener('keydown',function(e){var m={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[e.key];if(!m)return;e.preventDefault();move(m[0],m[1]);});
    document.getElementById('lhAgain').addEventListener('click',reset);
    document.getElementById('reset').addEventListener('click',reset);
    done.addEventListener('click',function(){var bonus=crossings>=10?8:(crossings>=5?4:0);kiwiComplete(bonus,crossings,crossings>=5);});
    unlocked=false;reset();if(timer)clearInterval(timer);timer=setInterval(tick,1000/30);
  <\/script>
</div>`;
}
export {
  lanehopper
};
