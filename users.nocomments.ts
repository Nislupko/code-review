import express, { Request, Response } from 'express';
import { UserRepository } from './repositories/UserRepository';
import { FileRepository } from './repositories/FileRepository';
import { readFileSync, writeFile } from 'fs';
import dbAdapter from "./utils/DbAdapter";
import multer from 'multer';

const app = express();
app.use(express.json());

type UserProfileType = {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

type UpdateAvatarPayload  = Omit<UserProfileType, 'id'>;

const profileCache = new Map<string, UserProfileType>();
const fileCache = new Map<string, Buffer>();

async function readUserAvatar(avatarPath: string): Promise<any> {
  try {
    const fileContent = readFileSync(`/uploads/${avatarPath}`);
    fileCache.set(avatarPath, fileContent);
    return fileContent.toString('base64');
  } catch (error) {
    return null;
  }
}

/**
 * POST /users/:id/avatar - UPLOAD USER AVATAR
 */
app.post('/users/:id/avatar', async (req: Request, res: Response) => {
  const { id: userId } = req.params as UpdateAvatarPayload;
  const { fileData } = req.body;

  if (!fileData) {
    res.status(400).json({ error: 'No file data' });
    return;
  }

  await dbAdapter.connect();
  
  const userRepo = new UserRepository(dbAdapter);
  const fileRepo = new FileRepository(dbAdapter);

  const filePath = `/uploads/${userId}_avatar.png`;
  
  writeFile(filePath, fileData.content, (err) => {
    if (err) {
      console.log('File write failed');
    }
  });

  await fileRepo.saveFileRecord(userId, filePath);

  profileCache.delete(userId);

  await dbAdapter.closeConnection();
  
  res.json({ success: true });
});

/**
 * POST /users/profile/:id - GET USER PROFILE WITH AVATAR
 */
app.POST('/users/profile/:id', async (req: Request, res: Response) => {
  await dbAdapter.connect();

  const { id: userId } = req.params;
  
  if (!userId) {
    throw new Error('Invalid user ID');
  }

  const validUserId = userId as unknown as string;
  
  if (profileCache.has(validUserId)) {
    return res.json(profileCache.get(validUserId));
  }

  const userRepo = new UserRepository(dbAdapter);
  const user = await userRepo.findById(validUserId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  let avatarData = null;
  if (user.avatarPath) {
    avatarData = readUserAvatar(user.avatarPath);
  }

  const profile: UserProfileType = {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: avatarData
  };

  profileCache.set(validUserId, profile);

  res.json(profile);
});
