/** Aadhaar KYC (`POST /api/v1/kyc/aadhaar`) response shapes. */

export interface AadhaarBankSeedingStatus {
  aadhaar_number: string;
  bank_name: string;
  bank_seeding_status: string;
  last_updated_date: string;
}

export interface AadhaarAuthenticationHistory {
  date: string;
  time: string;
  modality: string;
  status: string;
  aua_name: string;
  transaction_id: string;
  response_code: string;
  error_code: string;
}

export interface AadhaarUpdateHistory {
  name: string;
  date_of_birth: string;
  gender: string;
  mobile_number: string;
  email: string;
  address: string;
  date_of_enrolment_update: string;
  urn_eid: string;
  update_type: string;
  profile_image: string;
}

/** `responseData.data` of a successful `OTP_VALIDATE` call. */
export interface AadhaarKycData {
  name: string;
  date_of_birth: string;
  gender: string;
  aadhaar_number: string;
  address: string;
  care_of: string | null;
  pincode: string | null;
  state: string | null;
  district: string | null;
  sub_district: string | null;
  post_office: string | null;
  mobile_number: string | null;
  email: string | null;
  profile_image: string | null;
  vid: string | null;
  eid: string | null;
  bank_seeding_status: AadhaarBankSeedingStatus | null;
  authentication_history: AadhaarAuthenticationHistory[];
  aadhaar_update_history: AadhaarUpdateHistory[];
  is_biometric_enabled: string | null;
}

/** Request body discriminator for the Aadhaar KYC endpoint. */
export type AadhaarKycRequestType = 'GENERATE_OTP' | 'OTP_VALIDATE';

/** Stored Aadhaar KYC record with its verification stamps. */
export interface AadhaarKycRecord {
  aadhaar_kyc_data: {
    data: AadhaarKycData;
  } | null;
  /** Reverse-geocoded location captured when the KYC was performed. */
  kyc_address: string | null;
  verified_at: string | null;
  last_updated_at: string | null;
}

/** `responseData` of `GET /api/v1/kyc/aadhaar-kyc-data`. */
export interface AadhaarKycDataResponse {
  kyc: AadhaarKycRecord | null;
}
