/* Dependency-free OBJ geometry and z-buffered software rasterizer. */
(function(root){
'use strict';
const normalize=a=>{const l=Math.hypot(...a);return l>1e-12?a.map(v=>v/l):[0,0,1];};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function parseOBJ(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>10*1024*1024)throw Error('OBJは10MB以下にしてください。');
 const vertices=[],normals=[],faces=[];
 const index=(token,length)=>{if(!/^-?\d+$/.test(token||''))throw Error('OBJのインデックスが不正です。');const n=Number(token),i=n<0?length+n:n-1;if(!Number.isSafeInteger(n)||n===0||i<0||i>=length)throw Error('OBJが存在しない頂点・法線を参照しています。');return i;};
 for(const raw of text.split(/\r?\n/)){
  const line=raw.split('#')[0].trim();if(!line)continue;const [kind,...parts]=line.split(/\s+/);
  if(kind==='v'||kind==='vn'){
   if(parts.length<3)throw Error('OBJの座標が足りません。');const v=parts.slice(0,3).map(Number);if(!v.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e12))throw Error('OBJの座標が不正です。');
   (kind==='v'?vertices:normals).push(kind==='v'?v:normalize(v));if(vertices.length>30000||normals.length>90000)throw Error('OBJは頂点3万個・法線9万個までです。');
  }else if(kind==='f'){
   if(parts.length<3||parts.length>256)throw Error('OBJの面は3〜256頂点にしてください。');
   const corners=parts.map(p=>{const pair=p.split('/');return {v:index(pair[0],vertices.length),n:pair[2]?index(pair[2],normals.length):null};});
   // OBJ polygon faces are triangulated as a fan (convex polygons recommended).
   for(let i=1;i<corners.length-1;i++){faces.push([corners[0],corners[i],corners[i+1]]);if(faces.length>50000)throw Error('OBJは三角形5万面までです。');}
  }
 }
 if(vertices.length<3||!faces.length)throw Error('OBJに表示できる面がありません。');
 const min=[0,1,2].map(i=>Math.min(...vertices.map(v=>v[i]))),max=[0,1,2].map(i=>Math.max(...vertices.map(v=>v[i]))),center=min.map((v,i)=>(v+max[i])/2),size=Math.max(...max.map((v,i)=>v-min[i]));
 if(size<1e-12)throw Error('OBJの大きさがゼロです。');
 const positions=vertices.map(v=>v.map((n,i)=>(n-center[i])*1.6/size));
 const triangles=faces.map(face=>{const p=face.map(c=>positions[c.v]),area=cross(sub(p[1],p[0]),sub(p[2],p[0]));if(Math.hypot(...area)<1e-12)return null;const flat=normalize(area);return {p,n:face.map(c=>c.n===null?flat:normals[c.n])};}).filter(Boolean);
 if(!triangles.length)throw Error('OBJに面積を持つ面がありません。');
 return {triangles,vertexCount:vertices.length,faceCount:triangles.length};
}
function sphere(){const triangles=[],lat=20,lon=28;const p=(i,j)=>{const a=i/lat*Math.PI,b=j/lon*2*Math.PI;return [Math.sin(a)*Math.cos(b)*.8,Math.cos(a)*.8,Math.sin(a)*Math.sin(b)*.8];};for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){const a=p(i,j),b=p(i+1,j),c=p(i+1,j+1),d=p(i,j+1);for(const face of [[a,c,b],[a,d,c]])triangles.push({p:face,n:face.map(normalize)});}return {triangles};}
function cube(){return parseOBJ('v -.6 -.6 -.6\nv .6 -.6 -.6\nv .6 .6 -.6\nv -.6 .6 -.6\nv -.6 -.6 .6\nv .6 -.6 .6\nv .6 .6 .6\nv -.6 .6 .6\nf 1 4 3 2\nf 5 6 7 8\nf 1 5 8 4\nf 2 3 7 6\nf 4 8 7 3\nf 1 2 6 5');}
function flat(){const p=[[-.75,-.75,0],[.75,-.75,0],[.75,.75,0],[-.75,.75,0]],n=[[0,0,1],[0,0,1],[0,0,1]];return {triangles:[{p:[p[0],p[1],p[2]],n},{p:[p[0],p[2],p[3]],n}]};}
function rotate(v,yaw,pitch){const a=yaw*Math.PI/180,b=pitch*Math.PI/180,x=v[0]*Math.cos(a)+v[2]*Math.sin(a),z=-v[0]*Math.sin(a)+v[2]*Math.cos(a);return [x,v[1]*Math.cos(b)-z*Math.sin(b),v[1]*Math.sin(b)+z*Math.cos(b)];}
function rasterize(mesh,width,height,{yaw=0,pitch=0,shade=()=>[.8,.8,.8],background=[.15,.17,.2]}={}){
 const radius=Math.max(.001,...mesh.triangles.map(t=>Math.max(...t.p.map(v=>Math.hypot(...v)))));
 const data=new Uint8ClampedArray(width*height*4),depth=new Float32Array(width*height).fill(-Infinity),scale=Math.min(width,height)*.43/radius;
 for(let i=0;i<data.length;i+=4){data[i]=background[0]*255;data[i+1]=background[1]*255;data[i+2]=background[2]*255;data[i+3]=255;}
 for(const triangle of mesh.triangles){
  const p=triangle.p.map(v=>rotate(v,yaw,pitch)),n=triangle.n.map(v=>normalize(rotate(v,yaw,pitch))),screen=p.map(v=>[width/2+v[0]*scale,height/2-v[1]*scale,v[2]]);
  const [a,b,c]=screen,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-8)continue;
  // Double-sided preview. Back-facing normals flip to match the visible surface.
  const face=cross(sub(p[1],p[0]),sub(p[2],p[0])),flip=face[2]<0?-1:1;
  const rgb=n.map(normal=>shade(normal.map(v=>v*flip)));
  const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(width-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(height-1,Math.ceil(Math.max(a[1],b[1],c[1])));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den,v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den,w=1-u-v;if(u<-.00001||v<-.00001||w<-.00001)continue;
   const z=u*a[2]+v*b[2]+w*c[2],idx=y*width+x;if(z<=depth[idx])continue;depth[idx]=z;for(let i=0;i<3;i++)data[idx*4+i]=255*(u*rgb[0][i]+v*rgb[1][i]+w*rgb[2][i]);
  }
 }
 return {data,width,height,depth};
}
const api={parseOBJ,sphere,cube,flat,normalize,rotate,dot,rasterize};if(typeof module!=='undefined')module.exports=api;else root.Geometry=api;
})(globalThis);
