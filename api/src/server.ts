import { createApp } from './app';
import { connectDB } from './config/connectDB';
import { seedProvinces } from './services/ProvinceSeedService';

async function main(): Promise<void> {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no está definida');
  await connectDB();
  await seedProvinces();
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`API escuchando en el puerto ${port}`));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
