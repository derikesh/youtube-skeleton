import { createClient } from 'redis';

export const client = createClient({
    url:'redis://server-redis:6379',
});

export const connectRedis = async ()=>{
    try{
        await client.connect();
        console.log('Successfully connected to redis client');
        return true;
    }catch(err:any){
        console.log('Redis client Connection error :',err.message);
        return false
    }
}

