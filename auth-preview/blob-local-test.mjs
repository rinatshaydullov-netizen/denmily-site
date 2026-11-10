import { BlobsServer } from '@netlify/blobs/server';
import { getStore } from '@netlify/blobs';
import { NetlifyBlobCAS } from './netlify/lib/netlify-blob-store.mjs';
import { strict as assert } from 'node:assert';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory=await mkdtemp(join(tmpdir(),'denmily-blob-test-'));
const server=new BlobsServer({directory,logger:()=>{}});
const addr=await server.start();
try {
 const base=`http://127.0.0.1:${addr.port}`;
 const cas=new NetlifyBlobCAS(getStore({name:'test',siteID:'test',token:'local-test',apiURL:base,edgeURL:base,uncachedEdgeURL:base,consistency:'strong'}));
 assert.equal(await cas.create('test',{step:1}),true);
 assert.equal(await cas.create('test',{step:2}),false);
 const record=await cas.read('test');assert.equal(record.value.step,1);
 if(!record.version){console.log('INCONCLUSIVE: local Netlify Blobs emulator does not return an ETag; test against actual Netlify required.');process.exitCode=2;}
 else {assert.equal(await cas.replace('test',record.version,{step:3}),true);assert.equal(await cas.replace('test',record.version,{step:4}),false);console.log('Sequential conditional operations passed against local emulator only.');}
} finally {await server.stop();await rm(directory,{recursive:true,force:true})}

