import { gameHead, reward } from "./shell.js";
function pipes(usd) {
  return `<style>
    .pp-board{display:inline-grid;grid-template-columns:repeat(6,40px);grid-template-rows:repeat(6,40px);gap:2px;background:var(--line);border-radius:8px;padding:6px}
    .pp-cell{width:40px;height:40px;background:var(--card);border-radius:4px;position:relative}
    .pp-tile{width:100%;height:100%;position:relative;cursor:pointer}
    .pp-rot{position:absolute;inset:0;transition:transform .18s ease}
    .pp-arm{position:absolute;background:var(--fg);border-radius:2px}
    .pp-arm-N{left:50%;top:0;width:8px;height:52%;transform:translateX(-50%)}
    .pp-arm-E{top:50%;right:0;width:52%;height:8px;transform:translateY(-50%)}
    .pp-arm-S{left:50%;bottom:0;width:8px;height:52%;transform:translateX(-50%)}
    .pp-arm-W{top:50%;left:0;width:52%;height:8px;transform:translateY(-50%)}
    .pp-hub{position:absolute;left:50%;top:50%;width:13px;height:13px;border-radius:50%;background:var(--fg);transform:translate(-50%,-50%)}
    .pp-tile.aligned .pp-arm,.pp-tile.aligned .pp-hub{background:var(--green)}
    .pp-tile.source .pp-hub{background:var(--clay);width:17px;height:17px}
    .pp-tile.source.aligned .pp-hub{background:var(--green2)}
    .pp-tile.drain .pp-hub{background:var(--clay-d);width:17px;height:17px}
    .pp-tile.drain.aligned .pp-hub{background:var(--green2)}
    @media (prefers-reduced-motion:reduce){ .pp-rot{transition:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Pipes", "Rotate tiles to connect the source to the drain", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Rotations: 0 / 40</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb" class="k-press">New puzzle</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" id="ppStage"><div class="pp-board" id="board"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),board=document.getElementById('board'),stage=document.getElementById('ppStage');
    var N=6,BUDGET=40,DIRS=['N','E','S','W'];
    var DELTA={N:[-1,0],E:[0,1],S:[1,0],W:[0,-1]};
    var BASE={END:['N'],I:['N','S'],L:['N','E']};
    var tiles,pathCells,rotations,solved,locked;
    function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
    function dirFrom(a,b){var dr=b[0]-a[0],dc=b[1]-a[1];for(var i=0;i<4;i++){if(DELTA[DIRS[i]][0]===dr&&DELTA[DIRS[i]][1]===dc)return DIRS[i];}return null;}
    function dfsPath(path,visited,target,budget){
      if(path.length>=target)return true;
      if(budget.n-- <=0)return false;
      var cur=path[path.length-1],dirs=shuffle(DIRS.slice());
      for(var i=0;i<4;i++){var nr=cur[0]+DELTA[dirs[i]][0],nc=cur[1]+DELTA[dirs[i]][1];
        if(nr<0||nr>=N||nc<0||nc>=N)continue;var key=nr+','+nc;if(visited[key])continue;
        var nxt=[nr,nc];path.push(nxt);visited[key]=true;
        if(dfsPath(path,visited,target,budget))return true;
        path.pop();delete visited[key];}
      return false;}
    function genPath(){for(var attempt=0;attempt<200;attempt++){
        var target=12+Math.floor(Math.random()*9); // 12..20
        var start=[Math.floor(Math.random()*N),Math.floor(Math.random()*N)];
        var path=[start],visited={};visited[start[0]+','+start[1]]=true;
        if(dfsPath(path,visited,target,{n:4000})&&path.length>=10)return path;
      }
      return [[0,0],[0,1],[0,2],[1,2],[1,1],[1,0],[2,0],[2,1],[2,2]];}
    function rotateSet(dirs,steps){return dirs.map(function(d){return DIRS[(DIRS.indexOf(d)+steps)%4];});}
    function setEq(a,b){var sa=a.slice().sort().join(','),sb=b.slice().sort().join(',');return sa===sb;}
    function buildTiles(){pathCells=genPath();tiles={};
      for(var i=0;i<pathCells.length;i++){var cell=pathCells[i],key=cell[0]+','+cell[1];var trueDirs=[];
        if(i>0)trueDirs.push(dirFrom(cell,pathCells[i-1]));
        if(i<pathCells.length-1)trueDirs.push(dirFrom(cell,pathCells[i+1]));
        var shape=trueDirs.length===1?'END':(oppositeSet(trueDirs)?'I':'L');
        tiles[key]={shape:shape,trueDirs:trueDirs,rot:Math.floor(Math.random()*4),isSource:i===0,isDrain:i===pathCells.length-1};}}
    function oppositeSet(dirs){if(dirs.length!==2)return false;var opp={N:'S',S:'N',E:'W',W:'E'};return opp[dirs[0]]===dirs[1];}
    function currentDirs(t){return rotateSet(BASE[t.shape],t.rot);}
    function isAligned(t){return setEq(currentDirs(t),t.trueDirs);}
    function armEl(dir){var d=document.createElement('div');d.className='pp-arm pp-arm-'+dir;return d;}
    function render(){board.innerHTML='';
      for(var r=0;r<N;r++)for(var c=0;c<N;c++){var key=r+','+c;var cellEl=document.createElement('div');cellEl.className='pp-cell';
        var t=tiles[key];
        if(t){var tileEl=document.createElement('div');tileEl.className='pp-tile'+(t.isSource?' source':'')+(t.isDrain?' drain':'')+(isAligned(t)?' aligned':'');
          tileEl.dataset.key=key;
          var rot=document.createElement('div');rot.className='pp-rot';rot.style.transform='rotate('+(t.rot*90)+'deg)';
          BASE[t.shape].forEach(function(d){rot.appendChild(armEl(d));});
          var hub=document.createElement('div');hub.className='pp-hub';rot.appendChild(hub);
          tileEl.appendChild(rot);
          tileEl.addEventListener('click',(function(k){return function(){clickTile(k);};})(key));
          cellEl.appendChild(tileEl);}
        board.appendChild(cellEl);}}
    function clickTile(key){if(solved||locked)return;var t=tiles[key];if(!t)return;
      t.rot=(t.rot+1)%4;rotations++;statusEl.textContent='Rotations: '+rotations+' / '+BUDGET;render();checkWin();
      if(!solved&&rotations>=BUDGET){locked=true;statusEl.textContent='Over the '+BUDGET+'-rotation budget \u2014 New puzzle to try again.';
        stage.classList.add('k-shake-soft');setTimeout(function(){stage.classList.remove('k-shake-soft');},420);}}
    function checkWin(){for(var key in tiles){if(!isAligned(tiles[key]))return;}
      solved=true;statusEl.textContent='Connected in '+rotations+' rotation'+(rotations===1?'':'s')+'!';
      done.disabled=false;done.classList.add('k-earn-ready');stage.classList.add('k-winglow');setTimeout(function(){stage.classList.remove('k-winglow');},1100);}
    function init(){buildTiles();rotations=0;solved=false;locked=false;
      done.disabled=true;done.classList.remove('k-earn-ready');
      statusEl.textContent='Rotations: 0 / '+BUDGET;render();}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){kiwiComplete(rotations<=20?6:4,rotations,solved);});
    init();
  <\/script>
</div>`;
}
export {
  pipes
};
