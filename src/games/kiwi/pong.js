import { gameHead, reward } from "./shell.js";
function pong(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Pong", "First to 3 beats the CPU. Mouse or \u2191\u2193 to move", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">You 0 \xB7 CPU 0</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="reset">Restart</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><canvas id="cv" width="360" height="260" tabindex="0" style="background:var(--card);border-radius:10px;outline:none"></canvas></div>
  </div>
  <script>
    var cv=document.getElementById('cv'),x=cv.getContext('2d'),statusEl=document.getElementById('status'),done=document.getElementById('done');
    var cs=getComputedStyle(document.body);function v(n,f){var z=cs.getPropertyValue(n);return (z&&z.trim())||f;}
    var GREEN=v('--green','#6fa45a'),CLAY=v('--clay','#d97757'),LINE=v('--line','#ece7db');
    var W=360,H=260,PW=9,PH=54,BS=9,goal=3,ps,as,py,ay,bx,by,bvx,bvy,over,timer;
    function serve(dir){bx=W/2;by=H/2;bvx=dir*3.2;bvy=(Math.random()*2-1)*2.6;}
    function reset(){py=(H-PH)/2;ay=py;ps=0;as=0;over=false;done.disabled=true;statusEl.textContent='You 0 \xB7 CPU 0';serve(Math.random()<.5?1:-1);if(timer)clearInterval(timer);timer=setInterval(step,1000/60);}
    function score(){statusEl.textContent='You '+ps+' \xB7 CPU '+as;kpop(statusEl);if(ps>=goal){over=true;clearInterval(timer);statusEl.innerHTML='You win! <span class="k-win">Claim your reward.</span>';done.disabled=false;}else if(as>=goal){over=true;clearInterval(timer);statusEl.innerHTML='<span class="k-lose">CPU wins.</span> Restart to retry.';}}
    function step(){if(over)return;bx+=bvx;by+=bvy;
      if(by<BS/2){by=BS/2;bvy=-bvy;}if(by>H-BS/2){by=H-BS/2;bvy=-bvy;}
      if(bvx<0&&bx-BS/2<14+PW&&bx-BS/2>10&&by>py&&by<py+PH){bvx=-bvx*1.04;bvy+=((by-(py+PH/2))/PH)*2;}
      if(bvx>0&&bx+BS/2>W-14-PW&&bx+BS/2<W-10&&by>ay&&by<ay+PH){bvx=-bvx*1.04;bvy+=((by-(ay+PH/2))/PH)*2;}
      if(bx<-4){as++;score();serve(1);}else if(bx>W+4){ps++;score();serve(-1);}
      var c=ay+PH/2;if(c<by-8)ay+=3.0;else if(c>by+8)ay-=3.0;ay=Math.max(0,Math.min(H-PH,ay));
      draw();}
    function draw(){x.clearRect(0,0,W,H);x.strokeStyle=LINE;x.setLineDash([5,7]);x.beginPath();x.moveTo(W/2,0);x.lineTo(W/2,H);x.stroke();x.setLineDash([]);
      x.fillStyle=GREEN;x.fillRect(14,py,PW,PH);x.fillRect(W-14-PW,ay,PW,PH);
      x.fillStyle=CLAY;x.beginPath();x.arc(bx,by,BS/2,0,6.2832);x.fill();}
    cv.addEventListener('mousemove',function(e){var r=cv.getBoundingClientRect();py=Math.max(0,Math.min(H-PH,(e.clientY-r.top)*(H/r.height)-PH/2));});
    document.addEventListener('keydown',function(e){if(e.key==='ArrowUp'){e.preventDefault();py=Math.max(0,py-24);}else if(e.key==='ArrowDown'){e.preventDefault();py=Math.min(H-PH,py+24);}});
    document.getElementById('reset').addEventListener('click',reset);done.addEventListener('click',function(){kiwiComplete(ps,ps);});reset();
  <\/script>
</div>`;
}
export {
  pong
};
