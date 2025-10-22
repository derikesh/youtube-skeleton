import * as Minio from 'minio'

// Instantiate the MinIO client with the object store service
// endpoint and an authorized user's credentials
// play.min.io is the MinIO public test cluster
export const minioClient = new Minio.Client({
  endPoint: '192.168.101.2',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
})

// Destination bucket
const bucket = 'firstbucket'


// If it doesn't, create it
async function checkBucket(){
   try{
     const exists = await minioClient.bucketExists(bucket)

        if (exists) {
        console.log('Bucket ' + bucket + ' exists.')
        } else {
        await minioClient.makeBucket(bucket, 'us-east-1')
        console.log('Bucket ' + bucket + ' created in "us-east-1".')
        }
   }catch(err){
    console.log('error during connecting to minio server',err)
   }
}

checkBucket();




