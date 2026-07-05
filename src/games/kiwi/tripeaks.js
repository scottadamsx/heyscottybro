import { gameHead, reward } from "./shell.js";
function tripeaks(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Tri-Peaks Solitaire", "Clear cards one rank above or below the base (A wraps to K). Draw a new base if stuck", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Cleared: 0 / 18</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="drawb">Draw</button> <button id="newb">New</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right" style="max-width:340px"><div id="field" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px"></div><div style="display:flex;align-items:center;gap:10px"><span class="k-sub">Base:</span><div id="base"></div><span class="k-sub" id="stockn"></span></div></div>
  </div>
  <style>.sc{width:44px;height:62px;border-radius:8px;background:#fff;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;cursor:pointer;color:#1b1a17}.sc.red{color:#c0392b}.sc.gone{visibility:hidden}.sc.base{cursor:default;outline:2px solid var(--clay)}</style>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),field=document.getElementById('field'),baseEl=document.getElementById('base'),stockn=document.getElementById('stockn');
    var RR=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],SS=['\u2660','\u2665','\u2666','\u2663'];
    var deck,table,base,stock,cleared;
    function mk(){deck=[];for(var i=0;i<4;i++)for(var j=0;j<13;j++)deck.push({r:j,s:SS[i]});for(var k=deck.length-1;k>0;k--){var m=Math.floor(Math.random()*(k+1));var t=deck[k];deck[k]=deck[m];deck[m]=t;}}
    function adj(a,b){var d=Math.abs(a-b);return d===1||d===12;}
    function ch(c){return RR[c.r]+c.s;}
    function renderBase(){baseEl.innerHTML='';var d=document.createElement('div');d.className='sc base'+((base.s==='\u2665'||base.s==='\u2666')?' red':'');d.textContent=ch(base);baseEl.appendChild(d);stockn.textContent='Stock: '+stock.length;}
    function render(){field.innerHTML='';for(var i=0;i<table.length;i++){(function(i){var c=table[i];var d=document.createElement('div');d.className='sc'+((c.s==='\u2665'||c.s==='\u2666')?' red':'')+(c.gone?' gone':'');d.textContent=ch(c);d.addEventListener('click',function(){play(i);});field.appendChild(d);})(i);}renderBase();}
    function play(i){var c=table[i];if(c.gone||!adj(c.r,base.r))return;c.gone=true;base=c;cleared++;statusEl.textContent='Cleared: '+cleared+' / 18';render();done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';if(cleared===18){statusEl.textContent='Board cleared! Beautiful.';}}
    function drawCard(){if(!stock.length){statusEl.textContent='Stock empty \xB7 cleared '+cleared+' / 18';return;}base=stock.pop();renderBase();}
    function init(){mk();table=[];for(var i=0;i<18;i++){var c=deck.pop();c.gone=false;table.push(c);}base=deck.pop();stock=deck.slice(0,12);cleared=0;done.disabled=true;render();statusEl.textContent='Cleared: 0 / 18';}
    document.getElementById('drawb').addEventListener('click',drawCard);
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){kiwiComplete(Math.round(cleared/3),cleared);});
    init();
  <\/script>
</div>`;
}
export {
  tripeaks
};
