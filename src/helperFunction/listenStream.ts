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
          COUNT:4,
          BLOCK:5000,
        }
      );

      if(!uploads) {
        continue;
       };

        console.log('coming from stream',uploads[0].messages);
        //to allow multiple message to run simultensiouly
        let limit = pLimit(3);
        const results = await Promise.allSettled( uploads[0].messages.map( (msg:RedisStreamMessage)=>{
          return limit(()=>transcodingVideo(msg.message.fileName ,`transcoded/${cleanUpName(msg.message.fileName)}.webm`,{ stream:'upload-stream',group:'upload-group',id:msg.id } ));
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
  const thumbnailData:Buffer[] = [];
  const changeExtension = fileName.replace('.webm','.png');
  let dataStream:Stream.Readable | null = null;
  let child_process:any = null;

     function cleanup() {
       if (dataStream && !dataStream.destroyed) dataStream.destroy();
      if (child_process && !child_process.killed) child_process.kill('SIGKILL');
      }
  
  try{

    //first we could finish taking data and start transocding so 
    dataStream = await minioClient.getObject('firstbucket', fileName);

    const fileBuffer =await new Promise<Buffer>( (resolve,reject)=>{
              const chunks:Buffer[] = [];
              dataStream?.on('data',(chunk)=>chunks.push(chunk));
              dataStream?.on('end',()=>resolve(Buffer.concat(chunks)));
              dataStream?.on('error',reject);
    } )

    console.log('file download completed',fileBuffer.length);

    child_process = spawn('ffmpeg', [
    '-y',                    // Overwrite output files without asking
    '-i', 'pipe:0',         // Input from stdin (pipe:0)
    '-loglevel', 'error',
    
    // ===== OUTPUT 1: Transcoded video =====
    '-c:v', 'libvpx',       // Video codec: VP8 (for WebM format)
    '-b:v', '500k',         // Video bitrate: 500 kilobits/sec
    '-crf', '30',           // Constant Rate Factor: quality (0=best, 51=worst, 23=default)
    '-c:a', 'libvorbis',    // Audio codec: Vorbis (for WebM format)
    '-b:a', '128k',         // Audio bitrate: 128 kilobits/sec
    '-vf', 'scale=-2:360',  // Video filter: scale height to 360p, width auto (divisible by 2)
    '-f', 'webm',           // Output format: WebM container
    'pipe:1',               // Output to stdout (pipe:1)
    
    // ===== OUTPUT 2: Thumbnail image =====
    '-ss', '00:00:05',      // Seek to 5 seconds position for thumbnail
    '-vframes', '1',        // Extract only 1 frame
    '-vf', 'scale=-2:360',  // Video filter: same scaling as video
    '-f', 'image2',         // Output format: image format (jpg/png based on extension)
    'pipe:2'                // Output to stderr (pipe:2)
]);

    child_process.stdin.write(fileBuffer);
    child_process.stdin.end();
    
    child_process.stdout.on('data',(chunk:Buffer)=>{
      streamedData.push(chunk);
    });

    await new Promise((resolve, reject)=>{
      // Handle all errors
      child_process.stdin.on('error',(err:any)=>{
        console.log('error during stdin pipe');
        cleanup();
        reject(new Error(err));
      });

      //important error listener for checking whats happening durin transcoding
      child_process.stderr.on('data', (chunk:any) => {
        thumbnailData.push(chunk);
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
          const thumbnailValue = Buffer.concat(thumbnailData);
          await minioClient.putObject('firstbucket',outputFileName,bufferedData);
          await minioClient.putObject('imagebucket',changeExtension,thumbnailValue);
          console.log('successfully saved transcoded video');
          await client.xAck(groupInfo.stream, groupInfo.group, groupInfo.id);
          console.log('redis stream acknowledged! , saved file :',outputFileName);
          resolve('successfully finished saving transcoded video');
          cleanup();
        } catch(err) {
          cleanup();
          reject(err);
        }
      });

   
    });

  }catch(err:any){
    console.log('error during transcoding:', err.message);
    // Cleanup in case of early failure
    if(dataStream) dataStream.destroy();
    if(child_process) child_process.kill();
  }
}