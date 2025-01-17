import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export const uploadToS3 = async (file: Buffer, key: string, makePublic: boolean = false) => {
  try {
    // Create a temporary file
    const tempPath = join(tmpdir(), `${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await writeFile(tempPath, file);

    // Construct the AWS CLI command without ACL
    const bucket = process.env.AWS_BUCKET_NAME || 'gauntlet-avatars';
    const command = `aws s3 cp "${tempPath}" "s3://${bucket}/${key}" --region us-east-1`;

    // Execute the command
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      console.error('AWS CLI stderr:', stderr);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

export const getFromS3 = async (key: string) => {
  try {
    const bucket = process.env.AWS_BUCKET_NAME || 'gauntlet-avatars';
    const tempPath = join(tmpdir(), `${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const command = `aws s3 cp "s3://${bucket}/${key}" "${tempPath}" --region us-east-1`;

    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      console.error('AWS CLI stderr:', stderr);
    }

    return { success: true };
  } catch (error) {
    console.error('Error getting from S3:', error);
    throw error;
  }
}

export const deleteFromS3 = async (key: string) => {
  try {
    const bucket = process.env.AWS_BUCKET_NAME || 'gauntlet-avatars';
    const command = `aws s3 rm "s3://${bucket}/${key}" --region us-east-1`;

    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      console.error('AWS CLI stderr:', stderr);
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw error;
  }
}

export const getS3Url = (key: string): string => {
  const bucket = process.env.AWS_BUCKET_NAME || 'gauntlet-avatars';
  return `https://${bucket}.s3.amazonaws.com/${key}`;
}
