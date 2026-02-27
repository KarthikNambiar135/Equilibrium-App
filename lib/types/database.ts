export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string
          avatar_url: string | null
          phone: string | null
          upi_id: string | null
          preferred_payment_app: string | null
          honesty_score: number
          allow_friends_add_to_group: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name: string
          avatar_url?: string | null
          phone?: string | null
          upi_id?: string | null
          preferred_payment_app?: string | null
          honesty_score?: number
          allow_friends_add_to_group?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string
          avatar_url?: string | null
          phone?: string | null
          upi_id?: string | null
          preferred_payment_app?: string | null
          honesty_score?: number
          allow_friends_add_to_group?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          emoji: string
          mode: 'regular' | 'trip'
          personality: 'chill' | 'formal' | 'roast'
          invite_code: string
          is_active: boolean
          terminated_at: string | null
          trip_ended: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          emoji?: string
          mode?: 'regular' | 'trip'
          personality?: 'chill' | 'formal' | 'roast'
          invite_code?: string
          is_active?: boolean
          terminated_at?: string | null
          trip_ended?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          emoji?: string
          mode?: 'regular' | 'trip'
          personality?: 'chill' | 'formal' | 'roast'
          invite_code?: string
          is_active?: boolean
          terminated_at?: string | null
          trip_ended?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          role: 'admin' | 'member'
          joined_at: string
          left_at: string | null
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          role?: 'admin' | 'member'
          joined_at?: string
          left_at?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          role?: 'admin' | 'member'
          joined_at?: string
          left_at?: string | null
        }
      }
      expenses: {
        Row: {
          id: string
          group_id: string
          paid_by: string
          title: string
          description: string | null
          amount: number
          category: string
          split_type: 'equal' | 'percentage' | 'exact' | 'itemwise'
          receipt_url: string | null
          original_currency: string | null
          original_amount: number | null
          date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          paid_by: string
          title: string
          description?: string | null
          amount: number
          category?: string
          split_type?: 'equal' | 'percentage' | 'exact' | 'itemwise'
          receipt_url?: string | null
          original_currency?: string | null
          original_amount?: number | null
          date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          paid_by?: string
          title?: string
          description?: string | null
          amount?: number
          category?: string
          split_type?: 'equal' | 'percentage' | 'exact' | 'itemwise'
          receipt_url?: string | null
          original_currency?: string | null
          original_amount?: number | null
          date?: string
          created_at?: string
          updated_at?: string
        }
      }
      expense_splits: {
        Row: {
          id: string
          expense_id: string
          user_id: string
          amount: number
          percentage: number | null
          created_at: string
        }
        Insert: {
          id?: string
          expense_id: string
          user_id: string
          amount: number
          percentage?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          expense_id?: string
          user_id?: string
          amount?: number
          percentage?: number | null
          created_at?: string
        }
      }
      settlements: {
        Row: {
          id: string
          group_id: string
          from_user: string
          to_user: string
          amount: number
          status: 'pending' | 'completed' | 'cancelled'
          payment_mode: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          settled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          from_user: string
          to_user: string
          amount: number
          status?: 'pending' | 'completed' | 'cancelled'
          payment_mode?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          settled_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          from_user?: string
          to_user?: string
          amount?: number
          status?: 'pending' | 'completed' | 'cancelled'
          payment_mode?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          settled_at?: string | null
          created_at?: string
        }
      }
      expense_reactions: {
        Row: {
          id: string
          expense_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          expense_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          expense_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
      }
      expense_issues: {
        Row: {
          id: string
          expense_id: string
          raised_by: string
          description: string
          status: 'open' | 'resolved'
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          expense_id: string
          raised_by: string
          description: string
          status?: 'open' | 'resolved'
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          expense_id?: string
          raised_by?: string
          description?: string
          status?: 'open' | 'resolved'
          created_at?: string
          resolved_at?: string | null
        }
      }
      trip_spend_limits: {
        Row: {
          id: string
          group_id: string
          user_id: string
          spend_limit: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          spend_limit: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          spend_limit?: number
          created_at?: string
          updated_at?: string
        }
      }
      equipoints_log: {
        Row: {
          id: string
          user_id: string
          points: number
          reason: string
          metadata: any
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          points: number
          reason: string
          metadata?: any
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          points?: number
          reason?: string
          metadata?: any
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Friendship types
export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  created_at: string
  updated_at: string
}

export interface GroupInvite {
  id: string
  group_id: string
  invited_by: string
  invited_user: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  updated_at: string
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row'] & { equipoints?: number }
export type Group = Database['public']['Tables']['groups']['Row']
export type GroupMember = Database['public']['Tables']['group_members']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row'] & { proof_url?: string | null }
export type ExpenseSplit = Database['public']['Tables']['expense_splits']['Row']
export type Settlement = Database['public']['Tables']['settlements']['Row']
export type ExpenseReaction = Database['public']['Tables']['expense_reactions']['Row']
export type ExpenseIssue = Database['public']['Tables']['expense_issues']['Row']
export type TripSpendLimit = Database['public']['Tables']['trip_spend_limits']['Row']
export type EquipointsLog = Database['public']['Tables']['equipoints_log']['Row']

export type GroupWithMembers = Group & {
  group_members: (GroupMember & { profiles: Profile })[]
}

export type ExpenseWithDetails = Expense & {
  profiles: Profile
  expense_splits: (ExpenseSplit & { profiles: Profile })[]
  expense_reactions: ExpenseReaction[]
}

export type BalanceEntry = {
  userId: string
  name: string
  amount: number // positive = owed to you, negative = you owe
}

export type SettlementSuggestion = {
  from: string
  fromName: string
  to: string
  toName: string
  amount: number
}
