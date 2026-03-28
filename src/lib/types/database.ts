export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      institutions: {
        Row: {
          id: string;
          name: string;
          country: string | null;
          city: string | null;
          website: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          country?: string | null;
          city?: string | null;
          website?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          country?: string | null;
          city?: string | null;
          website?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          institution_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          institution_id: string | null;
          department_id: string | null;
          role: "researcher" | "pi" | "coordinator" | "admin";
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          institution_id?: string | null;
          department_id?: string | null;
          role?: "researcher" | "pi" | "coordinator" | "admin";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          email?: string | null;
          institution_id?: string | null;
          department_id?: string | null;
          role?: "researcher" | "pi" | "coordinator" | "admin";
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          owner_id: string;
          institution_id: string | null;
          status: "active" | "on_hold" | "completed" | "archived";
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          owner_id: string;
          institution_id?: string | null;
          status?: "active" | "on_hold" | "completed" | "archived";
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          owner_id?: string;
          institution_id?: string | null;
          status?: "active" | "on_hold" | "completed" | "archived";
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: "owner" | "pi" | "member" | "viewer";
          joined_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role?: "owner" | "pi" | "member" | "viewer";
          joined_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role?: "owner" | "pi" | "member" | "viewer";
          joined_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          doc_type:
            | "protocol"
            | "manuscript"
            | "thesis_chapter"
            | "ethics_application"
            | "analysis_plan"
            | "general"
            | "introduction"
            | "methodology"
            | "results"
            | "discussion"
            | "abstract"
            | "conclusion"
            | "literature_review";
          content: Json;
          template_id: string | null;
          status:
            | "draft"
            | "in_review"
            | "revision_requested"
            | "approved"
            | "locked";
          current_version: number;
          locked_by: string | null;
          locked_at: string | null;
          created_by: string;
          word_count: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          doc_type?:
            | "protocol"
            | "manuscript"
            | "thesis_chapter"
            | "ethics_application"
            | "analysis_plan"
            | "general"
            | "introduction"
            | "methodology"
            | "results"
            | "discussion"
            | "abstract"
            | "conclusion"
            | "literature_review";
          content?: Json;
          template_id?: string | null;
          status?:
            | "draft"
            | "in_review"
            | "revision_requested"
            | "approved"
            | "locked";
          current_version?: number;
          locked_by?: string | null;
          locked_at?: string | null;
          created_by: string;
          word_count?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          doc_type?:
            | "protocol"
            | "manuscript"
            | "thesis_chapter"
            | "ethics_application"
            | "analysis_plan"
            | "general"
            | "introduction"
            | "methodology"
            | "results"
            | "discussion"
            | "abstract"
            | "conclusion"
            | "literature_review";
          content?: Json;
          template_id?: string | null;
          status?:
            | "draft"
            | "in_review"
            | "revision_requested"
            | "approved"
            | "locked";
          current_version?: number;
          locked_by?: string | null;
          locked_at?: string | null;
          word_count?: number;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      document_versions: {
        Row: {
          id: string;
          document_id: string;
          version_number: number;
          content: Json;
          created_by: string | null;
          change_summary: string | null;
          word_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          version_number: number;
          content: Json;
          created_by?: string | null;
          change_summary?: string | null;
          word_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          version_number?: number;
          content?: Json;
          created_by?: string | null;
          change_summary?: string | null;
          word_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      document_templates: {
        Row: {
          id: string;
          name: string;
          doc_type: string;
          content: Json;
          standard: string | null;
          description: string | null;
          institution_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          doc_type: string;
          content: Json;
          standard?: string | null;
          description?: string | null;
          institution_id?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          doc_type?: string;
          content?: Json;
          standard?: string | null;
          description?: string | null;
          institution_id?: string | null;
        };
        Relationships: [];
      };
      ethics_applications: {
        Row: {
          id: string;
          project_id: string;
          application_ref: string | null;
          status:
            | "draft"
            | "submitted"
            | "under_review"
            | "approved"
            | "conditionally_approved"
            | "rejected"
            | "expired"
            | "renewal_pending";
          board_name: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          expires_at: string | null;
          conditions: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          application_ref?: string | null;
          status?:
            | "draft"
            | "submitted"
            | "under_review"
            | "approved"
            | "conditionally_approved"
            | "rejected"
            | "expired"
            | "renewal_pending";
          board_name?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          expires_at?: string | null;
          conditions?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          application_ref?: string | null;
          status?:
            | "draft"
            | "submitted"
            | "under_review"
            | "approved"
            | "conditionally_approved"
            | "rejected"
            | "expired"
            | "renewal_pending";
          board_name?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          expires_at?: string | null;
          conditions?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      ethics_amendments: {
        Row: {
          id: string;
          application_id: string;
          amendment_ref: string | null;
          description: string;
          justification: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          status: "draft" | "submitted" | "approved" | "rejected";
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          application_id: string;
          amendment_ref?: string | null;
          description: string;
          justification?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          status?: "draft" | "submitted" | "approved" | "rejected";
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          application_id?: string;
          amendment_ref?: string | null;
          description?: string;
          justification?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          status?: "draft" | "submitted" | "approved" | "rejected";
          created_by?: string | null;
        };
        Relationships: [];
      };
      ethics_documents: {
        Row: {
          id: string;
          application_id: string | null;
          amendment_id: string | null;
          file_name: string;
          file_path: string;
          file_size: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          application_id?: string | null;
          amendment_id?: string | null;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          application_id?: string | null;
          amendment_id?: string | null;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          uploaded_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Convenience row types
export type Institution =
  Database["public"]["Tables"]["institutions"]["Row"];
export type Department = Database["public"]["Tables"]["departments"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectMember =
  Database["public"]["Tables"]["project_members"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentVersion =
  Database["public"]["Tables"]["document_versions"]["Row"];
export type DocumentTemplate =
  Database["public"]["Tables"]["document_templates"]["Row"];
export type EthicsApplication =
  Database["public"]["Tables"]["ethics_applications"]["Row"];
export type EthicsAmendment =
  Database["public"]["Tables"]["ethics_amendments"]["Row"];
export type EthicsDocument =
  Database["public"]["Tables"]["ethics_documents"]["Row"];
