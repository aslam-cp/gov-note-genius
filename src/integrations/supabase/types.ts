export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      knowledge_bases: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          is_shared: boolean;
          name: string;
          owner_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          is_shared?: boolean;
          name: string;
          owner_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          is_shared?: boolean;
          name?: string;
          owner_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      noting_cases: {
        Row: {
          analysis: Json | null;
          applied_kb_ids: string[];
          context_summary: string;
          created_at: string;
          custom_instruction: string;
          id: string;
          noting_text: string | null;
          noting_type: string;
          owner_id: string | null;
          reference: string;
          session_id: string;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          analysis?: Json | null;
          applied_kb_ids?: string[];
          context_summary?: string;
          created_at?: string;
          custom_instruction?: string;
          id?: string;
          noting_text?: string | null;
          noting_type?: string;
          owner_id?: string | null;
          reference?: string;
          session_id: string;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Update: {
          analysis?: Json | null;
          applied_kb_ids?: string[];
          context_summary?: string;
          created_at?: string;
          custom_instruction?: string;
          id?: string;
          noting_text?: string | null;
          noting_type?: string;
          owner_id?: string | null;
          reference?: string;
          session_id?: string;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      noting_documents: {
        Row: {
          case_id: string;
          created_at: string;
          extracted_text: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          extracted_text?: string | null;
          file_name: string;
          id?: string;
          mime_type: string;
          size_bytes?: number;
          storage_path: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          extracted_text?: string | null;
          file_name?: string;
          id?: string;
          mime_type?: string;
          size_bytes?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "noting_documents_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "noting_cases";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_document_kbs: {
        Row: {
          created_at: string;
          knowledge_base_id: string;
          rule_document_id: string;
        };
        Insert: {
          created_at?: string;
          knowledge_base_id: string;
          rule_document_id: string;
        };
        Update: {
          created_at?: string;
          knowledge_base_id?: string;
          rule_document_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rule_document_kbs_knowledge_base_id_fkey";
            columns: ["knowledge_base_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_bases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rule_document_kbs_rule_document_id_fkey";
            columns: ["rule_document_id"];
            isOneToOne: false;
            referencedRelation: "rule_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_documents: {
        Row: {
          category: string;
          created_at: string;
          file_name: string;
          id: string;
          is_active: boolean;
          mime_type: string;
          reference_no: string;
          size_bytes: number;
          storage_path: string;
          summary: string;
          title: string;
          updated_at: string;
          uploader_id: string;
          year: number | null;
        };
        Insert: {
          category?: string;
          created_at?: string;
          file_name: string;
          id?: string;
          is_active?: boolean;
          mime_type: string;
          reference_no?: string;
          size_bytes?: number;
          storage_path: string;
          summary?: string;
          title: string;
          updated_at?: string;
          uploader_id: string;
          year?: number | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          file_name?: string;
          id?: string;
          is_active?: boolean;
          mime_type?: string;
          reference_no?: string;
          size_bytes?: number;
          storage_path?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
          uploader_id?: string;
          year?: number | null;
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
