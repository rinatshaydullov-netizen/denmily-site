import {getStore} from '@netlify/blobs';
import {purgeExpired} from '../lib/purge-expired.mjs';
// Inactive until the integration has passed all production checks.
export default async()=>{
 if(process.env.DENMILY_AUTH_ENABLED!=='true')return;
 await purgeExpired(getStore({name:'denmily-auth',consistency:'strong'}),Math.floor(Date.now()/1000));
};
export const config={schedule:'0 4 * * *'};

