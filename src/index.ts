import express from 'express';
import dotenv from 'dotenv';
import { connectRedis } from './redis/redisConnect';
import router from './routers/routs';
import { listenStream } from './helperFunction/listenStream';

//code configs
dotenv.config();

export let consumerName:string = process.env.CONSUMER || 'bob';

const app = express();  // connect to express

app.use(express.json());  //add a json parser

const PORT = process.env.PORT || 3000;  //set a port and fallback port

connectRedis();  //function to connect to redis 

listenStream(consumerName);  //listing to redis stream

app.use('/',router);  //router implemenation

console.log('Consumer name',consumerName);

app.listen(PORT , ()=>{
    console.log(`the server is running on ports ${PORT} ..`);
} )

