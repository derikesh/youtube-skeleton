import { spawn } from 'child_process';
import {client} from '../redis/redisConnect';
import Stream from 'stream';
import { minioClient } from '../minio/connectMinio';
import pLimit from 'p-limit';


//helper function 
function cleanUpName( filename:string ){
    return filename.replace(/\.(mp4|mov|avi|mkv|webm)$/i, '');
}


interface RedisStreamMessage {
  id: string;
  message: {
    fileName: string;
    [key: string]: any;  
  }
}

//listing to stream
let count = 0;

//listning to process running to gracefully shutdown redis running 
let running = true;

process.on('SIGINT',()=>{
  running = false;
  console.log('Gracefully shutting down redis ,caught SIGINT');
})

process.on('SIGTERM',()=>{
  console.log('Gracefullu shutting down redis , caught SIGTERM');
})

export async function listenStream(consumerName:string) {
  try{
      while(running){
        const uploads:any = await client.xReadGroup(
        'upload-group',
        consumerName,
        {
          key:'upload-stream',
          id:'>',
        },{
          COUNT:2,
          BLOCK:5000,
        }
      );

      if(!uploads) {continue };

        console.log('coming from stream',uploads[0].messages);
        //to allow multiple message to run simultensiouly
        let limit = pLimit(2);
        // uploads[0].messages.map( (item:RedisStreamMessage) => console.log('the name ius',item.message.fileName) ) 
        const results = await Promise.allSettled( uploads[0].messages.map( (msg:RedisStreamMessage)=>{
          return limit(()=>transcodingVideo(msg.message.fileName ,`transcoded/${cleanUpName(msg.message.fileName)}-transcoded-${count}.mp4`,{ stream:'upload-stream',group:'upload-group',id:msg.id } ));
        } ) )

        count++;

        results.forEach( (result,index)=>{
            if(result.status =='rejected'){
              const msg = uploads[0].messages[index];
              console.log('failed to fetch on ',msg);
            }
        } )
      
      }
  }catch(err:any){
    console.log('error during reading group , error :',err.message);
    
  }finally{
      await client.quit();
      console.log('connection closed with redis gracefully');
  }
}

//transcoding video
async function transcodingVideo(fileName:string,outputFileName:string,groupInfo:{stream:string,group:string,id:string}){
  const streamedData:Buffer[] = [];
  let dataStream:Stream.Readable | null = null;
  let child_process:any = null;
  
  try{
    dataStream = await minioClient.getObject('firstbucket', fileName);
    child_process = spawn('ffmpeg',[
      '-y',
      '-ss', '10',
      '-t', '10',
      '-i', 'pipe:0',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-vf', 'scale=-1:360',
      '-f','matroska',
      'pipe:1'
    ]);

    dataStream.pipe(child_process.stdin);
    
    dataStream.on('end',()=>{
      console.log('finished extracting video from bucket');
    });

    child_process.stdout.on('data',(chunk:Buffer)=>{
      streamedData.push(chunk);
    });

    await new Promise((resolve, reject)=>{
      // Handle all errors
      dataStream!.on('error',(err:any)=>{
        console.log('error in dataStream');
        cleanup();
        reject(new Error(err));
      });

      child_process.stdout.on('error',(err:any)=>{
        console.log('error during stdout');
        cleanup();
        reject(new Error(err));
      });

      child_process.stderr.on('data', (chunk:any) => {
      console.log('ffmpeg:', chunk.toString());
      });

      child_process.stdin.on('error',(err:any)=>{
        console.log('error during stdin pipe');
        cleanup();
        reject(new Error(err));
      });

      child_process.on('error', (err:any)=>{
        console.log('error in child process');
        cleanup();
        reject(new Error(err));
      });

      child_process.on('close', async (code:number)=>{
        if(code !== 0){
          console.log('error in closing child process');
          cleanup();
          reject(new Error(`FFmpeg exited with code ${code}`));
          return;
        }

        try {
          const bufferedData = Buffer.concat(streamedData);
          await minioClient.putObject('firstbucket',outputFileName,bufferedData);
          console.log('successfully saved transcoded video');
          await client.xAck(groupInfo.stream, groupInfo.group, groupInfo.id);
          console.log('redis stream acknowledged!');
          resolve('successfully finished saving transcoded video');
        } catch(err) {
          cleanup();
          reject(err);
        }
      });

      function cleanup() {
       if (dataStream && !dataStream.destroyed) dataStream.destroy();
      if (child_process && !child_process.killed) child_process.kill('SIGKILL');
      }
    });

  }catch(err:any){
    console.log('error during transcoding:', err.message);
    // Cleanup in case of early failure
    if(dataStream) dataStream.destroy();
    if(child_process) child_process.kill();
  }
}