const {parseMp3,buildMp3}=GainsawMp3;
const {hopEnergies,gatedLoudness}=GainsawLoudness;

const $=s=>document.querySelector(s);
const S={P:null,name:'',N:0,fd:0,sel0:0,sel1:0,steps:0,fadeIn:0,fadeOut:0,buf:null,ctx:null,an:null,ph:0,playing:null};
const MODES=['Stereo','Joint stereo','Dual channel','Mono'];

function fmt(t){t=Math.max(0,t);const m=Math.floor(t/60),s=t-m*60;return m+':'+s.toFixed(3).padStart(6,'0')}
function sdb(v,d=1){if(v==null||!isFinite(v))return '—';const r=v.toFixed(d);return (v>0.0001?'+':v<-0.0001?'−':'')+r.replace('-','')}
function status(msg,err){const el=$('#status');el.textContent=msg;el.classList.toggle('err',!!err)}

/* ghost waveform for empty state */
(()=>{let g='';for(let i=0;i<112;i++){const h=6+Math.abs(Math.sin(i*0.37)*Math.cos(i*0.11))*34;g+=`<rect x="${i*5}" y="${(46-h)/2}" width="3" height="${h}" rx="1.5"/>`}$('#ghostbars').innerHTML=g})();

/* ---------- loading ---------- */
const fileIn=$('#file'),drop=$('#drop'),wrap=$('#wavewrap');
fileIn.addEventListener('change',()=>{if(fileIn.files[0])load(fileIn.files[0]);fileIn.value=''});
['dragenter','dragover'].forEach(ev=>wrap.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>wrap.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
wrap.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)load(f)});

async function load(file){
  stop();status('Reading '+file.name+'…');
  let P;
  try{const u=new Uint8Array(await file.arrayBuffer());P=parseMp3(u)}catch(err){status(err.message||'This file could not be read.',true);return}
  if(P.audio.length<10){status('This MP3 is too short to edit.',true);return}
  const h=P.first;
  S.P=P;S.name=file.name;S.N=P.audio.length;S.fd=h.spf/h.sr;S.sel0=0;S.sel1=S.N;S.ph=0;S.an=null;S.buf=null;
  S.steps=0;S.fadeIn=0;S.fadeOut=0;$('#gain').value=0;$('#fadeIn').value=0;$('#fadeOut').value=0;
  const dur=S.N*S.fd,bytes=P.audio.reduce((a,f)=>a+f.len,0),kbps=Math.round(bytes*8/dur/1000);
  const vbr=P.audio.some(f=>f.h.br!==P.audio[0].h.br);
  $('#fileinfo').innerHTML='';const b=document.createElement('b');b.textContent=file.name;$('#fileinfo').append(b,
    document.createTextNode(`MPEG-${h.m1?'1':h.ver===2?'2':'2.5'} Layer III · ${(h.sr/1000).toFixed(1)} kHz · ${MODES[h.mode]} · ${vbr?'VBR ~':''}${kbps} kbps · ${fmt(dur)}`));
  $('#frameNote').textContent=`cuts snap to ${(S.fd*1000).toFixed(1)} ms frames`;
  $('#fname').value=file.name.replace(/\.mp3$/i,'')+'-edit.mp3';
  drop.hidden=true;$('#openAgain').hidden=false;$('#hA').hidden=$('#hB').hidden=false;
  ['#trimCard','#gainCard'].forEach(s=>$(s).classList.remove('off'));
  ['#play','#hearStart','#hearEnd','#save','#fname'].forEach(s=>$(s).disabled=false);
  refresh();
  status('Measuring loudness…');
  try{
    if(!S.ctx)S.ctx=new (window.AudioContext||window.webkitAudioContext)();
    S.buf=await S.ctx.decodeAudioData(P.u.buffer.slice(P.u.byteOffset,P.u.byteOffset+P.u.byteLength));
    if(S.P!==P)return;
    S.an=analyze(S.buf);refresh();
    status(P.vbri?'Ready. This file has a VBRI header, which Gainsaw drops on save (playback is unaffected).':'Ready. Drag the blue handles to trim, then set the volume.');
  }catch(err){status('Edits still work, but this browser could not decode the audio for preview and loudness.',true);refresh()}
}

function analyze(buf){
  const nc=Math.min(2,buf.numberOfChannels),ch=[];for(let c=0;c<nc;c++)ch.push(buf.getChannelData(c));
  const fs=buf.sampleRate,L=buf.length,h=S.P.first,ratio=fs/h.sr;
  const fPeak=new Float32Array(S.N),fRms=new Float32Array(S.N);
  for(let k=0;k<S.N;k++){
    const a=Math.min(L,Math.round(k*h.spf*ratio)),b=Math.min(L,Math.round((k+1)*h.spf*ratio));let pk=0,ss=0;
    for(const x of ch)for(let i=a;i<b;i++){const v=x[i];ss+=v*v;const av=v<0?-v:v;if(av>pk)pk=av}
    fPeak[k]=pk;fRms[k]=b>a?10*Math.log10(ss/((b-a)*nc)+1e-12):-120;
  }
  const B=4000,mn=new Float32Array(B),mx=new Float32Array(B);
  for(let j=0;j<B;j++){const a=Math.floor(j*L/B),b=Math.floor((j+1)*L/B);let lo=0,hi=0;for(const x of ch)for(let i=a;i<b;i++){const v=x[i];if(v<lo)lo=v;if(v>hi)hi=v}mn[j]=lo;mx[j]=hi}
  const {E,hop}=hopEnergies(ch,fs);
  return {fPeak,fRms,mn,mx,B,E,hop,dur:buf.duration};
}

/* ---------- gain model ---------- */
function ampSteps(t){return Math.max(-40,Math.round(20*Math.log10(Math.max(t,1e-4))/1.5))}
function fadeSteps(k){
  if(k<S.sel0||k>=S.sel1)return 0;let d=0;
  const Fi=Math.round(S.fadeIn/S.fd),Fo=Math.round(S.fadeOut/S.fd),a=k-S.sel0,b=S.sel1-1-k;
  if(Fi>0&&a<Fi)d=Math.min(d,ampSteps((a+0.5)/Fi));
  if(Fo>0&&b<Fo)d=Math.min(d,ampSteps((b+0.5)/Fo));
  return d;
}
const gainSteps=k=>S.steps+fadeSteps(k);
function selStats(){
  const an=S.an;if(!an)return null;
  let pk=0;for(let k=S.sel0;k<S.sel1;k++)if(an.fPeak[k]>pk)pk=an.fPeak[k];
  return {lufs:gatedLoudness(an.E,an.hop,S.sel0*S.fd,S.sel1*S.fd),peak:pk>0?20*Math.log10(pk):-120};
}

/* ---------- UI refresh ---------- */
function refresh(){
  $('#tStart').textContent=fmt(S.sel0*S.fd);$('#tEnd').textContent=fmt(S.sel1*S.fd);
  $('#tLen').textContent='Length '+fmt((S.sel1-S.sel0)*S.fd);
  $('#clockLen').textContent=fmt(S.N*S.fd);$('#clockNow').textContent=fmt(S.ph);
  const db=S.steps*1.5;$('#gainVal').textContent=sdb(db);
  $('#gainSteps').textContent=(S.steps>0?'+':'')+S.steps+(Math.abs(S.steps)===1?' step':' steps');
  $('#fadeInV').textContent=S.fadeIn?S.fadeIn.toFixed(1)+' s':'off';$('#fadeOutV').textContent=S.fadeOut?S.fadeOut.toFixed(1)+' s':'off';
  const st=selStats(),pill=$('#clipPill');
  if(st){
    $('#sLufs').innerHTML=st.lufs==null?'too quiet to measure':`${sdb(st.lufs)} <i>→</i> ${sdb(st.lufs+db)} <i>LUFS</i>`;
    const after=st.peak+db;$('#sPeak').innerHTML=`${sdb(st.peak)} <i>→</i> ${sdb(after)} <i>dBFS</i>`;
    pill.className='pill '+(after>0.05?'bad':after>-0.5?'mid':'ok');pill.textContent=after>0.05?'Clips':after>-0.5?'Tight':'Clean';
  }else{$('#sLufs').textContent=S.P?'measuring…':'—';$('#sPeak').textContent='—';pill.className='pill ok';pill.textContent='—'}
  draw();
}

initWaveform();

document.querySelectorAll('[data-nudge]').forEach(b=>b.addEventListener('click',()=>{
  const [w,d]=b.dataset.nudge.split(',');const n=+d;
  if(w==='a')S.sel0=Math.max(0,Math.min(S.sel1-1,S.sel0+n));else S.sel1=Math.min(S.N,Math.max(S.sel0+1,S.sel1+n));
  refresh();
}));
$('#resetTrim').addEventListener('click',()=>{S.sel0=0;S.sel1=S.N;refresh()});
$('#autoTrim').addEventListener('click',()=>{
  if(!S.an){status('Wait for the waveform to finish loading.');return}
  const r=S.an.fRms,th=-50;let a=0,b=S.N-1;while(a<S.N&&r[a]<th)a++;while(b>a&&r[b]<th)b--;
  if(a>=S.N){status('The whole track is below −50 dBFS, so there is nothing to trim against.',true);return}
  S.sel0=a;S.sel1=b+1;refresh();
  status(`Trimmed ${fmt(a*S.fd)} of silence from the start and ${fmt((S.N-1-b)*S.fd)} from the end.`);
});
$('#fadeIn').addEventListener('input',e=>{S.fadeIn=+e.target.value;refresh();restartIfPlaying()});
$('#fadeOut').addEventListener('input',e=>{S.fadeOut=+e.target.value;refresh();restartIfPlaying()});
function setSteps(n){S.steps=Math.max(-16,Math.min(16,n));$('#gain').value=S.steps;refresh();restartIfPlaying()}
$('#gain').addEventListener('input',e=>setSteps(+e.target.value));
$('#gMinus').addEventListener('click',()=>setSteps(S.steps-1));
$('#gPlus').addEventListener('click',()=>setSteps(S.steps+1));
document.querySelectorAll('[data-target]').forEach(b=>b.addEventListener('click',()=>{
  const st=selStats();if(!st||st.lufs==null){status('Loudness is still being measured.');return}
  const t=+b.dataset.target,n=Math.round((t-st.lufs)/1.5);setSteps(n);
  const after=st.peak+S.steps*1.5;
  status(`Set to ${sdb(st.lufs+S.steps*1.5)} LUFS for a ${t} target.`+(after>0.05?` Peaks now reach ${sdb(after)} dBFS and will clip. Try "Loudest without clipping".`:''),after>0.05);
}));
$('#maxClean').addEventListener('click',()=>{
  const st=selStats();if(!st){status('Loudness is still being measured.');return}
  setSteps(Math.floor(-st.peak/1.5));status(`Gain set to ${sdb(S.steps*1.5)} dB. The loudest peak lands at ${sdb(st.peak+S.steps*1.5)} dBFS.`);
});

initPlayer();

async function getDownloads(){try{if(window.claude&&typeof window.claude.use==='function')return await window.claude.use('downloads')}catch(e){}return null}
const MB=n=>(n/1048576).toFixed(1)+' MB';
$('#save').addEventListener('click',async()=>{
  if(!S.P)return;
  let name=($('#fname').value||'').trim()||'edit.mp3';if(!/\.mp3$/i.test(name))name+='.mp3';
  const r=buildMp3(S.P,S.sel0,S.sel1,gainSteps),out=r.bytes;
  const warn=r.clampHi?` ${r.clampHi} gain values hit the format's ceiling, so those frames are slightly quieter than asked.`:'';
  const dl=await getDownloads();
  if(dl){
    try{await dl.save({filename:name.replace(/\.mp3$/i,'.zip'),data:makeZip(name,out)});status(`Saved ${name} (${MB(out.length)}) inside a .zip. Open the standalone Gainsaw file to save a plain .mp3.`+warn)}
    catch(e){const c=e&&e.code;status(c==='declined'?'Save cancelled.':c==='rate_limited'?'A save prompt is already open.':'Saving is not available in this view. Open the standalone Gainsaw file instead.',c!=='declined')}
    return;
  }
  if(window.top!==window.self){status('Saving is not available in this view. Open the standalone Gainsaw file instead.',true);return}
  const url=URL.createObjectURL(new Blob([out],{type:'audio/mpeg'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  status(`Saved ${name} · ${fmt((S.sel1-S.sel0)*S.fd)} · ${MB(out.length)} · no re-encoding.`+warn);
});
