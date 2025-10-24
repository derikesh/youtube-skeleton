import express from 'express';
import dotenv from 'dotenv';
import { connectRedis } from './redis/redisConnect';
import router from './routers/routs';
import { listenStream } from './helperFunction/listenStream';
import { checkBucket } from './minio/connectMinio';

//code configs
dotenv.config();

export let consumerName:string = process.env.CONSUMER || 'bob';

const app = express();  // connect to express

app.use(express.json());  //add a json parser

const PORT = process.env.PORT || 3000;  //set a port and fallback port

app.use('/',router);  //router implemenation

console.log('Consumer name',consumerName);

async function startServer() {
    try {
        await checkBucket();        // Start MinIO first
        const connected = await connectRedis();       // Connect Redis second
        
         app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
        
        if(connected) await listenStream(consumerName);
       
    } catch(err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

startServer();