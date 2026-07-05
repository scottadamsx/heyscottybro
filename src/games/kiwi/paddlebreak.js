import { gameHead, reward } from "./shell.js";
function paddlebreak(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Paddle Breaker", "Mouse moves the paddle \u2014 clear both boards (speed ramps each one)", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Board 1 \xB7 Score: 0</div>
  <div class="k-pips" id="pips" style="margin-top:10px"></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb" class="k-press">New run</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="pbStage"><canvas id="cv" width="300" height="320" style="background:var(--card);border-radius:10px;cursor:none"></canvas></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),cv=document.getElementById('cv'),x=cv.getContext('2d'),pips=document.getElementById('pips'),stage=document.getElementById('pbStage');
    var W=300,Hh=320,BOARDS=2;
    var LAYOUTS=[{cols:5,rows:4,speed:1},{cols:6,rows:5,speed:1.5}];
    var px,bx,by,vx,vy,bricks,score,balls,ballsLostTotal,level,running,over,unlocked,raf;
    function renderPips(){pips.innerHTML='';for(var i=0;i<BOARDS;i++){var s=document.createElement('span');s.className='k-pip'+(i<level?' k-pip-win':'');pips.appendChild(s);}}
    function loadBoard(lv){var L=LAYOUTS[lv];var BW=Math.floor((W-2*14-(L.cols-1)*4)/L.cols),BH=16,GAP=4,OFF=14;
      bricks=[];for(var r=0;r<L.rows;r++)for(var c=0;c<L.cols;c++)bricks.push({x:OFF+c*(BW+GAP),y:OFF+r*(BH+GAP)+10,a:1,w:BW,h:BH});
      px=W/2-28;bx=W/2;by=Hh-40;var sp=2.4*L.speed;vx=sp;vy=-sp*1.15;}
    function reset(){level=0;score=0;balls=3;ballsLostTotal=0;over=false;unlocked=false;done.disabled=true;done.classList.remove('k-earn-ready');
      loadBoard(level);renderPips();statusEl.textContent='Board 1 \xB7 Score: 0 \xB7 balls '+balls;if(raf)cancelAnimationFrame(raf);running=true;loop();}
    function draw(){x.clearRect(0,0,W,Hh);x.fillStyle='#8bc34a';for(var i=0;i<bricks.length;i++){if(bricks[i].a)x.fillRect(bricks[i].x,bricks[i].y,bricks[i].w,bricks[i].h);}
      x.fillStyle='#d97757';x.fillRect(px,Hh-16,56,8);x.beginPath();x.arc(bx,by,5,0,6.2832);x.fill();}
    function nextBoard(){level++;if(level>=BOARDS){win();return;}loadBoard(level);renderPips();statusEl.textContent='Board '+(level+1)+' \xB7 Score: '+score+' \xB7 balls '+balls;draw();}
    function win(){running=false;over=true;unlocked=true;renderPips();var perfect=ballsLostTotal===0;
      statusEl.textContent='Both boards cleared! Score '+score+(perfect?' \xB7 perfect run':'');
      done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);draw();}
    function lose(){running=false;over=true;statusEl.textContent='Out of balls on board '+(level+1)+' \xB7 score '+score+'. Nothing to claim \u2014 try again.';
      stage.classList.add('k-shake-soft');setTimeout(function(){stage.classList.remove('k-shake-soft');},420);draw();}
    function loop(){if(!running)return;bx+=vx;by+=vy;if(bx<5||bx>W-5)vx=-vx;if(by<5)vy=-vy;
      if(by>Hh-24&&by<Hh-14&&bx>px&&bx<px+56){vy=-Math.abs(vy);vx+=(bx-(px+28))/28*1.2;}
      for(var i=0;i<bricks.length;i++){var b=bricks[i];if(b.a&&bx>b.x&&bx<b.x+b.w&&by>b.y&&by<b.y+b.h){b.a=0;vy=-vy;score++;kScore(score);statusEl.textContent='Board '+(level+1)+' \xB7 Score: '+score+' \xB7 balls '+balls;}}
      var lft=bricks.filter(function(b){return b.a;}).length;
      if(lft===0){draw();nextBoard();raf=requestAnimationFrame(loop);return;}
      if(by>Hh){balls--;ballsLostTotal++;if(balls<=0){lose();return;}var L=LAYOUTS[level];var sp=2.4*L.speed;bx=W/2;by=Hh-40;vx=sp;vy=-sp*1.15;statusEl.textContent='Board '+(level+1)+' \xB7 Score: '+score+' \xB7 balls '+balls;}
      draw();raf=requestAnimationFrame(loop);}
    document.addEventListener('mousemove',function(e){var r=cv.getBoundingClientRect();px=Math.max(0,Math.min(W-56,(e.clientX-r.left)*(W/r.width)-28));});
    document.getElementById('newb').addEventListener('click',reset);
    done.addEventListener('click',function(){var perfect=ballsLostTotal===0;var bonus=unlocked?(perfect?8:5):0;kiwiComplete(bonus,score,unlocked);});
    reset();
  <\/script>
</div>`;
}
export {
  paddlebreak
};
