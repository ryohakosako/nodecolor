/* Local-only file ingestion, used by the app and browser verification page. */
(function(root){
'use strict';
async function readImage(file){
 if(!file||!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type)||file.size>20*1024*1024)throw Error('PNG/JPEG/WebP/GIF/BMPの20MB以下の画像を選んでください。');
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width*bitmap.height>40000000)throw Error('画像は4000万画素以下にしてください。');
  const ratio=Math.min(1,1024/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  let src=canvas.toDataURL('image/png');if(src.length>2500000)src=canvas.toDataURL('image/jpeg',.88);if(src.length>2500000)throw Error('画像データが大きすぎます。小さくして読み込んでください。');
  return src;
 }finally{bitmap.close();}
}
async function readOBJ(file){if(!file||!file.name.toLowerCase().endsWith('.obj')||file.size>10*1024*1024)throw Error('10MB以下の.objファイルを選んでください。');const text=await file.text();const mesh=root.Geometry.parseOBJ(text);return {asset:{name:file.name.slice(0,160),text},mesh};}
root.SceneAssets={readImage,readOBJ};
})(globalThis);
