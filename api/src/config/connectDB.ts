import mongoose from 'mongoose';

export async function connectDB(uri: string | undefined = process.env.MONGODB_URI): Promise<void> {
  if (!uri) throw new Error('MONGODB_URI no está definida');
  await mongoose.connect(uri);
}
