import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { VisitClaim } from '../types/claim';
import { getSubmitClaimById } from '../services/uploadService';
import { formatDateString } from '../utils/format';

// Contract: we receive a VisitClaim-like object in location.state.submitClaim
// If absent, we can navigate back.
const SubmitFullProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation() as { state?: { submitClaim?: VisitClaim; raw?: any } };
  const [claim, setClaim] = useState<VisitClaim | null>(null);
  const [raw, setRaw] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.submitClaim) setClaim(location.state.submitClaim);
    if (location.state?.raw) setRaw(location.state.raw);
  }, [location.state]);

  // Fetch on mount if we don't have raw but we have id in URL
  useEffect(() => {
    async function load() {
      if (raw || !id) return;
      setLoading(true);
      setError(null);
      try {
        const row = await getSubmitClaimById(id);
        setRaw(row);
      } catch (e: any) {
        setError(e?.message || 'Failed to load submit claim');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, raw]);

  if (!claim && !raw) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-light-100 text-textDark pt-24">
        <div className="container mx-auto pb-12 px-4 md:px-6">
          <div className="mb-8 p-6 rounded-xl bg-white/95 backdrop-blur-sm border border-purple/20">
            <button onClick={() => navigate(-1)} className="text-purple hover:text-purple/80 flex items-center gap-1">
              <ChevronLeft size={18} />
              <span>Back</span>
            </button>
            {loading ? (
              <>
                <h1 className="text-2xl font-bold mt-4">Loading submit claim…</h1>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold mt-4">No claim data provided</h1>
                <p className="text-textDark/70 mt-2">Open this page from Submit Files results or ensure the URL contains an ID.</p>
                {error && <p className="text-error-600 mt-2">{error}</p>}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const row = (claim as any) || {};
  const submit: any = raw || (claim as any)?.__raw || {};
  const used = new Set<string>();
  const use = (...keys: string[]) => keys.forEach(k => used.add(k));
  const usePrefixWithIndex = (prefixes: string[], count: number) => {
    for (let i = 1; i <= count; i++) {
      prefixes.forEach(p => used.add(`${p}${i}`));
    }
  };

  // Collect CPT codes across service lines for header badge (no hooks to avoid hook order issues)
  const headerCptCodes = (() => {
    const codes: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const v = submit?.[`cpt${i}`];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        codes.push(String(v).trim());
      }
    }
    return Array.from(new Set(codes));
  })();

  // Simple formatters
  const fmtEmpty = (v: any) => v === undefined || v === null || v === '' ? '—' : v;
  const fmtCurrency = (v: any) => {
    if (v === undefined || v === null || v === '') return '—';
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sign = n < 0 ? '-' : '';
    return `${sign}$${s}`;
  };

  // Field as a stacked tile (label above value)
  const Field: React.FC<{ label: string; value: any; kind?: 'money' | 'text' | 'date' }> = ({ label, value, kind = 'text' }) => {
    // Heuristic: treat as date if explicitly marked, label suggests date, or value looks like ISO date
    const looksLikeDateKey = /(^|_|\b)(date|dob|dos|admit|discharge|service|birth|created|updated|submitted|received|from|to|filed|paid)(_|\b)/i.test(String(label));
    const looksLikeISO = typeof value === 'string' && /\d{4}-\d{2}-\d{2}T/.test(value);
    const isDate = kind === 'date' || looksLikeDateKey || looksLikeISO;
    const display = kind === 'money' ? fmtCurrency(value) : isDate ? formatDateString(value) : fmtEmpty(value);
    return (
      <div className="rounded-md border border-purple/10 bg-purple/5 px-3 py-2 min-h-[56px]">
        <div className="text-[11px] uppercase tracking-wide text-textDark/60">{label}</div>
        <div className="text-sm md:text-[15px] font-semibold text-textDark break-words mt-0.5">{display}</div>
      </div>
    );
  };

  // Collapsible section
  const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <div className="rounded-xl bg-white/90 backdrop-blur-sm border border-purple/20 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 md:px-6 py-3 md:py-4"
        >
          <h2 className="text-base md:text-lg font-semibold text-left">{title}</h2>
          {open ? <ChevronDown className="text-textDark/60" size={18} /> : <ChevronRight className="text-textDark/60" size={18} />}
        </button>
        {open && (
          <div className="px-4 md:px-6 pb-4 md:pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
          </div>
        )}
      </div>
    );
  };

  // Helpers to render multiple fields and mark them used
  const renderFields = (keys: Array<{ key: string; kind?: 'money'|'text'|'date' }>) => (
    <>
      {keys.map(({ key, kind }) => {
        use(key);
        return <Field key={key} label={key} value={submit[key]} kind={kind} />;
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-light-100 text-textDark pt-24">
      <div className="container mx-auto pb-12 px-4 md:px-6">
        <div className="mb-8 p-6 rounded-xl bg-white/95 backdrop-blur-sm border border-purple/20">
          <button onClick={() => navigate(-1)} className="text-purple hover:text-purple/80 flex items-center gap-1">
            <ChevronLeft size={18} />
            <span>Back to Submit Files</span>
          </button>
          <h1 className="text-3xl font-bold text-textDark mt-2">Submit Claim: {submit.bil_claim_submit_id || row.billing_id || row.claimId || row.id || 'N/A'}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="px-2.5 py-1 rounded-full bg-purple/10 text-purple-700">{row.patientName || [submit.patientfirst, submit.patientlast].filter(Boolean).join(' ') || 'Patient N/A'}</span>
            {headerCptCodes.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                CPT {headerCptCodes.slice(0, 2).join('/')}
              </span>
            )}
            {submit.totalcharges && <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Billed {fmtCurrency(submit.totalcharges)}</span>}
            {submit.claim_status && <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700">{String(submit.claim_status).toUpperCase()}</span>}
          </div>
        </div>

        <div className="space-y-4 md:space-y-6">
          <Section title="Patient">
            <Field label="Patient Name" value={row.patientName || [submit.patientfirst, submit.patientlast].filter(Boolean).join(' ')} />
            <Field label="Patient ID" value={row.memberId || submit.patient_id} />
            <Field label="Insurer ID (PatientID in XLS)" value={submit.insurerid} />
            <Field label="DOB" value={row.dateOfBirth || submit.patientdob} />
            <Field label="Gender" value={submit.patientmale ? 'M' : submit.patientfemale ? 'F' : ''} />
            <Field label="Phone" value={submit.patientphone} />
            <Field label="Address" value={[submit.patientstreetaddress, submit.patientcity, submit.patientstate, submit.patientzip].filter(Boolean).join(', ')} />
            {renderFields([
              { key: 'patientmidinit' },
              { key: 'patientrelationself' },
              { key: 'patientrelationspouse' },
              { key: 'patientrelationchild' },
              { key: 'patientrelationother' },
              { key: 'patientmaritalsingle' },
              { key: 'patientmaritalmarried' },
              { key: 'patientmaritalother' },
              { key: 'patientemploymentemployed' },
              { key: 'patientemploymentfulltimestudent' },
              { key: 'patientemploymentparttimestudent' },
            ])}
          </Section>
          {use('patientfirst','patientlast','patient_id','insurerid','patientdob','patientmale','patientfemale','patientphone','patientstreetaddress','patientcity','patientstate','patientzip')}

          <Section title="Keys and core identifiers">
            {renderFields([
              { key: 'bil_claim_submit_id' },
              { key: 'patient_id' },
              { key: 'clinic_id' },
              { key: 'patient_emr_no' },
              { key: 'cpt_code_id' },
              { key: 'cpt_code_id2' },
              { key: 'cpt_code_id3' },
              { key: 'oaupload' },
              { key: 'oa_fileid' },
              { key: 'oa_claimid' },
              { key: 'payor_reference_id' },
              { key: 'payor_status' },
              { key: 'payor_rejection_reason' },
            ])}
          </Section>
          {use('bil_claim_submit_id','oa_claimid','payor_reference_id','clinic_id')}

          <Section title="Insured">
            {renderFields([
              { key: 'insuredlast' }, { key: 'insuredfirst' }, { key: 'insuredmidinit' },
              { key: 'insureddob' }, { key: 'insuredgendermale' }, { key: 'insuredgenderfemale' },
              { key: 'insuredstreetaddress' }, { key: 'insuredcity' }, { key: 'insuredstate' }, { key: 'insuredzip' }, { key: 'insuredphone' },
              { key: 'insuredemployernam_orschoolname' }, { key: 'insuredinsuranceplannameorprogramname' }
            ])}
          </Section>
          {use('insuredlast','insuredfirst','insuredmidinit','insureddob','insuredgendermale','insuredgenderfemale','insuredstreetaddress','insuredcity','insuredstate','insuredzip','insuredphone','insuredemployernam_orschoolname','insuredinsuranceplannameorprogramname')}

          <Section title="Other insured">
            {renderFields([
              { key: 'otherinsuredlast' }, { key: 'otherinsuredfirst' }, { key: 'otherinsuredmidinit' },
              { key: 'otherinsuredpolicyorgroupnumber' }, { key: 'otherinsureddob' },
              { key: 'otherinsuredsexmale' }, { key: 'otherinsuredsexfemale' },
              { key: 'otherinsuredemlpoyernam_orschoolname' }, { key: 'otherinsuredinsuranceplanorprogramname' }
            ])}
          </Section>

          <Section title="Insurance plan and payer">
            {renderFields([
              { key: 'icd_indicator' },
              { key: 'insuranceplanname' }, { key: 'insurancepayerid' },
              { key: 'insurancestreetaddr' }, { key: 'insurancecity' }, { key: 'insurancestate' }, { key: 'insurancezip' }, { key: 'insurancecitystatezip' },
              { key: 'insurancephone' },
              { key: 'planmedicare' }, { key: 'planmedicaid' }, { key: 'planchampus' }, { key: 'planchampva' }, { key: 'plangrouphealthplan' }, { key: 'planfeca' }, { key: 'planother' },
            ])}
          </Section>
          {use('insuranceplanname','insurancepayerid','insurancephone','insurancestreetaddr','insurancecity','insurancestate','insurancezip','icd_indicator','insurancecitystatezip','planmedicare','planmedicaid','planchampus','planchampva','plangrouphealthplan','planfeca','planother')}

          <Section title="Condition and accident" defaultOpen={false}>
            {renderFields([
              { key: 'condtionrelatedtoemlpoymentyes' }, { key: 'condtionrelatedtoemlpoymentno' },
              { key: 'condtionrelatedtoautoaccidentyes' }, { key: 'condtionrelatedtoautoaccidentno' },
              { key: 'autoaccidentstate' },
              { key: 'condtionrelatedtootheraccidentyes' }, { key: 'condtionrelatedtootheraccidentno' },
              { key: 'reservedforlocaluse' },
            ])}
          </Section>

          <Section title="Policy and signatures (patient/insured)" defaultOpen={false}>
            {renderFields([
              { key: 'insuredpolicygrouporfecanumber' }, { key: 'patientsignature' }, { key: 'patientsignaturedate', kind: 'date' }, { key: 'insuredsignature' },
            ])}
          </Section>

          <Section title="Clinical timeline and hospitalization" defaultOpen={false}>
            {renderFields([
              { key: 'dateofcurrent' }, { key: 'dateofsimilarillness' }, { key: 'unabletoworkfromdate' }, { key: 'unabletoworktodate' },
              { key: 'hospitalizationfromdate' }, { key: 'hospitalizationtodate' }, { key: 'box19notes' },
            ])}
          </Section>

          <Section title="Referring/supervising providers" defaultOpen={false}>
            {renderFields([
              { key: 'referringphysician' }, { key: 'referphysqualifier' }, { key: 'referringphysicianid' }, { key: 'refer_phys_npi' }, { key: 'super_phys_npi' },
            ])}
          </Section>

          <Section title="Outside lab" defaultOpen={false}>
            {renderFields([
              { key: 'outsidelabchargesyes' }, { key: 'outsidelabchargesno' }, { key: 'outsidelabfees', kind: 'money' },
            ])}
          </Section>

          <Section title="Diagnosis codes">
            {renderFields([
              { key: 'diagcode1' }, { key: 'diagcode2' }, { key: 'diagcode3' }, { key: 'diagcode4' }, { key: 'diagcode5' }, { key: 'diagcode6' },
              { key: 'diagcode7' }, { key: 'diagcode8' }, { key: 'diagcode9' }, { key: 'diagcode10' }, { key: 'diagcode11' }, { key: 'diagcode12' },
              { key: 'medicaidresubcode' }, { key: 'medicaidrefnumber' }, { key: 'priorauthno' }, { key: 'hcfaclianumber' },
            ])}
          </Section>

          <Section title="Service Lines" defaultOpen={false}>
            <div className="col-span-full overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-textDark/70">
                    <th className="py-2 pr-4">Line</th>
                    <th className="py-2 pr-4">From</th>
                    <th className="py-2 pr-4">To</th>
                    <th className="py-2 pr-4">POS</th>
                    <th className="py-2 pr-4">EMG</th>
                    <th className="py-2 pr-4">CPT</th>
                    <th className="py-2 pr-4">Mods</th>
                    <th className="py-2 pr-4">Dx Ptr</th>
                    <th className="py-2 pr-4">Units</th>
                    <th className="py-2 pr-4">Charge</th>
                    <th className="py-2 pr-4">EPSDT</th>
                    <th className="py-2 pr-4">Rendering Qual</th>
                    <th className="py-2 pr-4">Rendering ID</th>
                    <th className="py-2 pr-0">Rendering NPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple/10">
      {[1,2,3,4,5,6].map(i => {
                    const has = submit[`cpt${i}`] || submit[`fromdateofservice${i}`] || submit[`charges${i}`];
                    if (!has) return null;
                    return (
                      <tr key={i}>
                        <td className="py-2 pr-4 font-medium">{i}</td>
        <td className="py-2 pr-4">{formatDateString(submit[`fromdateofservice${i}`])}</td>
        <td className="py-2 pr-4">{formatDateString(submit[`todateofservice${i}`])}</td>
                        <td className="py-2 pr-4">{fmtEmpty(submit[`placeofservice${i}`])}</td>
                        <td className="py-2 pr-4">{fmtEmpty(submit[`emg${i}`])}</td>
                        <td className="py-2 pr-4">{fmtEmpty(submit[`cpt${i}`])}</td>
                        <td className="py-2 pr-4">{fmtEmpty([submit[`modifiera${i}`], submit[`modifierb${i}`], submit[`modifierc${i}`], submit[`modifierd${i}`]].filter(Boolean).join(', '))}</td>
                        <td className="py-2 pr-4">{fmtEmpty(submit[`diagcodepointer${i}`])}</td>
                        <td className="py-2 pr-4">{fmtEmpty(submit[`units${i}`])}</td>
                        <td className="py-2 pr-4">{fmtCurrency(submit[`charges${i}`])}</td>
                        <td className="py-2 pr-4">{fmtEmpty(submit[`epsdt${i}`])}</td>
                        <td className="py-2 pr-4">{fmtEmpty(submit[`renderingphysqualifier${i}`])}</td>
                        <td className="py-2 pr-4">{fmtEmpty(submit[`renderingphysid${i}`])}</td>
                        <td className="py-2 pr-0">{fmtEmpty(submit[`renderingphysnpi${i}`])}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
          {usePrefixWithIndex(['fromdateofservice','todateofservice','placeofservice','emg','cpt','modifiera','modifierb','modifierc','modifierd','diagcodepointer','units','charges','epsdt','renderingphysqualifier','renderingphysid','renderingphysnpi'],6)}

          <Section title="Tax/assignment/accounting" defaultOpen={false}>
            {renderFields([
              { key: 'taxid' }, { key: 'ssn' }, { key: 'ein' }, { key: 'patientacctnumber' }, { key: 'acceptassignyes' }, { key: 'acceptassignno' },
            ])}
          </Section>

          <Section title="Totals and payments">
            <Field label="Billed Amount" value={row.billedAmount ?? submit.totalcharges} kind="money" />
            <Field label="Amount Paid" value={row.paidAmount ?? submit.amountpaid} kind="money" />
            <Field label="Balance Due" value={submit.balancedue} kind="money" />
          </Section>
          {use('totalcharges','amountpaid','balancedue')}

          <Section title="Physician, facility, supplier, provider meta" defaultOpen={false}>
            {renderFields([
              { key: 'physiciansignature' }, { key: 'physiciansignaturedate', kind: 'date' }, { key: 'physicianlast' }, { key: 'physicianfirst' }, { key: 'physicianmidinit' },
              { key: 'facilityname' }, { key: 'facilitystreetaddr' }, { key: 'facilitycity' }, { key: 'facilitystate' }, { key: 'facilityzip' }, { key: 'facilitycitystatezip' }, { key: 'facilitynpi' }, { key: 'facilityid' },
              { key: 'mammographycertification' },
              { key: 'suppliername' }, { key: 'supplierstreetaddr' }, { key: 'suppliercity' }, { key: 'supplierstate' }, { key: 'supplierzip' }, { key: 'suppliercitystatezip' }, { key: 'supplierphone' }, { key: 'suppliernpi' },
              { key: 'groupid' }, { key: 'billingprovidertype' },
            ])}
          </Section>

          <Section title="EDI/envelope and submission metadata" defaultOpen={false}>
            {renderFields([
              { key: 'isa_sender_id' }, { key: 'isa_receiver_id' }, { key: 'gs_functional_id' }, { key: 'submitter_contact_name' }, { key: 'submitter_contact_phone' }, { key: 'transaction_set_control_number' },
              { key: 'billing_provider_taxonomy_code' }, { key: 'billing_provider_tin_type' }, { key: 'referring_provider_taxonomy_code' }, { key: 'supervising_provider_name' }, { key: 'supervising_provider_npi' },
            ])}
          </Section>

          <Section title="Subscriber and COB" defaultOpen={false}>
            <Field label="Subscriber ID" value={submit.subscriber_id} />
            <Field label="Subscriber DOB" value={submit.subscriber_dob} />
            <Field label="Subscriber Gender" value={submit.subscriber_gender} />
            <Field label="Relationship to Subscriber" value={submit.patient_relationship_to_subscriber} />
            <Field label="COB Payer" value={[submit.cob_payer_name, submit.cob_payer_id].filter(Boolean).join(' / ')} />
            <Field label="COB Payment" value={fmtCurrency(submit.cob_payment_amount)} />
            <Field label="COB Adj" value={[submit.cob_adjustment_group_code, submit.cob_adjustment_reason_code, fmtCurrency(submit.cob_adjustment_amount)].filter(Boolean).join(' / ')} />
            <Field label="COB Payment Date" value={submit.cob_payment_date} />
            {renderFields([
              { key: 'service_line_control_number_1' }, { key: 'service_line_note_1' }, { key: 'emergency_indicator_1' }, { key: 'epsdt_indicator_1' },
            ])}
          </Section>
          {use('subscriber_id','subscriber_dob','subscriber_gender','patient_relationship_to_subscriber','cob_payer_name','cob_payer_id','cob_payment_amount','cob_adjustment_group_code','cob_adjustment_reason_code','cob_adjustment_amount','cob_payment_date','service_line_control_number_1','service_line_note_1','emergency_indicator_1','epsdt_indicator_1')}

          <Section title="Claim metadata and signatures" defaultOpen={false}>
            <Field label="Claim Frequency Code" value={submit.claim_frequency_code} />
            <Field label="Original Claim Ref#" value={submit.original_claim_reference_number} />
            <Field label="Patient Signature on File" value={submit.patient_signature_on_file} />
            <Field label="Provider Signature on File" value={submit.provider_signature_on_file} />
            <Field label="CLIA Number" value={submit.clia_number || submit.hcfaclianumber} />
          </Section>
          {use('claim_frequency_code','original_claim_reference_number','patient_signature_on_file','patientsignature','provider_signature_on_file','providersignature','physiciansignature','clia_number','hcfaclianumber')}

          <Section title="Upload/system/audit" defaultOpen={false}>
            {renderFields([
              { key: 'upload_id' }, { key: 'source_system' }, { key: 'office_ally_status' }, { key: 'office_ally_status_reason' }, { key: 'created_at' }, { key: 'content_sha256' },
            ])}
          </Section>

          {/* Raw views removed per request */}

          {/* Ensure nothing is missed: list all remaining columns alphabetically */}
          {submit && (
            (() => {
              const remaining = Object.keys(submit)
                .filter(k => !used.has(k))
                .sort((a,b) => a.localeCompare(b));
              if (remaining.length === 0) return null;
              return (
                <Section title={`Additional Fields (${remaining.length})`} defaultOpen={false}>
                  {remaining.map(k => (
                    <Field key={k} label={k} value={submit[k]} />
                  ))}
                </Section>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmitFullProfilePage;
