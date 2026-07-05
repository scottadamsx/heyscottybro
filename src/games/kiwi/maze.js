import { gameHead, reward } from "./shell.js";
function maze(usd) {
  return `<div class="wrap"><div class="k-split">
  <div class="k-left">${gameHead("Maze", "Arrow keys or WASD \u2014 find your way to the green exit", usd)}
  <div id="status" class="k-sub" style="margin-top:8px">Find the exit \xB7 moves 0</div>
  <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap"><button id="newb">New maze</button> <button id="done" disabled>Claim ${reward(usd)}</button></div>
  </div>
  <div class="k-right"><canvas id="cv" width="300" height="300" tabindex="0" style="background:var(--card);border-radius:10px;outline:none"></canvas></div>
  </div>
  <script>
    var statusEl=document.getElementById('status'),done=document.getElementById('done'),cv=document.getElementById('cv'),x=cv.getContext('2d');
    var N=11,S=300/N,cells,px,py,moves,solved;
    function idx(r,c){return r*N+c;}
    function gen(){cells=[];for(var i=0;i<N*N;i++)cells.push(15);var vis=[],st=[idx(0,0)];vis[idx(0,0)]=1;
      while(st.length){var cur=st[st.length-1],r=Math.floor(cur/N),c=cur%N,nb=[];
        if(r>0&&!vis[idx(r-1,c)])nb.push([idx(r-1,c),1,4]);if(c<N-1&&!vis[idx(r,c+1)])nb.push([idx(r,c+1),2,8]);
        if(r<N-1&&!vis[idx(r+1,c)])nb.push([idx(r+1,c),4,1]);if(c>0&&!vis[idx(r,c-1)])nb.push([idx(r,c-1),8,2]);
        if(nb.length){var ch=nb[Math.floor(Math.random()*nb.length)];cells[cur]&=~ch[1];cells[ch[0]]&=~ch[2];vis[ch[0]]=1;st.push(ch[0]);}else st.pop();}}
    function draw(){x.clearRect(0,0,300,300);x.strokeStyle='#6b6e58';x.lineWidth=2;
      for(var r=0;r<N;r++)for(var c=0;c<N;c++){var w=cells[idx(r,c)],X=c*S,Y=r*S;x.beginPath();if(w&1){x.moveTo(X,Y);x.lineTo(X+S,Y);}if(w&2){x.moveTo(X+S,Y);x.lineTo(X+S,Y+S);}if(w&4){x.moveTo(X+S,Y+S);x.lineTo(X,Y+S);}if(w&8){x.moveTo(X,Y+S);x.lineTo(X,Y);}x.stroke();}
      x.fillStyle='#8bc34a';x.fillRect((N-1)*S+4,(N-1)*S+4,S-8,S-8);
      x.fillStyle='#d97757';x.beginPath();x.arc(px*S+S/2,py*S+S/2,S*0.3,0,6.2832);x.fill();}
    function move(dr,dc){if(solved)return;var w=cells[idx(py,px)];if(dr===-1&&(w&1))return;if(dc===1&&(w&2))return;if(dr===1&&(w&4))return;if(dc===-1&&(w&8))return;px+=dc;py+=dr;moves++;statusEl.textContent='Find the exit \xB7 moves '+moves;draw();if(px===N-1&&py===N-1){solved=true;statusEl.textContent='Escaped in '+moves+' moves!';done.disabled=false;done.textContent='Claim ${reward(usd)} + bonus';}}
    cv.addEventListener('keydown',function(e){var k=e.key;if(k==='ArrowUp'||k==='w'){e.preventDefault();move(-1,0);}else if(k==='ArrowDown'||k==='s'){e.preventDefault();move(1,0);}else if(k==='ArrowLeft'||k==='a'){e.preventDefault();move(0,-1);}else if(k==='ArrowRight'||k==='d'){e.preventDefault();move(0,1);}});
    function init(){gen();px=0;py=0;moves=0;solved=false;done.disabled=true;statusEl.textContent='Find the exit \xB7 moves 0';draw();cv.focus();}
    document.getElementById('newb').addEventListener('click',init);
    done.addEventListener('click',function(){kiwiComplete(solved?6:0,moves);});
    init();
  <\/script>
</div>`;
}
export {
  maze
};
