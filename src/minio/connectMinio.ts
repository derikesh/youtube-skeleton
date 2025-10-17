import * as Minio from 'minio'

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

// File to upload
const sourceFile = './sample-5.mp4'

// Destination bucket
const bucket = 'firstbucket'

// Destination object name
const destinationObject = 'my-test-file.mp4'

// Check if the bucket exists
// If it doesn't, create it
async function checkBucket(){
    const exists = await minioClient.bucketExists(bucket)

        if (exists) {
        console.log('Bucket ' + bucket + ' exists.')
        } else {
        await minioClient.makeBucket(bucket, 'us-east-1')
        console.log('Bucket ' + bucket + ' created in "us-east-1".')
        }
}

checkBucket();

// Set the object metadata
var metaData = {
  'Content-Type': 'text/plain',
  'X-Amz-Meta-Testing': 1234,
  example: 5678,
}

// Upload the file with fPutObject
// If an object with the same name exists,
// it is updated with new data

async function fPutObject(){
    await minioClient.fPutObject(bucket, destinationObject, sourceFile, metaData)
    console.log('File ' + sourceFile + ' uploaded as object ' + destinationObject + ' in bucket ' + bucket)
}

// fPutObject();

