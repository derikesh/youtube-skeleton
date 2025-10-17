import express from 'express';
import { minioClient } from './minio/connectMinio';

import { spawn } from 'child_process';
import fs from 'fs';
import { connectRedis, client } from './redis/redisConnect';
import { Request , Response } from 'express';


//ffmpeg config code 

const app = express();
app.use(express.json());

// connect redis
connectRedis();


const PORT = 3000;

app.get('/',(req,res)=>{
    res.status(200).json({message:'the server is working'});
})

app.post('/video-prcoess-test', async (req: Request, res: Response) => {

    const inputFileName = 'my-test-file.mp4';
    const inputFileDirectory = `./downloads/${inputFileName}`;    //crete writable stream
    const outputFileName ='transcoded.mov';
    const outputDirectory=`./trascoded/${outputFileName}`   //create readable stream


    const streamInput = fs.createWriteStream(inputFileDirectory);
    // const streamOutput = fs.createReadStream(outputDirectory);
    //minio put object code , ffmpeg spawn (child process)
    try{


     const dataStream = await minioClient.getObject('firstbucket', 'my-test-file.mp4')
     dataStream.pipe(streamInput);   
    
    dataStream.on('end',()=>{
        console.log('data recieved from bucket , now transcoding....');
    })

    dataStream.on('err',(err)=>{
        res.status(500).json({message:'error during getting object from bucjet',error:err});
    });

    streamInput.on('finish',()=>{
                //we put a readble stream here 

        //span is child prcoess which allows us to give a readble stream and writable stream which is perfect for ffmpeg operations
        const chilc_prcoess = spawn('ffmpeg',[
            '-y',
            '-ss', '10',                // start at 10s
            '-t', '10',                 // duration 10s
            '-i', inputFileDirectory,            // input file //readble stream
            '-c:v', 'libx264',          // video codec
            '-c:a', 'aac',              // audio codec
            '-vf', 'scale=-1:360',      // video filter
             outputDirectory            // output file //writable stream'
        ])

        chilc_prcoess.on('close',async ()=>{
                console.log('successfully did it bro');
                await minioClient.putObject('transcoded',outputFileName,outputDirectory)
                res.status(200).json({message:'successfully transocded video'});
                fs.unlinkSync(inputFileDirectory);
                fs.unlinkSync(outputDirectory);

        })

    })


    }catch(err){
        res.status(500).json({message:'error during getting object from bucjet',error:err});
        console.log('Error occure during video transcoding');
    }
    
    
});


// app.post('/direct_transcode',async (req:Request, res:Response)=>{

//     const chunkArray:Buffer[] = [];
  
//     const child_process = spawn('ffmpeg',[
//             '-y',
//             '-ss', '10',                // start at 10s
//             '-t', '10',                 // duration 10s
//             '-i', 'pipe:0',            // input file //readble stream  //stdin
//             '-c:v', 'libx264',          // video codec
//             '-c:a', 'aac',              // audio codec
//             '-vf', 'scale=-1:360',      // video filter
//             '-f','matroska',
//             'pipe:1'                    //stdout , a wrtiable stream 
//         ])

//     try{

//             child_process.stdout.on('data',(chunk)=>{
//                 chunkArray.push(Buffer.from(chunk));
//             })
            
//             child_process.on('error', (err) => {
//                 console.error('Failed to start FFmpeg:', err);
//             });

//          const dataStream = await minioClient.getObject('firstbucket', 'my-test-file.mp4');
//          dataStream.pipe(child_process.stdin);
         
//             // Wait for FFmpeg to finish before uploading
//         child_process.on('close', async (code) => {
//               if (code !== 0) {
//                   return res.status(500).json({ message: 'FFmpeg process failed', code });
//               }
//               const buffer = Buffer.concat(chunkArray);
//               await minioClient.putObject('transcoded','newtranscoded.mov',buffer);
//               res.status(200).json({message:'successfully transocded video'});
//             });
            
//     }catch(err:any){
//           res.status(500).json({ 
//             message: 'Error processing video', 
//             error: err.message 
//         });
//         console.log('Error occure during video transcoding');
//     }

// })


//

console.log('s');

//creating a redis group 

app.post('/upload_video', async (req:Request, res:Response)=>{

    //add a redis stream when upload is completed;
    try{
        const streamRedis = await client.xAdd('upload-stream','*',{ 'video_name':'video_name_mr_least' ,'other_metadata':'thisismetadata'});
        res.status(200).json({message:'message should have gone to next server'});
        console.log(streamRedis);
    }catch(err){
        console.log('error during uploading video',err);
    }

})

app.listen(PORT , ()=>{
    console.log(`the server is running on ports ${PORT} ..`);
} )
