/**
 * ChangeLog model for tracking changes to claims
 */
interface ChangeLog {
  id: number;
  claim_id: number;
  user_id: number | null;
  username: string;
  billing_id: number | null; // Renamed from cpt_id
  timestamp: Date;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

export default ChangeLog;