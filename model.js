/* Version 3 scene model. Media and OBJ source stay in the project document. */
(function(root){
'use strict';
const G=typeof module!=='undefined'?require('./geometry.js'):root.Geometry;
const Legacy=typeof module!=='undefined'?require('./legacy-model.js'):root.LegacyColorModel;
const slots=['key','environment','reflection','highlight','background'];
const labels={base:'固有色',lighting:'照明',image:'画像',bundle:'照明一式',key:'主光源',environment:'環境光',reflection:'反射光',highlight:'ハイライト',background:'背景'};
const normalizeHex=v=>typeof v==='string'&&/^#?[\da-f]{6}$/i.test(v.trim())?'#'+v.trim().replace(/^#/,'').toUpperCase():null;
const isHex=v=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v);
const channels=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const hex=rgb=>'#'+rgb.map(c=>Math.round(Math.max(0,Math.min(1,c))*255).toString(16).padStart(2,'0')).join('').toUpperCase();
const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
const srgb=c=>c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;
const angle=a=>((a%360)+360)%360;
function defaults(){const lights={key:{color:'#FFE2AD',strength:.8,azimuth:315,elevation:40},environment:{color:'#829DC6',strength:.35},reflection:{color:'#DB9C7D',strength:.35,azimuth:70,elevation:-30},highlight:{color:'#FFF4E0',strength:.45,azimuth:315,elevation:40},background:{color:'#30343F'}};for(const light of Object.values(lights))light.enabled=true;return lights;}
function base(id,name,color,x,y){return {id,type:'base',name,color,x,y,shape:'sphere',rotation:{yaw:0,pitch:0},obj:null,savedColors:[]};}
function sample(){return {version:4,exportScale:1,nodes:[{id:'lighting',type:'lighting',name:'照明',x:30,y:30,lights:defaults()},base('skin','肌','#F2C7AB',405,30),{...base('hair','髪','#49405C',795,30),shape:'cube',rotation:{yaw:30,pitch:18}},base('cloth','服','#6E9BA4',1185,30),{id:'image',type:'image',name:'参考画像',x:405,y:715,src:null}],edges:['skin','hair','cloth'].map(to=>({from:'lighting',to,slot:'bundle'})),view:{x:20,y:20,scale:.85}};}
function source(state,node,slot){const e=state.edges.find(e=>e.to===node.id&&(e.slot==='bundle'||e.slot===slot));const light=e&&state.nodes.find(n=>n.id===e.from)?.lights[slot];return light?.enabled===false?undefined:light;}
function direction(light){const a=(light.azimuth||0)*Math.PI/180,e=(light.elevation||0)*Math.PI/180;return [Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e)];}
function shader(state,node){
 const key=source(state,node,'key')||{color:'#FFFFFF',strength:0,azimuth:315,elevation:40},env=source(state,node,'environment')||{color:'#FFFFFF',strength:0},ref=source(state,node,'reflection'),high=source(state,node,'highlight');
 const b=channels(node.color).map(linear),kc=channels(key.color).map(linear),ec=channels(env.color).map(linear),rc=channels(ref?.color||'#000000').map(linear),hc=channels(high?.color||'#000000').map(linear),kd=direction(key),rd=ref?direction(ref):[0,0,0],hd=high?G.normalize(direction(high).map((v,i)=>v+(i===2?1:0))):[0,0,1];
 return normal=>{const n=G.normalize(normal),diff=Math.max(0,G.dot(n,kd)),bounce=Math.max(0,G.dot(n,rd)),spec=high&&Math.hypot(...direction(high).map((v,i)=>v+(i===2?1:0)))>1e-8?Math.max(0,G.dot(n,hd))**40:0;return b.map((c,i)=>Math.max(0,Math.min(1,srgb(c*(env.strength*.55*ec[i]+key.strength*diff*1.3*kc[i]+(ref?.strength||0)*bounce*.7*rc[i])+(high?.strength||0)*spec*.65*hc[i]))));};
}
function gradientColor(state,node,t){const key=source(state,node,'key')||defaults().key,L=direction(key),axis=Math.abs(L[1])<.9?[0,1,0]:[1,0,0],dot=G.dot(L,axis),perp=G.normalize(axis.map((v,i)=>v-dot*L[i])),c=2*Math.max(0,Math.min(1,t))-1;return hex(shader(state,node)(L.map((v,i)=>v*c+perp[i]*Math.sqrt(Math.max(0,1-c*c)))));}
function migrate(data){
 const old=Legacy.validate(data),lists=Object.fromEntries(slots.map(s=>[s,old.nodes.filter(n=>n.type===s)])),count=Math.max(0,...slots.map(s=>lists[s].length)),nodes=[],mapping=new Map(),used=new Set(old.nodes.map(n=>n.id));
 for(let i=0;i<count;i++){
  let id='lighting-migrated-'+i;while(used.has(id))id+='-new';used.add(id);const lights=defaults();
  for(const slot of slots){const n=lists[slot][i];if(n){lights[slot]={...lights[slot],color:n.color,...(slot==='background'?{}:{strength:n.strength}),...(slot==='key'?{azimuth:angle(n.angle),elevation:40}:{})};mapping.set(n.id,id);}}
  nodes.push({id,type:'lighting',name:i?'照明 '+(i+1):'照明',x:30+i*350,y:30,lights});
 }
 let index=0;for(const n of old.nodes.filter(n=>n.type==='base')){nodes.push({...base(n.id,n.name,n.color,55+count*350+index%3*390,30+Math.floor(index/3)*690),shape:n.shape,rotation:{yaw:n.shape==='cube'?30:0,pitch:n.shape==='cube'?18:0}});index++;}
 const edges=old.edges.map(e=>({from:mapping.get(e.from),to:e.to,slot:old.nodes.find(n=>n.id===e.from).type}));
 return {version:3,nodes,edges,view:old.view};
}
function upgrade(data){
 const next=JSON.parse(JSON.stringify(data));next.version=4;next.exportScale=1;
 for(const n of next.nodes)if(n.type==='lighting')for(const l of Object.values(n.lights))l.enabled=true;
 const edges=[],groups=new Map();
 for(const n of next.nodes.filter(n=>n.type==='base')){
  const links=next.edges.filter(e=>e.to===n.id);if(!links.length)continue;
  const signature=JSON.stringify(slots.map(slot=>links.find(e=>e.slot===slot)?.from||null));let id=groups.get(signature);
  if(!id){const from=links[0].from,original=next.nodes.find(v=>v.id===from);const all=slots.every(slot=>links.some(e=>e.slot===slot&&e.from===from));
   if(all)id=from;else{ id='lighting-bundle-'+groups.size;while(next.nodes.some(v=>v.id===id))id+='-new';const lights=defaults();
    for(const slot of slots){const link=links.find(e=>e.slot===slot),src=link&&next.nodes.find(v=>v.id===link.from);lights[slot]=src?{...src.lights[slot]}:{...lights[slot],enabled:false};}
    next.nodes.push({id,type:'lighting',name:original.name+'（移行）',x:original.x,y:original.y+850+groups.size*40,lights});
   }groups.set(signature,id);
  }edges.push({from:id,to:n.id,slot:'bundle'});
 }next.edges=edges;return next;
}
function validate(data){
 if(data?.version===1||data?.version===2)return validate(migrate(data));
 if(data?.version===3)return validate(upgrade(data));
 if(!data||data.version!==4||!Array.isArray(data.nodes)||!Array.isArray(data.edges)||data.nodes.length>200||data.edges.length>500)throw Error('未対応の形式か、ノード数が上限を超えています。');
 const ids=new Set(),finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
 const nodes=data.nodes.map(n=>{
  if(!n||typeof n.id!=='string'||!n.id||n.id.length>100||ids.has(n.id)||!['base','lighting','image'].includes(n.type)||typeof n.name!=='string'||n.name.length>60||![n.x,n.y].every(v=>finite(v,-100000,100000)))throw Error('ノードの値が不正です。');
  ids.add(n.id);const out={id:n.id,type:n.type,name:n.name,x:n.x,y:n.y};
  if(n.type==='lighting'){
   out.lights={};for(const slot of slots){const light=n.lights?.[slot];if(!light||!isHex(light.color))throw Error('照明の色が不正です。');if(typeof light.enabled!=='boolean')throw Error('照明のオン・オフが不正です。');const value={color:light.color.toUpperCase(),enabled:light.enabled};
    if(slot!=='background'){if(!finite(light.strength,0,1))throw Error('照明強度が不正です。');value.strength=light.strength;}
    if(!['environment','background'].includes(slot)){if(!finite(light.azimuth,0,360)||!finite(light.elevation,-90,90))throw Error('照明の方位・上下角が不正です。');value.azimuth=light.azimuth;value.elevation=light.elevation;}
    if(light.hemisphere!==undefined){if(!['front','back'].includes(light.hemisphere))throw Error('光の手前・奥が不正です。');value.hemisphere=light.hemisphere;}out.lights[slot]=value;
   }
  }else if(n.type==='base'){
   if(!isHex(n.color)||!['sphere','cube','flat','obj'].includes(n.shape)||!finite(n.rotation?.yaw,0,360)||!finite(n.rotation?.pitch,-90,90)||!Array.isArray(n.savedColors)||n.savedColors.length>32||!n.savedColors.every(isHex))throw Error('固有色・形状・保存色が不正です。');
   out.color=n.color.toUpperCase();out.shape=n.shape;out.rotation={yaw:n.rotation.yaw,pitch:n.rotation.pitch};out.savedColors=[...new Set(n.savedColors.map(c=>c.toUpperCase()))];out.obj=null;
   if(n.obj!==null){if(!n.obj||typeof n.obj.name!=='string'||n.obj.name.length>160||typeof n.obj.text!=='string')throw Error('OBJデータが不正です。');G.parseOBJ(n.obj.text);out.obj={name:n.obj.name,text:n.obj.text};}
   if(n.shape==='obj'&&!out.obj)throw Error('OBJ形状のデータがありません。');
  }else{
   if(n.src!==null&&(typeof n.src!=='string'||n.src.length>2500000||!/^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(n.src)))throw Error('画像データが不正です。');out.src=n.src;
  }
  return out;
 });
 const targets=new Set();const edges=data.edges.map(e=>{if(!e||e.slot!=='bundle'||!nodes.some(n=>n.id===e.from&&n.type==='lighting')||!nodes.some(n=>n.id===e.to&&n.type==='base')||targets.has(e.to+':'+e.slot))throw Error('接続が不正です。');targets.add(e.to+':'+e.slot);return {from:e.from,to:e.to,slot:e.slot};});
 const v=data.view;if(!v||!finite(v.x,-100000,100000)||!finite(v.y,-100000,100000)||!finite(v.scale,.25,2))throw Error('視点が不正です。');
 const exportScale=data.exportScale??1;if(!finite(exportScale,.25,4))throw Error('PNG倍率が不正です。');return {version:4,nodes,edges,view:{x:v.x,y:v.y,scale:v.scale},exportScale};
}
const api={slots,labels,normalizeHex,isHex,channels,hex,angle,defaults,base,sample,source,direction,shader,gradientColor,validate};if(typeof module!=='undefined')module.exports=api;else root.ColorModel=api;
})(globalThis);
