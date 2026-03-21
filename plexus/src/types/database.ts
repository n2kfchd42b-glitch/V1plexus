export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          institution_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          avatar_url?: string | null
          institution_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          institution_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      institutions: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          settings: Json
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          settings?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          settings?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          id: string
          institution_id: string
          name: string
          slug: string
          description: string | null
          settings: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          institution_id: string
          name: string
          slug: string
          description?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          institution_id?: string
          name?: string
          slug?: string
          description?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: 'institution_admin' | 'department_head' | 'principal_investigator' | 'supervisor' | 'researcher' | 'external_reviewer'
          institution_id: string | null
          department_id: string | null
          project_id: string | null
          granted_by: string | null
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role: 'institution_admin' | 'department_head' | 'principal_investigator' | 'supervisor' | 'researcher' | 'external_reviewer'
          institution_id?: string | null
          department_id?: string | null
          project_id?: string | null
          granted_by?: string | null
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'institution_admin' | 'department_head' | 'principal_investigator' | 'supervisor' | 'researcher' | 'external_reviewer'
          institution_id?: string | null
          department_id?: string | null
          project_id?: string | null
          granted_by?: string | null
          created_at?: string
          expires_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          title: string
          description: string | null
          department_id: string | null
          owner_id: string
          status: 'active' | 'paused' | 'completed' | 'archived'
          phase: 'concept' | 'protocol' | 'ethics_review' | 'data_collection' | 'analysis' | 'writing' | 'publication' | 'archived'
          start_date: string | null
          target_end_date: string | null
          settings: Json
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          department_id?: string | null
          owner_id: string
          status?: 'active' | 'paused' | 'completed' | 'archived'
          phase?: 'concept' | 'protocol' | 'ethics_review' | 'data_collection' | 'analysis' | 'writing' | 'publication' | 'archived'
          start_date?: string | null
          target_end_date?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          department_id?: string | null
          owner_id?: string
          status?: 'active' | 'paused' | 'completed' | 'archived'
          phase?: 'concept' | 'protocol' | 'ethics_review' | 'data_collection' | 'analysis' | 'writing' | 'publication' | 'archived'
          start_date?: string | null
          target_end_date?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: 'pi' | 'supervisor' | 'researcher' | 'collaborator' | 'viewer'
          joined_at: string
          invited_by: string | null
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role: 'pi' | 'supervisor' | 'researcher' | 'collaborator' | 'viewer'
          joined_at?: string
          invited_by?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: 'pi' | 'supervisor' | 'researcher' | 'collaborator' | 'viewer'
          joined_at?: string
          invited_by?: string | null
        }
        Relationships: []
      }
      project_milestones: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          due_date: string | null
          completed_at: string | null
          status: 'pending' | 'in_progress' | 'completed' | 'overdue'
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description?: string | null
          due_date?: string | null
          completed_at?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'overdue'
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string | null
          due_date?: string | null
          completed_at?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'overdue'
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
