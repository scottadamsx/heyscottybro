import { gameHead, reward } from "./shell.js";
function sokoban(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Sokoban", "Arrow keys \u2014 push every box onto a ringed target. You can push but not pull", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Level 1</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="resetb">Reset level</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="grid" tabindex="0" style="display:inline-grid;gap:2px;outline:none"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),grid=document.getElementById('grid');
    var LEVELS=[['########','#      #','# .$@  #','#      #','########'],['#######','#  .  #','#  $  #','#  @  #','#     #','#######'],['########','#  .   #','# .$$@ #','#      #','#   .  #','########']];
    var lvl=0,map,px,py,solvedAll=false;
    function load(){map=LEVELS[lvl].map(function(r){return r.split('');});for(var r=0;r<map.length;r++)for(var c=0;c<map[r].length;c++){if(map[r][c]==='@'){px=c;py=r;map[r][c]=' ';}}draw();statusEl.textContent='Level '+(lvl+1)+' of '+LEVELS.length;grid.focus();}
    function cell(r,c){return (map[r]&&map[r][c]!==undefined)?map[r][c]:'#';}
    function draw(){grid.style.gridTemplateColumns='repeat('+map[0].length+',32px)';grid.innerHTML='';for(var r=0;r<map.length;r++)for(var c=0;c<map[r].length;c++){var ch=map[r][c],bg='transparent',inner='';if(r===py&&c===px){bg='var(--card)';inner='<div style="width:18px;height:18px;border-radius:50%;background:#d97757"></div>';}else if(ch==='#')bg='#3a3d30';else if(ch==='$'){bg='var(--card)';inner='<div style="width:22px;height:22px;border-radius:5px;background:#caa23a"></div>';}else if(ch==='*'){bg='var(--card)';inner='<div style="width:22px;height:22px;border-radius:5px;background:#8bc34a"></div>';}else if(ch==='.'){bg='var(--card)';inner='<div style="width:11px;height:11px;border-radius:50%;border:2px solid #8bc34a"></div>';}else bg='var(--card)';var d=document.createElement('div');d.style.cssText='width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:4px;background:'+bg;d.innerHTML=inner;grid.appendChild(d);}}
    function won(){for(var r=0;r<map.length;r++)for(var c=0;c<map[r].length;c++)if(map[r][c]==='$')return false;return true;}
    function move(dr,dc){if(solvedAll)return;var nr=py+dr,nc=px+dc,t=cell(nr,nc);if(t==='#')return;
      if(t==='$'||t==='*'){var br=nr+dr,bc=nc+dc,bt=cell(br,bc);if(bt==='#'||bt==='$'||bt==='*')return;map[nr][nc]=(t==='*')?'.':' ';map[br][bc]=(bt==='.')?'*':'$';}
      px=nc;py=nr;draw();
      if(won()){if(lvl<LEVELS.length-1){lvl++;done.disabled=false;done.textContent='Cash out ${reward(usd)} + bonus';statusEl.textContent='Solved! Next level\u2026';setTimeout(load,700);}else{solvedAll=true;statusEl.textContent='All levels solved! Nice.';done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';}}}
    grid.addEventListener('keydown',function(e){var k=e.key;if(k==='ArrowUp'){e.preventDefault();move(-1,0);}else if(k==='ArrowDown'){e.preventDefault();move(1,0);}else if(k==='ArrowLeft'){e.preventDefault();move(0,-1);}else if(k==='ArrowRight'){e.preventDefault();move(0,1);}});
    document.getElementById('resetb').addEventListener('click',load);
    done.addEventListener('click',function(){kiwiComplete(Math.min(10,(lvl+(solvedAll?1:0))*3),lvl);});
    load();
  <\/script>
</div>`;
}
export {
  sokoban
};
