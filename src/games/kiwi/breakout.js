import { gameHead, reward } from "./shell.js";
function breakout(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Brick Breaker", "Move the paddle with your mouse \u2014 clear the bricks", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Score: 0</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb">New</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><canvas id="cv" width="300" height="320" style="background:var(--card);border-radius:10px;cursor:none"></canvas></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),cv=document.getElementById('cv'),x=cv.getContext('2d');
    var W=300,Hh=320,px,bx,by,vx,vy,bricks,score,balls,running,raf;
    var BW=52,BH=16,COLS=5,GAP=4,OFF=14,ROWS=4;
    function reset(){px=W/2-28;bx=W/2;by=Hh-40;vx=2.4;vy=-2.8;score=0;balls=3;bricks=[];for(var r=0;r<ROWS;r++)for(var c=0;c<COLS;c++)bricks.push({x:OFF+c*(BW+GAP),y:OFF+r*(BH+GAP)+10,a:1});running=true;done.disabled=true;if(raf)cancelAnimationFrame(raf);loop();}
    function draw(){x.clearRect(0,0,W,Hh);x.fillStyle='#8bc34a';for(var i=0;i<bricks.length;i++){if(bricks[i].a)x.fillRect(bricks[i].x,bricks[i].y,BW,BH);}x.fillStyle='#d97757';x.fillRect(px,Hh-16,56,8);x.beginPath();x.arc(bx,by,5,0,6.2832);x.fill();}
    function loop(){if(!running)return;bx+=vx;by+=vy;if(bx<5||bx>W-5)vx=-vx;if(by<5)vy=-vy;
      if(by>Hh-24&&by<Hh-14&&bx>px&&bx<px+56){vy=-Math.abs(vy);vx+=(bx-(px+28))/28*1.2;}
      for(var i=0;i<bricks.length;i++){var b=bricks[i];if(b.a&&bx>b.x&&bx<b.x+BW&&by>b.y&&by<b.y+BH){b.a=0;vy=-vy;score++;statusEl.textContent='Score: '+score;}}
      var lft=bricks.filter(function(b){return b.a;}).length;
      if(lft===0){running=false;statusEl.textContent='Cleared every brick! Score '+score;done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';draw();return;}
      if(by>Hh){balls--;if(balls<=0){running=false;statusEl.textContent='Out of balls \xB7 score '+score;done.disabled=false;done.textContent='Claim ${reward(usd)}'+(score>0?' + bonus':'');draw();return;}bx=W/2;by=Hh-40;vx=2.4;vy=-2.8;statusEl.textContent='Score: '+score+' \xB7 balls '+balls;}
      draw();raf=requestAnimationFrame(loop);}
    document.addEventListener('mousemove',function(e){var r=cv.getBoundingClientRect();px=Math.max(0,Math.min(W-56,(e.clientX-r.left)*(W/r.width)-28));});
    document.getElementById('newb').addEventListener('click',reset);
    done.addEventListener('click',function(){kiwiComplete(Math.min(12,score),score);});
    reset();
  <\/script>
</div>`;
}
export {
  breakout
};
