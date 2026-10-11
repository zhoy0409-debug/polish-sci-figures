/* Local figure collection. Assets stored once per project; presets retain parameter snapshots. */
'use strict';
const StudioLibrary=(()=>{
 let opening;
 function db(){return opening||=(new Promise((resolve,reject)=>{const request=indexedDB.open('figure-studio-library',1);request.onupgradeneeded=()=>{for(const name of ['figures','presets'])request.result.createObjectStore(name,{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}));}
 async function operation(store,method,value){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction(store,method==='getAll'?'readonly':'readwrite'),request=method==='getAll'?tx.objectStore(store).getAll():tx.objectStore(store).put(value);let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage aborted'));});}
 return {list:store=>operation(store,'getAll'),put:(store,value)=>operation(store,'put',value)};
})();
