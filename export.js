/* Paint all nodes and wires into a standalone PNG, independent of viewport. */
(function(root){
'use strict';
function measure(scene,{cardFor,portPoint,scale:requested=1}){
 if(!scene.nodes.length)throw Error('保存するノードがありません。');

 const cards=scene.nodes.map(n=>({node:n,card:cardFor(n.id)}));
 const wireX=[],wireY=[];for(const edge of scene.edges){const a=portPoint(edge.from,'output',edge.slot),b=portPoint(edge.to,'input',edge.slot);if(a&&b){const bend=Math.max(60,Math.abs(b.x-a.x)/2);wireX.push(a.x,a.x+bend,b.x-bend,b.x);wireY.push(a.y,b.y);}}
 const minX=Math.min(...cards.map(c=>c.node.x),...wireX)-35,minY=Math.min(...cards.map(c=>c.node.y),...wireY)-35,maxX=Math.max(...cards.map(c=>c.node.x+c.card.offsetWidth),...wireX)+35,maxY=Math.max(...cards.map(c=>c.node.y+c.card.offsetHeight),...wireY)+35,w=maxX-minX,h=maxY-minY;
 if(w>60000||h>60000)throw Error('ノードが離れすぎています。近くに配置してから保存してください。');
 if(!Number.isFinite(requested)||requested<.25||requested>4)throw Error('倍率は0.25〜4にしてください。');const scale=Math.min(requested,8192/Math.max(w,h),Math.sqrt(24000000/(w*h)));return {cards,minX,minY,w,h,scale,width:Math.ceil(w*scale),height:Math.ceil(h*scale)};
}
async function createCanvas(scene,options){await document.fonts.ready;const {cardFor,portPoint}=options,{cards,minX,minY,w,h,scale,width,height}=measure(scene,options),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.translate(-minX,-minY);ctx.fillStyle='#17191e';ctx.fillRect(minX,minY,w,h);
 const palette={light:'#F4D199',hub:'#85CCB8',bundle:'#F4D199',key:'#F4D199',environment:'#8EB6E2',reflection:'#D99D8F',highlight:'#E4D8FA',background:'#9BBDB0'};
 for(const edge of scene.edges){const a=portPoint(edge.from,'output',edge.slot),b=portPoint(edge.to,'input',edge.slot);if(!a||!b)continue;const bend=Math.max(60,Math.abs(b.x-a.x)/2);const source=scene.nodes.find(n=>n.id===edge.from);ctx.strokeStyle=palette[source?.type==='lighting'?source.kind:'hub']||palette.bundle;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(a.x+bend,a.y,b.x-bend,b.y,b.x,b.y);ctx.stroke();}
 for(const {node,card}of cards){
  const rect=card.getBoundingClientRect(),unit=scene.view.scale;ctx.fillStyle='#24272f';ctx.strokeStyle=getComputedStyle(card).borderTopColor||'#474d5d';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(node.x,node.y,card.offsetWidth,card.offsetHeight,10);ctx.fill();ctx.stroke();
  for(const element of card.querySelectorAll('*')){
   if(!element.getClientRects().length||element.hidden)continue;const style=getComputedStyle(element);if(style.display==='none'||style.visibility==='hidden')continue;
   const r=element.getBoundingClientRect(),x=node.x+(r.left-rect.left)/unit,y=node.y+(r.top-rect.top)/unit,width=r.width/unit,height=r.height/unit;
   if(width<=0||height<=0)continue;
   if(element.tagName==='CANVAS'){ctx.drawImage(element,x,y,width,height);continue;}
   if(element.classList.contains('port')){ctx.fillStyle=style.backgroundColor;ctx.beginPath();ctx.arc(x+width/2,y+height/2,7,0,Math.PI*2);ctx.fill();continue;}
   if(element.classList.contains('node-header')||['BUTTON','INPUT','SELECT'].includes(element.tagName)){
    ctx.fillStyle=style.backgroundColor==='rgba(0, 0, 0, 0)'?'#24272f':style.backgroundColor;
    if(element.type==='color')ctx.fillStyle=element.value;
    ctx.fillRect(x,y,width,height);
   }
   if(element.type==='checkbox'){ctx.strokeStyle=style.color;ctx.strokeRect(x+1,y+1,width-2,height-2);if(element.checked){ctx.fillStyle=style.accentColor;ctx.fillRect(x+4,y+4,width-8,height-8);}continue;}
   if(element.type==='range'){
    const t=(Number(element.value)-Number(element.min))/(Number(element.max)-Number(element.min));ctx.fillStyle='#484e5c';ctx.fillRect(x,y+height/2-2,width,4);ctx.fillStyle=style.accentColor;ctx.fillRect(x,y+height/2-2,width*t,4);continue;
   }
   if(element.type==='color'||element.type==='file'||element.classList.contains('port'))continue;
   let text='';if(['INPUT','SELECT'].includes(element.tagName))text=element.tagName==='SELECT'?element.selectedOptions[0]?.textContent:element.value;
   else if(element.childElementCount===0)text=element.textContent.trim();
   if(!text)continue;ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();ctx.fillStyle=style.color;ctx.font=style.font||'12px sans-serif';ctx.textBaseline='middle';const padding=parseFloat(style.paddingLeft)||0;ctx.fillText(text,x+padding,y+height/2,Math.max(1,width-padding*2));ctx.restore();
  }
 }
 return canvas;
}
root.SceneExporter={createCanvas,measure};
})(globalThis);
