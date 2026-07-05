import { gameHead, reward } from "./shell.js";
function sudokumini(usd) {
  return `<style>
    .sm-board{display:inline-grid;grid-template-columns:repeat(6,44px);grid-template-rows:repeat(6,44px);gap:2px;background:var(--line);border:2px solid var(--fg);border-radius:6px;padding:2px}
    .sm-cell{display:flex;align-items:center;justify-content:center;background:var(--card);font-family:var(--display);font-weight:700;font-size:20px;color:var(--fg);cursor:pointer;user-select:none;position:relative}
    .sm-cell.given{color:var(--muted);cursor:default;background:var(--chip)}
    .sm-cell.sel{outline:2px solid var(--clay);outline-offset:-2px;z-index:1}
    .sm-cell.conflict{background:var(--tint);color:var(--clay-d)}
    .sm-cell.boxR{border-right:2px solid var(--fg)}
    .sm-cell.boxB{border-bottom:2px solid var(--fg)}
    .sm-pad{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;justify-content:center}
    .sm-padbtn{width:34px;height:34px;border-radius:8px;border:1.5px solid var(--line);background:var(--card);color:var(--fg);font-family:var(--display);font-weight:700;font-size:16px;cursor:pointer}
    .sm-padbtn:hover{background:var(--chip)}
    @media (prefers-reduced-motion:reduce){ .k-shake-soft{animation:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Mini Sudoku", "Fill the 6\xD76 grid \u2014 1\u20136 in every row, column, and box", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Select a cell, then pick a number</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="hint" class="k-press">Hint</button> <button id="newb" class="k-press">New puzzle</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="smStage"><div class="sm-arena" style="display:flex;flex-direction:column;align-items:center">
    <div class="sm-board" id="board"></div>
    <div class="sm-pad" id="pad"></div>
  </div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),board=document.getElementById('board'),pad=document.getElementById('pad'),stage=document.getElementById('smStage');
    var solution,puzzle,user,given,sel,solved,hintUsed;
    function canPlace(g,r,c,v){for(var i=0;i<6;i++){if(g[r*6+i]===v)return false;if(g[i*6+c]===v)return false;}
      var br=Math.floor(r/2)*2,bc=Math.floor(c/3)*3;
      for(var rr=br;rr<br+2;rr++)for(var cc=bc;cc<bc+3;cc++)if(g[rr*6+cc]===v)return false;
      return true;}
    function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
    function fillGrid(g){var idx=-1;for(var i=0;i<36;i++){if(g[i]===0){idx=i;break;}}
      if(idx<0)return true;
      var r=Math.floor(idx/6),c=idx%6,vals=shuffle([1,2,3,4,5,6]);
      for(var k=0;k<6;k++){var v=vals[k];if(canPlace(g,r,c,v)){g[idx]=v;if(fillGrid(g))return true;g[idx]=0;}}
      return false;}
    function countSolutions(g,limit){var idx=-1;for(var i=0;i<36;i++){if(g[i]===0){idx=i;break;}}
      if(idx<0)return 1;
      var r=Math.floor(idx/6),c=idx%6,count=0;
      for(var v=1;v<=6;v++){if(canPlace(g,r,c,v)){g[idx]=v;count+=countSolutions(g,limit-count);g[idx]=0;if(count>=limit)break;}}
      return count;}
    function generate(){var full=new Array(36).fill(0);fillGrid(full);
      var puz=full.slice(),order=shuffle([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35]);
      var givens=36,MIN=12;
      for(var k=0;k<order.length;k++){var idx=order[k];if(givens<=MIN)break;if(puz[idx]===0)continue;
        var save=puz[idx];puz[idx]=0;var test=puz.slice();
        if(countSolutions(test,2)===1){givens--;}else{puz[idx]=save;}}
      return {solution:full,puzzle:puz};}
    function conflicts(){var bad={};
      for(var r=0;r<6;r++)for(var c=0;c<6;c++){var v=user[r*6+c];if(!v)continue;
        for(var c2=0;c2<6;c2++){if(c2!==c&&user[r*6+c2]===v)bad[r*6+c]=true;}
        for(var r2=0;r2<6;r2++){if(r2!==r&&user[r2*6+c]===v)bad[r*6+c]=true;}
        var br=Math.floor(r/2)*2,bc=Math.floor(c/3)*3;
        for(var rr=br;rr<br+2;rr++)for(var cc=bc;cc<bc+3;cc++){if((rr!==r||cc!==c)&&user[rr*6+cc]===v)bad[r*6+c]=true;}}
      return bad;}
    function render(){board.innerHTML='';var bad=conflicts();
      for(var r=0;r<6;r++)for(var c=0;c<6;c++){var i=r*6+c;var el=document.createElement('div');
        el.className='sm-cell'+(given[i]?' given':'')+(bad[i]?' conflict':'')+(sel===i?' sel':'');
        if(c===2)el.classList.add('boxR');if(r===1||r===3)el.classList.add('boxB');
        el.textContent=user[i]?user[i]:'';
        el.addEventListener('click',(function(idx){return function(){selectCell(idx);};})(i));
        board.appendChild(el);}}
    function selectCell(i){if(solved||given[i])return;sel=i;render();}
    function place(v){if(solved||sel===null||sel===undefined)return;if(given[sel])return;
      user[sel]=v;render();checkWin();}
    function buildPad(){pad.innerHTML='';for(var v=1;v<=6;v++){var b=document.createElement('button');b.className='sm-padbtn k-press';b.textContent=v;
      b.addEventListener('click',(function(vv){return function(){place(vv);};})(v));pad.appendChild(b);}
      var clr=document.createElement('button');clr.className='sm-padbtn k-press';clr.textContent='\xD7';
      clr.addEventListener('click',function(){if(sel!==null&&sel!==undefined&&!given[sel]){user[sel]=0;render();}});pad.appendChild(clr);}
    function checkWin(){for(var i=0;i<36;i++)if(user[i]!==solution[i])return;
      solved=true;statusEl.textContent=hintUsed?'Solved! (hint used)':'Solved with no hints!';
      done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}
    function hint(){if(solved)return;var empties=[];for(var i=0;i<36;i++)if(!given[i]&&user[i]!==solution[i])empties.push(i);
      if(!empties.length)return;var pick=empties[Math.floor(Math.random()*empties.length)];
      user[pick]=solution[pick];hintUsed=true;sel=pick;render();checkWin();}
    document.addEventListener('keydown',function(e){if(sel===null||sel===undefined)return;
      if(e.key>='1'&&e.key<='6'){place(parseInt(e.key,10));}
      else if(e.key==='Backspace'||e.key==='0'||e.key==='Delete'){if(!given[sel]){user[sel]=0;render();}}});
    function init(){var g=generate();solution=g.solution;puzzle=g.puzzle;user=puzzle.slice();
      given=puzzle.map(function(v){return v!==0;});sel=null;solved=false;hintUsed=false;
      done.disabled=true;done.classList.remove('k-earn-ready');
      statusEl.textContent='Select a cell, then pick a number';render();}
    document.getElementById('newb').addEventListener('click',init);
    document.getElementById('hint').addEventListener('click',hint);
    done.addEventListener('click',function(){var bonus=hintUsed?4:7;kiwiComplete(bonus,hintUsed?0:1,solved);});
    buildPad();init();
  <\/script>
</div>`;
}
export {
  sudokumini
};
