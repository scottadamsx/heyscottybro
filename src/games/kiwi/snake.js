import { gameHead, reward } from "./shell.js";
function snake(usd) {
  return `<style>
    #snakeStage{position:relative;overflow:hidden}
    @keyframes snakeflash{0%{box-shadow:inset 0 0 0 0 rgba(192,57,43,.7)}35%{box-shadow:inset 0 0 0 16px rgba(192,57,43,.55)}100%{box-shadow:inset 0 0 0 0 rgba(192,57,43,0)}}
    .snake-flash{animation:snakeflash .55s ease-out}
    #deathPanel{display:none;position:absolute;inset:8px;border-radius:14px;background:rgba(251,250,244,.95);
                flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center}
    @media (prefers-reduced-motion:reduce){ .snake-flash{animation:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Snake", "Arrow keys. Eat 10 apples \u2014 keep going for more", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Score: 0 / 10</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="reset" class="k-press">Restart</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="snakeStage">
    <canvas id="cv" width="320" height="320" tabindex="0" style="background:var(--tile);border-radius:10px;outline:none;display:block"></canvas>
    <div id="deathPanel">
      <div class="k-label">Run over</div>
      <div id="deathScore" style="font-family:var(--display);font-size:30px;color:var(--fg)"></div>
      <button id="playAgain" class="k-press">Play again</button>
    </div>
  </div>
  </div>
  <script>
    var cv=document.getElementById('cv'),x=cv.getContext('2d'),S=26,G=12,statusEl=document.getElementById('status'),done=document.getElementById('done');
    var stageEl=document.getElementById('snakeStage'),deathPanel=document.getElementById('deathPanel'),deathScoreEl=document.getElementById('deathScore');
    var snk,dir,food,score,timer,goal=10,unlocked=false,dead=false;
    function rnd(){return Math.floor(Math.random()*G);}
    function roundRectPath(ctx2,xx,yy,w,h,r){ if(ctx2.roundRect){ctx2.beginPath();ctx2.roundRect(xx,yy,w,h,r);return;} ctx2.beginPath();ctx2.moveTo(xx+r,yy);ctx2.arcTo(xx+w,yy,xx+w,yy+h,r);ctx2.arcTo(xx+w,yy+h,xx,yy+h,r);ctx2.arcTo(xx,yy+h,xx,yy,r);ctx2.arcTo(xx,yy,xx+w,yy,r);ctx2.closePath(); }
    function init(){snk=[{x:6,y:6}];dir={x:1,y:0};score=0;dead=false;done.disabled=!unlocked;place();statusEl.textContent='Score: 0 / '+goal;deathPanel.style.display='none';cv.focus();if(timer)clearInterval(timer);timer=setInterval(step,110);draw();}
    function place(){food={x:rnd(),y:rnd()};}
    function die(){dead=true;if(timer){clearInterval(timer);timer=null;}stageEl.classList.remove('snake-flash');void stageEl.offsetWidth;stageEl.classList.add('snake-flash');deathScoreEl.textContent='Score '+score+' / '+goal;deathPanel.style.display='flex';}
    function step(){if(dead)return;var h={x:snk[0].x+dir.x,y:snk[0].y+dir.y};if(h.x<0||h.y<0||h.x>=G||h.y>=G){die();return;}for(var i=0;i<snk.length;i++)if(snk[i].x===h.x&&snk[i].y===h.y){die();return;}snk.unshift(h);
      if(h.x===food.x&&h.y===food.y){score++;statusEl.textContent='Score: '+score+' / '+goal;if(score>=goal){if(!unlocked){unlocked=true;done.disabled=false;done.classList.add('k-earn-ready');}statusEl.textContent='Nice! '+score+' apples \u2014 claim, or keep going!';}place();}else{snk.pop();}draw();}
    function draw(){x.clearRect(0,0,320,320);
      x.strokeStyle='rgba(46,43,37,.06)';x.lineWidth=1;
      for(var gx=0;gx<=G;gx++){x.beginPath();x.moveTo(gx*S,0);x.lineTo(gx*S,320);x.stroke();}
      for(var gy=0;gy<=G;gy++){x.beginPath();x.moveTo(0,gy*S);x.lineTo(320,gy*S);x.stroke();}
      var pulse=0.85+0.15*Math.sin(Date.now()/260),fr=(S-6)/2*pulse;
      x.fillStyle='#6F9A4E';x.beginPath();x.arc(food.x*S+S/2,food.y*S+S/2,fr,0,6.2832);x.fill();
      x.fillStyle='rgba(255,255,255,.55)';for(var sd=0;sd<5;sd++){var ang=sd/5*6.2832;x.beginPath();x.arc(food.x*S+S/2+Math.cos(ang)*fr*0.45,food.y*S+S/2+Math.sin(ang)*fr*0.45,1.4,0,6.2832);x.fill();}
      for(var i=snk.length-1;i>=0;i--){var seg=snk[i];x.fillStyle=(i===0)?'#557F38':'#8bc34a';roundRectPath(x,seg.x*S+2,seg.y*S+2,S-4,S-4,6);x.fill();}
      var hd=snk[0];x.fillStyle='#fff';var ex1=hd.x*S+S*0.32,ex2=hd.x*S+S*0.68,ey=hd.y*S+S*0.36;x.beginPath();x.arc(ex1,ey,1.6,0,6.2832);x.arc(ex2,ey,1.6,0,6.2832);x.fill();}
    cv.addEventListener('keydown',function(e){var m={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1}}[e.key];if(!m)return;e.preventDefault();if(dead){init();return;}if(m.x!==-dir.x||m.y!==-dir.y)dir=m;});
    document.getElementById('playAgain').addEventListener('click',init);
    document.getElementById('reset').addEventListener('click',init);done.addEventListener('click',kiwiComplete);init();
  <\/script>
</div>`;
}
export {
  snake
};
