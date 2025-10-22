import fs from 'fs';
import { minioClient } from '../../minio/connectMinio';
import { Request,Response } from 'express';
import { spawn } from 'child_process';

export const videoProcess = async (req: Request, res: Response) => {
    
    const inputFileName = 'my-test-file.mp4';
    const inputFileDirectory = `./downloads/${inputFileName}`;   
    const outputFileName ='transcoded.mov';
    const outputDirectory=`./trascoded/${outputFileName}`   //create readable stream
    
    const streamInput = fs.createWriteStream(inputFileDirectory);  //crete writable stream
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
            '-i', inputFileDirectory,    // input file //readble stream from child process perspective , writable from main thread
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
} 