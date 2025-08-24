export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface AuthContext {
  user: User;
  isAuthenticated: boolean;
}