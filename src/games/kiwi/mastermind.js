import { gameHead, reward } from "./shell.js";
function mastermind(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Mastermind", "Crack the 4-colour code in 8 tries \xB7 \u25CF right spot \xB7 \u25CB right colour", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Pick 4 colours</div>
  <div id="pal" style="margin-top:14px;display:flex;gap:6px"></div>
  <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button id="guess" disabled>Guess</button> <button id="clear">Clear</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="cur" style="display:flex;gap:6px;margin-bottom:10px"></div><div id="rows"></div></div>
  </div>
  <style>.peg{width:30px;height:30px;border-radius:50%;border:1px solid var(--line);display:inline-block}.slot{width:30px;height:30px;border-radius:50%;border:2px dashed var(--line)}.mmrow{display:flex;gap:6px;align-items:center;margin-bottom:6px}.fb{font-size:14px;color:var(--clay);margin-left:8px;letter-spacing:2px}</style>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),pal=document.getElementById('pal'),cur=document.getElementById('cur'),rows=document.getElementById('rows'),guessB=document.getElementById('guess');
    var COL=['#c0392b','#2f855a','#2b6cb0','#e0b020','#8b5cf6','#e07b3c'];
    var code,guess,tries,MAX=8,solved=false;
    function peg(ci){var s=document.createElement('span');s.className='peg';s.style.background=COL[ci];return s;}
    function renderPal(){pal.innerHTML='';COL.forEach(function(c,i){var b=document.createElement('button');b.style.cssText='width:30px;height:30px;border-radius:50%;border:0;cursor:pointer;background:'+c;b.addEventListener('click',function(){if(guess.length<4){guess.push(i);renderCur();}});pal.appendChild(b);});}
    function renderCur(){cur.innerHTML='';for(var i=0;i<4;i++){if(i<guess.length)cur.appendChild(peg(guess[i]));else{var s=document.createElement('span');s.className='slot';cur.appendChild(s);}}guessB.disabled=guess.length!==4;}
    function score(gs){var bk=0,wt=0,cc=code.slice(),gg=gs.slice();for(var i=0;i<4;i++)if(gg[i]===cc[i]){bk++;cc[i]=-1;gg[i]=-2;}for(var j=0;j<4;j++){if(gg[j]<0)continue;var idx=cc.indexOf(gg[j]);if(idx>=0){wt++;cc[idx]=-1;}}return[bk,wt];}
    function submit(){if(guess.length!==4)return;tries++;var r=score(guess);var row=document.createElement('div');row.className='mmrow';for(var i=0;i<4;i++)row.appendChild(peg(guess[i]));var fb=document.createElement('span');fb.className='fb';var t='';for(var a=0;a<r[0];a++)t+='\u25CF';for(var b2=0;b2<r[1];b2++)t+='\u25CB';fb.textContent=t;row.appendChild(fb);rows.appendChild(row);
      if(r[0]===4){solved=true;statusEl.textContent='Cracked it in '+tries+'!';done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';guessB.disabled=true;return;}
      if(tries>=MAX){statusEl.textContent='Out of tries \u2014 the code was:';var row2=document.createElement('div');row2.className='mmrow';for(var k=0;k<4;k++)row2.appendChild(peg(code[k]));rows.appendChild(row2);done.disabled=false;done.textContent='Move on \u203A';guessB.disabled=true;return;}
      statusEl.textContent='Try '+(tries+1)+' of '+MAX;guess=[];renderCur();}
    guessB.addEventListener('click',submit);
    document.getElementById('clear').addEventListener('click',function(){guess=[];renderCur();});
    done.addEventListener('click',function(){kiwiComplete(solved?(MAX-tries+2):0,solved?(MAX-tries):0);});
    code=[];for(var i=0;i<4;i++)code.push(Math.floor(Math.random()*6));guess=[];tries=0;renderPal();renderCur();
  <\/script>
</div>`;
}
export {
  mastermind
};
