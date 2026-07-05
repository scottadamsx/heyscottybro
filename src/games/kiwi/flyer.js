import { gameHead } from "./shell.js";
function flyer(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Kiwi Flyer", "Tap / Space to fly, dodge the gaps. The longer you last, the more you earn", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Score: 0 \xB7 earning 0 pts</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="done" disabled>Cash out</button></div>
  </div>
  <div class="k-right"><canvas id="cv" width="320" height="300" tabindex="0" style="background:var(--card);border-radius:6px;outline:none;max-width:100%"></canvas></div>
  </div>
  <script>
    var cv=document.getElementById('cv'),ctx=cv.getContext('2d'),statusEl=document.getElementById('status'),done=document.getElementById('done');
    var cs=getComputedStyle(document.body);
    function v(n,f){var x=cs.getPropertyValue(n);return (x&&x.trim())||f;}
    var GREEN=v('--green','#5a8f3c'),LINE=v('--line','#cdbfa6'),FG=v('--fg','#36402a');
    var W=320,H=300,GAP=104,PX=64,PR=11,y,vel,score,over,started,pipes,seedsGot;
    function bonus(){return Math.min(10,score+seedsGot);}
    function reset(){y=H/2;vel=0;score=0;seedsGot=0;over=false;started=false;pipes=[{x:W,gap:120,passed:false,sy:120+(Math.random()<.5?-40:40),sGot:false}];upd();}
    function upd(){statusEl.textContent='Score: '+score+' \xB7 earning '+bonus()+' pts';}
    function end(){over=true;done.disabled=false;statusEl.textContent='Down! Cash out ('+bonus()+' pts)';}
    function flap(){if(over)return;started=true;vel=-5.4;}
    function tick(){if(started&&!over){vel+=0.5;y+=vel;for(var i=0;i<pipes.length;i++){pipes[i].x-=2.9;}
      if(pipes[pipes.length-1].x<W-150){var ng=50+Math.random()*(H-150);pipes.push({x:W+10,gap:ng,passed:false,sy:ng+(Math.random()<.5?-GAP/2+12:GAP/2-12),sGot:false});}
      if(pipes[0].x<-30){pipes.shift();}
      for(var i=0;i<pipes.length;i++){var p=pipes[i];if(!p.passed&&p.x+24<PX){p.passed=true;score++;upd();}
        if(!p.sGot&&Math.abs(PX-(p.x+12))<PR+6&&Math.abs(y-p.sy)<PR+6){p.sGot=true;seedsGot++;upd();}
        if(p.x<PX+PR&&p.x+24>PX-PR&&(y-PR<p.gap-GAP/2||y+PR>p.gap+GAP/2)){end();}}
      if(y>H-PR||y<PR){end();}}
      draw();}
    function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle=LINE;for(var i=0;i<pipes.length;i++){var p=pipes[i];ctx.fillRect(p.x,0,24,p.gap-GAP/2);ctx.fillRect(p.x,p.gap+GAP/2,24,H-(p.gap+GAP/2));}
      for(var j=0;j<pipes.length;j++){var q=pipes[j];if(!q.sGot){ctx.fillStyle='#c9a85e';ctx.beginPath();ctx.arc(q.x+12,q.sy,5,0,6.2832);ctx.fill();}}
      ctx.fillStyle=GREEN;ctx.beginPath();ctx.arc(PX,y,PR,0,6.2832);ctx.fill();
      if(!started){ctx.fillStyle=FG;ctx.font='13px system-ui';ctx.fillText('Tap or press Space to start',PX,38);}}
    function act(e){e.preventDefault();flap();}
    cv.addEventListener('mousedown',act);document.addEventListener('keydown',function(e){if(e.key===' '||e.key==='ArrowUp'){act(e);}});
    done.addEventListener('click',function(){kiwiComplete(bonus(),score);});
    reset();setInterval(tick,1000/45);cv.focus();
  <\/script>
</div>`;
}
export {
  flyer
};
