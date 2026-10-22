// Only used when running inside the Claude artifact viewer (the .zip save path in app.js).
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRCT[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function makeZip(name,data){
  const nb=new TextEncoder().encode(name),crc=crc32(data),n=data.length,d=new Date();
  const tm=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),dt=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  const lh=new DataView(new ArrayBuffer(30));[[0,0x04034b50,4],[4,20],[6,0x0800],[8,0],[10,tm],[12,dt],[14,crc,4],[18,n,4],[22,n,4],[26,nb.length],[28,0]].forEach(([o,v,s])=>s===4?lh.setUint32(o,v,true):lh.setUint16(o,v,true));
  const cd=new DataView(new ArrayBuffer(46));[[0,0x02014b50,4],[4,20],[6,20],[8,0x0800],[10,0],[12,tm],[14,dt],[16,crc,4],[20,n,4],[24,n,4],[28,nb.length],[42,0,4]].forEach(([o,v,s])=>s===4?cd.setUint32(o,v,true):cd.setUint16(o,v,true));
  const eo=new DataView(new ArrayBuffer(22));eo.setUint32(0,0x06054b50,true);eo.setUint16(8,1,true);eo.setUint16(10,1,true);eo.setUint32(12,46+nb.length,true);eo.setUint32(16,30+nb.length+n,true);
  return new Blob([lh,nb,data,cd,nb,eo]);
}
