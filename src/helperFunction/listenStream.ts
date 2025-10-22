import { spawn } from 'child_process';
import {client} from '../redis/redisConnect';
import Stream from 'stream';
import { minioClient } from '../minio/connectMinio';

//listing to stream
export async function listenStream(consumerName:string) {
  try{
    while(true){
      const uploads:any = await client.xReadGroup(
        'upload-group',
        consumerName,
        {
          key:'upload-stream',
          id:'>',
        },{
          COUNT:10,
          BLOCK:0,
        }
      );
      if(uploads.length>0) {
        console.log('coming from stream',uploads[0].messages);
        for( const message of uploads[0].messages ){
          await transcodingVideo(message.fileName ,`${message.fileName}-transcoded.mp4`,{ stream:'upload-stream',group:'upload-group',id:message.id } );
        }
      }
    }
  }catch(err:any){
    console.log('error during reading group , error :',err.message)
  }
}

//transcoding video
async function transcodingVideo(fileName:string,outputFileName:string,groupInfo:{stream:string,group:string,id:string}){
  const streamedData:Buffer[] = [];
  let dataStream:Stream.Readable | null = null;
  let child_process:any = null;
  
  try{
    dataStream = await minioClient.getObject('mybucket', fileName);
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
          await minioClient.putObject('transcoded',outputFileName,bufferedData);
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
        if(dataStream) {
          dataStream.destroy();
        }
        if(child_process) {
          child_process.kill();
        }
      }
    });

  }catch(err:any){
    console.log('error during transcoding:', err.message);
    // Cleanup in case of early failure
    if(dataStream) dataStream.destroy();
    if(child_process) child_process.kill();
  }
}