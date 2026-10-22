(function (root) {
function kCoefs(fs){
  let G=3.999843853973347,Q=0.7071752369554196,fc=1681.974450955533;
  let A=Math.pow(10,G/40),w=2*Math.PI*fc/fs,cs=Math.cos(w),al=Math.sin(w)/(2*Q),sA=Math.sqrt(A);
  let a0=(A+1)-(A-1)*cs+2*sA*al;
  const f1={b0:A*((A+1)+(A-1)*cs+2*sA*al)/a0,b1:-2*A*((A-1)+(A+1)*cs)/a0,b2:A*((A+1)+(A-1)*cs-2*sA*al)/a0,a1:2*((A-1)-(A+1)*cs)/a0,a2:((A+1)-(A-1)*cs-2*sA*al)/a0};
  Q=0.5003270373238773;fc=38.13547087602444;w=2*Math.PI*fc/fs;cs=Math.cos(w);al=Math.sin(w)/(2*Q);a0=1+al;
  const f2={b0:(1+cs)/2/a0,b1:-(1+cs)/a0,b2:(1+cs)/2/a0,a1:-2*cs/a0,a2:(1-al)/a0};
  return [f1,f2];
}
function hopEnergies(chans,fs){
  const [f1,f2]=kCoefs(fs),hop=Math.round(fs*0.1),L=chans[0].length,nh=Math.floor(L/hop),E=new Float64Array(nh);
  for(const x of chans){
    let xp1=0,xp2=0,yp1=0,yp2=0,zp1=0,zp2=0,hi=0,cnt=0;
    for(let i=0;i<nh*hop;i++){
      const xi=x[i],yi=f1.b0*xi+f1.b1*xp1+f1.b2*xp2-f1.a1*yp1-f1.a2*yp2;xp2=xp1;xp1=xi;
      const zi=f2.b0*yi+f2.b1*yp1+f2.b2*yp2-f2.a1*zp1-f2.a2*zp2;yp2=yp1;yp1=yi;zp2=zp1;zp1=zi;
      E[hi]+=zi*zi;if(++cnt===hop){cnt=0;hi++}
    }
  }
  return {E,hop};
}
function gatedLoudness(E,hop,t0,t1){
  const z=[];for(let j=Math.ceil(t0/0.1-1e-9);j+3<E.length&&j*0.1+0.4<=t1+1e-9;j++)z.push((E[j]+E[j+1]+E[j+2]+E[j+3])/(4*hop));
  const lk=v=>-0.691+10*Math.log10(v);
  const g1=z.filter(v=>v>0&&lk(v)>-70);if(!g1.length)return null;
  const rel=lk(g1.reduce((a,b)=>a+b,0)/g1.length)-10;
  const g2=g1.filter(v=>lk(v)>rel);if(!g2.length)return null;
  return lk(g2.reduce((a,b)=>a+b,0)/g2.length);
}
  const api = { kCoefs, hopEnergies, gatedLoudness };
  if (typeof module !== 'undefined') module.exports = api;
  else root.GainsawLoudness = api;
})(this);
