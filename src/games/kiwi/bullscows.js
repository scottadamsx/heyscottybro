import { gameHead, reward } from "./shell.js";
function bullscows(usd) {
  return `<style>
    .bc-peg{width:30px;height:30px;border-radius:8px;border:1.5px solid var(--line);background:var(--card);
            display:inline-flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:700;font-size:15px;color:var(--fg)}
    .bc-peg.slot{border-style:dashed;color:var(--muted)}
    .bc-pal{display:flex;gap:6px;flex-wrap:wrap;max-width:260px}
    .bc-palbtn{width:32px;height:32px;border-radius:8px;border:1.5px solid var(--line);background:var(--card);color:var(--fg);
               font-family:var(--display);font-weight:700;font-size:15px;cursor:pointer}
    .bc-palbtn:hover{background:var(--chip)}
    .bc-palbtn:disabled{opacity:.35;cursor:default}
    .bc-cur{display:flex;gap:6px;margin-bottom:10px}
    .bc-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
    .bc-fb{font-size:14px;color:var(--clay-d);margin-left:8px;letter-spacing:2px;font-family:var(--sans)}
    .bc-rows{max-height:32vh;overflow-y:auto}
  </style>
  <div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Bulls and Cows", "Crack the 4-digit code in 8 tries \xB7 \u25CF right spot \xB7 \u25CB right digit", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Pick 4 distinct digits</div>
  <div class="bc-pal" id="pal" style="margin-top:14px"></div>
  <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button id="guess" class="k-press" disabled>Guess</button> <button id="clear" class="k-press">Clear</button> <button id="newb" class="k-press">New game</button> <button id="done" class="k-earnbtn k-press" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div class="bc-cur" id="cur"></div><div class="bc-rows" id="rows"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),pal=document.getElementById('pal'),cur=document.getElementById('cur'),rows=document.getElementById('rows'),guessB=document.getElementById('guess');
    var code,guess,tries,MAX=8,solved,over;
    function peg(d,slot){var s=document.createElement('span');s.className='bc-peg'+(slot?' slot':'');s.textContent=slot?'':d;return s;}
    function renderPal(){pal.innerHTML='';for(var d=0;d<=9;d++){(function(dd){var b=document.createElement('button');b.className='bc-palbtn k-press';b.textContent=dd;
      b.disabled=guess.indexOf(dd)>=0;
      b.addEventListener('click',function(){if(over)return;if(guess.length<4&&guess.indexOf(dd)<0){guess.push(dd);renderCur();renderPal();}});
      pal.appendChild(b);})(d);}}
    function renderCur(){cur.innerHTML='';for(var i=0;i<4;i++){cur.appendChild(i<guess.length?peg(guess[i],false):peg(null,true));}guessB.disabled=over||guess.length!==4;}
    function score(gs){var bulls=0,cows=0;for(var i=0;i<4;i++)if(gs[i]===code[i])bulls++;
      for(var j=0;j<4;j++)if(code.indexOf(gs[j])>=0)cows++;
      cows-=bulls;return[bulls,cows];}
    function submit(){if(over||guess.length!==4)return;tries++;var r=score(guess);
      var row=document.createElement('div');row.className='bc-row';for(var i=0;i<4;i++)row.appendChild(peg(guess[i],false));
      var fb=document.createElement('span');fb.className='bc-fb';var t='';for(var a=0;a<r[0];a++)t+='\u25CF';for(var b2=0;b2<r[1];b2++)t+='\u25CB';fb.textContent=t||'\u2014';
      row.appendChild(fb);rows.appendChild(row);rows.scrollTop=rows.scrollHeight;KM.guesses++;
      if(r[0]===4){solved=true;over=true;statusEl.textContent='Cracked it in '+tries+' guess'+(tries===1?'':'es')+'!';
        done.disabled=false;done.classList.add('k-earn-ready');guessB.disabled=true;guess=[];renderCur();renderPal();return;}
      if(tries>=MAX){over=true;statusEl.textContent='Out of guesses \u2014 the code was '+code.join('')+'. New game to try again.';
        var row2=document.createElement('div');row2.className='bc-row';for(var k=0;k<4;k++)row2.appendChild(peg(code[k],false));rows.appendChild(row2);
        guessB.disabled=true;guess=[];renderCur();renderPal();return;}
      statusEl.textContent='Guess '+(tries+1)+' of '+MAX;guess=[];renderCur();renderPal();}
    guessB.addEventListener('click',submit);
    document.getElementById('clear').addEventListener('click',function(){if(over)return;guess=[];renderCur();renderPal();});
    function init(){var digits=[0,1,2,3,4,5,6,7,8,9];for(var i=digits.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=digits[i];digits[i]=digits[j];digits[j]=t;}
      code=digits.slice(0,4);guess=[];tries=0;solved=false;over=false;
      done.disabled=true;done.classList.remove('k-earn-ready');
      rows.innerHTML='';statusEl.textContent='Pick 4 distinct digits';renderPal();renderCur();}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){var bonus=solved&&tries<=5?7:4;kiwiComplete(bonus,tries,solved);});
    init();
  <\/script>
</div>`;
}
export {
  bullscows
};
