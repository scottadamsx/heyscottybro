import { gameHead, reward } from "./shell.js";
function gridseek(usd) {
  return `<style>
    .gs-board{display:inline-grid;grid-template-columns:repeat(10,30px);grid-template-rows:repeat(10,30px);gap:1px;background:var(--line);padding:6px;border-radius:8px;user-select:none}
    .gs-cell{width:30px;height:30px;background:var(--card);display:flex;align-items:center;justify-content:center;font-family:var(--sans);font-weight:700;font-size:13px;color:var(--fg);cursor:pointer;border-radius:3px}
    .gs-cell.sel{background:var(--tint);color:var(--clay-d)}
    .gs-cell.found{background:var(--green);color:#fff}
    .gs-words{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:12px;max-width:280px}
    .gs-word{font-size:12.5px;font-weight:700;color:var(--fg);letter-spacing:.02em}
    .gs-word.found{color:var(--muted);text-decoration:line-through}
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Word Search", "Find all 8 hidden words in the 10x10 grid", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Time: 3:00 \xB7 Found 0 / 8</div>
  <div class="gs-words" id="wordlist"></div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb" class="k-press">New puzzle</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="gsStage"><div class="gs-board" id="board"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),board=document.getElementById('board'),wordlistEl=document.getElementById('wordlist'),stage=document.getElementById('gsStage');
    var SIZE=10,BANK=['CODE','DEBUG','BRANCH','MERGE','COMMIT','SCRIPT','ARRAY','KIWI','AGENT','LOOP','TOKEN','CACHE'];
    var DIRS8=[[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
    var grid,cells,placed,found,over,won,anchor,dragMoved,curPath,timeLeft,timer,startedAt,elapsedAtWin;
    function idx(r,c){return r*SIZE+c;}
    function inb(r,c){return r>=0&&r<SIZE&&c>=0&&c<SIZE;}
    function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
    function tryPlace(g,word,attempts){
      for(var a=0;a<attempts;a++){
        var dir=DIRS8[Math.floor(Math.random()*DIRS8.length)];var dr=dir[0],dc=dir[1];var len=word.length;
        var r0min=dr<0?(len-1):0,r0max=dr>0?(SIZE-len):(SIZE-1);
        var c0min=dc<0?(len-1):0,c0max=dc>0?(SIZE-len):(SIZE-1);
        if(r0min>r0max||c0min>c0max)continue;
        var r0=r0min+Math.floor(Math.random()*(r0max-r0min+1));
        var c0=c0min+Math.floor(Math.random()*(c0max-c0min+1));
        var path=[],ok=true;
        for(var i=0;i<len;i++){var r=r0+dr*i,c=c0+dc*i;if(!inb(r,c)){ok=false;break;}
          var existing=g[idx(r,c)];if(existing!==null&&existing!==word[i]){ok=false;break;}
          path.push(idx(r,c));}
        if(!ok)continue;
        for(var k=0;k<len;k++)g[path[k]]=word[k];
        return path;}
      return null;}
    function buildPuzzle(){
      for(var outer=0;outer<100;outer++){
        var g=new Array(SIZE*SIZE).fill(null);
        var chosen=shuffle(BANK.slice()).slice(0,8);
        var pl=[],failed=false;
        for(var w=0;w<chosen.length;w++){var path=tryPlace(g,chosen[w],400);if(!path){failed=true;break;}pl.push({word:chosen[w],cells:path,found:false});}
        if(!failed){var letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';for(var i=0;i<g.length;i++)if(g[i]===null)g[i]=letters[Math.floor(Math.random()*letters.length)];
          return{grid:g,placed:pl};}}
      return null;}
    function straightPath(aIdx,bIdx){var ar=Math.floor(aIdx/SIZE),ac=aIdx%SIZE,br=Math.floor(bIdx/SIZE),bc=bIdx%SIZE;
      var dr=br-ar,dc=bc-ac;if(dr===0&&dc===0)return null;
      if(!(dr===0||dc===0||Math.abs(dr)===Math.abs(dc)))return null;
      var steps=Math.max(Math.abs(dr),Math.abs(dc));var sdr=dr===0?0:dr/Math.abs(dr),sdc=dc===0?0:dc/Math.abs(dc);
      var path=[];for(var k=0;k<=steps;k++)path.push(idx(ar+sdr*k,ac+sdc*k));return path;}
    function arraysEqual(a,b){if(a.length!==b.length)return false;for(var i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
    function matchWord(path){for(var i=0;i<placed.length;i++){var pw=placed[i];if(pw.found)continue;
      if(arraysEqual(path,pw.cells)||arraysEqual(path,pw.cells.slice().reverse()))return pw;}return null;}
    function renderWordList(){wordlistEl.innerHTML='';placed.forEach(function(pw){var s=document.createElement('span');s.className='gs-word'+(pw.found?' found':'');s.textContent=pw.word;wordlistEl.appendChild(s);});}
    function clearTransientHighlight(){cells.forEach(function(cell,i){if(!cell.classList.contains('found'))cell.classList.remove('sel');});}
    function highlightPath(path){clearTransientHighlight();path.forEach(function(i){cells[i].classList.add('sel');});}
    function markFound(pw){pw.found=true;found++;pw.cells.forEach(function(i){cells[i].classList.remove('sel');cells[i].classList.add('found');});
      renderWordList();
      statusEl.textContent='Time: '+fmtTime(timeLeft)+' \xB7 Found '+found+' / '+placed.length;
      if(found>=placed.length)winAll();}
    function fmtTime(t){var m=Math.floor(t/60),s=t%60;return m+':'+(s<10?'0':'')+s;}
    function winAll(){over=true;won=true;if(timer){clearInterval(timer);timer=null;}
      elapsedAtWin=180-timeLeft;
      statusEl.textContent='All 8 found in '+elapsedAtWin+'s!';
      done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}
    function timeUp(){over=true;won=false;if(timer){clearInterval(timer);timer=null;}
      statusEl.textContent="Time's up \u2014 "+found+' / '+placed.length+' found. New puzzle to try again.';
      stage.classList.add('k-shake-soft');setTimeout(function(){stage.classList.remove('k-shake-soft');},420);}
    function tick(){if(over)return;timeLeft--;if(timeLeft<=0){timeLeft=0;statusEl.textContent='Time: 0:00 \xB7 Found '+found+' / '+placed.length;timeUp();return;}
      statusEl.textContent='Time: '+fmtTime(timeLeft)+' \xB7 Found '+found+' / '+placed.length;}
    function finalizeSelection(path){if(!path||path.length<2){clearTransientHighlight();return;}
      var pw=matchWord(path);
      if(pw){markFound(pw);}else{highlightPath(path);setTimeout(clearTransientHighlight,260);}}
    function onDown(i){if(over)return;
      if(anchor===null){anchor=i;dragMoved=false;curPath=[i];highlightPath(curPath);}
      else{var path=straightPath(anchor,i);anchor=null;dragMoved=false;finalizeSelection(path);}}
    function onDrag(i){if(over||anchor===null)return;dragMoved=true;var path=straightPath(anchor,i);if(path){curPath=path;highlightPath(path);}}
    function onUp(){if(over)return;
      if(anchor!==null&&dragMoved){finalizeSelection(curPath);anchor=null;dragMoved=false;}}
    function render(){cells.forEach(function(cell,i){cell.textContent=grid[i];});}
    function init(){var p=buildPuzzle();grid=p.grid;placed=p.placed;found=0;over=false;won=false;anchor=null;dragMoved=false;curPath=null;timeLeft=180;
      done.disabled=true;done.classList.remove('k-earn-ready');
      board.innerHTML='';cells=[];
      for(var i=0;i<SIZE*SIZE;i++){(function(i){var cell=document.createElement('div');cell.className='gs-cell';
        cell.addEventListener('mousedown',function(e){e.preventDefault();onDown(i);});
        cell.addEventListener('mouseenter',function(e){if(e.buttons===1)onDrag(i);});
        board.appendChild(cell);cells.push(cell);})(i);}
      document.addEventListener('mouseup',onUp);
      render();renderWordList();
      statusEl.textContent='Time: 3:00 \xB7 Found 0 / '+placed.length;
      if(timer)clearInterval(timer);timer=setInterval(tick,1000);}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){var bonus=won?(elapsedAtWin<=90?6:4):0;kiwiComplete(bonus,found,won);});
    init();
  <\/script>
</div>`;
}
export {
  gridseek
};
