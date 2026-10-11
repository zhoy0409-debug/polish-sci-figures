/* Local project assets, revisions, collection and presets; no network. */
'use strict';
const StudioLibrary=(()=>{
 const opening={};
 function db(store){const name=store==='autosaves'?'figure-studio-autosaves':'figure-studio-library';return opening[name]||=(new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>{for(const key of (store==='autosaves'?['autosaves']:['figures','presets']))request.result.createObjectStore(key,{keyPath:'id'});};request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};request.onerror=()=>reject(request.error);}));}
 async function operation(store,method,value){const database=await db(store);return new Promise((resolve,reject)=>{const tx=database.transaction(store,method==='put'?'readwrite':'readonly'),request=method==='getAll'?tx.objectStore(store).getAll():tx.objectStore(store)[method](value);let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage aborted'));});}
 return {get:(store,key)=>operation(store,'get',key),list:store=>operation(store,'getAll'),put:(store,value)=>operation(store,'put',value)};
})();
