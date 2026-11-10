// Delete only expired transient records, with a 24-hour safety margin.
// Accounts never have an expiration and are intentionally excluded.
export async function purgeExpired(blob, now, maxScanned=5000){
 let scanned=0,deleted=0;
 for(const prefix of ['code:','session:','limit:']){
  for await(const page of blob.list({prefix,paginate:true})){
   for(const entry of page.blobs){
    if(++scanned>maxScanned)return {scanned,deleted};
    const item=await blob.get(entry.key,{type:'json',consistency:'strong'});
    if(item&&Number.isSafeInteger(item.expires)&&item.expires+86400<now){await blob.delete(entry.key);deleted++}
   }
  }
 }
 return {scanned,deleted};
}

