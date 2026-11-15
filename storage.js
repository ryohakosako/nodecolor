/* IndexedDB can retain images and OBJ without the localStorage size limit. */
(function(root){
'use strict';
function createStore(name='nodecolor-scene-v3'){
let database,queue=Promise.resolve();
const fallbackKey=name==='nodecolor-scene-v3'?'nodecolor.project.v3':'nodecolor.qa.'+name;
function db(){if(!database)database=new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('documents');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('保存領域を開けません。'));});return database;}
async function load(){try{const d=await db();const value=await new Promise((resolve,reject)=>{const r=d.transaction('documents','readonly').objectStore('documents').get('project');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(value)return {value,legacy:false};}catch{}
 for(const key of name==='nodecolor-scene-v3'?['nodecolor.project.v3','nodecolor.project.v2','nodecolor.project.v1']:[fallbackKey]){const raw=localStorage.getItem(key);if(raw)return {value:JSON.parse(raw),legacy:key!==fallbackKey};}return null;
}
function save(value){const copy=structuredClone(value);queue=queue.catch(()=>{}).then(async()=>{try{const d=await db();await new Promise((resolve,reject)=>{const tx=d.transaction('documents','readwrite');tx.objectStore('documents').put(copy,'project');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('保存を中断しました。'));});return 'IndexedDB';}catch{localStorage.setItem(fallbackKey,JSON.stringify(copy));return 'localStorage';}});return queue;}
return {load,save,close:async()=>{if(database)(await database).close();}};
}
root.SceneStore={...createStore(),createStore};
})(globalThis);
