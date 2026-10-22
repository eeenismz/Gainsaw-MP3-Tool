/* ---------- waveform ---------- */
let cv,cx,hA,hB;
const RULER=22;
function tok(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()}
function draw(){
  const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  cx.setTransform(dpr,0,0,dpr,0,0);cx.clearRect(0,0,W,H);
  if(!S.P)return;
  const c={panel:tok('--panel'),wave:tok('--wave'),dim:tok('--wave-dim'),acc:tok('--accent'),clip:tok('--clip'),ink:tok('--ink'),muted:tok('--muted'),line:tok('--line'),sel:tok('--sel')};
  const D=S.N*S.fd,wh=H-RULER,mid=wh/2,amp=mid*0.92,xA=S.sel0/S.N*W,xB=S.sel1/S.N*W;
  cx.fillStyle=c.sel;cx.fillRect(xA,0,xB-xA,wh);
  cx.fillStyle=c.line;cx.fillRect(0,mid,W,1);
  const an=S.an;
  if(an){
    for(let x=0;x<W;x++){
      const t0=x/W*D,t1=(x+1)/W*D;
      const j0=Math.floor(t0/an.dur*an.B),j1=Math.max(j0+1,Math.floor(t1/an.dur*an.B));
      let lo=0,hi=0;for(let j=Math.max(0,j0);j<Math.min(an.B,j1);j++){if(an.mn[j]<lo)lo=an.mn[j];if(an.mx[j]>hi)hi=an.mx[j]}
      const k=Math.min(S.N-1,Math.floor((t0+t1)/2/S.fd)),inSel=k>=S.sel0&&k<S.sel1;
      const g=inSel?Math.pow(10,gainSteps(k)*1.5/20):1;
      const a=hi*g,b=lo*g;
      cx.fillStyle=inSel?c.wave:c.dim;
      const yT=mid-Math.min(1,a)*amp,yB=mid-Math.max(-1,b)*amp;cx.fillRect(x,yT,1,Math.max(1,yB-yT));
      if(inSel&&(a>1||b<-1)){cx.fillStyle=c.clip;if(a>1)cx.fillRect(x,mid-amp-3,1,6);if(b<-1)cx.fillRect(x,mid+amp-3,1,6)}
    }
  }else{cx.fillStyle=c.muted;cx.font='13px '+tok('--f-body');cx.fillText('Decoding waveform…',16,mid-8)}
  cx.strokeStyle=c.line;cx.setLineDash([3,4]);
  for(const y of [mid-amp,mid+amp]){cx.beginPath();cx.moveTo(0,y+.5);cx.lineTo(W,y+.5);cx.stroke()}
  cx.setLineDash([]);
  // ruler
  cx.fillStyle=c.panel;cx.fillRect(0,wh,W,RULER);cx.fillStyle=c.line;cx.fillRect(0,wh,W,1);
  const steps=[1,2,5,10,15,30,60,120,300];let step=steps.find(s=>W/(D/s)>=70)||600;
  cx.fillStyle=c.muted;cx.font='11px '+tok('--f-mono');
  for(let t=0;t<=D;t+=step){const x=Math.round(t/D*W);cx.fillRect(x,wh,1,5);const m=Math.floor(t/60),s=Math.round(t%60);if(x<W-30)cx.fillText(m+':'+String(s).padStart(2,'0'),x+3,wh+15)}
  // handles
  for(const x of [xA,xB]){
    cx.fillStyle=c.acc;cx.fillRect(Math.round(x)-1,0,2,wh);
    const tx=Math.min(W-14,Math.max(0,x-7));cx.beginPath();cx.roundRect(tx,0,14,20,[0,0,4,4]);cx.fill();
    cx.fillStyle=c.panel;cx.fillRect(tx+5,5,1,10);cx.fillRect(tx+8,5,1,10);
  }
  // keyboard handles: same spot as the drawn handles, clamped the same way; aria values in frames
  hA.style.left=Math.max(0,Math.min(W-14,xA-7))+'px';hB.style.left=Math.max(0,Math.min(W-14,xB-7))+'px';
  hA.setAttribute('aria-valuemin',0);hA.setAttribute('aria-valuemax',S.sel1-1);hA.setAttribute('aria-valuenow',S.sel0);hA.setAttribute('aria-valuetext',fmt(S.sel0*S.fd));
  hB.setAttribute('aria-valuemin',S.sel0+1);hB.setAttribute('aria-valuemax',S.N);hB.setAttribute('aria-valuenow',S.sel1);hB.setAttribute('aria-valuetext',fmt(S.sel1*S.fd));
  const xp=S.ph/D*W;cx.fillStyle=c.ink;cx.fillRect(Math.round(xp),0,1,wh);
}
let drag=null;
function hit(x){const W=cv.clientWidth,xA=S.sel0/S.N*W,xB=S.sel1/S.N*W;if(Math.abs(x-xA)<10&&Math.abs(x-xA)<=Math.abs(x-xB))return 'a';if(Math.abs(x-xB)<10)return 'b';return null}

/* keyboard trim on a focused handle (w='a' start, 'b' end): arrows = 1 frame, Shift = 1 s, Home/End = ends */
function kbTrim(e,w){
  if(!S.P||e.altKey||e.ctrlKey||e.metaKey)return;
  const k=e.key,d=(k==='ArrowLeft'?-1:k==='ArrowRight'?1:0)*(e.shiftKey?Math.round(1/S.fd):1);
  if(!d&&k!=='Home'&&k!=='End')return;
  e.preventDefault(); // stops the page scrolling on arrows
  let f=w==='a'?S.sel0:S.sel1;
  if(k==='Home')f=0;else if(k==='End')f=S.N;else f+=d;
  // same clamps as the nudge buttons
  if(w==='a')S.sel0=Math.max(0,Math.min(S.sel1-1,f));else S.sel1=Math.min(S.N,Math.max(S.sel0+1,f));
  refresh();
  if(S.playing)play(S.sel0*S.fd,S.sel1*S.fd); // same restart as pointerup
}

function initWaveform(){
cv=$('#wave');cx=cv.getContext('2d');hA=$('#hA');hB=$('#hB');
hA.addEventListener('keydown',e=>kbTrim(e,'a'));hB.addEventListener('keydown',e=>kbTrim(e,'b'));
new ResizeObserver(()=>draw()).observe(cv);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',draw);
new MutationObserver(draw).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
cv.addEventListener('pointerdown',e=>{
  if(!S.P)return;const x=e.offsetX;drag=hit(x);cv.setPointerCapture(e.pointerId);
  if(!drag){S.ph=Math.max(0,Math.min(S.N*S.fd,x/cv.clientWidth*S.N*S.fd));if(S.playing)play(S.ph,S.sel1*S.fd);refresh()}
});
cv.addEventListener('pointermove',e=>{
  if(!S.P)return;const x=e.offsetX;
  if(!drag){cv.style.cursor=hit(x)?'ew-resize':'crosshair';return}
  const f=Math.round(Math.max(0,Math.min(1,x/cv.clientWidth))*S.N);
  if(drag==='a')S.sel0=Math.max(0,Math.min(f,S.sel1-1));else S.sel1=Math.min(S.N,Math.max(f,S.sel0+1));
  refresh();
});
cv.addEventListener('pointerup',()=>{if(drag&&S.playing)play(S.sel0*S.fd,S.sel1*S.fd);drag=null});
}
