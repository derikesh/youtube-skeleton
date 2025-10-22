import { createClient } from 'redis';

export const client = createClient({
    url:'redis://server-redis:6379',
});

export const connectRedis = async ()=>{
    client.on('error', err => console.log('Redis Client Error', err.message));
    await client.connect();
}

