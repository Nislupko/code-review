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

// ISSUE: Global cache without size limits or TTL - Memory leak potential
const profileCache = new Map<string, UserProfileType>();
const fileCache = new Map<string, Buffer>();

// ISSUE: Mixing sync file operations in async context
// ISSUE: Using any type
async function readUserAvatar(avatarPath: string): Promise<any> {
  try {
    // ISSUE: Using sync method in async function - blocks event loop
    const fileContent = readFileSync(`/uploads/${avatarPath}`);
    // ISSUE: Adding to cache without size control - memory leak
    fileCache.set(avatarPath, fileContent);
    return fileContent.toString('base64');
  } catch (error) {
    // ISSUE: Swallowing errors silently
    return null;
  }
}

/**
 * POST /users/:id/avatar - UPLOAD USER AVATAR
 */
app.post('/users/:id/avatar', async (req: Request, res: Response) => {
  // ISSUE: incorrect type, omit is used wrongly
  const { id: userId } = req.params as UpdateAvatarPayload;
  const { fileData } = req.body;

  // ISSUE: No input validation
  if (!fileData) {
    res.status(400).json({ error: 'No file data' });
    return;
  }

  await dbAdapter.connect();
  
  const userRepo = new UserRepository(dbAdapter);
  const fileRepo = new FileRepository(dbAdapter);

  // ISSUE: path is hardcoded but still stored in DB
  const filePath = `/uploads/${userId}_avatar.png`;
  
  // ISSUE: Using callback-based API without promisification
  writeFile(filePath, fileData.content, (err) => {
    if (err) {
      // ISSUE: Error in callback not properly handled in async context
      console.log('File write failed');
    }
  });

  // ISSUE: Race condition - file might not be written yet
  await fileRepo.saveFileRecord(userId, filePath);

  // ISSUE: Invalidating cache but with wrong key format
  profileCache.delete(userId);

  await dbAdapter.closeConnection();
  
  res.json({ success: true });
});

/**
 * POST /users/profile/:id - GET USER PROFILE WITH AVATAR
 */
// ISSUE: params order
app.POST('/users/profile/:id', async (req: Request, res: Response) => {
    // ISSUE: Separate connection for each call.
  await dbAdapter.connect();

  // BAD PRACTICE: missing vlaidation
  // BAD PRACTICE: missing error handling
  const { id: userId } = req.params;
  
  if (!userId) {
    // ISSUE: Throwing error without proper Express error handling
    throw new Error('Invalid user ID');
  }

  // ISSUE: Type casting w/o proper validation
  const validUserId = userId as unknown as string;
  
  if (profileCache.has(validUserId)) {
    // ISSUE: Returning cached data but not closing DB connection
    return res.json(profileCache.get(validUserId));
  }

  // BAD PRACTICE: Singletone might used 
  const userRepo = new UserRepository(dbAdapter);
  const user = await userRepo.findById(validUserId);

  if (!user) {
    // ISSUE: Not closing DB connection before sending response
    return res.status(404).json({ error: 'User not found' });
  }

  let avatarData = null;
  if (user.avatarPath) {
    // ISSUE: Not awaiting async operation
    avatarData = readUserAvatar(user.avatarPath);
  }

  const profile: UserProfileType = {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: avatarData
  };

  // ISSUE: Adding to cache without size control - memory leak
  profileCache.set(validUserId, profile);

  // ISSUE: Not closing database connection
  res.json(profile);
});

