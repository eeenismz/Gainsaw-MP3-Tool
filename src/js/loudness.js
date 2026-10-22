(function (root) {
function kCoefs(fs){
  // libebur128 bilinear form (K=tan(pi*fc/fs)); reproduces BS.1770 48k coefficients exactly
  let G=3.999843853973347,Q=0.7071752369554196,fc=1681.974450955533;
  let K=Math.tan(Math.PI*fc/fs),Vh=Math.pow(10,G/20),Vb=Math.pow(Vh,0.4996667741545416),a0=1+K/Q+K*K;
  // stage 1: high shelf
  const f1={b0:(Vh+Vb*K/Q+K*K)/a0,b1:2*(K*K-Vh)/a0,b2:(Vh-Vb*K/Q+K*K)/a0,a1:2*(K*K-1)/a0,a2:(1-K/Q+K*K)/a0};
  Q=0.5003270373238773;fc=38.13547087602444;K=Math.tan(Math.PI*fc/fs);a0=1+K/Q+K*K;
  // stage 2: high-pass
  const f2={b0:1,b1:-2,b2:1,a1:2*(K*K-1)/a0,a2:(1-K/Q+K*K)/a0};
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
