
export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  points: number;
  channelId?: string;
  subscriberCount?: number;
  handle?: string;
  tasksCompleted: number;
  questCredits: number; // Energy/Credits to play quests
  role: 'user' | 'admin';
  superTasksCompletedToday: number;
  lastSuperTaskDate: string; // ISO date string
  
  // Quest Tracking (ISO Date Strings)
  lastDailyLinkDate?: string;
  lastSpinDate?: string;
  lastScratchDate?: string;
  lastFlipDate?: string;
}

export enum TaskType {
  LIKE = 'LIKE',
  SUBSCRIBE = 'SUBSCRIBE',
  WATCH = 'WATCH',
  SUPER = 'SUPER'
}

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  url: string;
  reward: number;
  channelName?: string;
  thumbnailUrl?: string;
  monetagLink?: string; // Only for SUPER tasks
  creatorId?: string; // If null, it's a system task
  requiredDuration?: number; // For watch tasks
}

export interface Campaign {
  id: string;
  userId: string;
  type: TaskType;
  targetUrl: string;
  quantityRequested: number;
  quantityFulfilled: number;
  costPerAction: number;
  status: 'active' | 'paused' | 'completed';
  createdAt: number;
}
