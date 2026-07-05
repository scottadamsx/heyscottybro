import { gameHead, reward } from "./shell.js";
function dotsboxes(usd) {
  return `<style>
    .db-board{display:inline-grid;gap:0;background:transparent}
    .db-dot{width:10px;height:10px;border-radius:50%;background:var(--muted);justify-self:center;align-self:center}
    .db-edge{background:var(--line);border-radius:3px;cursor:pointer;transition:background .12s}
    .db-edge:hover{background:var(--clay)}
    .db-edge.drawn{background:var(--clay-d);cursor:default}
    .db-edge.drawn.o{background:var(--fg)}
    .db-hedge{height:6px;align-self:center}
    .db-vedge{width:6px;justify-self:center}
    .db-box{border-radius:4px}
    .db-box.x{background:var(--tint)}
    .db-box.o{background:var(--chip)}
    .db-box.fillpop{animation:kdbpop .3s ease-out}
    @keyframes kdbpop{0%{transform:scale(.5);opacity:.2}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
    @media (prefers-reduced-motion:reduce){ .db-box.fillpop{animation:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Dots and Boxes", "Draw lines, complete boxes, avoid giving the CPU a free one", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Your move</div>
  <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><span class="k-chip" id="youChip">You: 0</span><span class="k-chip" id="cpuChip">CPU: 0</span></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb" class="k-press">New game</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="dbStage"><div class="db-board" id="board"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),board=document.getElementById('board'),youChip=document.getElementById('youChip'),cpuChip=document.getElementById('cpuChip'),stage=document.getElementById('dbStage');
    var DOTS=5,BOXES=DOTS-1; // 5 dots per side -> 4x4 = 16 boxes
    var DOT=10,EDGE=30,THICK=6;
    var hE,vE,owner,turn,over,youScore,cpuScore,winner;
    function hIdx(r,c){return r*BOXES+c;} // r:0..DOTS-1, c:0..BOXES-1
    function vIdx(r,c){return r*DOTS+c;} // r:0..BOXES-1, c:0..DOTS-1
    function boxSides(r,c){return (hE[hIdx(r,c)]?1:0)+(hE[hIdx(r+1,c)]?1:0)+(vE[vIdx(r,c)]?1:0)+(vE[vIdx(r,c+1)]?1:0);}
    function boxesForH(r,c){var out=[];if(r-1>=0)out.push([r-1,c]);if(r<BOXES)out.push([r,c]);return out;}
    function boxesForV(r,c){var out=[];if(c-1>=0)out.push([r,c-1]);if(c<BOXES)out.push([r,c]);return out;}
    function remaining(){var out=[];for(var r=0;r<DOTS;r++)for(var c=0;c<BOXES;c++)if(!hE[hIdx(r,c)])out.push({type:'h',r:r,c:c});
      for(var r2=0;r2<BOXES;r2++)for(var c2=0;c2<DOTS;c2++)if(!vE[vIdx(r2,c2)])out.push({type:'v',r:r2,c:c2});return out;}
    function affectedBoxes(e){return e.type==='h'?boxesForH(e.r,e.c):boxesForV(e.r,e.c);}
    function setEdge(e,val){if(e.type==='h')hE[hIdx(e.r,e.c)]=val;else vE[vIdx(e.r,e.c)]=val;}
    // wouldComplete/wouldCreate3 only ever run on undrawn (null) edges from remaining(), so the
    // hypothetical marker's color doesn't matter \u2014 reverting to null is always the correct undo.
    function wouldComplete(e){setEdge(e,'X');var n=0;var bs=affectedBoxes(e);for(var i=0;i<bs.length;i++)if(boxSides(bs[i][0],bs[i][1])===4)n++;setEdge(e,null);return n;}
    function wouldCreate3(e){setEdge(e,'X');var n=0;var bs=affectedBoxes(e);for(var i=0;i<bs.length;i++)if(boxSides(bs[i][0],bs[i][1])===3)n++;setEdge(e,null);return n;}
    function drawEdge(e,who){setEdge(e,who);var bs=affectedBoxes(e),completed=0;
      for(var i=0;i<bs.length;i++){var r=bs[i][0],c=bs[i][1];if(!owner[r*BOXES+c]&&boxSides(r,c)===4){owner[r*BOXES+c]=who;completed++;if(who==='X')youScore++;else cpuScore++;}}
      return completed;}
    function cellEl(sel){return board.querySelector(sel);}
    function renderEdge(e){var el=cellEl('[data-k="'+e.type+'-'+e.r+'-'+e.c+'"]');if(!el)return;var val=e.type==='h'?hE[hIdx(e.r,e.c)]:vE[vIdx(e.r,e.c)];
      el.classList.toggle('drawn',!!val);el.classList.toggle('o',val==='O');}
    function renderAll(newlyOwned){for(var r=0;r<DOTS;r++)for(var c=0;c<BOXES;c++)renderEdge({type:'h',r:r,c:c});
      for(var r2=0;r2<BOXES;r2++)for(var c2=0;c2<DOTS;c2++)renderEdge({type:'v',r:r2,c:c2});
      for(var r3=0;r3<BOXES;r3++)for(var c3=0;c3<BOXES;c3++){var o=owner[r3*BOXES+c3];var el=cellEl('[data-box="'+r3+'-'+c3+'"]');if(!el)continue;
        el.classList.remove('x','o');if(o)el.classList.add(o==='X'?'x':'o');}
      if(newlyOwned)for(var i=0;i<newlyOwned.length;i++){var el2=cellEl('[data-box="'+newlyOwned[i][0]+'-'+newlyOwned[i][1]+'"]');if(el2){el2.classList.remove('fillpop');void el2.offsetWidth;el2.classList.add('fillpop');}}
      youChip.textContent='You: '+youScore;cpuChip.textContent='CPU: '+cpuScore;}
    function ownedListFrom(bs){var out=[];for(var i=0;i<bs.length;i++){var r=bs[i][0],c=bs[i][1];if(owner[r*BOXES+c])out.push([r,c]);}return out;}
    function isGameOver(){return remaining().length===0;}
    function endGame(){over=true;winner=youScore>cpuScore;
      statusEl.textContent='Game over \u2014 you '+youScore+', CPU '+cpuScore+(winner?'. You win!':(youScore===cpuScore?'. Draw.':'. CPU wins.'));
      if(winner){done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}
      else{stage.classList.add('k-shake-soft');setTimeout(function(){stage.classList.remove('k-shake-soft');},420);}}
    function cpuTurn(){if(over)return;var edges=remaining();
      var completing=edges.filter(function(e){return wouldComplete(e)>0;});
      if(completing.length){completing.sort(function(a,b){return wouldComplete(b)-wouldComplete(a);});var e=completing[0];
        var bs=affectedBoxes(e);var n=drawEdge(e,'O');renderAll(ownedListFrom(bs));
        if(isGameOver()){endGame();return;}
        setTimeout(cpuTurn,380);return;}
      var safe=edges.filter(function(e){return wouldCreate3(e)===0;});
      var pick;
      if(safe.length){pick=safe[Math.floor(Math.random()*safe.length)];}
      else{edges.sort(function(a,b){return wouldCreate3(a)-wouldCreate3(b);});pick=edges[0];}
      var bs2=affectedBoxes(pick);drawEdge(pick,'O');renderAll(ownedListFrom(bs2));
      if(isGameOver()){endGame();return;}
      turn='X';statusEl.textContent='Your move';}
    function click(e){if(over||turn!=='X')return;var already=e.type==='h'?hE[hIdx(e.r,e.c)]:vE[vIdx(e.r,e.c)];if(already)return;
      var bs=affectedBoxes(e);var n=drawEdge(e,'X');renderAll(ownedListFrom(bs));
      if(isGameOver()){endGame();return;}
      if(n>0){statusEl.textContent='Nice \u2014 go again';return;}
      turn='O';statusEl.textContent='CPU is thinking\u2026';setTimeout(cpuTurn,450);}
    function buildBoard(){board.innerHTML='';var cols=[],rows=[];for(var i=0;i<DOTS;i++){cols.push(DOT+'px');rows.push(DOT+'px');if(i<BOXES){cols.push(EDGE+'px');rows.push(EDGE+'px');}}
      board.style.gridTemplateColumns=cols.join(' ');board.style.gridTemplateRows=rows.join(' ');
      var GN=DOTS+BOXES;
      for(var gi=0;gi<GN;gi++)for(var gj=0;gj<GN;gj++){var el=document.createElement('div');
        if(gi%2===0&&gj%2===0){el.className='db-dot';}
        else if(gi%2===0&&gj%2===1){var r=gi/2,c=(gj-1)/2;el.className='db-edge db-hedge';el.dataset.k='h-'+r+'-'+c;el.style.width=EDGE+'px';el.style.height=THICK+'px';el.addEventListener('click',function(rr,cc){return function(){click({type:'h',r:rr,c:cc});};}(r,c));}
        else if(gi%2===1&&gj%2===0){var r2=(gi-1)/2,c2=gj/2;el.className='db-edge db-vedge';el.dataset.k='v-'+r2+'-'+c2;el.style.width=THICK+'px';el.style.height=EDGE+'px';el.addEventListener('click',function(rr,cc){return function(){click({type:'v',r:rr,c:cc});};}(r2,c2));}
        else{var r3=(gi-1)/2,c3=(gj-1)/2;el.className='db-box';el.dataset.box=r3+'-'+c3;el.style.width=EDGE+'px';el.style.height=EDGE+'px';}
        board.appendChild(el);}}
    function init(){hE=new Array(DOTS*BOXES).fill(null);vE=new Array(BOXES*DOTS).fill(null);owner=new Array(BOXES*BOXES).fill(null);
      turn='X';over=false;winner=false;youScore=0;cpuScore=0;done.disabled=true;done.classList.remove('k-earn-ready');
      buildBoard();renderAll();statusEl.textContent='Your move';}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){var margin=youScore-cpuScore;var bonus=winner?(margin>=5?8:6):0;kiwiComplete(bonus,margin,winner);});
    init();
  <\/script>
</div>`;
}
export {
  dotsboxes
};
