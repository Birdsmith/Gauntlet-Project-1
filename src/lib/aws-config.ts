import { S3Client } from '@aws-sdk/client-s3'

// Initialize S3 client
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
  endpoint: `https://s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`,
  forcePathStyle: false
})

// Validate AWS configuration
export const validateAwsConfig = () => {
  const requiredEnvVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_S3_BUCKET',
  ]

  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar])

  if (missingVars.length > 0) {
    throw new Error(`Missing required AWS environment variables: ${missingVars.join(', ')}`)
  }

  return true
}
