import { reward } from "./shell.js";
function wordle(usd) {
  return `<style>
    .wb{display:flex;flex-direction:row;gap:34px;align-items:flex-start;justify-content:center;margin-top:20px;flex-wrap:wrap}
    .wb-left{display:flex;flex-direction:column;align-items:center;gap:10px}
    .wb-keys{display:flex;flex-direction:column;gap:6px;align-items:center}
    .wb-kr{display:flex;gap:5px}
    .wb-key{min-width:30px;height:42px;padding:0 9px;border-radius:9px;background:var(--chip);border:0;font-family:var(--sans);font-weight:600;font-size:13px;cursor:pointer;color:var(--fg);text-transform:uppercase}
    .wb-key:hover{filter:brightness(.97)}
    .wb-key.hit{background:var(--green);color:#fff}.wb-key.near{background:var(--gold);color:#fff}.wb-key.miss{background:#cfc8ba;color:#fff}
    .wb-key.wide{background:var(--clay);color:#fff;min-width:62px}
    .wb-grid{display:flex;flex-direction:column;gap:7px}
    .wb-row{display:flex;gap:7px}
    .wb-cell{width:48px;height:48px;border:2px solid var(--line);border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:var(--display);font-size:24px;font-weight:600;text-transform:uppercase;color:var(--fg)}
    .wb-cell.hit{background:var(--green);border-color:var(--green);color:#fff}
    .wb-cell.near{background:var(--gold);border-color:var(--gold);color:#fff}
    .wb-cell.miss{background:#cfc8ba;border-color:#cfc8ba;color:#fff}
    @media (max-height:520px){ .wb-cell{width:38px;height:38px;font-size:19px} .wb-key{height:36px} }
  </style>
  <div class="wrap"><div class="k-split">
    <div class="k-left">
      <div class="k-label">Quick Play</div>
      <h1 class="k-title">Word Break</h1>
      <div class="k-sub" id="st" style="margin-top:4px"></div>
      <div class="wb-keys" id="keys" style="margin-top:18px"></div>
      <div class="k-actions" style="justify-content:flex-start;margin-top:18px"><button class="k-primary" id="done" disabled>Claim ${reward(usd)}</button></div>
    </div>
    <div class="k-right"><div class="wb-grid" id="grid"></div></div>
  </div>
  <script>
    var WORDS=['COMMIT','DEPLOY','BRANCH','SERVER','IMPORT','EXPORT','OBJECT','STRING','SCHEMA','DOCKER','LAMBDA','CURSOR','RENDER','SOCKET','BUFFER','KERNEL','SYNTAX','PYTHON','MODULE','COOKIE'];
    var ANS=WORDS[Math.floor(Math.random()*WORDS.length)], ROWS=6, LEN=6;
    var row=0,col=0,over=false,cur='';
    var grid=document.getElementById('grid'),keys=document.getElementById('keys'),st=document.getElementById('st'),done=document.getElementById('done');
    var cells=[];
    for(var r=0;r<ROWS;r++){var rw=document.createElement('div');rw.className='wb-row';cells[r]=[];for(var c=0;c<LEN;c++){var cl=document.createElement('div');cl.className='wb-cell';rw.appendChild(cl);cells[r][c]=cl;}grid.appendChild(rw);}
    var keystate={};
    var LAYOUT=['QWERTYUIOP','ASDFGHJKL','ENTER ZXCVBNM \u232B'];
    LAYOUT.forEach(function(rowstr){var kr=document.createElement('div');kr.className='wb-kr';rowstr.split(' ').forEach(function(grp){
      if(grp==='ENTER'||grp==='\u232B'){var b=document.createElement('button');b.className='wb-key wide';b.textContent=grp==='ENTER'?'ENTER':'\u232B';b.addEventListener('click',function(){key(grp==='ENTER'?'Enter':'Backspace');});kr.appendChild(b);}
      else{for(var x=0;x<grp.length;x++){(function(ch){var b=document.createElement('button');b.className='wb-key';b.dataset.k=ch;b.textContent=ch;b.addEventListener('click',function(){key(ch);});kr.appendChild(b);})(grp.charAt(x));}}
    });keys.appendChild(kr);});
    function setStatus(){st.textContent='Guess the 6-letter word \xB7 '+(ROWS-row)+' tries left';}
    function paintKey(ch,state){var pri={hit:3,near:2,miss:1};if((pri[state]||0)>(pri[keystate[ch]]||0)){keystate[ch]=state;var btns=keys.querySelectorAll('[data-k="'+ch+'"]');for(var i=0;i<btns.length;i++){btns[i].classList.remove('hit','near','miss');btns[i].classList.add(state);}}}
    function render(){for(var c=0;c<LEN;c++){cells[row][c].textContent=cur.charAt(c)||'';}}
    function submit(){
      if(cur.length<LEN)return;
      var ans=ANS.split(''),res=[],left={};for(var z=0;z<LEN;z++)res.push('miss');
      for(var i=0;i<LEN;i++){if(cur.charAt(i)===ans[i]){res[i]='hit';}else{left[ans[i]]=(left[ans[i]]||0)+1;}}
      for(var i2=0;i2<LEN;i2++){if(res[i2]!=='hit'){var ch=cur.charAt(i2);if(left[ch]>0){res[i2]='near';left[ch]--;}}}
      for(var i3=0;i3<LEN;i3++){cells[row][i3].classList.add(res[i3]);paintKey(cur.charAt(i3),res[i3]);}
      if(cur===ANS){over=true;st.textContent='Solved in '+(row+1)+'! Claim your reward.';done.disabled=false;return;}
      row++;cur='';col=0;KM.guesses++;
      if(row>=ROWS){over=true;st.textContent='The word was '+ANS+'. Move on for the base reward.';done.textContent='Move on \u2192';done.disabled=false;return;}
      setStatus();
    }
    function shakeKey(ch){var b=keys.querySelector('[data-k="'+ch+'"]');if(b){b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake');setTimeout(function(){b.classList.remove('shake');},300);}}
    function key(k){
      if(over)return;
      if(k==='Enter'){submit();return;}
      if(k==='Backspace'){cur=cur.slice(0,-1);render();return;}
      if(/^[a-zA-Z]$/.test(k)&&cur.length<LEN){var CH=k.toUpperCase();
        // A letter we already ruled out (grey) isn't available \u2014 reject it with a shake.
        if(keystate[CH]==='miss'){shakeKey(CH);return;}
        cur+=CH;render();}
    }
    document.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key==='Backspace'||/^[a-zA-Z]$/.test(e.key)){e.preventDefault();key(e.key);}});
    done.addEventListener('click',function(){kiwiComplete((ROWS-row),(ROWS-row));});
    // Take keyboard focus so physical typing works without a click.
    document.addEventListener('click',function(){try{window.focus();}catch(e){}});
    setTimeout(function(){try{window.focus();}catch(e){}},150);
    setStatus();
  <\/script>
  </div>`;
}
export {
  wordle
};
