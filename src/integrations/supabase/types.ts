export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      complaint_events: {
        Row: {
          actor: string
          complaint_id: string
          created_at: string
          detail: string
          event_type: string
          id: string
        }
        Insert: {
          actor?: string
          complaint_id: string
          created_at?: string
          detail?: string
          event_type: string
          id?: string
        }
        Update: {
          actor?: string
          complaint_id?: string
          created_at?: string
          detail?: string
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_events_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          accepted_at: string | null
          address: string
          ai_confidence: number
          assigned_worker_id: string | null
          citizen_name: string
          citizen_note: string
          created_at: string
          escalation_level: number
          id: string
          lat: number
          lng: number
          priority: Database["public"]["Enums"]["complaint_priority"]
          priority_override_reason: string | null
          reference: string
          resolved_at: string | null
          sla_deadline: string | null
          sla_start: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          verification_status: string | null
          waste_category: Database["public"]["Enums"]["waste_category"]
          zone_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          address?: string
          ai_confidence?: number
          assigned_worker_id?: string | null
          citizen_name?: string
          citizen_note?: string
          created_at?: string
          escalation_level?: number
          id?: string
          lat?: number
          lng?: number
          priority?: Database["public"]["Enums"]["complaint_priority"]
          priority_override_reason?: string | null
          reference: string
          resolved_at?: string | null
          sla_deadline?: string | null
          sla_start?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          verification_status?: string | null
          waste_category?: Database["public"]["Enums"]["waste_category"]
          zone_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          address?: string
          ai_confidence?: number
          assigned_worker_id?: string | null
          citizen_name?: string
          citizen_note?: string
          created_at?: string
          escalation_level?: number
          id?: string
          lat?: number
          lng?: number
          priority?: Database["public"]["Enums"]["complaint_priority"]
          priority_override_reason?: string | null
          reference?: string
          resolved_at?: string | null
          sla_deadline?: string | null
          sla_start?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          verification_status?: string | null
          waste_category?: Database["public"]["Enums"]["waste_category"]
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_assigned_worker_id_fkey"
            columns: ["assigned_worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          complaint_id: string
          escalated_at: string
          from_level: number
          id: string
          reason: string
          to_level: number
        }
        Insert: {
          complaint_id: string
          escalated_at?: string
          from_level?: number
          id?: string
          reason?: string
          to_level?: number
        }
        Update: {
          complaint_id?: string
          escalated_at?: string
          from_level?: number
          id?: string
          reason?: string
          to_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "escalations_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_config: {
        Row: {
          duration_hours: number
          escalation_extension_hours: number
          priority: Database["public"]["Enums"]["complaint_priority"]
          updated_at: string
          warn_at_percent: number[]
        }
        Insert: {
          duration_hours: number
          escalation_extension_hours?: number
          priority: Database["public"]["Enums"]["complaint_priority"]
          updated_at?: string
          warn_at_percent?: number[]
        }
        Update: {
          duration_hours?: number
          escalation_extension_hours?: number
          priority?: Database["public"]["Enums"]["complaint_priority"]
          updated_at?: string
          warn_at_percent?: number[]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          availability: string
          created_at: string
          id: string
          name: string
          performance_score: number
          phone: string
          zone_id: string | null
        }
        Insert: {
          availability?: string
          created_at?: string
          id?: string
          name: string
          performance_score?: number
          phone?: string
          zone_id?: string | null
        }
        Update: {
          availability?: string
          created_at?: string
          id?: string
          name?: string
          performance_score?: number
          phone?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string
          id: string
          name: string
          sensitivity_tags: string[]
          supervisor_name: string
        }
        Insert: {
          center_lat?: number
          center_lng?: number
          created_at?: string
          id?: string
          name: string
          sensitivity_tags?: string[]
          supervisor_name?: string
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string
          id?: string
          name?: string
          sensitivity_tags?: string[]
          supervisor_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_zone: { Args: { _zone_id: string }; Returns: boolean }
      current_zone: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      run_sla_escalation: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "commissioner" | "zonal_officer" | "citizen"
      complaint_priority: "critical" | "high" | "medium" | "low"
      complaint_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "verified"
        | "closed"
        | "escalated"
        | "reopened"
      waste_category:
        | "organic"
        | "plastic"
        | "paper_cardboard"
        | "e_waste"
        | "construction_debris"
        | "hazardous"
        | "mixed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["commissioner", "zonal_officer", "citizen"],
      complaint_priority: ["critical", "high", "medium", "low"],
      complaint_status: [
        "pending",
        "assigned",
        "in_progress",
        "resolved",
        "verified",
        "closed",
        "escalated",
        "reopened",
      ],
      waste_category: [
        "organic",
        "plastic",
        "paper_cardboard",
        "e_waste",
        "construction_debris",
        "hazardous",
        "mixed",
      ],
    },
  },
} as const
