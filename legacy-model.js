/* Pure graph and color model, shared by browser and tests. */
(function(root){
'use strict';
const types=['base','key','environment','reflection','highlight','background'];
const labels={base:'固有色',key:'主光源',environment:'環境光',reflection:'反射光',highlight:'ハイライト',background:'背景'};
const normalizeHex=v=>typeof v==='string'&&/^#?[\da-f]{6}$/i.test(v.trim())?'#'+v.trim().replace(/^#/,'').toUpperCase():null;
const isHex=v=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v);
const channels=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const hex=rgb=>'#'+rgb.map(c=>Math.round(Math.max(0,Math.min(1,c))*255).toString(16).padStart(2,'0')).join('').toUpperCase();
const mix=(a,b,t)=>hex(channels(a).map((c,i)=>c*(1-t)+channels(b)[i]*t));
const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
const srgb=c=>c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;
function source(state,node,type){const edge=state.edges.find(e=>e.to===node.id&&state.nodes.some(n=>n.id===e.from&&n.type===type));return edge&&state.nodes.find(n=>n.id===edge.from);}
function shader(state,node){
 const env=source(state,node,'environment'),key=source(state,node,'key'),reflected=source(state,node,'reflection'),shine=source(state,node,'highlight');
 const base=channels(node.color).map(linear),ec=channels(env?.color||'#FFFFFF').map(linear),kc=channels(key?.color||'#FFFFFF').map(linear),rc=channels(reflected?.color||'#FFFFFF').map(linear),hc=channels(shine?.color||'#FFFFFF').map(linear);
 return (light,specular=light**18)=>hex(base.map((c,i)=>{
  const tinted=c*(1-(env?.strength||0))+ec[i]*(env?.strength||0)*.6;
  const ambient=env ? .15+env.strength*.45 : .38;
  const diffuse=key?key.strength*light*1.3*kc[i]:.62*light;
  const bounce=reflected?reflected.strength*(1-light)*.45*rc[i]:0;
  const spec=shine?shine.strength*specular*.8*hc[i]:0;
  return srgb(Math.max(0,tinted*(ambient+diffuse)+c*bounce+spec));
 }));
}
function tones(state,node){const shade=shader(state,node);return {shadow:shade(0),middle:shade(.5),light:shade(1),original:node.color};}
const result=(state,node)=>tones(state,node).middle;
function sample(){return {version:2,nodes:[
{id:'key',type:'key',name:'主光源',color:'#FFE2AD',strength:.8,angle:-45,x:30,y:20},
{id:'env',type:'environment',name:'環境光',color:'#809AC9',strength:.25,x:30,y:340},
{id:'reflection',type:'reflection',name:'床からの反射光',color:'#D79D7D',strength:.35,x:330,y:20},
{id:'highlight',type:'highlight',name:'ハイライト',color:'#FFF5E7',strength:.45,x:330,y:285},
{id:'bg',type:'background',name:'プレビュー背景',color:'#434A59',x:330,y:550},
{id:'skin',type:'base',name:'肌',color:'#F2C7AB',shape:'sphere',backdrop:'#30343D',x:660,y:20},
{id:'hair',type:'base',name:'髪',color:'#49405C',shape:'cube',backdrop:'#30343D',x:1000,y:20},
{id:'cloth',type:'base',name:'服',color:'#6E9BA4',shape:'sphere',backdrop:'#30343D',x:1340,y:20}
],edges:['skin','hair','cloth'].flatMap(to=>['key','env','reflection','highlight','bg'].map(from=>({from,to}))),view:{x:20,y:20,scale:.75}};}
function validate(data){
 if(!data||![1,2].includes(data.version)||!Array.isArray(data.nodes)||!Array.isArray(data.edges)||data.nodes.length>100||data.edges.length>500)throw Error('未対応の形式、またはノード・接続数が上限を超えています。');
 const legacy=data.version===1,ids=new Set();
 const nodes=data.nodes.map((n,index)=>{
  if(!n||typeof n.id!=='string'||!n.id||n.id.length>100||ids.has(n.id)||!types.includes(n.type)||typeof n.name!=='string'||n.name.length>60||!isHex(n.color)||![n.x,n.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=100000))throw Error('ノードの値が不正です。');
  ids.add(n.id);const out={id:n.id,type:n.type,name:n.name,color:n.color.toUpperCase(),x:n.x,y:n.y};
  if(!['base','background'].includes(n.type)){if(!Number.isFinite(n.strength)||n.strength<0||n.strength>1)throw Error('光の強さが不正です。');out.strength=n.strength;}
  if(n.type==='key'){if(!Number.isFinite(n.angle)||n.angle < -180 || n.angle > 180)throw Error('光の向きが不正です。');out.angle=n.angle;}
  if(n.type==='base'){
   if(!legacy&&(!['sphere','cube','flat'].includes(n.shape)||!isHex(n.backdrop)))throw Error('オブジェクト設定が不正です。');
   out.shape=legacy?'sphere':n.shape;out.backdrop=legacy?'#30343D':n.backdrop.toUpperCase();
  }
  if(legacy){const bi=data.nodes.slice(0,index).filter(v=>v.type==='base').length;out.x=n.type==='base'?660+bi*340:n.type==='background'?330:30;out.y=n.type==='base'?20:n.type==='background'?20:270;}
  return out;
 });
 const targets=new Set();const edges=data.edges.map(e=>{
  const from=nodes.find(n=>n.id===e?.from),to=nodes.find(n=>n.id===e?.to);
  if(!from||from.type==='base'||(legacy&&from.type!=='environment')||!to||to.type!=='base'||targets.has(to.id+':'+from.type))throw Error('接続データが不正です。');
  targets.add(to.id+':'+from.type);return {from:from.id,to:to.id};
 });
 if(legacy&&data.showBackground){const bg=nodes.find(n=>n.type==='background');if(bg)nodes.filter(n=>n.type==='base').forEach(n=>edges.push({from:bg.id,to:n.id}));}
 const v=data.view;if(!v||![v.x,v.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000)||!Number.isFinite(v.scale)||v.scale<.25||v.scale>2)throw Error('表示設定が不正です。');
 return {version:2,nodes,edges,view:{x:v.x,y:v.y,scale:v.scale}};
}
const api={types,labels,normalizeHex,isHex,mix,source,shader,tones,result,sample,validate};
if(typeof module!=='undefined')module.exports=api;else root.LegacyColorModel=api;
})(globalThis);
