export interface User {
  uid: string;
  username: string;
  avatar: string;
  email?: string;
  isAnonymous?: boolean;
  isAdmin?: boolean;
  followerCount: number;
  followingCount: number;
  createdAt: number;
  xp?: number;
  level?: number;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorIsAdmin?: boolean;
  title?: string;
  content: string;
  imageUrl?: string;
  details?: string;
  tags: string[];
  category?: string;
  nutritionSummary?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: number;
  isDeleted?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorIsAdmin?: boolean;
  content: string;
  createdAt: number;
  isDeleted?: boolean;
  isPinned?: boolean;
}

export interface SupportChat {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  lastMessage: string;
  lastMessageTime: number;
  userHiddenUntil?: number;
  unreadByAdmin?: boolean;
  unreadByUser?: boolean;
}

export interface SupportMessage {
  id: string;
  role: 'user' | 'admin' | 'system';
  text: string;
  createdAt: number;
  xp?: number;
  level?: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: number;
  isPush?: boolean;
  userId?: string;
  followerId?: string;
  type?: string;
}

