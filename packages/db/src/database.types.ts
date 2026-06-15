export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_action_types: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action_type_code: string
          created_at: string
          description: string
          id: string
          lease_id: string | null
          metadata: Json
          property_id: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type_code: string
          created_at?: string
          description: string
          id?: string
          lease_id?: string | null
          metadata?: Json
          property_id?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type_code?: string
          created_at?: string
          description?: string
          id?: string
          lease_id?: string | null
          metadata?: Json
          property_id?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_action_type_code_fkey"
            columns: ["action_type_code"]
            isOneToOne: false
            referencedRelation: "activity_action_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "activity_logs_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "v_archived_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_property_occupancy"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "activity_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      amenities: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      billing_charges: {
        Row: {
          amount: number
          billing_entry_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          amount?: number
          billing_entry_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          amount?: number
          billing_entry_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_charges_billing_entry_id_fkey"
            columns: ["billing_entry_id"]
            isOneToOne: false
            referencedRelation: "billing_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_charges_billing_entry_id_fkey"
            columns: ["billing_entry_id"]
            isOneToOne: false
            referencedRelation: "v_billing_entries_full"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_entries: {
        Row: {
          created_at: string
          due_date: string
          id: string
          lease_id: string
          period_id: string | null
          rent_due: number
          sequence: number
          status_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          lease_id: string
          period_id?: string | null
          rent_due?: number
          sequence?: number
          status_code?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          lease_id?: string
          period_id?: string | null
          rent_due?: number
          sequence?: number
          status_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_entries_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "v_archived_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "billing_statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      billing_frequencies: {
        Row: {
          code: string
          interval_days: number
          label: string
        }
        Insert: {
          code: string
          interval_days: number
          label: string
        }
        Update: {
          code?: string
          interval_days?: number
          label?: string
        }
        Relationships: []
      }
      billing_periods: {
        Row: {
          created_at: string
          due_date: string
          id: string
          property_id: string
          sequence: number
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          property_id: string
          sequence: number
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          property_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_periods_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_periods_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_property_occupancy"
            referencedColumns: ["property_id"]
          },
        ]
      }
      billing_statuses: {
        Row: {
          code: string
          is_settled: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          is_settled?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          is_settled?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      landlord_payout_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          created_at: string
          details: string | null
          id: string
          landlord_id: string
          method: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          details?: string | null
          id?: string
          landlord_id: string
          method: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          details?: string | null
          id?: string
          landlord_id?: string
          method?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landlord_payout_methods_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          advance_payment: number
          billing_frequency_code: string
          contract_periods: number | null
          created_at: string
          due_day: number | null
          end_reason: string | null
          ended_at: string | null
          id: string
          property_id: string
          rent_amount: number
          rent_end_date: string | null
          rent_start_date: string | null
          security_deposit: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          advance_payment?: number
          billing_frequency_code?: string
          contract_periods?: number | null
          created_at?: string
          due_day?: number | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          property_id: string
          rent_amount?: number
          rent_end_date?: string | null
          rent_start_date?: string | null
          security_deposit?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          advance_payment?: number
          billing_frequency_code?: string
          contract_periods?: number | null
          created_at?: string
          due_day?: number | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          property_id?: string
          rent_amount?: number
          rent_end_date?: string | null
          rent_start_date?: string | null
          security_deposit?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_billing_frequency_code_fkey"
            columns: ["billing_frequency_code"]
            isOneToOne: false
            referencedRelation: "billing_frequencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_property_occupancy"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_types: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          billing_entry_id: string | null
          created_at: string
          id: string
          lease_id: string
          notes: string | null
          paid_at: string
          payment_type_code: string
          recorded_by: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          billing_entry_id?: string | null
          created_at?: string
          id?: string
          lease_id: string
          notes?: string | null
          paid_at?: string
          payment_type_code?: string
          recorded_by?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          billing_entry_id?: string | null
          created_at?: string
          id?: string
          lease_id?: string
          notes?: string | null
          paid_at?: string
          payment_type_code?: string
          recorded_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_billing_entry_id_fkey"
            columns: ["billing_entry_id"]
            isOneToOne: false
            referencedRelation: "billing_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_billing_entry_id_fkey"
            columns: ["billing_entry_id"]
            isOneToOne: false
            referencedRelation: "v_billing_entries_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "v_archived_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_type_code_fkey"
            columns: ["payment_type_code"]
            isOneToOne: false
            referencedRelation: "payment_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          billing_mode: string
          created_at: string
          id: string
          landlord_id: string
          lease_date: string | null
          max_tenants: number
          property_location: string | null
          property_type_code: string | null
          rent_amount: number
          unit_name: string
          updated_at: string
        }
        Insert: {
          billing_mode?: string
          created_at?: string
          id?: string
          landlord_id: string
          lease_date?: string | null
          max_tenants?: number
          property_location?: string | null
          property_type_code?: string | null
          rent_amount?: number
          unit_name: string
          updated_at?: string
        }
        Update: {
          billing_mode?: string
          created_at?: string
          id?: string
          landlord_id?: string
          lease_date?: string | null
          max_tenants?: number
          property_location?: string | null
          property_type_code?: string | null
          rent_amount?: number
          unit_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_property_type_code_fkey"
            columns: ["property_type_code"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["code"]
          },
        ]
      }
      property_amenities: {
        Row: {
          amenity_code: string
          property_id: string
        }
        Insert: {
          amenity_code: string
          property_id: string
        }
        Update: {
          amenity_code?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_amenities_amenity_code_fkey"
            columns: ["amenity_code"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "property_amenities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_amenities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_property_occupancy"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          property_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          property_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_property_occupancy"
            referencedColumns: ["property_id"]
          },
        ]
      }
      property_types: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          billing_entry_id: string
          channel: string
          created_at: string
          id: string
          sent_at: string
          status: string
        }
        Insert: {
          billing_entry_id: string
          channel?: string
          created_at?: string
          id?: string
          sent_at?: string
          status?: string
        }
        Update: {
          billing_entry_id?: string
          channel?: string
          created_at?: string
          id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_billing_entry_id_fkey"
            columns: ["billing_entry_id"]
            isOneToOne: false
            referencedRelation: "billing_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_billing_entry_id_fkey"
            columns: ["billing_entry_id"]
            isOneToOne: false
            referencedRelation: "v_billing_entries_full"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          code: string
          name: string
          price: number
          property_limit: number
        }
        Insert: {
          code: string
          name: string
          price?: number
          property_limit: number
        }
        Update: {
          code?: string
          name?: string
          price?: number
          property_limit?: number
        }
        Relationships: []
      }
      subscription_statuses: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          landlord_id: string
          last_payment_at: string | null
          next_billing_at: string | null
          plan_code: string
          started_at: string
          status_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          landlord_id: string
          last_payment_at?: string | null
          next_billing_at?: string | null
          plan_code: string
          started_at?: string
          status_code?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          landlord_id?: string
          last_payment_at?: string | null
          next_billing_at?: string | null
          plan_code?: string
          started_at?: string
          status_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "subscriptions_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "subscription_statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      tenants: {
        Row: {
          contact_number: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          landlord_id: string
          property_id: string | null
          tenant_name: string
          tenant_slot: number | null
          updated_at: string
        }
        Insert: {
          contact_number: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          landlord_id: string
          property_id?: string | null
          tenant_name: string
          tenant_slot?: number | null
          updated_at?: string
        }
        Update: {
          contact_number?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          landlord_id?: string
          property_id?: string | null
          tenant_name?: string
          tenant_slot?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_property_occupancy"
            referencedColumns: ["property_id"]
          },
        ]
      }
    }
    Views: {
      v_archived_tenants: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          contact_number: string | null
          contract_months: number | null
          created_at: string | null
          due_day: number | null
          id: string | null
          landlord_id: string | null
          property_id: string | null
          property_location: string | null
          property_name: string | null
          property_type: string | null
          rent_amount: number | null
          rent_end_date: string | null
          rent_start_date: string | null
          tenant_name: string | null
          total_due: number | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_property_occupancy"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "properties_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_property_type_code_fkey"
            columns: ["property_type"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["code"]
          },
        ]
      }
      v_billing_entries_full: {
        Row: {
          balance: number | null
          created_at: string | null
          due_date: string | null
          gross_due: number | null
          id: string | null
          lease_id: string | null
          other_charges: number | null
          paid_amount: number | null
          period_id: string | null
          rent_due: number | null
          sequence: number | null
          status_code: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_entries_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "v_archived_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_entries_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "billing_statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      v_property_occupancy: {
        Row: {
          occupancy_status: string | null
          property_id: string | null
        }
        Insert: {
          occupancy_status?: never
          property_id?: string | null
        }
        Update: {
          occupancy_status?: never
          property_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_and_reset_property_atomic: {
        Args: { p_landlord_id: string; p_payload: Json }
        Returns: Json
      }
      claim_tenant_reminder: {
        Args: { p_billing_entry_id: string; p_landlord_id: string }
        Returns: boolean
      }
      create_property_atomic: {
        Args: { p_landlord_id: string; p_payload: Json }
        Returns: Json
      }
      create_unhoused_tenant_atomic: {
        Args: { p_landlord_id: string; p_payload: Json }
        Returns: Json
      }
      get_landlord_payout_methods: {
        Args: { p_property_id: string }
        Returns: {
          account_name: string
          account_number: string
          details: string
          landlord_name: string
          method: string
        }[]
      }
      record_payment_atomic: {
        Args: { p_landlord_id: string; p_payload: Json }
        Returns: Json
      }
      update_property_atomic: {
        Args: { p_landlord_id: string; p_payload: Json; p_property_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

