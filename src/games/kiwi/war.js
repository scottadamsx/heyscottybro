import { gameHead, reward } from "./shell.js";
function war(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("War", "Flip a card each round \u2014 higher card wins. Best of 9", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">You 0 \u2014 0 CPU</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="flip">Flip</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <style>.pc{position:relative;width:62px;height:88px;background:#fff;border:1px solid #d8ccb6;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.18);color:#2b2e22;font-weight:800}.pc.red{color:#c0392b}.pc .r{position:absolute;top:5px;left:7px;font-size:15px}.pc .r.b{top:auto;bottom:5px;left:auto;right:7px;transform:rotate(180deg)}.pc .s{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:30px}.vs{font-weight:700;color:var(--muted,#8a8474);font-size:18px}</style>
  <div class="k-right"><div id="tbl" style="display:flex;align-items:center;gap:12px;min-height:92px"></div><div class="k-sub" id="rd" style="margin-top:8px"></div></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),tbl=document.getElementById('tbl'),rd=document.getElementById('rd');
    var RW=['2','3','4','5','6','7','8','9','10','J','Q','K','A'],SU=['\u2660','\u2665','\u2666','\u2663'],you=0,cpu=0,round=0,MAX=9;
    function rc(){return Math.floor(Math.random()*13);}
    function card(idx){var s=Math.floor(Math.random()*4),red=(s===1||s===2);return '<div class="pc'+(red?' red':'')+'"><span class="r">'+RW[idx]+'</span><span class="s">'+SU[s]+'</span><span class="r b">'+RW[idx]+'</span></div>';}
    document.getElementById('flip').addEventListener('click',function(){if(round>=MAX)return;round++;var a=rc(),b=rc();var res=a>b?'You win':a<b?'CPU wins':'Tie';if(a>b)you++;else if(a<b)cpu++;tbl.innerHTML=card(a)+'<span class="vs">VS</span>'+card(b);rd.textContent='Round '+round+': '+res;statusEl.textContent='You '+you+' \u2014 '+cpu+' CPU';if(round>=MAX){var w=you>cpu;statusEl.textContent=(w?'You win the war! ':'War lost. ')+'('+you+'\u2013'+cpu+')';done.disabled=false;done.textContent='Claim ${reward(usd)}'+(w?' + bonus':'');}});
    done.addEventListener('click',function(){kiwiComplete(you>cpu?4:0,you,you>cpu);});
    statusEl.textContent='You 0 \u2014 0 CPU';
  <\/script>
</div>`;
}
export {
  war
};
