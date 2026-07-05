import { gameHead, reward } from "./shell.js";
function game2048(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("2048", "Arrow keys \u2014 the higher you reach, the more you earn (128+ to claim)", usd)}
  <div style="position:relative;display:inline-block"><div id="status" class="k-sub" style="margin-top:8px">Score: 0</div><span id="scoredelta" class="k-scoredelta" style="display:none;top:4px;left:100%;margin-left:8px"></span></div>
  <div style="margin-top:10px"><span class="k-chip" id="bestChip">Best tile \u2014</span></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="reset" class="k-press">New game</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="board" tabindex="0" style="display:inline-grid;grid-template-columns:repeat(4,64px);gap:8px;outline:none"></div></div>
  </div>
  <script>
    var board=document.getElementById('board'),statusEl=document.getElementById('status'),done=document.getElementById('done'),bestChip=document.getElementById('bestChip'),scoreDelta=document.getElementById('scoredelta');
    var C={0:'var(--hover)',2:'var(--tile)',4:'#F0E4C8',8:'#E7CE9C',16:'#DDAE66',32:'#D08A50',64:'#C26343',128:'#6F9A4E',256:'#5F8A42',512:'#4F7938',1024:'#3E6A2E',2048:'#2E5423'};
    var DARK=[0,2,4,8,16];
    var g,score,lastScore,bestTile,spawnIdx,mergedBoard,doneReadyFired;
    var BASE=${Math.round(usd * 1e3)};
    function lsg(k){try{return localStorage.getItem(k);}catch(e){return null;}}
    function lss(k,v){try{localStorage.setItem(k,v);}catch(e){}}
    bestTile=Number(lsg('kiwi.2048.bestTile')||0);
    function bonus2048(m){return m>=1024?10:m>=512?6:m>=256?4:m>=128?2:0;}
    function init(){g=[];for(var i=0;i<16;i++)g.push(0);score=0;lastScore=0;spawnIdx=-1;mergedBoard=[];doneReadyFired=false;add();add();draw();board.focus();done.disabled=true;done.classList.remove('k-earn-ready');}
    function add(){var e=[];for(var i=0;i<16;i++)if(!g[i])e.push(i);if(!e.length)return -1;var pick=e[Math.floor(Math.random()*e.length)];g[pick]=Math.random()<.9?2:4;return pick;}
    function showDelta(n){if(!scoreDelta)return;scoreDelta.textContent='+'+n;scoreDelta.style.display='inline-block';scoreDelta.classList.remove('k-scoredelta');void scoreDelta.offsetWidth;scoreDelta.classList.add('k-scoredelta');}
    function draw(){board.innerHTML='';for(var i=0;i<16;i++){var v=g[i],d=document.createElement('div');
        d.style.cssText='height:64px;display:flex;align-items:center;justify-content:center;border-radius:7px;font-weight:800;font-size:'+(v>=1024?17:20)+'px;color:'+(DARK.indexOf(v)>=0?'var(--fg)':'#fff')+';background:'+(C[v]||(v?'#20401C':C[0]));
        if(v)d.textContent=v;
        var cls=[];if(i===spawnIdx&&v)cls.push('k-tilepop');if(mergedBoard[i])cls.push('k-mergepulse');
        if(cls.length)d.className=cls.join(' ');
        board.appendChild(d);}
      spawnIdx=-1;mergedBoard=[];
      var mt=Math.max.apply(null,g);
      if(mt>bestTile){bestTile=mt;lss('kiwi.2048.bestTile',String(bestTile));}
      bestChip.textContent='Best tile '+(bestTile||'\u2014');
      if(score>lastScore){showDelta(score-lastScore);kpop(statusEl);}
      lastScore=score;
      var tot=BASE+bonus2048(mt);statusEl.textContent='Score: '+score+(mt>=128?' \xB7 claim '+tot+' pts':'');
      if(mt>=128){done.disabled=false;done.textContent='Claim '+tot+' pts';if(!doneReadyFired){doneReadyFired=true;done.classList.add('k-earn-ready');}}}
    function slide(row){var a=row.filter(function(x){return x;});var merged=[];for(var i=0;i<a.length-1;i++){if(a[i]===a[i+1]){a[i]*=2;score+=a[i];a.splice(i+1,1);merged[i]=true;}}while(a.length<4)a.push(0);while(merged.length<4)merged.push(false);return{vals:a,merged:merged};}
    function move(dir){var before=g.join();var mb=[];for(var r=0;r<4;r++){var line=[];for(var c=0;c<4;c++){var idx=(dir==='L'||dir==='R')?r*4+c:c*4+r;line.push(g[idx]);}if(dir==='R'||dir==='D')line.reverse();var res=slide(line);var vals=res.vals,mm=res.merged;if(dir==='R'||dir==='D'){vals=vals.slice().reverse();mm=mm.slice().reverse();}for(var c2=0;c2<4;c2++){var idx2=(dir==='L'||dir==='R')?r*4+c2:c2*4+r;g[idx2]=vals[c2];if(mm[c2])mb[idx2]=true;}}
      if(g.join()!==before){KM.moves++;mergedBoard=mb;spawnIdx=add();draw();}}
    board.addEventListener('keydown',function(e){var k={ArrowLeft:'L',ArrowRight:'R',ArrowUp:'U',ArrowDown:'D'}[e.key];if(k){e.preventDefault();move(k);}});
    document.getElementById('reset').addEventListener('click',init);done.addEventListener('click',function(){kiwiComplete(bonus2048(Math.max.apply(null,g)),score);});init();
  <\/script>
</div>`;
}
export {
  game2048
};
