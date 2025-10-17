import { createClient } from 'redis';

export const client = createClient({
    url:'redis://:yourpassword@localhost:6380',
});

export const connectRedis = async ()=>{
    
    client.on('error', err => console.log('Redis Client Error', err));

    await client.connect();
}



