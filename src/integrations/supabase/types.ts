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
      admin_accounts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          last_login_at: string | null
          memo: string | null
          role: Database["public"]["Enums"]["idfit_app_role"]
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          memo?: string | null
          role?: Database["public"]["Enums"]["idfit_app_role"]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          memo?: string | null
          role?: Database["public"]["Enums"]["idfit_app_role"]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      as_tickets: {
        Row: {
          admin_note: string | null
          created_at: string
          customer_message: string
          id: string
          issue_type: Database["public"]["Enums"]["as_issue_type"]
          order_id: string
          status: Database["public"]["Enums"]["as_ticket_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          customer_message?: string
          id?: string
          issue_type?: Database["public"]["Enums"]["as_issue_type"]
          order_id: string
          status?: Database["public"]["Enums"]["as_ticket_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          customer_message?: string
          id?: string
          issue_type?: Database["public"]["Enums"]["as_issue_type"]
          order_id?: string
          status?: Database["public"]["Enums"]["as_ticket_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "as_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      idfit_profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          referral_code: string | null
          role: Database["public"]["Enums"]["idfit_app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          referral_code?: string | null
          role?: Database["public"]["Enums"]["idfit_app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          referral_code?: string | null
          role?: Database["public"]["Enums"]["idfit_app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_items: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          encrypted_payload: string
          id: string
          order_id: string
          replaced_by_id: string | null
          updated_at: string
          visible_to_customer: boolean
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          encrypted_payload: string
          id?: string
          order_id: string
          replaced_by_id?: string | null
          updated_at?: string
          visible_to_customer?: boolean
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          encrypted_payload?: string
          id?: string
          order_id?: string
          replaced_by_id?: string | null
          updated_at?: string
          visible_to_customer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_replaced_by_id_fkey"
            columns: ["replaced_by_id"]
            isOneToOne: false
            referencedRelation: "delivery_items"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_rules: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          fixed_usdt: number
          id: string
          margin_type: Database["public"]["Enums"]["margin_type"]
          max_price_usdt: number | null
          min_margin_usdt: number
          name: string
          percent_value: number
          scope: Database["public"]["Enums"]["margin_scope"]
          scope_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          fixed_usdt?: number
          id?: string
          margin_type?: Database["public"]["Enums"]["margin_type"]
          max_price_usdt?: number | null
          min_margin_usdt?: number
          name: string
          percent_value?: number
          scope?: Database["public"]["Enums"]["margin_scope"]
          scope_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          fixed_usdt?: number
          id?: string
          margin_type?: Database["public"]["Enums"]["margin_type"]
          max_price_usdt?: number | null
          min_margin_usdt?: number
          name?: string
          percent_value?: number
          scope?: Database["public"]["Enums"]["margin_scope"]
          scope_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_note: string | null
          created_at: string
          customer_note: string | null
          id: string
          commission_percent: number
          commission_usdt: number
          margin_usdt: number
          order_no: string
          payment_address: string | null
          payment_confirmed_at: string | null
          payment_network: string
          payment_tx_hash: string | null
          product_id: string
          referral_code: string | null
          sale_price_usdt: number
          sales_code_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          supplier_cost_usdt: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          customer_note?: string | null
          id?: string
          commission_percent?: number
          commission_usdt?: number
          margin_usdt?: number
          order_no: string
          payment_address?: string | null
          payment_confirmed_at?: string | null
          payment_network?: string
          payment_tx_hash?: string | null
          product_id: string
          referral_code?: string | null
          sale_price_usdt: number
          sales_code_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          supplier_cost_usdt?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          customer_note?: string | null
          id?: string
          commission_percent?: number
          commission_usdt?: number
          margin_usdt?: number
          order_no?: string
          payment_address?: string | null
          payment_confirmed_at?: string | null
          payment_network?: string
          payment_tx_hash?: string | null
          product_id?: string
          referral_code?: string | null
          sale_price_usdt?: number
          sales_code_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          supplier_cost_usdt?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_candidates: {
        Row: {
          admin_note: string | null
          created_at: string
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          duration_days: number | null
          freshness_expires_at: string | null
          id: string
          metadata: Json
          parsed_confidence: number
          product_title: string
          raw_message_id: string
          seller_id: string | null
          service_name: string
          source_id: string
          status: Database["public"]["Enums"]["candidate_status"]
          stock_count: number | null
          stock_state: Database["public"]["Enums"]["stock_state"]
          supplier_cost_usdt: number | null
          supplier_currency: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          duration_days?: number | null
          freshness_expires_at?: string | null
          id?: string
          metadata?: Json
          parsed_confidence?: number
          product_title: string
          raw_message_id: string
          seller_id?: string | null
          service_name?: string
          source_id: string
          status?: Database["public"]["Enums"]["candidate_status"]
          stock_count?: number | null
          stock_state?: Database["public"]["Enums"]["stock_state"]
          supplier_cost_usdt?: number | null
          supplier_currency?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          duration_days?: number | null
          freshness_expires_at?: string | null
          id?: string
          metadata?: Json
          parsed_confidence?: number
          product_title?: string
          raw_message_id?: string
          seller_id?: string | null
          service_name?: string
          source_id?: string
          status?: Database["public"]["Enums"]["candidate_status"]
          stock_count?: number | null
          stock_state?: Database["public"]["Enums"]["stock_state"]
          supplier_cost_usdt?: number | null
          supplier_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_candidates_raw_message_id_fkey"
            columns: ["raw_message_id"]
            isOneToOne: false
            referencedRelation: "raw_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_candidates_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_candidates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "telegram_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          candidate_id: string | null
          created_at: string
          description: string
          id: string
          last_synced_at: string | null
          margin_rate: number
          margin_usdt: number
          metadata: Json
          sale_price_usdt: number
          seller_id: string | null
          service_name: string
          source_id: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock_count: number | null
          stock_state: Database["public"]["Enums"]["stock_state"]
          supplier_cost_usdt: number
          title: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          description?: string
          id?: string
          last_synced_at?: string | null
          margin_rate?: number
          margin_usdt?: number
          metadata?: Json
          sale_price_usdt?: number
          seller_id?: string | null
          service_name?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_count?: number | null
          stock_state?: Database["public"]["Enums"]["stock_state"]
          supplier_cost_usdt?: number
          title: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          description?: string
          id?: string
          last_synced_at?: string | null
          margin_rate?: number
          margin_usdt?: number
          metadata?: Json
          sale_price_usdt?: number
          seller_id?: string | null
          service_name?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_count?: number | null
          stock_state?: Database["public"]["Enums"]["stock_state"]
          supplier_cost_usdt?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "product_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "telegram_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_team_codes: {
        Row: {
          code: string
          commission_percent: number
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          memo: string | null
          name: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          code: string
          commission_percent?: number
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          memo?: string | null
          name: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          code?: string
          commission_percent?: number
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          memo?: string | null
          name?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      raw_messages: {
        Row: {
          created_at: string
          hash_key: string
          id: string
          message_media: Json
          message_text: string
          metadata: Json
          original_url: string | null
          parse_status: Database["public"]["Enums"]["raw_message_parse_status"]
          parser_version: string | null
          received_at: string
          sender_identifier: string | null
          source_id: string
          telegram_message_id: string | null
        }
        Insert: {
          created_at?: string
          hash_key: string
          id?: string
          message_media?: Json
          message_text?: string
          metadata?: Json
          original_url?: string | null
          parse_status?: Database["public"]["Enums"]["raw_message_parse_status"]
          parser_version?: string | null
          received_at?: string
          sender_identifier?: string | null
          source_id: string
          telegram_message_id?: string | null
        }
        Update: {
          created_at?: string
          hash_key?: string
          id?: string
          message_media?: Json
          message_text?: string
          metadata?: Json
          original_url?: string | null
          parse_status?: Database["public"]["Enums"]["raw_message_parse_status"]
          parser_version?: string | null
          received_at?: string
          sender_identifier?: string | null
          source_id?: string
          telegram_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_messages_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "telegram_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          as_count: number
          created_at: string
          display_name: string
          failure_count: number
          id: string
          last_seen_at: string | null
          metadata: Json
          observed_sales_count: number
          source_id: string
          success_count: number
          telegram_identifier: string | null
          trust_score: number
          updated_at: string
        }
        Insert: {
          as_count?: number
          created_at?: string
          display_name?: string
          failure_count?: number
          id?: string
          last_seen_at?: string | null
          metadata?: Json
          observed_sales_count?: number
          source_id: string
          success_count?: number
          telegram_identifier?: string | null
          trust_score?: number
          updated_at?: string
        }
        Update: {
          as_count?: number
          created_at?: string
          display_name?: string
          failure_count?: number
          id?: string
          last_seen_at?: string | null
          metadata?: Json
          observed_sales_count?: number
          source_id?: string
          success_count?: number
          telegram_identifier?: string | null
          trust_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sellers_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "telegram_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_purchase_jobs: {
        Row: {
          actual_cost_usdt: number | null
          conversation_log: Json
          created_at: string
          expected_cost_usdt: number | null
          failure_reason: string | null
          finished_at: string | null
          id: string
          max_allowed_cost_usdt: number | null
          order_id: string
          seller_id: string | null
          source_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["purchase_job_status"]
          updated_at: string
        }
        Insert: {
          actual_cost_usdt?: number | null
          conversation_log?: Json
          created_at?: string
          expected_cost_usdt?: number | null
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          max_allowed_cost_usdt?: number | null
          order_id: string
          seller_id?: string | null
          source_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["purchase_job_status"]
          updated_at?: string
        }
        Update: {
          actual_cost_usdt?: number | null
          conversation_log?: Json
          created_at?: string
          expected_cost_usdt?: number | null
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          max_allowed_cost_usdt?: number | null
          order_id?: string
          seller_id?: string | null
          source_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["purchase_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_purchase_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_purchase_jobs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_purchase_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "telegram_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_leads: {
        Row: {
          approved_source_id: string | null
          confidence: number
          created_at: string
          discovered_from_raw_message_id: string | null
          discovered_from_source_id: string | null
          evidence: string
          evidence_kind: string
          id: string
          identifier: string
          metadata: Json
          normalized_identifier: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_type: Database["public"]["Enums"]["telegram_source_type"]
          status: Database["public"]["Enums"]["source_lead_status"]
          updated_at: string
        }
        Insert: {
          approved_source_id?: string | null
          confidence?: number
          created_at?: string
          discovered_from_raw_message_id?: string | null
          discovered_from_source_id?: string | null
          evidence?: string
          evidence_kind?: string
          id?: string
          identifier: string
          metadata?: Json
          normalized_identifier: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type: Database["public"]["Enums"]["telegram_source_type"]
          status?: Database["public"]["Enums"]["source_lead_status"]
          updated_at?: string
        }
        Update: {
          approved_source_id?: string | null
          confidence?: number
          created_at?: string
          discovered_from_raw_message_id?: string | null
          discovered_from_source_id?: string | null
          evidence?: string
          evidence_kind?: string
          id?: string
          identifier?: string
          metadata?: Json
          normalized_identifier?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_type?: Database["public"]["Enums"]["telegram_source_type"]
          status?: Database["public"]["Enums"]["source_lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_leads_approved_source_id_fkey"
            columns: ["approved_source_id"]
            isOneToOne: false
            referencedRelation: "telegram_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_leads_discovered_from_raw_message_id_fkey"
            columns: ["discovered_from_raw_message_id"]
            isOneToOne: false
            referencedRelation: "raw_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_leads_discovered_from_source_id_fkey"
            columns: ["discovered_from_source_id"]
            isOneToOne: false
            referencedRelation: "telegram_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_sources: {
        Row: {
          auto_collect_enabled: boolean
          auto_purchase_enabled: boolean
          created_at: string
          created_by: string | null
          default_margin_rule_id: string | null
          id: string
          metadata: Json
          name: string
          source_type: Database["public"]["Enums"]["telegram_source_type"]
          status: Database["public"]["Enums"]["source_status"]
          telegram_identifier: string
          trust_override: number | null
          updated_at: string
        }
        Insert: {
          auto_collect_enabled?: boolean
          auto_purchase_enabled?: boolean
          created_at?: string
          created_by?: string | null
          default_margin_rule_id?: string | null
          id?: string
          metadata?: Json
          name: string
          source_type: Database["public"]["Enums"]["telegram_source_type"]
          status?: Database["public"]["Enums"]["source_status"]
          telegram_identifier: string
          trust_override?: number | null
          updated_at?: string
        }
        Update: {
          auto_collect_enabled?: boolean
          auto_purchase_enabled?: boolean
          created_at?: string
          created_by?: string | null
          default_margin_rule_id?: string | null
          id?: string
          metadata?: Json
          name?: string
          source_type?: Database["public"]["Enums"]["telegram_source_type"]
          status?: Database["public"]["Enums"]["source_status"]
          telegram_identifier?: string
          trust_override?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      board_products: {
        Row: {
          created_at: string
          description: string
          id: string
          last_synced_at: string | null
          metadata: Json
          sale_price_usdt: number
          service_name: string
          source_label: string | null
          source_trust: number | null
          status: Database["public"]["Enums"]["product_status"]
          stock_count: number | null
          stock_state: Database["public"]["Enums"]["stock_state"]
          title: string
          updated_at: string
        }
        Relationships: []
      }
      visible_products: {
        Row: {
          description: string
          id: string
          last_synced_at: string | null
          metadata: Json
          sale_price_usdt: number
          service_name: string
          source_label: string | null
          source_trust: number | null
          stock_count: number | null
          stock_state: Database["public"]["Enums"]["stock_state"]
          title: string
          updated_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      idfit_calculate_sale_price: {
        Args: {
          fixed_usdt: number
          margin_type: Database["public"]["Enums"]["margin_type"]
          max_price_usdt: number
          min_margin_usdt: number
          percent_value: number
          supplier_cost: number
        }
        Returns: number
      }
      idfit_admin_sales_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          code: string
          name: string
          email: string | null
          status: string
          commission_percent: number
          user_id: string | null
          members_count: number
          orders_count: number
          gross_sales_usdt: number
          net_profit_usdt: number
          commission_usdt: number
        }[]
      }
      idfit_has_role: {
        Args: {
          _roles: Database["public"]["Enums"]["idfit_app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      idfit_my_sales_members: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          full_name: string
          email: string | null
          created_at: string
          orders_count: number
          gross_sales_usdt: number
          net_profit_usdt: number
          commission_usdt: number
        }[]
      }
      idfit_mark_depleted_products_sold_out: { Args: never; Returns: number }
      idfit_next_order_no: { Args: never; Returns: string }
    }
    Enums: {
      as_issue_type:
        | "invalid_login"
        | "used_code"
        | "expired"
        | "wrong_product"
        | "other"
      as_ticket_status:
        | "open"
        | "investigating"
        | "replacement_sent"
        | "rejected"
        | "closed"
      candidate_status:
        | "candidate"
        | "approved"
        | "hidden"
        | "expired"
        | "rejected"
      idfit_app_role:
        | "owner"
        | "admin"
        | "operator"
        | "support"
        | "customer"
      delivery_type: "code" | "login" | "invite_link" | "manual"
      margin_scope: "global" | "service" | "source" | "seller"
      margin_type: "percent" | "fixed_usdt" | "percent_plus_fixed"
      order_status:
        | "payment_pending"
        | "payment_confirmed"
        | "purchasing"
        | "delivered"
        | "as_open"
        | "failed"
        | "refunded_review"
      product_status: "visible" | "hidden" | "sold_out" | "expired"
      purchase_job_status:
        | "queued"
        | "checking_stock"
        | "purchasing"
        | "waiting_payment"
        | "waiting_delivery"
        | "delivered"
        | "manual_review"
        | "failed"
      raw_message_parse_status: "pending" | "parsed" | "ignored" | "failed"
      source_lead_status: "new" | "reviewing" | "approved" | "rejected" | "duplicate"
      source_status: "live" | "paused" | "throttled" | "blocked"
      stock_state: "in_stock" | "low" | "sold_out" | "unknown"
      telegram_source_type: "group" | "channel" | "bot" | "manual" | "website"
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
  public: {
    Enums: {
      as_issue_type: [
        "invalid_login",
        "used_code",
        "expired",
        "wrong_product",
        "other",
      ],
      as_ticket_status: [
        "open",
        "investigating",
        "replacement_sent",
        "rejected",
        "closed",
      ],
      candidate_status: [
        "candidate",
        "approved",
        "hidden",
        "expired",
        "rejected",
      ],
      idfit_app_role: [
        "owner",
        "admin",
        "operator",
        "support",
        "customer",
      ],
      delivery_type: ["code", "login", "invite_link", "manual"],
      margin_scope: ["global", "service", "source", "seller"],
      margin_type: ["percent", "fixed_usdt", "percent_plus_fixed"],
      order_status: [
        "payment_pending",
        "payment_confirmed",
        "purchasing",
        "delivered",
        "as_open",
        "failed",
        "refunded_review",
      ],
      product_status: ["visible", "hidden", "sold_out", "expired"],
      purchase_job_status: [
        "queued",
        "checking_stock",
        "purchasing",
        "waiting_payment",
        "waiting_delivery",
        "delivered",
        "manual_review",
        "failed",
      ],
      raw_message_parse_status: ["pending", "parsed", "ignored", "failed"],
      source_status: ["live", "paused", "throttled", "blocked"],
      stock_state: ["in_stock", "low", "sold_out", "unknown"],
      telegram_source_type: ["group", "channel", "bot", "manual"],
    },
  },
} as const
