/**
 * Adapter for a Netlify Blobs store configured for strong reads.
 * Only deploy after testing conditional writes on the actual service, setting
 * expiration cleanup, rate limits, private secrets and performing security review.
 */
export class NetlifyBlobCAS {
  constructor(store) { this.store=store; }
  async read(key) {
    const result=await this.store.getWithMetadata(key,{type:'json',consistency:'strong'});
    return result===null?null:{value:result.data,version:result.etag};
  }
  async create(key,value) {
    return (await this.store.setJSON(key,value,{onlyIfNew:true})).modified===true;
  }
  async replace(key,version,value) {
    if(typeof version!=='string'||version.length===0) return false;
    return (await this.store.setJSON(key,value,{onlyIfMatch:version})).modified===true;
  }
}

