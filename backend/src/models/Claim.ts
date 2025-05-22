/**
 * Claim model representing the upl_billing_reimburse table structure
 */
interface Claim {
  id: number;
  patient_id: number;
  patient_emr_no: string;
  cpt_id: number; // Renamed from billing_id to cpt_id to match database
  cpt_code: string;
  service_start: string;
  service_end: string;
  icd_code: string;
  units: number;
  provider_name: string;
  oa_claim_id: string | null;
  oa_visit_id: string | null;
  charge_dt: string;
  charge_amt: number;
  allowed_amt: number | null;
  allowed_add_amt: number | null;
  allowed_exp_amt: number | null;
  prim_ins: string | null;
  prim_amt: number | null;
  prim_post_dt: string | null;
  prim_chk_det: string | null;
  prim_recv_dt: string | null;
  prim_chk_amt: number | null;
  prim_cmt: string | null;
  sec_ins: string | null;
  sec_amt: number | null;
  sec_post_dt: string | null;
  sec_chk_det: string | null;
  sec_recv_dt: string | null;
  sec_chk_amt: number | null;
  sec_cmt: string | null;
  pat_amt: number | null;
  pat_recv_dt: string | null;
  total_amt: number;
  charges_adj_amt: number | null;
  write_off_amt: number | null;
  bal_amt: number;
  reimb_pct: number | null;
  claim_status: string;
  claim_status_type: string | null;
}

export default Claim;