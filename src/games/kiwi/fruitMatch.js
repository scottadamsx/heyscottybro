import { gameHead, reward } from "./shell.js";
function fruitMatch(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Fruit Match", "Swap neighbours to line up 3+. Reach 300", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Score: 0 / 300</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="reset">New board</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="grid"></div></div>
  </div>
  <style>#grid{display:inline-grid;grid-template-columns:repeat(7,40px);gap:4px;background:var(--card);padding:8px;border-radius:12px}
    .fm{width:40px;height:40px;border:0;border-radius:10px;background:var(--tile);font-size:23px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
    .fm.sel{outline:2px solid var(--clay);outline-offset:-2px}</style>
  <script>
    var N=7,K=['\u{1F352}','\u{1F34B}','\u{1F347}','\u{1F34A}','\u{1F34F}','\u{1FAD0}'],goal=300;
    var grid=document.getElementById('grid'),statusEl=document.getElementById('status'),done=document.getElementById('done');
    var b=[],cells=[],score=0,sel=null,busy=false;
    function rnd(){return Math.floor(Math.random()*K.length);}
    function idx(r,c){return r*N+c;}
    function findMatches(){var m={},r,c,run,k;
      for(r=0;r<N;r++){run=1;for(c=1;c<=N;c++){if(c<N&&b[idx(r,c)]===b[idx(r,c-1)]){run++;}else{if(run>=3){for(k=0;k<run;k++)m[idx(r,c-1-k)]=1;}run=1;}}}
      for(c=0;c<N;c++){run=1;for(r=1;r<=N;r++){if(r<N&&b[idx(r,c)]===b[idx(r-1,c)]){run++;}else{if(run>=3){for(k=0;k<run;k++)m[idx(r-1-k,c)]=1;}run=1;}}}
      return Object.keys(m).map(Number);}
    function build(){grid.innerHTML='';cells=[];b=[];for(var i=0;i<N*N;i++)b.push(rnd());
      var guard=0;while(findMatches().length&&guard++<200){findMatches().forEach(function(j){b[j]=rnd();});}
      score=0;sel=null;busy=false;done.disabled=true;statusEl.textContent='Score: 0 / '+goal;
      for(var i2=0;i2<N*N;i2++){(function(i2){var t=document.createElement('button');t.className='fm';t.addEventListener('click',function(){pick(i2);});grid.appendChild(t);cells.push(t);})(i2);}paint();}
    function paint(){for(var i=0;i<N*N;i++){cells[i].textContent=K[b[i]];cells[i].classList.toggle('sel',i===sel);}}
    function adj(a,c){return Math.abs(Math.floor(a/N)-Math.floor(c/N))+Math.abs((a%N)-(c%N))===1;}
    function swap(a,c){var t=b[a];b[a]=b[c];b[c]=t;}
    function resolve(){busy=true;(function iter(){var ms=findMatches();if(!ms.length){busy=false;statusEl.textContent='Score: '+score+' / '+goal;if(score>=goal){done.disabled=false;statusEl.innerHTML='Juicy! <span class="k-win">Claim your reward.</span>';}return;}
      score+=ms.length*10;ms.forEach(function(i){b[i]=-1;});
      for(var c=0;c<N;c++){var col=[],r;for(r=N-1;r>=0;r--){if(b[idx(r,c)]!==-1)col.push(b[idx(r,c)]);}while(col.length<N)col.push(rnd());for(r=N-1;r>=0;r--)b[idx(r,c)]=col[N-1-r];}
      paint();kpop(statusEl);setTimeout(iter,170);})();}
    function pick(i){if(busy)return;if(sel===null){sel=i;paint();return;}if(sel===i){sel=null;paint();return;}
      if(adj(sel,i)){var a=sel;sel=null;swap(a,i);if(findMatches().length){paint();resolve();}else{swap(a,i);paint();}}else{sel=i;paint();}}
    document.getElementById('reset').addEventListener('click',build);done.addEventListener('click',function(){kiwiComplete(Math.round(score/8),score);});build();
  <\/script>
</div>`;
}
export {
  fruitMatch
};
