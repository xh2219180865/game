/** Keep the entry parseable before loading the exact-integer game core. */
declare const require:(path:string)=>unknown;
declare const wx:{createCanvas():HTMLCanvasElement;getSystemInfoSync():{windowWidth:number;windowHeight:number;pixelRatio:number}};

if(typeof BigInt==='function'){
  require('./game-core.js');
}else{
  const canvas=wx.createCanvas(),ctx=canvas.getContext('2d'),info=wx.getSystemInfoSync(),ratio=Math.min(info.pixelRatio||1,3);
  canvas.width=Math.round(info.windowWidth*ratio);canvas.height=Math.round(info.windowHeight*ratio);
  if(ctx){
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#213F3D';ctx.fillRect(0,0,info.windowWidth,info.windowHeight);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#FFF1CE';ctx.font='600 25px sans-serif';ctx.fillText('谋定山河',info.windowWidth/2,info.windowHeight*.36);
    ctx.font='16px sans-serif';ctx.fillText('当前运行环境暂不支持',info.windowWidth/2,info.windowHeight*.47);
    ctx.font='14px sans-serif';ctx.fillText('请更新微信后重试',info.windowWidth/2,info.windowHeight*.53);
    ctx.fillText('本地记录保持不变',info.windowWidth/2,info.windowHeight*.59);
  }
}
