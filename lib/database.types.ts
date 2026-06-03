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
      chats: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          attachment_type: Database["public"]["Enums"]["attachment_type"]
          created_at: string
          file_name: string
          file_size: number | null
          height: number | null
          id: string
          message_id: string
          metadata: Json
          mime_type: string
          storage_path: string
          width: number | null
        }
        Insert: {
          attachment_type: Database["public"]["Enums"]["attachment_type"]
          created_at?: string
          file_name: string
          file_size?: number | null
          height?: number | null
          id?: string
          message_id: string
          metadata?: Json
          mime_type: string
          storage_path: string
          width?: number | null
        }
        Update: {
          attachment_type?: Database["public"]["Enums"]["attachment_type"]
          created_at?: string
          file_name?: string
          file_size?: number | null
          height?: number | null
          id?: string
          message_id?: string
          metadata?: Json
          mime_type?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          metadata: Json
          parent_message_id: string | null
          role: Database["public"]["Enums"]["message_role"]
          token_count: number | null
          updated_at: string
        }
        Insert: {
          chat_id: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          parent_message_id?: string | null
          role: Database["public"]["Enums"]["message_role"]
          token_count?: number | null
          updated_at?: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          parent_message_id?: string | null
          role?: Database["public"]["Enums"]["message_role"]
          token_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          max_free_questions: number
          question_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          max_free_questions?: number
          question_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          max_free_questions?: number
          question_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_question_count_for_user: {
        Args: {
          p_is_anonymous: boolean
          p_user_id: string
        }
        Returns: {
          max_free_questions: number
          question_count: number
        }[]
      }
    }
    Enums: {
      attachment_type: "image" | "document"
      message_role: "user" | "assistant" | "system"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type ChatRow = Database["public"]["Tables"]["chats"]["Row"]
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"]
export type MessageAttachmentRow =
  Database["public"]["Tables"]["message_attachments"]["Row"]

export type MessageAttachmentView = MessageAttachmentRow & {
  signed_url: string | null
}

export type MessageWithAttachments = MessageRow & {
  attachments: MessageAttachmentView[]
}
