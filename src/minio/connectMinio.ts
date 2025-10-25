import * as Minio from 'minio'
import { timeoutFunction } from '../utility/utilityFunction'

// Instantiate the MinIO client with the object store service
// endpoint and an authorized user's credentials
// play.min.io is the MinIO public test cluster
export const minioClient = new Minio.Client({
  endPoint: '192.168.101.9',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
})


// Destination bucket
const bucket = 'firstbucket'

// If it doesn't, create it
export async function checkBucket(){

   try{
     
     const exists =await timeoutFunction(minioClient.bucketExists(bucket),5000);

        if (exists) {
        console.log('Bucket ' + bucket + ' exists.')
        } else {
        await minioClient.makeBucket(bucket, 'us-east-1')
        console.log('Bucket ' + bucket + ' created in "us-east-1".')
        }
   }catch(err:any){
    console.error('error during connecting to minio server',err.message);
    throw err;
   }
}

