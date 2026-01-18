export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'doctor' | 'patient';
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  meeting_number: string;
  doctor_id: string;
  patient_id: string;
  scheduled_time: string;
  reason: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  room_id: string;
  created_at: string;
  doctor?: User;
  patient?: User;
}

export interface Consent {
  id: string;
  appointment_id: string;
  patient_id: string;
  status: 'pending' | 'granted' | 'denied';
  consent_text: string;
  granted_at?: string;
  created_at: string;
}

export interface Interview {
  id: string;
  appointment_id: string;
  recording_path?: string;
  transcript_path?: string;
  transcript_text?: string;
  summary_text?: string;
  key_points?: string;
  duration_seconds?: number;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}
