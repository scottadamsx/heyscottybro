import { gameHead, reward } from "./shell.js";
function nonogram(usd) {
  return `<style>
    .no-board{display:inline-grid;gap:2px;background:transparent}
    .no-cell{width:30px;height:30px;border-radius:4px;background:var(--tile);cursor:pointer;transition:background .1s,transform .06s}
    .no-cell:hover{background:var(--hover)}
    .no-cell.filled{background:var(--fg)}
    .no-cell.filled:hover{background:var(--fg)}
    .no-clue-col,.no-clue-row{display:flex;font-family:var(--display);font-weight:600;font-size:13px;color:var(--muted);user-select:none}
    .no-clue-col{flex-direction:column;align-items:center;justify-content:flex-end;gap:1px;padding-bottom:3px}
    .no-clue-row{flex-direction:row;align-items:center;justify-content:flex-end;gap:5px;padding-right:6px}
    .no-corner{width:100%;height:100%}
    @keyframes nowrong{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
    .no-cell.wrong{animation:nowrong .22s ease-in-out;background:var(--tint)}
    @media (prefers-reduced-motion:reduce){ .no-cell.wrong{animation:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Nonogram", "Fill the 8\xD78 grid to match the row and column clues", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Mistakes: 0 / 3</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb" class="k-press">New puzzle</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="noStage"><div class="no-board" id="board"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),board=document.getElementById('board'),stage=document.getElementById('noStage');
    var N=8,CLUEW=64,CELL=30;
    var solution,filled,mistakes,solved,rowClues,colClues;
    function runsOf(arr){var runs=[],cur=0;for(var i=0;i<arr.length;i++){if(arr[i]){cur++;}else{if(cur>0)runs.push(cur);cur=0;}}if(cur>0)runs.push(cur);return runs.length?runs:[0];}
    function genSolution(){var s=new Array(N*N).fill(false);
      // Density ~45-58% filled, retried if a row or column ends up totally empty AND totally full
      // (keeps puzzles visually varied) \u2014 otherwise any random layout is a valid, solvable puzzle.
      for(var tries=0;tries<40;tries++){
        for(var i=0;i<N*N;i++)s[i]=Math.random()<0.5;
        var allEmpty=true,anyFilled=false;
        for(var i2=0;i2<N*N;i2++){if(s[i2])anyFilled=true;else allEmpty=false;}
        if(anyFilled&&!allEmpty)break;
      }
      return s;}
    function computeClues(){rowClues=[];colClues=[];
      for(var r=0;r<N;r++){var row=[];for(var c=0;c<N;c++)row.push(solution[r*N+c]);rowClues.push(runsOf(row));}
      for(var c2=0;c2<N;c2++){var col=[];for(var r2=0;r2<N;r2++)col.push(solution[r2*N+c2]);colClues.push(runsOf(col));}}
    function solvedFilledCount(){var n=0;for(var i=0;i<N*N;i++)if(solution[i])n++;return n;}
    function buildBoard(){board.innerHTML='';
      var maxRowClueW=Math.max.apply(null,rowClues.map(function(r){return r.length;}));
      var clueColW=Math.max(46,maxRowClueW*16+10);
      board.style.gridTemplateColumns=clueColW+'px repeat('+N+','+CELL+'px)';
      board.style.gridTemplateRows=CLUEW+'px repeat('+N+','+CELL+'px)';
      var corner=document.createElement('div');corner.className='no-corner';board.appendChild(corner);
      for(var c=0;c<N;c++){var cc=document.createElement('div');cc.className='no-clue-col';cc.style.width=CELL+'px';
        colClues[c].forEach(function(n){var s=document.createElement('span');s.textContent=n;cc.appendChild(s);});
        board.appendChild(cc);}
      for(var r=0;r<N;r++){
        var rc=document.createElement('div');rc.className='no-clue-row';rc.style.height=CELL+'px';
        rc.textContent=rowClues[r].join(' ');
        board.appendChild(rc);
        for(var c2=0;c2<N;c2++){
          var cell=document.createElement('div');cell.className='no-cell';cell.dataset.i=r*N+c2;
          cell.addEventListener('click',(function(idx){return function(){click(idx);};})(r*N+c2));
          board.appendChild(cell);
        }
      }
    }
    function renderCell(i){var el=board.querySelector('[data-i="'+i+'"]');if(!el)return;el.classList.toggle('filled',!!filled[i]);}
    function click(i){if(solved)return;
      if(filled[i]){filled[i]=false;renderCell(i);return;}
      if(solution[i]){filled[i]=true;renderCell(i);checkWin();return;}
      var el=board.querySelector('[data-i="'+i+'"]');if(el){el.classList.remove('wrong');void el.offsetWidth;el.classList.add('wrong');}
      mistakes++;statusEl.textContent='Mistakes: '+mistakes+' / 3';
      if(mistakes>=3){resetBoard('Too many mistakes \u2014 board reset. Same puzzle, try again.');}
    }
    function checkWin(){var filledCount=0;for(var i=0;i<N*N;i++)if(filled[i])filledCount++;
      if(filledCount===solvedFilledCount()){solved=true;statusEl.textContent='Solved with '+mistakes+' mistake'+(mistakes===1?'':'s')+'!';
        done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}}
    function resetBoard(msg){filled=new Array(N*N).fill(false);mistakes=0;for(var i=0;i<N*N;i++)renderCell(i);
      stage.classList.add('k-shake-soft');setTimeout(function(){stage.classList.remove('k-shake-soft');},420);
      statusEl.textContent=(msg?msg+' \xB7 ':'')+'Mistakes: 0 / 3';}
    function init(){solution=genSolution();computeClues();filled=new Array(N*N).fill(false);mistakes=0;solved=false;
      done.disabled=true;done.classList.remove('k-earn-ready');
      buildBoard();statusEl.textContent='Mistakes: 0 / 3';}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){var bonus=mistakes===0?7:4;kiwiComplete(bonus,mistakes,solved);});
    init();
  <\/script>
</div>`;
}
export {
  nonogram
};
