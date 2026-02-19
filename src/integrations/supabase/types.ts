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
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string
          hub: string
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
          hub: string
          id?: string
          name: string
          step_type: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          hub?: string
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
      notifications: {
        Row: {
          id: string
          user_id: string
          type: Database["public"]["Enums"]["notification_type"]
          title: string
          message: string
          task_id: string | null
          triggered_by: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type?: Database["public"]["Enums"]["notification_type"]
          title: string
          message: string
          task_id?: string | null
          triggered_by?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
          title?: string
          message?: string
          task_id?: string | null
          triggered_by?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      rate_cards: {
        Row: {
          id: string
          hub: string
          service_type: string
          vehicle_type: string
          base_rate: number
          per_mile_rate: number
          per_lb_rate: number
          min_charge: number
          fuel_surcharge_pct: number
          created_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          hub: string
          service_type: string
          vehicle_type: string
          base_rate?: number
          per_mile_rate?: number
          per_lb_rate?: number
          min_charge?: number
          fuel_surcharge_pct?: number
          created_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          hub?: string
          service_type?: string
          vehicle_type?: string
          base_rate?: number
          per_mile_rate?: number
          per_lb_rate?: number
          min_charge?: number
          fuel_surcharge_pct?: number
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_quotes: {
        Row: {
          id: string
          lead_id: string | null
          hub: string
          service_type: string
          vehicle_type: string
          distance_miles: number
          weight_lbs: number
          stops: number
          base_rate: number
          mileage_charge: number
          weight_charge: number
          fuel_surcharge: number
          stop_fee: number
          total_quote: number
          margin_pct: number
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id?: string | null
          hub: string
          service_type: string
          vehicle_type: string
          distance_miles?: number
          weight_lbs?: number
          stops?: number
          base_rate?: number
          mileage_charge?: number
          weight_charge?: number
          fuel_surcharge?: number
          stop_fee?: number
          total_quote?: number
          margin_pct?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string | null
          hub?: string
          service_type?: string
          vehicle_type?: string
          distance_miles?: number
          weight_lbs?: number
          stops?: number
          base_rate?: number
          mileage_charge?: number
          weight_charge?: number
          fuel_surcharge?: number
          stop_fee?: number
          total_quote?: number
          margin_pct?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
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
      drivers: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          email: string | null
          hub: string
          status: string
          license_number: string | null
          license_expiry: string | null
          hired_date: string | null
          hourly_rate: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          phone?: string | null
          email?: string | null
          hub?: string
          status?: string
          license_number?: string | null
          license_expiry?: string | null
          hired_date?: string | null
          hourly_rate?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          email?: string | null
          hub?: string
          status?: string
          license_number?: string | null
          license_expiry?: string | null
          hired_date?: string | null
          hourly_rate?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          id: string
          vehicle_name: string
          vehicle_type: string
          make: string | null
          model: string | null
          year: number | null
          vin: string | null
          license_plate: string | null
          hub: string
          status: string
          current_mileage: number
          next_service_mileage: number | null
          next_service_date: string | null
          insurance_expiry: string | null
          registration_expiry: string | null
          fuel_type: string
          avg_mpg: number | null
          daily_rate: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vehicle_name: string
          vehicle_type?: string
          make?: string | null
          model?: string | null
          year?: number | null
          vin?: string | null
          license_plate?: string | null
          hub?: string
          status?: string
          current_mileage?: number
          next_service_mileage?: number | null
          next_service_date?: string | null
          insurance_expiry?: string | null
          registration_expiry?: string | null
          fuel_type?: string
          avg_mpg?: number | null
          daily_rate?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vehicle_name?: string
          vehicle_type?: string
          make?: string | null
          model?: string | null
          year?: number | null
          vin?: string | null
          license_plate?: string | null
          hub?: string
          status?: string
          current_mileage?: number
          next_service_mileage?: number | null
          next_service_date?: string | null
          insurance_expiry?: string | null
          registration_expiry?: string | null
          fuel_type?: string
          avg_mpg?: number | null
          daily_rate?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          id: string
          driver_id: string
          latitude: number
          longitude: number
          accuracy: number | null
          speed: number | null
          heading: number | null
          altitude: number | null
          battery_pct: number | null
          is_moving: boolean
          active_load_id: string | null
          recorded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          latitude: number
          longitude: number
          accuracy?: number | null
          speed?: number | null
          heading?: number | null
          altitude?: number | null
          battery_pct?: number | null
          is_moving?: boolean
          active_load_id?: string | null
          recorded_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          latitude?: number
          longitude?: number
          accuracy?: number | null
          speed?: number | null
          heading?: number | null
          altitude?: number | null
          battery_pct?: number | null
          is_moving?: boolean
          active_load_id?: string | null
          recorded_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_active_load_id_fkey"
            columns: ["active_load_id"]
            isOneToOne: false
            referencedRelation: "daily_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_shifts: {
        Row: {
          id: string
          driver_id: string
          shift_start: string
          shift_end: string | null
          hub: string
          status: string
          start_lat: number | null
          start_lng: number | null
          end_lat: number | null
          end_lng: number | null
          total_miles: number
          created_at: string
        }
        Insert: {
          id?: string
          driver_id: string
          shift_start?: string
          shift_end?: string | null
          hub?: string
          status?: string
          start_lat?: number | null
          start_lng?: number | null
          end_lat?: number | null
          end_lng?: number | null
          total_miles?: number
          created_at?: string
        }
        Update: {
          id?: string
          driver_id?: string
          shift_start?: string
          shift_end?: string | null
          hub?: string
          status?: string
          start_lat?: number | null
          start_lng?: number | null
          end_lat?: number | null
          end_lng?: number | null
          total_miles?: number
          created_at?: string
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
      load_status_events: {
        Row: {
          id: string
          load_id: string
          driver_id: string
          old_status: string | null
          new_status: string
          latitude: number | null
          longitude: number | null
          note: string | null
          recorded_at: string
        }
        Insert: {
          id?: string
          load_id: string
          driver_id: string
          old_status?: string | null
          new_status: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          recorded_at?: string
        }
        Update: {
          id?: string
          load_id?: string
          driver_id?: string
          old_status?: string | null
          new_status?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_status_events_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "daily_loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_status_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_loads: {
        Row: {
          id: string
          load_date: string
          reference_number: string | null
          dispatcher_id: string | null
          driver_id: string | null
          vehicle_id: string | null
          shift: string
          hub: string
          client_name: string | null
          pickup_address: string | null
          delivery_address: string | null
          miles: number
          deadhead_miles: number
          start_time: string | null
          end_time: string | null
          wait_time_minutes: number
          revenue: number
          driver_pay: number
          fuel_cost: number
          status: string
          detention_eligible: boolean
          detention_billed: number
          service_type: string
          packages: number
          weight_lbs: number | null
          comments: string | null
          pod_confirmed: boolean
          tracking_token: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_email: string | null
          estimated_arrival: string | null
          route_order: number
          pickup_lat: number | null
          pickup_lng: number | null
          delivery_lat: number | null
          delivery_lng: number | null
          created_by: string | null
          created_at: string
          updated_at: string
          // Fields added 2026-02-18
          consol_number: string | null
          pickup_open_hours: string | null
          pickup_contact_name: string | null
          pickup_contact_phone: string | null
          delivery_contact_name: string | null
          delivery_contact_phone: string | null
          package_type: string | null
          weight_kg: number | null
          bol_url: string | null
        }
        Insert: {
          id?: string
          load_date?: string
          reference_number?: string | null
          dispatcher_id?: string | null
          driver_id?: string | null
          vehicle_id?: string | null
          shift?: string
          hub?: string
          client_name?: string | null
          pickup_address?: string | null
          delivery_address?: string | null
          miles?: number
          deadhead_miles?: number
          start_time?: string | null
          end_time?: string | null
          wait_time_minutes?: number
          revenue?: number
          driver_pay?: number
          fuel_cost?: number
          status?: string
          detention_eligible?: boolean
          detention_billed?: number
          service_type?: string
          packages?: number
          weight_lbs?: number | null
          comments?: string | null
          pod_confirmed?: boolean
          tracking_token?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_email?: string | null
          estimated_arrival?: string | null
          route_order?: number
          pickup_lat?: number | null
          pickup_lng?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          consol_number?: string | null
          pickup_open_hours?: string | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          delivery_contact_name?: string | null
          delivery_contact_phone?: string | null
          package_type?: string | null
          weight_kg?: number | null
          bol_url?: string | null
        }
        Update: {
          id?: string
          load_date?: string
          reference_number?: string | null
          dispatcher_id?: string | null
          driver_id?: string | null
          vehicle_id?: string | null
          shift?: string
          hub?: string
          client_name?: string | null
          pickup_address?: string | null
          delivery_address?: string | null
          miles?: number
          deadhead_miles?: number
          start_time?: string | null
          end_time?: string | null
          wait_time_minutes?: number
          revenue?: number
          driver_pay?: number
          fuel_cost?: number
          status?: string
          detention_eligible?: boolean
          detention_billed?: number
          service_type?: string
          packages?: number
          weight_lbs?: number | null
          comments?: string | null
          pod_confirmed?: boolean
          tracking_token?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_email?: string | null
          estimated_arrival?: string | null
          route_order?: number
          pickup_lat?: number | null
          pickup_lng?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          consol_number?: string | null
          pickup_open_hours?: string | null
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          delivery_contact_name?: string | null
          delivery_contact_phone?: string | null
          package_type?: string | null
          weight_kg?: number | null
          bol_url?: string | null
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
      vehicle_maintenance: {
        Row: {
          id: string
          vehicle_id: string
          maintenance_type: string
          description: string | null
          cost: number
          mileage_at_service: number | null
          service_date: string
          next_service_date: string | null
          next_service_mileage: number | null
          vendor: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          maintenance_type: string
          description?: string | null
          cost?: number
          mileage_at_service?: number | null
          service_date?: string
          next_service_date?: string | null
          next_service_mileage?: number | null
          vendor?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          maintenance_type?: string
          description?: string | null
          cost?: number
          mileage_at_service?: number | null
          service_date?: string
          next_service_date?: string | null
          next_service_mileage?: number | null
          vendor?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      load_documents: {
        Row: {
          id: string
          load_id: string
          document_type: string
          file_name: string
          file_path: string
          file_size_bytes: number
          mime_type: string | null
          notes: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          load_id: string
          document_type?: string
          file_name: string
          file_path: string
          file_size_bytes?: number
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          load_id?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_documents_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "daily_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      proof_of_delivery: {
        Row: {
          id: string
          load_id: string
          photo_paths: string[]
          signature_path: string | null
          recipient_name: string | null
          delivery_notes: string | null
          delivery_time: string | null
          status: string
          verified_by: string | null
          verified_at: string | null
          rejection_reason: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          submitted_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          load_id: string
          photo_paths?: string[]
          signature_path?: string | null
          recipient_name?: string | null
          delivery_notes?: string | null
          delivery_time?: string | null
          status?: string
          verified_by?: string | null
          verified_at?: string | null
          rejection_reason?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          submitted_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          load_id?: string
          photo_paths?: string[]
          signature_path?: string | null
          recipient_name?: string | null
          delivery_notes?: string | null
          delivery_time?: string | null
          status?: string
          verified_by?: string | null
          verified_at?: string | null
          rejection_reason?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          submitted_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proof_of_delivery_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "daily_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_rates: {
        Row: {
          id: string
          competitor_name: string
          hub: string
          vehicle_type: string
          service_type: string
          base_rate: number
          per_mile_rate: number
          fuel_surcharge_pct: number
          included_miles: number
          min_charge: number
          source: string
          source_url: string | null
          confidence: string
          notes: string | null
          effective_date: string
          expiration_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          competitor_name: string
          hub: string
          vehicle_type: string
          service_type?: string
          base_rate?: number
          per_mile_rate?: number
          fuel_surcharge_pct?: number
          included_miles?: number
          min_charge?: number
          source?: string
          source_url?: string | null
          confidence?: string
          notes?: string | null
          effective_date?: string
          expiration_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          competitor_name?: string
          hub?: string
          vehicle_type?: string
          service_type?: string
          base_rate?: number
          per_mile_rate?: number
          fuel_surcharge_pct?: number
          included_miles?: number
          min_charge?: number
          source?: string
          source_url?: string | null
          confidence?: string
          notes?: string | null
          effective_date?: string
          expiration_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      get_last_contacts: {
        Args: Record<string, never>
        Returns: {
          lead_id: string
          last_contact: string
        }[]
      }
      get_driver_positions: {
        Args: Record<string, never>
        Returns: {
          driver_id: string
          driver_name: string
          hub: string
          latitude: number
          longitude: number
          speed: number | null
          heading: number | null
          battery_pct: number | null
          is_moving: boolean
          active_load_id: string | null
          recorded_at: string
          shift_status: string
        }[]
      }
      get_tracking_info: {
        Args: {
          p_token: string
        }
        Returns: Json
      }
    }
    Enums: {
      activity_type: "note" | "email" | "call" | "meeting"
      app_role: "owner" | "dispatcher"
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
      notification_type: "task_assigned" | "task_updated" | "task_due_soon" | "task_overdue" | "task_completed" | "task_comment"
      task_priority: "critical" | "high" | "medium" | "low"
      task_status: "todo" | "in_progress" | "done"
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
      activity_type: ["note", "email", "call", "meeting"],
      app_role: ["owner", "dispatcher"],
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
      notification_type: ["task_assigned", "task_updated", "task_due_soon", "task_overdue", "task_completed", "task_comment"],
      task_priority: ["critical", "high", "medium", "low"],
      task_status: ["todo", "in_progress", "done"],
    },
  },
} as const
