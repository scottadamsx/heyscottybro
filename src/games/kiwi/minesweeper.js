import { gameHead, reward } from "./shell.js";
function minesweeper(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Minesweeper", "Clear the 9\xD79 board (10 mines). One life \u2014 no retries. Right-click, or toggle Flag mode, to flag", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Mines left: 10 \xB7 one chance</div>
  <div style="margin-top:10px"><button id="flagMode" class="k-chip k-press" type="button" style="cursor:pointer;border:0">\u{1F6A9} Flag mode: off</button></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="mineStage"><div id="grid" style="display:inline-grid;grid-template-columns:repeat(9,30px);gap:3px;background:var(--card);padding:8px;border-radius:6px"></div></div>
  </div>
  <style>
    .cell{width:30px;height:30px;border:0;border-radius:6px;background:var(--tile);color:var(--fg);font-weight:700;font-size:15px;cursor:pointer;
          box-shadow:inset 1.5px 1.5px 0 rgba(255,255,255,.65),inset -2.5px -2.5px 0 rgba(0,0,0,.20);
          transition:transform .12s ease,box-shadow .12s ease,opacity .18s ease;transform:scale(1);opacity:1}
    .cell:hover{filter:brightness(1.04)}
    .cell.flagging{cursor:crosshair}
    .cell.open{background:var(--bg);box-shadow:inset 0 0 0 1px var(--line);cursor:default;animation:kcellreveal .22s ease-out both}
    @keyframes kcellreveal{0%{opacity:.15;transform:scale(.72)}100%{opacity:1;transform:scale(1)}}
    .cell.mine{background:#c8772e;color:#fff;box-shadow:none}
    .cell.n1{color:var(--green2)}.cell.n2{color:var(--green)}.cell.n3{color:var(--gold)}.cell.n4{color:var(--clay)}
    .cell.n5{color:var(--clay-d)}.cell.n6{color:var(--muted)}.cell.n7{color:var(--fg)}.cell.n8{color:#6b6e58}
    #mineStage.k-winglow{box-shadow:0 0 0 0 rgba(111,154,78,.5)}
  </style>
  <script>
    var N=9,M=10,grid=document.getElementById('grid'),statusEl=document.getElementById('status'),done=document.getElementById('done'),stage=document.getElementById('mineStage'),flagBtn=document.getElementById('flagMode');
    var cells,mines,opened,flags,over,won=false,flagMode=false;
    done.addEventListener('click',function(){ kiwiComplete(won?5:0, null, won); });
    flagBtn.addEventListener('click',function(){ flagMode=!flagMode; flagBtn.textContent='\u{1F6A9} Flag mode: '+(flagMode?'on':'off'); grid.classList.toggle('flagging',flagMode); for(var i=0;i<cells.length;i++){ cells[i].classList.toggle('flagging',flagMode); } });
    function build(){grid.innerHTML='';cells=[];mines={};opened={};flags={};over=false;won=false;done.disabled=true;stage.classList.remove('k-winglow');var c=0;while(c<M){var r=Math.floor(Math.random()*N*N);if(!mines[r]){mines[r]=1;c++;}}
      for(var i=0;i<N*N;i++){(function(i){var b=document.createElement('button');b.className='cell';b.addEventListener('click',function(){ if(flagMode){ flag(i); } else { open(i); } });b.addEventListener('contextmenu',function(e){e.preventDefault();flag(i);});grid.appendChild(b);cells.push(b);})(i);}statusEl.textContent='Mines left: '+M+' \xB7 one chance';}
    function nb(i){var r=Math.floor(i/N),c=i%N,o=[];for(var dr=-1;dr<=1;dr++)for(var dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;var nr=r+dr,nc=c+dc;if(nr>=0&&nr<N&&nc>=0&&nc<N)o.push(nr*N+nc);}return o;}
    function count(i){var n=0,a=nb(i);for(var k=0;k<a.length;k++)if(mines[a[k]])n++;return n;}
    function lose(){over=true;won=false;statusEl.textContent='Boom \u2014 that was your one shot.';done.disabled=false;done.textContent='Move on \u203A';stage.classList.remove('k-winglow');stage.classList.add('k-shake-soft');setTimeout(function(){stage.classList.remove('k-shake-soft');},420);}
    // Collects the whole zero-cascade first, then reveals it with a small staggered delay per
    // cell so a big flood-fill reads as a wave instead of popping in all at once.
    function open(i){if(over||opened[i]||flags[i])return;
      if(mines[i]){cells[i].className='cell mine';cells[i].textContent='\u2737';opened[i]=1;lose();return;}
      var wave=[],seen={};
      (function collect(i){if(seen[i]||opened[i]||flags[i])return;seen[i]=1;opened[i]=1;wave.push(i);var n=count(i);if(!n){var a=nb(i);for(var k=0;k<a.length;k++)collect(a[k]);}})(i);
      wave.forEach(function(idx,k){var n=count(idx);cells[idx].style.transitionDelay=(Math.min(k,24)*16)+'ms';cells[idx].className='cell open'+(n?' n'+n:'');if(n)cells[idx].textContent=n;});
      var oc=0;for(var z in opened)oc++;
      if(oc===N*N-M){over=true;won=true;statusEl.textContent='Cleared! Claim your reward.';done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';stage.classList.add('k-winglow');}}
    function flag(i){if(over||opened[i])return;if(flags[i]){delete flags[i];cells[i].textContent='';}else{flags[i]=1;cells[i].textContent='\u2691';}var fc=0;for(var z in flags)fc++;statusEl.textContent='Mines left: '+(M-fc)+' \xB7 one chance';}
    build();
  <\/script>
</div>`;
}
export {
  minesweeper
};
