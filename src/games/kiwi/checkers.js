import { gameHead, reward } from "./shell.js";
function checkers(usd) {
  return `<style>
    .ck-board{display:inline-grid;grid-template-columns:repeat(8,38px);grid-template-rows:repeat(8,38px);border-radius:8px;overflow:hidden;border:2px solid #4a3624}
    .ck-cell{width:38px;height:38px;display:flex;align-items:center;justify-content:center;position:relative}
    .ck-cell.light{background:#EDE3CE}
    .ck-cell.dark{background:#7C5C43}
    .ck-cell.dark.sel{background:#a6835f}
    .ck-cell.dark.hint::after{content:'';width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.55)}
    .ck-piece{width:29px;height:29px;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,.4);cursor:pointer;display:flex;align-items:center;justify-content:center}
    .ck-piece.red{background:var(--clay)}
    .ck-piece.black{background:#2E2B25}
    .ck-piece.king{box-shadow:0 0 0 3px var(--gold),0 2px 4px rgba(0,0,0,.4)}
    .ck-piece.place-anim{animation:ktilepop .22s cubic-bezier(.2,.9,.3,1.2)}
    @media (prefers-reduced-motion:reduce){ .ck-piece.place-anim{animation:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Checkers", "8x8 draughts vs the CPU \u2014 forced captures, kings", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Your move (you are the clay pieces)</div>
  <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><span class="k-chip" id="youChip">You: 12</span><span class="k-chip" id="cpuChip">CPU: 12</span><span class="k-chip" id="kingsChip">Kings lost: 0</span></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb" class="k-press">New game</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="ckStage"><div class="ck-board" id="board"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),board=document.getElementById('board'),youChip=document.getElementById('youChip'),cpuChip=document.getElementById('cpuChip'),kingsChip=document.getElementById('kingsChip'),stage=document.getElementById('ckStage');
    var cells,grid,over,winner,kingsLostByPlayer,selected,thinking;
    function inb(r,c){return r>=0&&r<8&&c>=0&&c<8;}
    function idx(r,c){return r*8+c;}
    function isKingPiece(p){return p==='R'||p==='B';}
    function colorOf(p){return (p==='r'||p==='R')?'red':(p==='b'||p==='B')?'black':null;}
    function forwardDirs(color,king){if(king)return[[-1,-1],[-1,1],[1,-1],[1,1]];return color==='red'?[[-1,-1],[-1,1]]:[[1,-1],[1,1]];}
    function initBoard(){var b=new Array(64).fill(null);
      for(var r=0;r<3;r++)for(var c=0;c<8;c++)if((r+c)%2===1)b[idx(r,c)]='b';
      for(var r2=5;r2<8;r2++)for(var c2=0;c2<8;c2++)if((r2+c2)%2===1)b[idx(r2,c2)]='r';
      return b;}
    function genHopsFrom(g,r,c){var piece=g[idx(r,c)];if(!piece)return[];var color=colorOf(piece),king=isKingPiece(piece);
      var dirs=forwardDirs(color,king),out=[];
      for(var i=0;i<dirs.length;i++){var dr=dirs[i][0],dc=dirs[i][1];var mr=r+dr,mc=c+dc,tr=r+2*dr,tc=c+2*dc;
        if(!inb(tr,tc)||!inb(mr,mc))continue;
        var mid=g[idx(mr,mc)];if(!mid||colorOf(mid)===color)continue;
        if(g[idx(tr,tc)])continue;
        out.push({mr:mr,mc:mc,tr:tr,tc:tc});}
      return out;}
    function genSimpleFrom(g,r,c){var piece=g[idx(r,c)];if(!piece)return[];var color=colorOf(piece),king=isKingPiece(piece);
      var dirs=forwardDirs(color,king),out=[];
      for(var i=0;i<dirs.length;i++){var dr=dirs[i][0],dc=dirs[i][1];var tr=r+dr,tc=c+dc;
        if(!inb(tr,tc)||g[idx(tr,tc)])continue;out.push({tr:tr,tc:tc});}
      return out;}
    function simpleMovesForColor(g,color){var out=[];for(var i=0;i<64;i++){var p=g[i];if(p&&colorOf(p)===color){var r=Math.floor(i/8),c=i%8;var hops=genSimpleFrom(g,r,c);
      for(var h=0;h<hops.length;h++)out.push({or:r,oc:c,tr:hops[h].tr,tc:hops[h].tc});}}return out;}
    function applySimpleMove(g,move){var nb=g.slice();var piece=nb[idx(move.or,move.oc)];var color=colorOf(piece);nb[idx(move.or,move.oc)]=null;
      var finalPiece=piece;if(!isKingPiece(piece)){if(color==='red'&&move.tr===0)finalPiece='R';if(color==='black'&&move.tr===7)finalPiece='B';}
      nb[idx(move.tr,move.tc)]=finalPiece;return nb;}
    function dfsCaptures(g,r,c,origin,path,captured,sequences){var hops=genHopsFrom(g,r,c);
      if(hops.length===0){if(captured.length>0)sequences.push({origin:origin,path:path.slice(),captured:captured.slice()});return;}
      for(var i=0;i<hops.length;i++){var h=hops[i];var nb=g.slice();var piece=nb[idx(r,c)];var color=colorOf(piece);
        nb[idx(r,c)]=null;nb[idx(h.mr,h.mc)]=null;
        var landed=piece,promoted=false;
        if(!isKingPiece(piece)){if((color==='red'&&h.tr===0)||(color==='black'&&h.tr===7)){landed=color==='red'?'R':'B';promoted=true;}}
        nb[idx(h.tr,h.tc)]=landed;
        var newPath=path.concat([{r:h.tr,c:h.tc}]);var newCaptured=captured.concat([idx(h.mr,h.mc)]);
        if(promoted){sequences.push({origin:origin,path:newPath,captured:newCaptured});}
        else{dfsCaptures(nb,h.tr,h.tc,origin,newPath,newCaptured,sequences);}}}
    function allCaptureSequencesForColor(g,color){var seqs=[];for(var i=0;i<64;i++){var p=g[i];if(p&&colorOf(p)===color){var r=Math.floor(i/8),c=i%8;
      dfsCaptures(g,r,c,{r:r,c:c},[{r:r,c:c}],[],seqs);}}return seqs;}
    function applySequence(g,seq){var nb=g.slice();var piece=nb[idx(seq.path[0].r,seq.path[0].c)];var color=colorOf(piece);var isK=isKingPiece(piece);
      nb[idx(seq.path[0].r,seq.path[0].c)]=null;
      for(var i=1;i<seq.path.length;i++){var a=seq.path[i-1],b=seq.path[i];var mr=(a.r+b.r)/2,mc=(a.c+b.c)/2;nb[idx(mr,mc)]=null;}
      var last=seq.path[seq.path.length-1];var finalPiece=piece;
      if(!isK){if(color==='red'&&last.r===0)finalPiece='R';if(color==='black'&&last.r===7)finalPiece='B';}
      nb[idx(last.r,last.c)]=finalPiece;return nb;}
    function legalMovesForColor(g,color){var caps=allCaptureSequencesForColor(g,color);if(caps.length>0)return{kind:'capture',moves:caps};
      return{kind:'simple',moves:simpleMovesForColor(g,color)};}
    function applyAny(g,kind,move){return kind==='capture'?applySequence(g,move):applySimpleMove(g,move);}
    function evalBoard(g){var m=0;for(var i=0;i<64;i++){var p=g[i];if(!p)continue;var r=Math.floor(i/8);
      if(p==='b')m+=1+r*0.02;else if(p==='B')m+=1.5;else if(p==='r')m-=1+(7-r)*0.02;else if(p==='R')m-=1.5;}
      return m;}
    function cpuChooseMove(g){var lm=legalMovesForColor(g,'black');if(lm.moves.length===0)return null;
      if(lm.moves.length===1)return{kind:lm.kind,move:lm.moves[0]};
      var bestVal=-Infinity,bestMoves=[];
      for(var i=0;i<lm.moves.length;i++){var b2=applyAny(g,lm.kind,lm.moves[i]);
        var rlm=legalMovesForColor(b2,'red');var val;
        if(rlm.moves.length===0){val=1000;}
        else{var worst=Infinity;for(var j=0;j<rlm.moves.length;j++){var b3=applyAny(b2,rlm.kind,rlm.moves[j]);var v=evalBoard(b3);if(v<worst)worst=v;}val=worst;}
        if(val>bestVal+1e-9){bestVal=val;bestMoves=[lm.moves[i]];}else if(Math.abs(val-bestVal)<1e-9){bestMoves.push(lm.moves[i]);}}
      var pick=bestMoves[Math.floor(Math.random()*bestMoves.length)];
      return{kind:lm.kind,move:pick};}
    function counts(g){var r=0,b2=0;for(var i=0;i<64;i++){if(g[i]&&colorOf(g[i])==='red')r++;else if(g[i]&&colorOf(g[i])==='black')b2++;}return{r:r,b:b2};}
    function updChips(){var c=counts(grid);youChip.textContent='You: '+c.r;cpuChip.textContent='CPU: '+c.b;kingsChip.textContent='Kings lost: '+kingsLostByPlayer;}
    function pieceEl(p,i){var d=document.createElement('div');d.className='ck-piece place-anim '+(colorOf(p)==='red'?'red':'black')+(isKingPiece(p)?' king':'');return d;}
    function render(hintOrigins,hintDests){cells.forEach(function(cell,i){cell.classList.toggle('sel',!!(hintOrigins&&hintOrigins.indexOf(i)>=0));
        cell.classList.toggle('hint',!!(hintDests&&hintDests.indexOf(i)>=0));
        cell.innerHTML='';var p=grid[i];if(p)cell.appendChild(pieceEl(p,i));});updChips();}
    function playerLegal(){return legalMovesForColor(grid,'red');}
    function originsFor(lm){var s={};lm.moves.forEach(function(m){var oi=lm.kind==='capture'?idx(m.path[0].r,m.path[0].c):idx(m.or,m.oc);s[oi]=true;});return Object.keys(s).map(Number);}
    function destsForOrigin(lm,oi){if(lm.kind==='capture'){return lm.moves.filter(function(m){return idx(m.path[0].r,m.path[0].c)===oi;}).map(function(m){return idx(m.path[1].r,m.path[1].c);});}
      return lm.moves.filter(function(m){return idx(m.or,m.oc)===oi;}).map(function(m){return idx(m.tr,m.tc);});}
    function endIfNoMoves(){var lm=playerLegal();if(lm.moves.length===0){finish(false);return true;}return false;}
    function finish(youWin){over=true;winner=youWin;var msg=youWin?'You win! The CPU has no legal move.':'You have no legal move \u2014 CPU wins.';
      statusEl.textContent=msg;render();
      if(youWin){done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}
      else{stage.classList.add('k-shake-soft');setTimeout(function(){stage.classList.remove('k-shake-soft');},420);}}
    function cpuTurn(){thinking=true;statusEl.textContent='CPU is thinking\u2026';
      setTimeout(function(){
        var lm=legalMovesForColor(grid,'black');
        if(lm.moves.length===0){thinking=false;finish(true);return;}
        var choice=cpuChooseMove(grid);
        if(choice.kind==='capture'&&choice.move.captured){for(var k=0;k<choice.move.captured.length;k++){var ci=choice.move.captured[k];if(grid[ci]==='R')kingsLostByPlayer++;}}
        grid=applyAny(grid,choice.kind,choice.move);
        thinking=false;render();
        if(endIfNoMoves())return;
        statusEl.textContent='Your move';render(originsFor(playerLegal()));
      },420);}
    function click(i){if(over||thinking)return;var lm=playerLegal();var origins=originsFor(lm);
      if(selected===null||selected===undefined){
        if(origins.indexOf(i)>=0){selected=i;render([i],destsForOrigin(lm,i));}
        return;}
      var dests=destsForOrigin(lm,selected);
      if(dests.indexOf(i)>=0){
        if(lm.kind==='capture'){var seq=lm.moves.filter(function(m){return idx(m.path[0].r,m.path[0].c)===selected&&idx(m.path[1].r,m.path[1].c)===i;})[0];
          // Apply just the first hop of the chosen sequence; if the landed piece still has a
          // forced continuation available, keep this same piece selected and require it to continue.
          var r0=seq.path[0].r,c0=seq.path[0].c,r1=seq.path[1].r,c1=seq.path[1].c;
          var midr=(r0+r1)/2,midc=(c0+c1)/2;var piece=grid[idx(r0,c0)];var color=colorOf(piece);
          var nb=grid.slice();nb[idx(r0,c0)]=null;nb[idx(midr,midc)]=null;
          var promoted=false,landed=piece;
          if(!isKingPiece(piece)){if((color==='red'&&r1===0)){landed='R';promoted=true;}}
          nb[idx(r1,c1)]=landed;grid=nb;selected=null;
          var cont=!promoted&&genHopsFrom(grid,r1,c1).length>0;
          if(cont){selected=idx(r1,c1);render([selected],genHopsFrom(grid,r1,c1).map(function(h){return idx(h.tr,h.tc);}));return;}
        }else{var mv={or:Math.floor(selected/8),oc:selected%8,tr:Math.floor(i/8),tc:i%8};grid=applySimpleMove(grid,mv);selected=null;}
        render();
        if(endIfNoMoves())return;
        cpuTurn();
      }else if(origins.indexOf(i)>=0){selected=i;render([i],destsForOrigin(lm,i));}
      else{selected=null;render();}}
    function init(){grid=initBoard();over=false;winner=false;kingsLostByPlayer=0;selected=null;thinking=false;
      done.disabled=true;done.classList.remove('k-earn-ready');
      board.innerHTML='';cells=[];
      for(var r=0;r<8;r++)for(var c=0;c<8;c++){(function(i){var cell=document.createElement('div');var dark=(Math.floor(i/8)+i%8)%2===1;
        cell.className='ck-cell '+(dark?'dark':'light');if(dark)cell.addEventListener('click',function(){click(i);});board.appendChild(cell);cells.push(cell);})(r*8+c);}
      statusEl.textContent='Your move (you are the clay pieces)';render(originsFor(playerLegal()));}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){var c=counts(grid);var bonus=winner?(kingsLostByPlayer===0?8:5):0;kiwiComplete(bonus,c.r-c.b,winner);});
    init();
  <\/script>
</div>`;
}
export {
  checkers
};
