(function (root) {
const BR1=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320];
const BR2=[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
const SRT={3:[44100,48000,32000],2:[22050,24000,16000],0:[11025,12000,8000]};
function hdr(u,i){
  if(i+4>u.length||u[i]!==0xFF||(u[i+1]&0xE0)!==0xE0)return null;
  const ver=(u[i+1]>>3)&3,layer=(u[i+1]>>1)&3;
  if(ver===1||layer!==1)return null;
  const bi=u[i+2]>>4,si=(u[i+2]>>2)&3;
  if(bi===0||bi===15||si===3)return null;
  const m1=ver===3,br=(m1?BR1:BR2)[bi]*1000,sr=SRT[ver][si],pad=(u[i+2]>>1)&1,mode=u[i+3]>>6;
  return {ver,m1,sr,br,mode,nch:mode===3?1:2,crc:(u[i+1]&1)===0,spf:m1?1152:576,len:Math.floor((m1?144:72)*br/sr)+pad};
}
function sideLen(h){return h.m1?(h.nch===1?17:32):(h.nch===1?9:17)}
const GGC={};
function ggOffs(h){
  const k=(h.m1?1:2)+'-'+h.nch;if(GGC[k])return GGC[k];const o=[];
  if(h.m1){const st=9+(h.nch===1?5:3)+4*h.nch;for(let g=0;g<2;g++)for(let c=0;c<h.nch;c++)o.push(st+(g*h.nch+c)*59+21)}
  else{const st=8+(h.nch===1?1:2);for(let c=0;c<h.nch;c++)o.push(st+c*63+21)}
  return GGC[k]=o;
}
function readBits(u,base,off,n){let v=0;for(let i=0;i<n;i++){const b=off+i;v=(v<<1)|((u[base+(b>>3)]>>(7-(b&7)))&1)}return v}
function writeBits(u,base,off,n,val){for(let i=0;i<n;i++){const b=off+i,idx=base+(b>>3),sh=7-(b&7),bit=(val>>(n-1-i))&1;u[idx]=(u[idx]&~(1<<sh))|(bit<<sh)}}
function crcMpeg(u,p,sl){let crc=0xFFFF;const feed=x=>{for(let i=7;i>=0;i--){const top=(crc>>15)&1;crc=(crc<<1)&0xFFFF;if(top^((x>>i)&1))crc^=0x8005}};feed(u[p+2]);feed(u[p+3]);for(let i=0;i<sl;i++)feed(u[p+6+i]);return crc}
function crc16arc(u,s,n){let c=0;for(let i=0;i<n;i++){c^=u[s+i];for(let k=0;k<8;k++)c=(c&1)?(c>>>1)^0xA001:c>>>1}return c}
function str(u,i,n){let s='';for(let k=0;k<n&&i+k<u.length;k++)s+=String.fromCharCode(u[i+k]);return s}
function isTagAt(u,i){return str(u,i,3)==='TAG'||str(u,i,8)==='APETAGEX'||str(u,i,6)==='LYRICS'}
function u32(u,i){return ((u[i]<<24)|(u[i+1]<<16)|(u[i+2]<<8)|u[i+3])>>>0}
function w32(u,i,v){u[i]=v>>>24&255;u[i+1]=v>>>16&255;u[i+2]=v>>>8&255;u[i+3]=v&255}

function parseMp3(u){
  let pos=0;
  while(pos+10<=u.length&&str(u,pos,3)==='ID3'){
    const size=((u[pos+6]&127)<<21)|((u[pos+7]&127)<<14)|((u[pos+8]&127)<<7)|(u[pos+9]&127);
    pos+=10+size+((u[pos+5]&16)?10:0);
  }
  const head=u.subarray(0,Math.min(pos,u.length));
  let first=null,i=pos;
  for(;i+4<u.length;i++){const h=hdr(u,i);if(!h)continue;const h2=hdr(u,i+h.len);if(h2&&h2.ver===h.ver&&h2.sr===h.sr){first=h;break}}
  if(!first)throw new Error('No MP3 audio frames found. Is this an MPEG Layer III file?');
  const frames=[];let off=i;
  const same=h=>h&&h.ver===first.ver&&h.sr===first.sr;
  while(off+4<=u.length){
    const h=hdr(u,off);
    if(same(h)&&off+h.len<=u.length){frames.push({off,len:h.len,h});off+=h.len;continue}
    if(isTagAt(u,off))break;
    let found=-1;
    for(let j=off+1;j+4<u.length;j++){if(isTagAt(u,j))break;const a=hdr(u,j);if(same(a)){const n=j+a.len;if(n===u.length||same(hdr(u,n))||isTagAt(u,n)){found=j;break}}}
    if(found<0)break;off=found;
  }
  const tail=u.subarray(off);
  let xing=null,vbri=false;
  const f0=frames[0],h0=f0.h,xo=4+(h0.crc?2:0)+sideLen(h0),tag=str(u,f0.off+xo,4);
  if(tag==='Xing'||tag==='Info')xing={frame:f0,xo,vbr:tag==='Xing'};
  else if(str(u,f0.off+36,4)==='VBRI')vbri=true;
  const audio=(xing||vbri)?frames.slice(1):frames;
  return {u,head,tail,xing,vbri,audio,first};
}

/* deltaFn(k) -> gain steps for audio frame k (absolute index). Returns {bytes, clampHi, clampLo} */
function buildMp3(P,s,e,deltaFn){
  const u=P.u,A=P.audio,x=P.xing,xlen=x?x.frame.len:0;
  let ab=0;for(let k=s;k<e;k++)ab+=A[k].len;
  const out=new Uint8Array(P.head.length+xlen+ab+P.tail.length);
  let p=0,hi=0,lo=0;out.set(P.head,p);p+=P.head.length;
  const xs=p;if(x){out.set(u.subarray(x.frame.off,x.frame.off+xlen),p);p+=xlen}
  const offs=new Array(e-s);
  for(let k=s;k<e;k++){
    const f=A[k];out.set(u.subarray(f.off,f.off+f.len),p);offs[k-s]=p-xs;
    const d=deltaFn(k);
    if(d!==0){
      const base=p+4+(f.h.crc?2:0);
      for(const o of ggOffs(f.h)){let v=readBits(out,base,o,8)+d;if(v>255){v=255;hi++}else if(v<0){v=0;lo++}writeBits(out,base,o,8,v)}
      if(f.h.crc){const c=crcMpeg(out,p,sideLen(f.h));out[p+4]=c>>8;out[p+5]=c&255}
    }
    p+=f.len;
  }
  out.set(P.tail,p);
  if(x&&!(s===0&&e===A.length)){
    const n=e-s,total=xlen+ab;let q=xs+x.xo+4;const flags=u32(out,q);q+=4;
    if(flags&1){w32(out,q,n);q+=4}
    if(flags&2){w32(out,q,total);q+=4}
    if(flags&4){for(let i=0;i<100;i++){const fi=Math.min(n-1,Math.floor(i*n/100));out[q+i]=Math.min(255,Math.floor(offs[fi]/total*256))}q+=100}
    if(flags&8)q+=4;
    if(q+36<=xs+xlen&&/^[A-Za-z]{4}$/.test(str(out,q,4))){const c=crc16arc(out,xs,q-xs+34);out[q+34]=c>>8;out[q+35]=c&255}
  }
  return {bytes:out,clampHi:hi,clampLo:lo};
}
  const api = { parseMp3, buildMp3 };
  if (typeof module !== 'undefined') module.exports = api;
  else root.GainsawMp3 = api;
})(this);
