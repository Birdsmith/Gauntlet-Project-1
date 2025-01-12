import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { s3Client } from './aws-config'

export const uploadToS3 = async (file: Buffer, key: string) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file,
  })

  try {
    const response = await s3Client.send(command)
    return response
  } catch (error) {
    console.error('Error uploading to S3:', error)
    throw error
  }
}

export const getFromS3 = async (key: string) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  })

  try {
    const response = await s3Client.send(command)
    return response
  } catch (error) {
    console.error('Error getting from S3:', error)
    throw error
  }
}

export const deleteFromS3 = async (key: string) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  })

  try {
    const response = await s3Client.send(command)
    return response
  } catch (error) {
    console.error('Error deleting from S3:', error)
    throw error
  }
}
