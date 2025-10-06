import express from 'express';
import dotenv from 'dotenv';
import {FFmpeg} from 'kiss-ffmpeg';

import { Request , Response } from 'express';


dotenv.config();

//ffmpeg config code 
const ffmpeg =new FFmpeg();

const app = express();
app.use(express.json());

const PORT = 3000;

app.get('/',(req,res)=>{
    res.status(200).json({message:'the server is working'});
})

app.post('/video-process', async (req:Request, res:Response)=>{
     
    const {inputFilePath,outputFilePath} = req.body;

    let responseSent = false;

    if(!inputFilePath || !outputFilePath) {
        console.log('Internal server problem');
        return res.status(500).json({message:'Internal server error'});
    }

    //define some input and output video fomrates 
    ffmpeg.inputs = { url:inputFilePath , options:{ss:10,t:10} };
    ffmpeg.outputs = {url:outputFilePath , options:{ "c:v":"libx264", "c:a": "aac", vf:"scale=-1:360" }}     

    ffmpeg.on('progress',(proc , status)=>{
        console.log(`process started with ${status.frame}, time:${status.time}`)
    })

    ffmpeg.on('end',()=>{
        console.log('video processing end');
        if(!responseSent){
            responseSent = true;
            return res.status(200).json({message:'video process successful'});
        }
    })

    ffmpeg.on('error',(proc,err)=>{
        console.log(`error occured during execution ${err.message}`);
         if(!responseSent){
            responseSent = true;
           return res.status(500).json({ message: 'Processing failed', error: err.message });
        }
    })
    
    try{
        await ffmpeg.run();
    }catch(err:any){
        if (!responseSent) {
            responseSent = true;
            console.log('error while running ffmpeg',err);
            return res.status(500).json({message: 'FFmpeg execution failed'});
        }
    }

})

app.listen(PORT , ()=>{
    console.log(`the server is running on ports ${PORT} ..`);
} )
