import { gameHead, reward } from "./shell.js";
function connect4(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Connect 4", "Drop discs and line up four \u2014 you are red", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Your move</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb">New game</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><div id="bd" style="display:inline-grid;grid-template-columns:repeat(7,40px);gap:5px;background:var(--card);padding:8px;border-radius:10px"></div></div>
  </div>
  <style>.c4{width:40px;height:40px;border-radius:50%;background:var(--bg);border:1px solid var(--line);cursor:pointer}.c4.r{background:#c0392b}.c4.y{background:#e0b020}</style>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),bd=document.getElementById('bd');
    var W=7,H=6,g,over,wins=0,games=0;
    function at(r,c){return g[r*W+c];}
    function render(){bd.innerHTML='';for(var r=0;r<H;r++)for(var c=0;c<W;c++){(function(r,c){var d=document.createElement('div');var v=at(r,c);d.className='c4'+(v==='R'?' r':v==='Y'?' y':'');d.addEventListener('click',function(){drop(c);});bd.appendChild(d);})(r,c);}}
    function landing(c){for(var r=H-1;r>=0;r--)if(!at(r,c))return r;return -1;}
    function place(c,p){var r=landing(c);if(r<0)return -1;g[r*W+c]=p;return r;}
    function win(p){for(var r=0;r<H;r++)for(var c=0;c<W;c++){if(at(r,c)!==p)continue;var ds=[[0,1],[1,0],[1,1],[1,-1]];for(var d=0;d<4;d++){var ok=true;for(var k=1;k<4;k++){var nr=r+ds[d][0]*k,nc=c+ds[d][1]*k;if(nr<0||nr>=H||nc<0||nc>=W||at(nr,nc)!==p){ok=false;break;}}if(ok)return true;}}return false;}
    function full(){return g.indexOf('')<0;}
    function aiMove(){for(var c=0;c<W;c++){if(landing(c)<0)continue;var r=place(c,'Y');if(win('Y'))return;g[r*W+c]='';}for(var c2=0;c2<W;c2++){if(landing(c2)<0)continue;var r2=place(c2,'R');var blk=win('R');g[r2*W+c2]='';if(blk){place(c2,'Y');return;}}var opts=[];for(var c3=0;c3<W;c3++)if(landing(c3)>=0)opts.push(c3);if(opts.length){var pick=(opts.indexOf(3)>=0&&Math.random()<.5)?3:opts[Math.floor(Math.random()*opts.length)];place(pick,'Y');}}
    function fin(msg,w){over=true;games++;if(w)wins++;statusEl.textContent=msg+' \xB7 won '+wins+'/'+games;done.disabled=false;done.textContent='Claim ${reward(usd)}'+(wins>0?' + bonus':'');render();}
    function drop(c){if(over||landing(c)<0)return;place(c,'R');render();if(win('R')){fin('You win!',true);return;}if(full()){fin('Draw.',false);return;}aiMove();render();if(win('Y')){fin('Computer wins.',false);return;}if(full()){fin('Draw.',false);return;}}
    function init(){g=[];for(var i=0;i<W*H;i++)g.push('');over=false;render();statusEl.textContent='Your move \xB7 won '+wins+'/'+games;done.disabled=(wins===0);}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){kiwiComplete(wins*4,wins,wins>0);});
    init();
  <\/script>
</div>`;
}
export {
  connect4
};
