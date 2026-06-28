import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export type AuthContextType = {
  session: Session | null;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);