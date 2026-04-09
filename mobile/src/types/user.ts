export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileRequest {
  full_name?: string | null;
  phone?: string | null;
  profile_image_url?: string | null;
}
