/* ---------- playback ---------- */
function curPos(){return S.playing?Math.min(S.playing.to,S.playing.from+Math.max(0,S.ctx.currentTime-S.playing.t0)):S.ph}
function stop(){if(S.playing){const p=S.playing;S.playing=null;try{p.src.stop()}catch(e){}}$('#play').textContent='Play'}
function play(from,to){
  stop();if(!S.buf||!S.ctx)return;S.ctx.resume();
  from=Math.max(0,from);to=Math.min(to,S.buf.duration);if(to-from<0.05)return;
  const src=S.ctx.createBufferSource();src.buffer=S.buf;const g=S.ctx.createGain();src.connect(g).connect(S.ctx.destination);
  const k0=Math.floor(from/S.fd),k1=Math.max(k0+2,Math.ceil(to/S.fd)),curve=new Float32Array(k1-k0);
  for(let i=0;i<curve.length;i++)curve[i]=Math.pow(10,gainSteps(k0+i)*1.5/20);
  const t0=S.ctx.currentTime+0.04;g.gain.setValueAtTime(curve[0],S.ctx.currentTime);g.gain.setValueCurveAtTime(curve,t0,(k1-k0)*S.fd);
  src.start(t0,from,to-from);S.playing={src,t0,from,to};$('#play').textContent='Pause';
  src.onended=()=>{if(S.playing&&S.playing.src===src){S.playing=null;$('#play').textContent='Play';S.ph=Math.min(to,S.sel1*S.fd);refresh()}};
  const tick=()=>{if(!S.playing||S.playing.src!==src)return;S.ph=curPos();$('#clockNow').textContent=fmt(S.ph);draw();requestAnimationFrame(tick)};requestAnimationFrame(tick);
}
let rT=0;function restartIfPlaying(){if(!S.playing)return;clearTimeout(rT);rT=setTimeout(()=>{if(S.playing)play(curPos(),S.playing.to)},120)}
function togglePlay(){
  if(!S.buf)return;
  if(S.playing){S.ph=curPos();stop();refresh();return}
  const a=S.sel0*S.fd,b=S.sel1*S.fd;play(S.ph>=a&&S.ph<b-0.05?S.ph:a,b);
}
function initPlayer(){
$('#play').addEventListener('click',togglePlay);
$('#hearStart').addEventListener('click',()=>play(S.sel0*S.fd,Math.min(S.sel1*S.fd,S.sel0*S.fd+5)));
$('#hearEnd').addEventListener('click',()=>play(Math.max(S.sel0*S.fd,S.sel1*S.fd-5),S.sel1*S.fd));
/* ←/→ move the playhead 1 s (Shift = 5 s). Skipped on inputs and trim handles, which use the arrows themselves. */
document.addEventListener('keydown',e=>{
  if(!S.P||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')||e.altKey||e.ctrlKey||e.metaKey)return;
  const t=e.target;if(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.classList.contains('handle'))return;
  e.preventDefault();
  if(e.repeat&&S.playing)return; // a held key would restart playback ~30 times a second
  const d=(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?5:1);
  // while playing, stay inside the kept part so playback doesn't silently stop past the end
  const lo=S.playing?S.sel0*S.fd:0,hi=S.playing?S.sel1*S.fd-0.1:S.N*S.fd;
  S.ph=Math.max(lo,Math.min(hi,curPos()+d));
  if(S.playing)play(S.ph,S.sel1*S.fd); // same as clicking the waveform while playing
  refresh();
});
document.addEventListener('keydown',e=>{
  if(e.code!=='Space'||!S.buf)return;const t=e.target;
  if(t.tagName==='BUTTON'||(t.tagName==='INPUT'&&t.type==='text')||t.tagName==='LABEL')return;
  e.preventDefault();togglePlay();
});
}
