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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      blast_responses: {
        Row: {
          blast_id: string
          created_at: string | null
          decline_reason: string | null
          distance_miles: number | null
          driver_id: string
          id: string
          latitude: number | null
          longitude: number | null
          notified_at: string | null
          responded_at: string | null
          response_time_ms: number | null
          status: string
        }
        Insert: {
          blast_id: string
          created_at?: string | null
          decline_reason?: string | null
          distance_miles?: number | null
          driver_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notified_at?: string | null
          responded_at?: string | null
          response_time_ms?: number | null
          status?: string
        }
        Update: {
          blast_id?: string
          created_at?: string | null
          decline_reason?: string | null
          distance_miles?: number | null
          driver_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notified_at?: string | null
          responded_at?: string | null
          response_time_ms?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "blast_responses_blast_id_fkey"
            columns: ["blast_id"]
            isOneToOne: false
            referencedRelation: "dispatch_blasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blast_responses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_billing_profiles: {
        Row: {
          billing_email: string | null
          client_name: string
          created_at: string | null
          fuel_surcharge_pct: number | null
          id: string
          invoice_frequency: string | null
          notes: string | null
          payment_terms: number | null
          quickbooks_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          billing_email?: string | null
          client_name: string
          created_at?: string | null
          fuel_surcharge_pct?: number | null
          id?: string
          invoice_frequency?: string | null
          notes?: string | null
          payment_terms?: number | null
          quickbooks_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_email?: string | null
          client_name?: string
          created_at?: string | null
          fuel_surcharge_pct?: number | null
          id?: string
          invoice_frequency?: string | null
          notes?: string | null
          payment_terms?: number | null
          quickbooks_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string
          id: string
          industry: string | null
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          email: string | null
          first_name: string
          id: string
          job_title: string | null
          last_name: string
          lead_id: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name: string
          id?: string
          job_title?: string | null
          last_name: string
          lead_id?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string
          id?: string
          job_title?: string | null
          last_name?: string
          lead_id?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_dispatches: {
        Row: {
          created_at: string
          created_by: string | null
          dispatch_date: string
          driver_name: string
          id: string
          notes: string | null
          route: string | null
          status: string
          stops: number | null
          synced_at: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          driver_name: string
          id?: string
          notes?: string | null
          route?: string | null
          status?: string
          stops?: number | null
          synced_at?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          driver_name?: string
          id?: string
          notes?: string | null
          route?: string | null
          status?: string
          stops?: number | null
          synced_at?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      daily_loads: {
        Row: {
          actual_delivery: string | null
          actual_pickup: string | null
          bol_url: string | null
          client_name: string | null
          collection_time: string | null
          comments: string | null
          consol_number: string | null
          created_at: string | null
          created_by: string | null
          current_eta: string | null
          deadhead_miles: number | null
          delivery_address: string | null
          delivery_company: string | null
          delivery_contact_name: string | null
          delivery_contact_phone: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_time: string | null
          description: string | null
          detention_billed: number | null
          detention_eligible: boolean | null
          dimensions_text: string | null
          dispatcher_id: string | null
          driver_id: string | null
          driver_pay: number | null
          end_time: string | null
          estimated_delivery: string | null
          estimated_pickup: string | null
          eta_status: string | null
          fuel_cost: number | null
          hub: string
          id: string
          inbound_tracking: string | null
          load_date: string
          miles: number | null
          outbound_tracking: string | null
          package_type: string | null
          packages: number | null
          pickup_address: string | null
          pickup_company: string | null
          pickup_contact_name: string | null
          pickup_contact_phone: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_open_hours: string | null
          po_number: string | null
          pod_confirmed: boolean | null
          reference_number: string
          requested_by: string | null
          revenue: number | null
          route_distance_meters: number | null
          route_duration_seconds: number | null
          service_type: string | null
          shift: string | null
          shipper_name: string | null
          signature_url: string | null
          signer_name: string | null
          sla_deadline: string | null
          start_time: string | null
          status: string
          tracking_token: string | null
          updated_at: string | null
          vehicle_id: string | null
          vehicle_required: string | null
          wait_time_minutes: number | null
          weight_kg: number | null
          weight_lbs: number | null
        }
        Insert: {
          actual_delivery?: string | null
          actual_pickup?: string | null
          bol_url?: string | null
          client_name?: string | null
          collection_time?: string | null
          comments?: string | null
          consol_number?: string | null
          created_at?: string | null
          created_by?: string | null
          current_eta?: string | null
          deadhead_miles?: number | null
          delivery_address?: string | null
          delivery_company?: string | null
          delivery_contact_name?: string | null
          delivery_contact_phone?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_time?: string | null
          description?: string | null
          detention_billed?: number | null
          detention_eligible?: boolean | null
          dimensions_text?: string | null
          dispatcher_id?: string | null
          driver_id?: string | null
          driver_pay?: number | null
          end_time?: string | null
          estimated_delivery?: string | null
          estimated_pickup?: string | null
          eta_status?: string | null
          fuel_cost?: number | null
          hub: string
          id?: string
          inbound_tracking?: string | null
          load_date: string
          miles?: number | null
          outbound_tracking?: string | null
          package_type?: string | null
          packages?: number | null
          pickup_address?: string | null
          pickup_company?: string | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_open_hours?: string | null
          po_number?: string | null
          pod_confirmed?: boolean | null
          reference_number: string
          requested_by?: string | null
          revenue?: number | null
          route_distance_meters?: number | null
          route_duration_seconds?: number | null
          service_type?: string | null
          shift?: string | null
          shipper_name?: string | null
          signature_url?: string | null
          signer_name?: string | null
          sla_deadline?: string | null
          start_time?: string | null
          status?: string
          tracking_token?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          vehicle_required?: string | null
          wait_time_minutes?: number | null
          weight_kg?: number | null
          weight_lbs?: number | null
        }
        Update: {
          actual_delivery?: string | null
          actual_pickup?: string | null
          bol_url?: string | null
          client_name?: string | null
          collection_time?: string | null
          comments?: string | null
          consol_number?: string | null
          created_at?: string | null
          created_by?: string | null
          current_eta?: string | null
          deadhead_miles?: number | null
          delivery_address?: string | null
          delivery_company?: string | null
          delivery_contact_name?: string | null
          delivery_contact_phone?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_time?: string | null
          description?: string | null
          detention_billed?: number | null
          detention_eligible?: boolean | null
          dimensions_text?: string | null
          dispatcher_id?: string | null
          driver_id?: string | null
          driver_pay?: number | null
          end_time?: string | null
          estimated_delivery?: string | null
          estimated_pickup?: string | null
          eta_status?: string | null
          fuel_cost?: number | null
          hub?: string
          id?: string
          inbound_tracking?: string | null
          load_date?: string
          miles?: number | null
          outbound_tracking?: string | null
          package_type?: string | null
          packages?: number | null
          pickup_address?: string | null
          pickup_company?: string | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_open_hours?: string | null
          po_number?: string | null
          pod_confirmed?: boolean | null
          reference_number?: string
          requested_by?: string | null
          revenue?: number | null
          route_distance_meters?: number | null
          route_duration_seconds?: number | null
          service_type?: string | null
          shift?: string | null
          shipper_name?: string | null
          signature_url?: string | null
          signer_name?: string | null
          sla_deadline?: string | null
          start_time?: string | null
          status?: string
          tracking_token?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          vehicle_required?: string | null
          wait_time_minutes?: number | null
          weight_kg?: number | null
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_loads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_loads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_blasts: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          blast_sent_at: string | null
          blasted_at: string | null
          blasted_by: string | null
          created_at: string | null
          created_by: string | null
          dispatcher_id: string
          drivers_declined: number | null
          drivers_notified: number | null
          drivers_viewed: number | null
          expires_at: string
          hub: string
          id: string
          load_id: string
          message: string | null
          priority: string
          radius_miles: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          blast_sent_at?: string | null
          blasted_at?: string | null
          blasted_by?: string | null
          created_at?: string | null
          created_by?: string | null
          dispatcher_id: string
          drivers_declined?: number | null
          drivers_notified?: number | null
          drivers_viewed?: number | null
          expires_at: string
          hub: string
          id?: string
          load_id: string
          message?: string | null
          priority?: string
          radius_miles?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          blast_sent_at?: string | null
          blasted_at?: string | null
          blasted_by?: string | null
          created_at?: string | null
          created_by?: string | null
          dispatcher_id?: string
          drivers_declined?: number | null
          drivers_notified?: number | null
          drivers_viewed?: number | null
          expires_at?: string
          hub?: string
          id?: string
          load_id?: string
          message?: string | null
          priority?: string
          radius_miles?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_blasts_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_blasts_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "daily_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          active_load_id: string | null
          altitude: number | null
          battery_pct: number | null
          created_at: string | null
          driver_id: string
          heading: number | null
          id: string
          is_moving: boolean | null
          latitude: number
          longitude: number
          recorded_at: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          active_load_id?: string | null
          altitude?: number | null
          battery_pct?: number | null
          created_at?: string | null
          driver_id: string
          heading?: number | null
          id?: string
          is_moving?: boolean | null
          latitude: number
          longitude: number
          recorded_at: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          active_load_id?: string | null
          altitude?: number | null
          battery_pct?: number | null
          created_at?: string | null
          driver_id?: string
          heading?: number | null
          id?: string
          is_moving?: boolean | null
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          driver_id: string | null
          id: string
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          driver_id?: string | null
          id?: string
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          driver_id?: string | null
          id?: string
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_notifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_shifts: {
        Row: {
          created_at: string | null
          driver_id: string
          end_time: string | null
          hub: string
          id: string
          start_time: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          end_time?: string | null
          hub: string
          id?: string
          start_time: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          end_time?: string | null
          hub?: string
          id?: string
          start_time?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string | null
          created_by: string | null
          device_token: string | null
          email: string | null
          full_name: string
          hired_date: string | null
          hourly_rate: number | null
          hub: string
          id: string
          license_expiry: string | null
          license_number: string | null
          notes: string | null
          phone: string
          status: string
          updated_at: string | null
          user_id: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          device_token?: string | null
          email?: string | null
          full_name: string
          hired_date?: string | null
          hourly_rate?: number | null
          hub: string
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          notes?: string | null
          phone: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          device_token?: string | null
          email?: string | null
          full_name?: string
          hired_date?: string | null
          hourly_rate?: number | null
          hub?: string
          id?: string
          license_expiry?: string | null
          license_number?: string | null
          notes?: string | null
          phone?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string
          hub: string | null
          id: string
          name: string
          step_type: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string
          hub?: string | null
          id?: string
          name: string
          step_type?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          hub?: string | null
          id?: string
          name?: string
          step_type?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      follow_up_rules: {
        Row: {
          created_at: string
          days_after: number
          department: Database["public"]["Enums"]["department"] | null
          id: string
          is_active: boolean
          task_priority: Database["public"]["Enums"]["task_priority"]
          task_title: string
          trigger_stage: Database["public"]["Enums"]["lead_stage"]
        }
        Insert: {
          created_at?: string
          days_after?: number
          department?: Database["public"]["Enums"]["department"] | null
          id?: string
          is_active?: boolean
          task_priority?: Database["public"]["Enums"]["task_priority"]
          task_title: string
          trigger_stage: Database["public"]["Enums"]["lead_stage"]
        }
        Update: {
          created_at?: string
          days_after?: number
          department?: Database["public"]["Enums"]["department"] | null
          id?: string
          is_active?: boolean
          task_priority?: Database["public"]["Enums"]["task_priority"]
          task_title?: string
          trigger_stage?: Database["public"]["Enums"]["lead_stage"]
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          load_id: string | null
          quantity: number | null
          reference_number: string | null
          service_date: string | null
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          load_id?: string | null
          quantity?: number | null
          reference_number?: string | null
          service_date?: string | null
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          load_id?: string | null
          quantity?: number | null
          reference_number?: string | null
          service_date?: string | null
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "daily_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          recorded_by: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          client_billing_profile_id: string | null
          client_name: string
          created_at: string | null
          created_by: string | null
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          quickbooks_invoice_id: string | null
          quickbooks_synced_at: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          client_billing_profile_id?: string | null
          client_name: string
          created_at?: string | null
          created_by?: string | null
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          quickbooks_invoice_id?: string | null
          quickbooks_synced_at?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          client_billing_profile_id?: string | null
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          quickbooks_invoice_id?: string | null
          quickbooks_synced_at?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_billing_profile_id_fkey"
            columns: ["client_billing_profile_id"]
            isOneToOne: false
            referencedRelation: "client_billing_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_interactions: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          created_by: string
          id: string
          lead_id: string
          note: string
        }
        Insert: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          created_by?: string
          id?: string
          lead_id: string
          note: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sequences: {
        Row: {
          created_at: string
          created_by: string
          email_delivery_status: string | null
          follow_up_date: string | null
          id: string
          lead_id: string
          manual_mode: boolean
          note: string | null
          response_status: string
          sent_at: string | null
          status: string
          step_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          email_delivery_status?: string | null
          follow_up_date?: string | null
          id?: string
          lead_id: string
          manual_mode?: boolean
          note?: string | null
          response_status?: string
          sent_at?: string | null
          status?: string
          step_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email_delivery_status?: string | null
          follow_up_date?: string | null
          id?: string
          lead_id?: string
          manual_mode?: boolean
          note?: string | null
          response_status?: string
          sent_at?: string | null
          status?: string
          step_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sequences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          avg_packages_day: number | null
          city_hub: string | null
          company_id: string | null
          company_name: string
          contact_person: string
          created_at: string
          created_by: string
          delivery_points: string | null
          delivery_radius_miles: number | null
          email: string | null
          enrichment_data: Json | null
          enrichment_source: string | null
          estimated_monthly_loads: number | null
          id: string
          industry: string | null
          main_lanes: string | null
          next_action_date: string | null
          phone: string | null
          service_type: string | null
          sla_requirement: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          avg_packages_day?: number | null
          city_hub?: string | null
          company_id?: string | null
          company_name: string
          contact_person: string
          created_at?: string
          created_by?: string
          delivery_points?: string | null
          delivery_radius_miles?: number | null
          email?: string | null
          enrichment_data?: Json | null
          enrichment_source?: string | null
          estimated_monthly_loads?: number | null
          id?: string
          industry?: string | null
          main_lanes?: string | null
          next_action_date?: string | null
          phone?: string | null
          service_type?: string | null
          sla_requirement?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          avg_packages_day?: number | null
          city_hub?: string | null
          company_id?: string | null
          company_name?: string
          contact_person?: string
          created_at?: string
          created_by?: string
          delivery_points?: string | null
          delivery_radius_miles?: number | null
          email?: string | null
          enrichment_data?: Json | null
          enrichment_source?: string | null
          estimated_monthly_loads?: number | null
          id?: string
          industry?: string | null
          main_lanes?: string | null
          next_action_date?: string | null
          phone?: string | null
          service_type?: string | null
          sla_requirement?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      load_geofence_events: {
        Row: {
          accuracy: number | null
          address_matched: string | null
          created_at: string | null
          driver_id: string | null
          event_type: string
          id: string
          latitude: number
          load_id: string | null
          longitude: number
          triggered_at: string | null
        }
        Insert: {
          accuracy?: number | null
          address_matched?: string | null
          created_at?: string | null
          driver_id?: string | null
          event_type: string
          id?: string
          latitude: number
          load_id?: string | null
          longitude: number
          triggered_at?: string | null
        }
        Update: {
          accuracy?: number | null
          address_matched?: string | null
          created_at?: string | null
          driver_id?: string | null
          event_type?: string
          id?: string
          latitude?: number
          load_id?: string | null
          longitude?: number
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "load_geofence_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_geofence_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "daily_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      load_messages: {
        Row: {
          created_at: string | null
          id: string
          load_id: string
          message: string
          read_by: string[] | null
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          load_id: string
          message: string
          read_by?: string[] | null
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          created_at?: string | null
          id?: string
          load_id?: string
          message?: string
          read_by?: string[] | null
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_messages_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "daily_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      load_status_events: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          load_id: string
          new_status: string
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          load_id: string
          new_status: string
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          load_id?: string
          new_status?: string
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "load_status_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "daily_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          read: boolean | null
          task_id: string | null
          title: string
          triggered_by: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          read?: boolean | null
          task_id?: string | null
          title: string
          triggered_by?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          read?: boolean | null
          task_id?: string | null
          title?: string
          triggered_by?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nurture_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pod_submissions: {
        Row: {
          captured_at: string
          created_at: string
          driver_id: string
          id: string
          lat: number | null
          lng: number | null
          load_id: string
          notes: string | null
          photo_url: string | null
          signature_url: string | null
          signed_at: string | null
          signer_name: string | null
        }
        Insert: {
          captured_at?: string
          created_at?: string
          driver_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          load_id: string
          notes?: string | null
          photo_url?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signer_name?: string | null
        }
        Update: {
          captured_at?: string
          created_at?: string
          driver_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          load_id?: string
          notes?: string | null
          photo_url?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pod_submissions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_submissions_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "daily_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          hub: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          hub?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          hub?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quickbooks_sync_log: {
        Row: {
          error_message: string | null
          id: string
          invoice_id: string | null
          qb_invoice_id: string | null
          qb_invoice_number: string | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          qb_invoice_id?: string | null
          qb_invoice_number?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          qb_invoice_id?: string | null
          qb_invoice_number?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_sync_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_tokens: {
        Row: {
          access_token: string
          access_token_expires_at: string
          connected_by: string | null
          created_at: string | null
          environment: string | null
          id: string
          realm_id: string
          refresh_token: string
          refresh_token_expires_at: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          access_token_expires_at: string
          connected_by?: string | null
          created_at?: string | null
          environment?: string | null
          id?: string
          realm_id: string
          refresh_token: string
          refresh_token_expires_at: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string
          connected_by?: string | null
          created_at?: string | null
          environment?: string | null
          id?: string
          realm_id?: string
          refresh_token?: string
          refresh_token_expires_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_cards: {
        Row: {
          base_rate: number
          created_by: string | null
          fuel_surcharge_pct: number
          hub: string
          id: string
          min_charge: number
          per_lb_rate: number
          per_mile_rate: number
          service_type: string
          updated_at: string | null
          vehicle_type: string
        }
        Insert: {
          base_rate?: number
          created_by?: string | null
          fuel_surcharge_pct?: number
          hub: string
          id?: string
          min_charge?: number
          per_lb_rate?: number
          per_mile_rate?: number
          service_type: string
          updated_at?: string | null
          vehicle_type: string
        }
        Update: {
          base_rate?: number
          created_by?: string | null
          fuel_surcharge_pct?: number
          hub?: string
          id?: string
          min_charge?: number
          per_lb_rate?: number
          per_mile_rate?: number
          service_type?: string
          updated_at?: string | null
          vehicle_type?: string
        }
        Relationships: []
      }
      route_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          created_at: string | null
          driver_id: string | null
          id: string
          is_read: boolean | null
          load_id: string | null
          message: string | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type: string
          created_at?: string | null
          driver_id?: string | null
          id?: string
          is_read?: boolean | null
          load_id?: string | null
          message?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string | null
          driver_id?: string | null
          id?: string
          is_read?: boolean | null
          load_id?: string | null
          message?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_alerts_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "daily_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_quotes: {
        Row: {
          base_rate: number
          created_at: string | null
          created_by: string | null
          distance_miles: number
          fuel_surcharge: number
          hub: string
          id: string
          lead_id: string | null
          margin_pct: number
          mileage_charge: number
          notes: string | null
          service_type: string
          stop_fee: number
          stops: number
          total_quote: number
          vehicle_type: string
          weight_charge: number
          weight_lbs: number
        }
        Insert: {
          base_rate?: number
          created_at?: string | null
          created_by?: string | null
          distance_miles?: number
          fuel_surcharge?: number
          hub: string
          id?: string
          lead_id?: string | null
          margin_pct?: number
          mileage_charge?: number
          notes?: string | null
          service_type: string
          stop_fee?: number
          stops?: number
          total_quote?: number
          vehicle_type: string
          weight_charge?: number
          weight_lbs?: number
        }
        Update: {
          base_rate?: number
          created_at?: string | null
          created_by?: string | null
          distance_miles?: number
          fuel_surcharge?: number
          hub?: string
          id?: string
          lead_id?: string | null
          margin_pct?: number
          mileage_charge?: number
          notes?: string | null
          service_type?: string
          stop_fee?: number
          stops?: number
          total_quote?: number
          vehicle_type?: string
          weight_charge?: number
          weight_lbs?: number
        }
        Relationships: [
          {
            foreignKeyName: "saved_quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_articles: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          task_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          task_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_lead_links: {
        Row: {
          id: string
          lead_id: string
          task_id: string
        }
        Insert: {
          id?: string
          lead_id: string
          task_id: string
        }
        Update: {
          id?: string
          lead_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_lead_links_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_lead_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          department: Database["public"]["Enums"]["department"] | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          department?: Database["public"]["Enums"]["department"] | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          department?: Database["public"]["Enums"]["department"] | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
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
      vehicle_car_washes: {
        Row: {
          created_at: string | null
          driver_id: string | null
          id: string
          notes: string | null
          recorded_by: string | null
          vehicle_id: string | null
          wash_date: string
        }
        Insert: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          recorded_by?: string | null
          vehicle_id?: string | null
          wash_date?: string
        }
        Update: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          recorded_by?: string | null
          vehicle_id?: string | null
          wash_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_car_washes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_car_washes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_inspections: {
        Row: {
          car_wash_done: boolean | null
          checklist: Json
          created_at: string | null
          driver_id: string | null
          id: string
          inspection_date: string
          notes: string | null
          odometer_reading: number
          photos: string[] | null
          reviewed_by: string | null
          status: string | null
          submitted_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          car_wash_done?: boolean | null
          checklist?: Json
          created_at?: string | null
          driver_id?: string | null
          id?: string
          inspection_date?: string
          notes?: string | null
          odometer_reading: number
          photos?: string[] | null
          reviewed_by?: string | null
          status?: string | null
          submitted_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          car_wash_done?: boolean | null
          checklist?: Json
          created_at?: string | null
          driver_id?: string | null
          id?: string
          inspection_date?: string
          notes?: string | null
          odometer_reading?: number
          photos?: string[] | null
          reviewed_by?: string | null
          status?: string | null
          submitted_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inspections_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenance: {
        Row: {
          completed_date: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          maintenance_type: string
          mileage_at_service: number | null
          next_service_date: string | null
          next_service_mileage: number | null
          notes: string | null
          scheduled_date: string | null
          service_date: string | null
          status: string | null
          updated_at: string | null
          vehicle_id: string | null
          vendor: string | null
        }
        Insert: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          maintenance_type: string
          mileage_at_service?: number | null
          next_service_date?: string | null
          next_service_mileage?: number | null
          notes?: string | null
          scheduled_date?: string | null
          service_date?: string | null
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          vendor?: string | null
        }
        Update: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          maintenance_type?: string
          mileage_at_service?: number | null
          next_service_date?: string | null
          next_service_mileage?: number | null
          notes?: string | null
          scheduled_date?: string | null
          service_date?: string | null
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
          vendor?: string | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          assigned_driver_id: string | null
          avg_mpg: number | null
          created_at: string | null
          created_by: string | null
          current_mileage: number | null
          daily_rate: number | null
          fuel_type: string | null
          hub: string
          id: string
          insurance_expiry: string | null
          license_plate: string | null
          make: string | null
          model: string | null
          name: string
          next_service_date: string | null
          next_service_mileage: number | null
          notes: string | null
          plate_number: string
          registration_expiry: string | null
          status: string
          type: string
          updated_at: string | null
          vehicle_name: string | null
          vehicle_type: string | null
          vin: string | null
          year: number | null
        }
        Insert: {
          assigned_driver_id?: string | null
          avg_mpg?: number | null
          created_at?: string | null
          created_by?: string | null
          current_mileage?: number | null
          daily_rate?: number | null
          fuel_type?: string | null
          hub: string
          id?: string
          insurance_expiry?: string | null
          license_plate?: string | null
          make?: string | null
          model?: string | null
          name: string
          next_service_date?: string | null
          next_service_mileage?: number | null
          notes?: string | null
          plate_number: string
          registration_expiry?: string | null
          status?: string
          type: string
          updated_at?: string | null
          vehicle_name?: string | null
          vehicle_type?: string | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          assigned_driver_id?: string | null
          avg_mpg?: number | null
          created_at?: string | null
          created_by?: string | null
          current_mileage?: number | null
          daily_rate?: number | null
          fuel_type?: string | null
          hub?: string
          id?: string
          insurance_expiry?: string | null
          license_plate?: string | null
          make?: string | null
          model?: string | null
          name?: string
          next_service_date?: string | null
          next_service_mileage?: number | null
          notes?: string | null
          plate_number?: string
          registration_expiry?: string | null
          status?: string
          type?: string
          updated_at?: string | null
          vehicle_name?: string | null
          vehicle_type?: string | null
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          id: string
          driver_id: string
          clock_in: string
          clock_out: string | null
          break_minutes: number | null
          total_minutes: number | null
          regular_hours: number | null
          overtime_hours: number | null
          total_pay: number | null
          hub: string
          shift: string
          work_date: string
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          driver_id: string
          clock_in?: string
          clock_out?: string | null
          break_minutes?: number | null
          total_minutes?: number | null
          regular_hours?: number | null
          overtime_hours?: number | null
          total_pay?: number | null
          hub?: string
          shift?: string
          work_date?: string
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          driver_id?: string
          clock_in?: string
          clock_out?: string | null
          break_minutes?: number | null
          total_minutes?: number | null
          regular_hours?: number | null
          overtime_hours?: number | null
          total_pay?: number | null
          hub?: string
          shift?: string
          work_date?: string
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      time_breaks: {
        Row: {
          id: string
          time_entry_id: string
          driver_id: string
          break_type: string
          break_start: string
          break_end: string | null
          break_minutes: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          time_entry_id: string
          driver_id: string
          break_type?: string
          break_start?: string
          break_end?: string | null
          break_minutes?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          time_entry_id?: string
          driver_id?: string
          break_type?: string
          break_start?: string
          break_end?: string | null
          break_minutes?: number | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_breaks_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_breaks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      v_active_clocks: {
        Row: {
          entry_id: string | null
          driver_id: string | null
          driver_name: string | null
          hourly_rate: number | null
          hub: string | null
          shift: string | null
          clock_in: string | null
          work_date: string | null
          elapsed_minutes: number | null
          on_break: boolean | null
          active_break_id: string | null
          break_minutes: number | null
        }
        Relationships: []
      }
      v_payroll_summary: {
        Row: {
          driver_id: string | null
          full_name: string | null
          hourly_rate: number | null
          hub: string | null
          week_start: string | null
          shifts: number | null
          total_work_minutes: number | null
          total_regular_hours: number | null
          total_overtime_hours: number | null
          total_pay: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      check_car_wash_due: { Args: never; Returns: undefined }
      clock_in_driver: {
        Args: { p_driver_id: string; p_hub: string; p_shift: string; p_notes?: string | null }
        Returns: Json
      }
      clock_out_driver: {
        Args: { p_entry_id: string; p_notes?: string | null }
        Returns: Json
      }
      confirm_blast_assignment: {
        Args: { p_blast_id: string; p_driver_id: string }
        Returns: Json
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      end_break: {
        Args: { p_break_id: string }
        Returns: Json
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      generate_invoice_number: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_active_blasts_for_driver: {
        Args: { p_driver_id: string }
        Returns: {
          blast_created: string
          blast_id: string
          blast_status: string
          client_name: string
          delivery_address: string
          delivery_company: string
          delivery_time: string
          description: string
          expires_at: string
          load_id: string
          message: string
          miles: number
          packages: number
          pickup_address: string
          pickup_company: string
          reference_number: string
          response_status: string
          revenue: number
          service_type: string
        }[]
      }
      get_driver_by_user: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string | null
          created_by: string | null
          device_token: string | null
          email: string | null
          full_name: string
          hired_date: string | null
          hourly_rate: number | null
          hub: string
          id: string
          license_expiry: string | null
          license_number: string | null
          notes: string | null
          phone: string
          status: string
          updated_at: string | null
          user_id: string | null
          vehicle_type: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "drivers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_driver_loads_today: {
        Args: { p_driver_id: string }
        Returns: {
          actual_delivery: string | null
          actual_pickup: string | null
          bol_url: string | null
          client_name: string | null
          collection_time: string | null
          comments: string | null
          consol_number: string | null
          created_at: string | null
          created_by: string | null
          current_eta: string | null
          deadhead_miles: number | null
          delivery_address: string | null
          delivery_company: string | null
          delivery_contact_name: string | null
          delivery_contact_phone: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_time: string | null
          description: string | null
          detention_billed: number | null
          detention_eligible: boolean | null
          dimensions_text: string | null
          dispatcher_id: string | null
          driver_id: string | null
          driver_pay: number | null
          end_time: string | null
          estimated_delivery: string | null
          estimated_pickup: string | null
          eta_status: string | null
          fuel_cost: number | null
          hub: string
          id: string
          inbound_tracking: string | null
          load_date: string
          miles: number | null
          outbound_tracking: string | null
          package_type: string | null
          packages: number | null
          pickup_address: string | null
          pickup_company: string | null
          pickup_contact_name: string | null
          pickup_contact_phone: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_open_hours: string | null
          po_number: string | null
          pod_confirmed: boolean | null
          reference_number: string
          requested_by: string | null
          revenue: number | null
          route_distance_meters: number | null
          route_duration_seconds: number | null
          service_type: string | null
          shift: string | null
          shipper_name: string | null
          signature_url: string | null
          signer_name: string | null
          sla_deadline: string | null
          start_time: string | null
          status: string
          tracking_token: string | null
          updated_at: string | null
          vehicle_id: string | null
          vehicle_required: string | null
          wait_time_minutes: number | null
          weight_kg: number | null
          weight_lbs: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_loads"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_driver_performance: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          avg_revenue_per_load: number
          delivered_loads: number
          driver_id: string
          driver_name: string
          failed_loads: number
          hub: string
          on_time_rate: number
          pod_compliance_rate: number
          total_loads: number
          total_miles: number
          total_revenue: number
        }[]
      }
      get_driver_positions: {
        Args: never
        Returns: {
          driver_id: string
          driver_name: string
          hub: string
          latitude: number
          longitude: number
          speed: number
          heading: number
          battery_pct: number | null
          is_moving: boolean
          active_load_id: string | null
          recorded_at: string
          shift_status: string
        }[]
      }
      get_driver_suggestion: {
        Args: { p_load_id: string; p_pickup_lat: number; p_pickup_lng: number; p_cutoff_time?: string | null }
        Returns: {
          driver_id: string
          driver_name: string
          distance_km: number
          active_loads_count: number
          eta_to_pickup_min: number
          eta_to_delivery_min: number
          estimated_arrival_at_delivery: string
          cutoff_margin_min: number | null
          can_meet_cutoff: boolean
          driver_status: string
          score: number
        }[]
      }
      get_driver_shift_summary: {
        Args: { p_date?: string; p_driver_id: string }
        Returns: Json
      }
      get_fleet_inspection_status: {
        Args: never
        Returns: {
          car_wash_overdue: boolean
          days_since_wash: number
          inspection_done: boolean
          inspection_status: string
          last_car_wash: string
          last_odometer: number
          plate: string
          vehicle_id: string
          vehicle_name: string
        }[]
      }
      get_last_contacts: {
        Args: never
        Returns: {
          lead_id: string
          last_contact: string
        }[]
      }
      get_load_by_tracking_token: { Args: { p_token: string }; Returns: Json }
      get_tracking_info: { Args: { p_token: string }; Returns: Json }
      get_uninvoiced_loads: {
        Args: never
        Returns: {
          client_name: string
          driver_id: string
          id: string
          load_date: string
          reference_number: string
          revenue: number
          service_type: string
          status: string
        }[]
      }
      get_unread_message_counts: {
        Args: { p_user_id: string }
        Returns: {
          load_id: string
          unread_count: number
        }[]
      }
      get_vehicle_odometer_history: {
        Args: { p_vehicle_id: string }
        Returns: {
          driver_name: string
          inspection_date: string
          odometer_reading: number
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_blast_stat: {
        Args: { p_blast_id: string; p_field: string }
        Returns: undefined
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_messages_read: {
        Args: { p_load_id: string; p_user_id: string }
        Returns: undefined
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      trigger_geofence_arrival: {
        Args: {
          p_accuracy?: number
          p_driver_id: string
          p_event_type: string
          p_latitude: number
          p_load_id: string
          p_longitude: number
        }
        Returns: Json
      }
      unlockrows: { Args: { "": string }; Returns: number }
      start_break: {
        Args: { p_entry_id: string; p_driver_id: string; p_type?: string }
        Returns: Json
      }
      update_load_status: {
        Args: {
          p_driver_id: string
          p_lat?: number
          p_lng?: number
          p_load_id: string
          p_notes?: string
          p_status: string
        }
        Returns: Json
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      upsert_driver_location: {
        Args: {
          p_accuracy?: number
          p_driver_id: string
          p_heading?: number
          p_lat: number
          p_lng: number
          p_speed?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      activity_type: "note" | "email" | "call" | "meeting"
      app_role: "owner" | "dispatcher" | "driver"
      department:
        | "onboarding"
        | "operations"
        | "prospecting"
        | "clients"
        | "marketing_growth"
        | "fleet_courier"
        | "finance"
      lead_stage:
        | "new_lead"
        | "first_contact"
        | "quote_sent"
        | "negotiation"
        | "account_won"
        | "qualified"
        | "operational_review"
        | "trial_run"
        | "account_active"
        | "retention"
      task_priority: "critical" | "high" | "medium" | "low"
      task_status: "todo" | "in_progress" | "done"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      activity_type: ["note", "email", "call", "meeting"],
      app_role: ["owner", "dispatcher", "driver"],
      department: [
        "onboarding",
        "operations",
        "prospecting",
        "clients",
        "marketing_growth",
        "fleet_courier",
        "finance",
      ],
      lead_stage: [
        "new_lead",
        "first_contact",
        "quote_sent",
        "negotiation",
        "account_won",
        "qualified",
        "operational_review",
        "trial_run",
        "account_active",
        "retention",
      ],
      task_priority: ["critical", "high", "medium", "low"],
      task_status: ["todo", "in_progress", "done"],
    },
  },
} as const
