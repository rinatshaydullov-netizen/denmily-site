import { createHmac } from 'node:crypto';

// Prototype fixed-window limit. Requires a truly atomic CAS implementation and
// a cleanup job for expired keys. The caller must derive IP from a trusted source.
export class CasRateLimit {
  constructor(store,key){if(typeof key!=='string'||Buffer.byteLength(key)<32)throw new Error('Invalid rate key');this.store=store;this.key=key}
  async consume(scope,identity,limit,windowSeconds,now){
    if(!/^[a-z-]{1,32}$/.test(scope)||typeof identity!=='string'||identity.length<1||identity.length>256||!Number.isSafeInteger(limit)||limit<1||!Number.isSafeInteger(windowSeconds)||windowSeconds<1||!Number.isSafeInteger(now))throw new Error('Invalid rate parameters');
    const bucket='limit:'+createHmac('sha256',this.key).update(scope+'\0'+identity).digest('hex');
    for(let i=0;i<12;i++){
      const old=await this.store.read(bucket);
      if(!old){if(await this.store.create(bucket,{count:1,expires:now+windowSeconds}))return true;continue}
      if(old.value.expires<=now){if(await this.store.replace(bucket,old.version,{count:1,expires:now+windowSeconds}))return true;continue}
      if(old.value.count>=limit)return false;
      if(await this.store.replace(bucket,old.version,{...old.value,count:old.value.count+1}))return true;
    }
    return false;
  }
}

