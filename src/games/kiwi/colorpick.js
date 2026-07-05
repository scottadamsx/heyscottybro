import { gameHead, reward } from "./shell.js";
function colorpick(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Odd One Out", "Tap the tile that is a slightly different shade. It gets harder each level", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Level 1</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb">Restart</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="grid" style="display:inline-grid;gap:5px"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),grid=document.getElementById('grid');
    var level,over,oddBtn;
    function build(){oddBtn=null;var n=Math.min(6,2+Math.floor(level/2));var size=Math.floor(264/n)-5;grid.style.gridTemplateColumns='repeat('+n+','+size+'px)';
      var base=[60+Math.random()*120,90+Math.random()*100,90+Math.random()*100];var diff=Math.max(7,42-level*2.3);
      var sign=Math.random()<.5?1:-1;var odd=Math.floor(Math.random()*n*n);
      grid.innerHTML='';for(var i=0;i<n*n;i++){(function(i){var col=base.slice();if(i===odd)col[0]=Math.max(0,Math.min(255,col[0]+sign*diff));var b=document.createElement('button');b.style.cssText='width:'+size+'px;height:'+size+'px;border:0;border-radius:6px;cursor:pointer;background:rgb('+Math.round(col[0])+','+Math.round(col[1])+','+Math.round(col[2])+')';b.addEventListener('click',function(){pick(i===odd);});if(i===odd){oddBtn=b;}grid.appendChild(b);})(i);}}
    function pick(correct){if(over)return;if(correct){level++;statusEl.textContent='Level '+level;done.disabled=false;done.textContent='Cash out ${reward(usd)} + bonus';build();}else{over=true;if(oddBtn){oddBtn.style.outline='4px solid #fff';oddBtn.style.outlineOffset='-4px';oddBtn.style.boxShadow='0 0 0 6px rgba(0,0,0,.55)';}statusEl.textContent='Wrong tile \u2014 the highlighted one was it. Reached level '+level;done.disabled=false;done.textContent='Claim ${reward(usd)}'+(level>1?' + bonus':'');}}
    function init(){level=1;over=false;done.disabled=true;statusEl.textContent='Level 1';build();}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){kiwiComplete(Math.min(15,level-1),level-1);});
    init();
  <\/script>
</div>`;
}
export {
  colorpick
};
