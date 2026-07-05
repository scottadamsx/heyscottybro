import { gameHead, reward } from "./shell.js";
function typingtest(usd) {
  return `<div class="wrap">
  ${gameHead("Typing Test", "Type the sentence as fast and accurately as you can", usd)}
  <div id="sent" style="margin-top:16px;font-size:18px;line-height:1.6;max-width:620px;color:var(--fg)"></div>
  <textarea id="inp" rows="3" style="margin-top:14px;width:100%;max-width:620px;font-size:16px;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg)" placeholder="Start typing\u2026"></textarea>
  <div id="status" class="k-sub" style="margin-top:10px">0 WPM</div>
  <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb">New sentence</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),sent=document.getElementById('sent'),inp=document.getElementById('inp');
    var SENTS=['The quick brown fox jumps over the lazy dog while the sun sets behind the hills.','Great software is built one small, legible change at a time, not in a single heroic push.','A calm mind and a fast feedback loop will beat raw talent on almost any project.','Curiosity, patience, and a willingness to be wrong are the real superpowers of a builder.','Ship something small today; momentum compounds faster than any clever plan ever will.'];
    var target,t0=null,wpm=0,fin=false;
    function pick(){target=SENTS[Math.floor(Math.random()*SENTS.length)];sent.textContent=target;inp.value='';t0=null;fin=false;wpm=0;done.disabled=true;statusEl.textContent='0 WPM';inp.focus();}
    inp.addEventListener('input',function(){if(fin)return;if(t0===null)t0=Date.now();var v=inp.value;var mins=(Date.now()-t0)/60000;var words=v.trim().split(/\\s+/).filter(Boolean).length;wpm=mins>0?Math.round(words/mins):0;
      var ok=0;for(var i=0;i<v.length;i++)if(v[i]===target[i])ok++;var acc=v.length?Math.round(100*ok/v.length):100;
      statusEl.textContent=wpm+' WPM \xB7 '+acc+'% accurate';
      if(v.length>=target.length){fin=true;statusEl.textContent='Done \u2014 '+wpm+' WPM at '+acc+'% accuracy';done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';inp.dataset.wpm=wpm;inp.dataset.acc=acc;}});
    document.getElementById('newb').addEventListener('click',pick);
    done.addEventListener('click',function(){var w=Number(inp.dataset.wpm||'0'),a=Number(inp.dataset.acc||'0');kiwiComplete(a>=85?Math.min(12,Math.round(w/8)):2,w);});
    pick();
  <\/script>
</div>`;
}
export {
  typingtest
};
