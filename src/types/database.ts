export type AccountType = 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Standard' | 'Premium' | 'VIP' | 'Entreprise';
export type MemberStatus = 'actif' | 'inactif' | 'suspendu';
export type CardStatus = 'active' | 'expiree' | 'revoquee' | 'en_attente';
export type VerificationResultType = 'valide' | 'expiree' | 'revoquee' | 'inconnue';
export type UserRole = 'admin' | 'agent';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  member_code: string;
  client_code?: string | null;
  first_name: string;
  last_name: string;
  account_type: AccountType;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  member_id: string;
  card_identifier: string;
  qr_token_hash: string;
  created_at: string;
  expires_at: string;
  status: CardStatus;
  revoked_at: string | null;
  renewed_from_card_id: string | null;
  created_by?: string | null;
  members?: Member;
}

export interface VerificationLog {
  id: string;
  card_id: string | null;
  result: VerificationResultType;
  verified_at: string;
  token_hash_lookup: string;
  ip_address_hash: string | null;
  user_agent: string | null;
  cards?: (Card & { members?: Member }) | null;
}

export interface VerificationResponse {
  success: boolean;
  result: VerificationResultType;
  message: string;
  card_identifier?: string;
  first_name?: string;
  last_name?: string;
  member_code?: string;
  account_type?: AccountType;
  created_at?: string;
  expires_at?: string;
  revoked_at?: string;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          full_name: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: Member;
        Insert: {
          id?: string;
          member_code?: string;
          first_name: string;
          last_name: string;
          account_type?: AccountType;
          status?: MemberStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_code?: string;
          first_name?: string;
          last_name?: string;
          account_type?: AccountType;
          status?: MemberStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cards: {
        Row: Card;
        Insert: {
          id?: string;
          member_id: string;
          card_identifier: string;
          qr_token_hash: string;
          created_at?: string;
          expires_at: string;
          status?: CardStatus;
          revoked_at?: string | null;
          renewed_from_card_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          member_id?: string;
          card_identifier?: string;
          qr_token_hash?: string;
          created_at?: string;
          expires_at?: string;
          status?: CardStatus;
          revoked_at?: string | null;
          renewed_from_card_id?: string | null;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cards_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          }
        ];
      };
      verification_logs: {
        Row: VerificationLog;
        Insert: {
          id?: string;
          card_id?: string | null;
          result: VerificationResultType;
          verified_at?: string;
          token_hash_lookup: string;
          ip_address_hash?: string | null;
          user_agent?: string | null;
        };
        Update: {
          id?: string;
          card_id?: string | null;
          result?: VerificationResultType;
          verified_at?: string;
          token_hash_lookup?: string;
          ip_address_hash?: string | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "verification_logs_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          }
        ];
      };
      member_code_counter: {
        Row: {
          id: number;
          last_sequence_number: number;
        };
        Insert: {
          id?: number;
          last_sequence_number: number;
        };
        Update: {
          id?: number;
          last_sequence_number?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      verify_card_by_token: {
        Args: {
          p_token_hash: string;
          p_ip_address_hash?: string;
          p_user_agent?: string;
        };
        Returns: Json;
      };
      create_member_atomic: {
        Args: {
          p_first_name: string;
          p_last_name: string;
          p_account_type?: AccountType;
        };
        Returns: Json;
      };
      generate_next_member_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      account_type_enum: AccountType;
      member_status_enum: MemberStatus;
      card_status_enum: CardStatus;
      verification_result_enum: VerificationResultType;
      user_role_enum: UserRole;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
