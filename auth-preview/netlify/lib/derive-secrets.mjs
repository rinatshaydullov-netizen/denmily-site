import {createHmac} from 'node:crypto';
export function deriveSecrets(master){
 if(typeof master!=='string'||!/^[a-f0-9]{64}$/.test(master))throw new Error('Invalid master key');
 const secrets={bridge:master};
 for(const name of ['code','account','session','rate'])secrets[name]=createHmac('sha256',master).update('DENMILY website authentication v1: '+name).digest('hex');
 return secrets;
}

