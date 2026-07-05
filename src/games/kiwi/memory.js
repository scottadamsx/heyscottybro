import { gameHead, reward } from "./shell.js";
function memory(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Memory Match", "Find all 8 pairs", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Moves: 0</div>
  <div class="k-pips" id="pips" style="margin-top:10px"></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="reset" class="k-press">New game</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="grid" style="display:inline-grid;grid-template-columns:repeat(4,64px);gap:10px"></div></div>
  </div>
  <style>
    .mc{width:64px;height:64px;background:transparent;border:0;cursor:pointer;perspective:600px}
    .mc-inner{position:relative;width:100%;height:100%;transition:transform .45s cubic-bezier(.2,.8,.3,1);transform-style:preserve-3d}
    .mc.up .mc-inner,.mc.done .mc-inner{transform:rotateY(180deg)}
    .mc-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:10px;backface-visibility:hidden;font-size:28px}
    .mc-face.front{background:var(--tile);color:var(--clay-d);font-family:var(--display);font-size:19px;font-weight:600}
    .mc-face.back{background:var(--hover);transform:rotateY(180deg)}
    .mc.done .mc-face.back{background:#e3f0d8}
    .mc.done{animation:kwinglow .8s ease-out}
    .mc.mismatch .mc-inner{animation:kshakesoft .4s ease-in-out}
    @media (prefers-reduced-motion:reduce){ .mc-inner{transition:none} .mc.done{animation:none} .mc.mismatch .mc-inner{animation:none} }
  </style>
  <script>
    var EM=['\u{1F95D}','\u{1F34B}','\u{1F347}','\u{1F34A}','\u{1F34F}','\u{1FAD0}','\u{1F352}','\u{1F351}'],grid=document.getElementById('grid'),statusEl=document.getElementById('status'),done=document.getElementById('done'),pipsEl=document.getElementById('pips');
    var deck,first,lock,moves,matched;
    function buildPips(){pipsEl.innerHTML='';for(var i=0;i<EM.length;i++){var s=document.createElement('span');s.className='k-pip';pipsEl.appendChild(s);}}
    function updPips(){var kids=pipsEl.children;for(var i=0;i<kids.length;i++)kids[i].classList.toggle('k-pip-win',i<matched);}
    function init(){deck=EM.concat(EM);for(var i=deck.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=deck[i];deck[i]=deck[j];deck[j]=t;}
      grid.innerHTML='';first=null;lock=false;moves=0;matched=0;done.disabled=true;done.classList.remove('k-earn-ready');statusEl.textContent='Moves: 0';buildPips();updPips();
      for(var k=0;k<deck.length;k++){(function(k){
        var b=document.createElement('button');b.className='mc';
        var inner=document.createElement('div');inner.className='mc-inner';
        var front=document.createElement('div');front.className='mc-face front';front.textContent='\u{1F95D}';
        var back=document.createElement('div');back.className='mc-face back';back.textContent=deck[k];
        inner.appendChild(front);inner.appendChild(back);b.appendChild(inner);
        b.addEventListener('click',function(){flip(b,k);});grid.appendChild(b);
      })(k);}}
    function flip(b,k){if(lock||b.classList.contains('up')||b.classList.contains('done'))return;b.classList.add('up');
      if(!first){first={b:b,k:k};return;}moves++;statusEl.textContent='Moves: '+moves;
      if(deck[first.k]===deck[k]){first.b.classList.remove('up');first.b.classList.add('done');b.classList.add('done');first=null;matched++;updPips();if(matched===EM.length){statusEl.textContent='Solved in '+moves+' moves!';done.disabled=false;done.classList.add('k-earn-ready');}}
      else{lock=true;var f=first;first=null;setTimeout(function(){f.b.classList.add('mismatch');b.classList.add('mismatch');setTimeout(function(){f.b.classList.remove('up','mismatch');b.classList.remove('up','mismatch');lock=false;},420);},700);}}
    document.getElementById('reset').addEventListener('click',init);done.addEventListener('click',kiwiComplete);init();
  <\/script>
</div>`;
}
export {
  memory
};
