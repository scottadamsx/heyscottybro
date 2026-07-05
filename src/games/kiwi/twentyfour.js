import { gameHead, reward } from "./shell.js";
function twentyfour(usd) {
  return `<style>
    .tf-tiles{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;min-height:56px}
    .tf-tile{min-width:56px;height:56px;padding:0 10px;border-radius:14px;background:var(--card);border:1.5px solid var(--line);
             display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:700;font-size:19px;color:var(--fg);cursor:pointer;box-shadow:0 4px 10px -6px rgba(46,43,37,.3)}
    .tf-tile.sel{border-color:var(--clay);background:var(--tint);color:var(--clay-d)}
    .tf-tile.place-anim{animation:ktilepop .24s cubic-bezier(.2,.9,.3,1.2)}
    .tf-ops{display:flex;gap:8px;margin-top:16px}
    .tf-op{width:44px;height:44px;border-radius:12px;font-family:var(--display);font-weight:700;font-size:18px}
    .tf-op.sel{background:var(--clay-d)}
    @media (prefers-reduced-motion:reduce){ .tf-tile.place-anim{animation:none} }
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("24", "Make 24 from 4 numbers \u2014 each used once", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Rounds solved: 0 / 3</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="resetb" class="k-press">Reset round</button> <button id="newb" class="k-press">New numbers</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div style="display:flex;flex-direction:column;align-items:center">
    <div class="tf-tiles" id="tiles"></div>
    <div class="tf-ops" id="ops"></div>
  </div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),tilesEl=document.getElementById('tiles'),opsEl=document.getElementById('ops');
    var tiles,selId,pendingOp,solved,roundsSolved,nextId,startNums;
    function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){var t=b;b=a%b;a=t;}return a||1;}
    function frac(n,d){if(d<0){n=-n;d=-d;}var g=gcd(n,d);if(g===0)g=1;return{n:n/g,d:d/g};}
    function fadd(a,b){return frac(a.n*b.d+b.n*a.d,a.d*b.d);}
    function fsub(a,b){return frac(a.n*b.d-b.n*a.d,a.d*b.d);}
    function fmul(a,b){return frac(a.n*b.n,a.d*b.d);}
    function fdiv(a,b){if(b.n===0)return null;return frac(a.n*b.d,a.d*b.n);}
    function solve24(nums){if(nums.length===1)return nums[0].n===24*nums[0].d;
      for(var i=0;i<nums.length;i++)for(var j=0;j<nums.length;j++){if(i===j)continue;
        var rest=[];for(var k=0;k<nums.length;k++)if(k!==i&&k!==j)rest.push(nums[k]);
        var a=nums[i],b=nums[j];var results=[fadd(a,b),fsub(a,b),fmul(a,b)];var dv=fdiv(a,b);if(dv)results.push(dv);
        for(var r=0;r<results.length;r++){if(results[r]&&solve24(rest.concat([results[r]])))return true;}}
      return false;}
    function isSolvable(vals){return solve24(vals.map(function(v){return frac(v,1);}));}
    function randomSet(){var a=[];for(var i=0;i<4;i++)a.push(1+Math.floor(Math.random()*9));return a;}
    function generateSolvable(){for(var i=0;i<200;i++){var s=randomSet();if(isSolvable(s))return s;}return[3,8,4,6];}
    function displayValue(t){return t.d===1?String(t.n):(t.n+'/'+t.d);}
    function makeTile(n,d){nextId++;return{id:nextId,n:n,d:d};}
    function renderTiles(){tilesEl.innerHTML='';tiles.forEach(function(t){var el=document.createElement('div');
      el.className='tf-tile place-anim k-press'+(t.id===selId?' sel':'');el.textContent=displayValue(t);
      el.addEventListener('click',function(){onTileClick(t.id);});tilesEl.appendChild(el);});}
    function renderOps(){opsEl.innerHTML='';var ops=[['+','+'],['\u2212','-'],['\xD7','*'],['\xF7','/']];
      ops.forEach(function(pair){var b=document.createElement('button');b.className='tf-op k-press'+(pendingOp===pair[1]?' sel':'');b.textContent=pair[0];
        b.addEventListener('click',function(){if(selId===null)return;pendingOp=pendingOp===pair[1]?null:pair[1];renderOps();});opsEl.appendChild(b);});}
    function applyOp(op,a,b){if(op==='+')return fadd(a,b);if(op==='-')return fsub(a,b);if(op==='*')return fmul(a,b);if(op==='/')return fdiv(a,b);return null;}
    function onTileClick(id){if(solved)return;
      if(selId===null){selId=id;renderTiles();return;}
      if(id===selId){selId=null;pendingOp=null;renderTiles();renderOps();return;}
      if(!pendingOp){selId=id;renderTiles();return;}
      var first=tiles.filter(function(t){return t.id===selId;})[0];var second=tiles.filter(function(t){return t.id===id;})[0];
      var result=applyOp(pendingOp,first,second);
      if(!result){statusEl.textContent='Can\\'t divide by zero \u2014 pick a different pair.';selId=null;pendingOp=null;renderTiles();renderOps();return;}
      var newTile=makeTile(result.n,result.d);
      tiles=tiles.filter(function(t){return t.id!==selId&&t.id!==id;});tiles.push(newTile);
      selId=null;pendingOp=null;renderTiles();renderOps();
      if(tiles.length===1)checkFinal();}
    function checkFinal(){var t=tiles[0];
      if(t.n===24*t.d){solved=true;roundsSolved++;
        statusEl.textContent='24! Rounds solved: '+roundsSolved+(roundsSolved>=3?' \u2014 Claim unlocked':' / 3');
        if(roundsSolved>=3){done.disabled=false;done.classList.add('k-earn-ready');}
        setTimeout(function(){newRound();},900);
      }else{statusEl.textContent='That\\'s '+displayValue(t)+' \u2014 not 24. Reset round to try again.';}}
    function newRound(){startNums=generateSolvable();tiles=startNums.map(function(n){return makeTile(n,1);});selId=null;pendingOp=null;solved=false;
      renderTiles();renderOps();
      statusEl.textContent='Rounds solved: '+roundsSolved+(roundsSolved>=3?' \u2014 Claim unlocked (keep going for a bigger bonus)':' / 3');}
    function resetRound(){tiles=startNums.map(function(n){return makeTile(n,1);});selId=null;pendingOp=null;solved=false;renderTiles();renderOps();}
    document.getElementById('resetb').addEventListener('click',resetRound);
    document.getElementById('newb').addEventListener('click',newRound);
    done.addEventListener('click',function(){var bonus=roundsSolved>=5?7:(roundsSolved>=3?4:0);kiwiComplete(bonus,roundsSolved,roundsSolved>=3);});
    nextId=0;roundsSolved=0;newRound();
  <\/script>
</div>`;
}
export {
  twentyfour
};
