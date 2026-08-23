/**
 * Seed — synthetic golden dataset. NEVER real patient data.
 *
 * Creates: platform admin, verified organizations, verified + pending
 * practitioners, the golden patient (Rahul Sharma — rich 9-year history with
 * trending labs, a blood-group conflict, duplicate documents), a set of
 * additional synthetic patients, and one live consent grant so the doctor
 * portal has data on first run.
 *
 * Usage: npx tsx scripts/seed.ts   (resets all data first)
 */
import { sql } from "drizzle-orm";

async function main() {
  const { db } = await import("../src/server/db/index");
  const schema = await import("../src/server/db/schema");
  const { auth } = await import("../src/server/auth");
  const identity = await import("../src/server/modules/identity/verification");
  const { patientService } = await import("../src/server/modules/patients/service");
  const { records } = await import("../src/server/modules/records/service");
  const { ingestDocument } = await import("../src/server/modules/documents/pipeline");
  const { extraction } = await import("../src/server/modules/ai/extract");
  const { contradictionEngine } = await import("../src/server/modules/ai/contradictions");
  const { consent } = await import("../src/server/modules/consent/service");
  const { audit } = await import("../src/server/modules/audit/service");

  console.log("→ Resetting database…");
  const tableNames = [
    "ai_summary_claims", "ai_summaries", "audit_events", "conflicts",
    "emergency_access_events", "notifications", "search_chunks", "consents",
    "documents", "observations", "diagnostic_reports", "immunizations",
    "procedures", "medication_statements", "allergies", "conditions",
    "encounters", "patient_identifiers", "patients", "practitioner_verifications",
    "practitioners", "organization_verifications", "organizations",
    "verification", "account", "session", "user",
  ];
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${tableNames.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`),
  );

  /* ---------------------------------------------------------------- */
  const PASSWORD = "Password123!";

  async function makeUser(email: string, name: string, role: string, extra?: Record<string, unknown>) {
    const res = await auth.api.signUpEmail({
      body: {
        email,
        password: PASSWORD,
        name,
        ...(extra ?? {}),
      } as never,
    });
    const id = (res as { user?: { id: string } }).user?.id;
    if (!id) throw new Error(`Failed to create user ${email}`);
    // role is input:false in auth config (signups are patients by default);
    // seeding grants professional roles directly, mirroring admin grants.
    if (role !== "patient") {
      await db
        .update(schema.user)
        .set({ role: role as typeof schema.user.$inferSelect.role })
        .where(sql`${schema.user.id} = ${id}`);
    }
    return id;
  }

  console.log("→ Users…");
  const adminId = await makeUser("admin@medilink.health", "Platform Admin", "platform_admin");
  const meeraUserId = await makeUser("meera@medilink.health", "Dr. Meera Iyer", "doctor");
  const arjunUserId = await makeUser("arjun@medilink.health", "Dr. Arjun Rao", "doctor");
  const sanjayUserId = await makeUser("sanjay@medilink.health", "Dr. Sanjay Nair", "doctor");
  const labUserId = await makeUser("lab@sunrise.health", "Priya Kulkarni", "lab_staff");
  await makeUser("orgadmin@citygeneral.health", "Ravi Menon", "org_admin");
  const rahulUserId = await makeUser("rahul@example.com", "Rahul Sharma", "patient");

  console.log("→ Organizations…");
  const cityGeneral = await identity.createOrganization({
    createdByUserId: adminId,
    name: "City General Hospital",
    type: "hospital",
    registrationNumber: "CGH/2011/MH",
    city: "Pune",
    state: "Maharashtra",
  });
  const sunrise = await identity.createOrganization({
    createdByUserId: adminId,
    name: "Sunrise Diagnostics",
    type: "lab",
    registrationNumber: "SUN/2016/MH",
    city: "Pune",
    state: "Maharashtra",
  });
  const lakeview = await identity.createOrganization({
    createdByUserId: adminId,
    name: "Lakeview Cardiac Institute",
    type: "hospital",
    registrationNumber: "LCI/2014/KA",
    city: "Bengaluru",
    state: "Karnataka",
  });
  // Pending org → shows in admin queue
  await identity.createOrganization({
    createdByUserId: sanjayUserId,
    name: "Nandini Clinic",
    type: "clinic",
    registrationNumber: "NC/2022/MH",
    city: "Pune",
  });

  // Attach staff to their orgs
  const { user: userTable } = schema;
  const { eq } = await import("drizzle-orm");
  await db.update(userTable).set({ organizationId: cityGeneral.organization.id }).where(eq(userTable.id, meeraUserId));
  await db.update(userTable).set({ organizationId: sunrise.organization.id }).where(eq(userTable.id, labUserId));

  console.log("→ Practitioners…");
  const meera = await identity.submitPractitionerVerification({
    userId: meeraUserId,
    fullName: "Dr. Meera Iyer",
    registrationNumber: "MMC/2010/45231",
    council: "Maharashtra Medical Council",
    qualification: "MBBS, MD (Internal Medicine)",
    specialty: "Internal Medicine",
    organizationId: cityGeneral.organization.id,
  });
  await identity.submitPractitionerVerification({
    userId: arjunUserId,
    fullName: "Dr. Arjun Rao",
    registrationNumber: "KMC/2012/31088",
    council: "Karnataka Medical Council",
    qualification: "MBBS, MD, DM (Cardiology)",
    specialty: "Cardiology",
    organizationId: lakeview.organization.id,
  });
  // Pending practitioner → admin queue
  await identity.submitPractitionerVerification({
    userId: sanjayUserId,
    fullName: "Dr. Sanjay Nair",
    registrationNumber: "MMC/2019/51777",
    council: "Maharashtra Medical Council",
    qualification: "MBBS",
    specialty: "General Practice",
  });

  console.log("→ Golden patient (Rahul Sharma)…");
  const rahul = await patientService.create({
    fullName: "Rahul Sharma",
    dob: "1972-03-15",
    sex: "male",
    phone: "+91 98765 43210",
    bloodGroupSelfReported: "O+", // conflict: verified lab says B+
    addressCity: "Pune",
    emergencyContactName: "Kavita Sharma (wife)",
    emergencyContactPhone: "+91 98220 11223",
    userId: rahulUserId,
    createdById: adminId,
  });

  const provMeera = {
    authoredById: meeraUserId,
    organizationId: cityGeneral.organization.id,
    trust: "verified" as const,
  };
  const provArjun = {
    authoredById: arjunUserId,
    organizationId: lakeview.organization.id,
    trust: "verified" as const,
  };

  // Longitudinal history
  await records.addCondition(rahul.id, { name: "Essential hypertension", status: "chronic", onsetDate: "2017-06-10", notes: "Diagnosed at City General OPD." }, provMeera);
  await records.addCondition(rahul.id, { name: "Type 2 diabetes mellitus", status: "chronic", onsetDate: "2019-02-18" }, provMeera);
  await records.addCondition(rahul.id, { name: "Chronic kidney disease, stage 3", status: "active", onsetDate: "2024-08-02", notes: "Nephrology referral — declining eGFR." }, provMeera);
  await records.addAllergy(rahul.id, { substance: "Penicillin", criticality: "high", reaction: "Anaphylaxis (childhood)", onsetDate: "1985-01-01" }, provMeera);
  await records.addProcedure(rahul.id, { name: "Percutaneous coronary intervention (angioplasty) with drug-eluting stent", performedDate: "2022-11-08", outcome: "Uncomplicated", notes: "LAD lesion; done at Lakeview." }, provArjun);
  await records.addProcedure(rahul.id, { name: "Coronary angiography", performedDate: "2022-10-28", outcome: "Triple-vessel disease, LAD 90%" }, provArjun);

  await records.addEncounter(rahul.id, { type: "opd", reason: "Post-angioplasty follow-up", occurredAt: new Date("2023-05-12"), practitionerId: meera.practitioner.id }, provMeera);
  await records.addEncounter(rahul.id, { type: "opd", reason: "Diabetes + hypertension review", occurredAt: new Date("2026-07-14"), practitionerId: meera.practitioner.id }, provMeera);

  // Medications (current)
  const meds: Array<[string, string, string, string]> = [
    ["Metformin", "500 mg", "BD", "2019-02-18"],
    ["Telmisartan", "40 mg", "OD", "2017-06-10"],
    ["Atorvastatin", "10 mg", "HS", "2022-11-08"],
    ["Aspirin", "75 mg", "OD", "2022-11-08"],
    ["Clopidogrel", "75 mg", "OD", "2022-11-08"],
  ];
  for (const [medication, dose, frequency, startDate] of meds) {
    await records.addMedication(
      rahul.id,
      { medication, dose, frequency, startDate, status: "active", prescriberId: meera.practitioner.id },
      provMeera,
    );
  }
  // A stopped medication for history
  await records.addMedication(rahul.id, { medication: "Glimepiride", dose: "1 mg", frequency: "OD", startDate: "2020-04-01", endDate: "2022-06-15", status: "stopped" }, provMeera);

  /* ---------------------------------------------------------------- */
  console.log("→ Synthetic lab documents (running the real ingest pipeline)…");

  const labReports: Array<{ title: string; date: string; body: string }> = [
    {
      title: "HbA1c & Fasting Glucose — Apr 2023",
      date: "2023-04-12",
      body: `SUNRISE DIAGNOSTICS, Pune — Ref: SUN/2023/48112
Patient: Rahul Sharma   Age/Sex: 51/M   Referred by: Dr. Meera Iyer
Test                          Result      Unit        Reference
HbA1c                         7.2         %           4.0 - 5.6
Fasting Blood Sugar           142         mg/dL       70 - 100`,
    },
    {
      title: "HbA1c & Fasting Glucose — Apr 2024",
      date: "2024-04-10",
      body: `SUNRISE DIAGNOSTICS, Pune — Ref: SUN/2024/50331
Patient: Rahul Sharma   Age/Sex: 52/M   Referred by: Dr. Meera Iyer
Test                          Result      Unit        Reference
HbA1c                         7.8         %           4.0 - 5.6
Fasting Blood Sugar           168         mg/dL       70 - 100`,
    },
    {
      title: "HbA1c & Fasting Glucose — Apr 2025",
      date: "2025-04-09",
      body: `SUNRISE DIAGNOSTICS, Pune — Ref: SUN/2025/52990
Patient: Rahul Sharma   Age/Sex: 53/M
Test                          Result      Unit        Reference
HbA1c                         8.1         %           4.0 - 5.6
Fasting Blood Sugar           181         mg/dL       70 - 100`,
    },
    {
      title: "HbA1c & Fasting Glucose — Apr 2026",
      date: "2026-04-08",
      body: `SUNRISE DIAGNOSTICS, Pune — Ref: SUN/2026/55410
Patient: Rahul Sharma   Age/Sex: 54/M
Test                          Result      Unit        Reference
HbA1c                         8.4         %           4.0 - 5.6
Fasting Blood Sugar           196         mg/dL       70 - 100`,
    },
    {
      title: "Renal Function Panel — Jun 2024",
      date: "2024-06-21",
      body: `SUNRISE DIAGNOSTICS, Pune — Ref: SUN/2024/51877
Patient: Rahul Sharma   Age/Sex: 52/M
Test                          Result      Unit        Reference
Serum Creatinine             1.4         mg/dL       0.7 - 1.3
Blood Urea                   42          mg/dL       15 - 40
eGFR                         54          mL/min     > 90`,
    },
    {
      title: "Renal Function Panel — Jun 2026",
      date: "2026-06-30",
      body: `SUNRISE DIAGNOSTICS, Pune — Ref: SUN/2026/56002
Patient: Rahul Sharma   Age/Sex: 54/M
Test                          Result      Unit        Reference
Serum Creatinine             2.0         mg/dL       0.7 - 1.3
Blood Urea                   58          mg/dL       15 - 40
Serum Potassium              5.4         mmol/L      3.5 - 5.1`,
    },
    {
      title: "Lipid Profile — Nov 2022",
      date: "2022-11-20",
      body: `SUNRISE DIAGNOSTICS, Pune
Patient: Rahul Sharma   Age/Sex: 50/M
Test                          Result      Unit        Reference
LDL Cholesterol              112         mg/dL       < 100
HDL Cholesterol              35          mg/dL       40 - 60
Triglycerides                210         mg/dL       < 150
Total Cholesterol            189         mg/dL       < 200`,
    },
    {
      title: "CBC — Jul 2026",
      date: "2026-07-14",
      body: `CITY GENERAL HOSPITAL, Pune — Ref: CGH/2026/90231
Patient: Rahul Sharma   Age/Sex: 54/M
Test                          Result      Unit        Reference
Hemoglobin                   11.2        g/dL        13.0 - 17.0
Total Leucocyte Count        8900        /cumm       4000 - 11000
Platelet Count               230000      /cumm       150000 - 410000`,
    },
    {
      title: "Blood Group & Rh — Jan 2020",
      date: "2020-01-15",
      body: `SUNRISE DIAGNOSTICS, Pune — Ref: SUN/2020/40012
Patient: Rahul Sharma
Blood Group                  B Positive
Method: Slide agglutination`,
    },
    {
      title: "Discharge Summary — PCI (Nov 2022)",
      date: "2022-11-10",
      body: `LAKEVIEW CARDIAC INSTITUTE, Bengaluru — DISCHARGE SUMMARY
Patient: Rahul Sharma, 50/M (MRN LCI-88213). Admitted 2022-11-07, discharged 2022-11-10.
Chief complaint: exertional chest pain 3 months. Angiography: LAD 90%, RCA 60%.
Procedure: PCI to LAD with DES on 2022-11-08. Uncomplicated.
Discharge medications: Aspirin 75 OD, Clopidogrel 75 OD, Atorvastatin 10 HS, Metformin 500 BD, Telmisartan 40 OD.
Advice: cardiac rehab, review 6 weeks.`,
    },
  ];

  for (const report of labReports) {
    const bytes = new TextEncoder().encode(report.body);
    const doc = await ingestDocument({
      patientId: rahul.id,
      uploadedById: labUserId,
      organizationId: sunrise.organization.id,
      kind: report.title.includes("Discharge") ? "discharge_summary" : "lab_report",
      title: report.title,
      mimeType: "text/plain",
      bytes,
      recordedDate: report.date,
    });

    // Structured extraction from the real document
    const extracted = await extraction.fromText(report.body);
    if (extracted.labs.length || extracted.bloodGroup) {
      await records.addObservations(
        rahul.id,
        extracted.labs.map((l) => ({
          panel: l.panel,
          name: l.name,
          value: l.value ?? null,
          valueString: l.valueString ?? null,
          unit: l.unit ?? undefined,
          referenceRangeLow: l.referenceRangeLow ?? null,
          referenceRangeHigh: l.referenceRangeHigh ?? null,
          flag: l.flag,
          effectiveDate: report.date,
        })),
        {
          authoredById: labUserId,
          organizationId: sunrise.organization.id,
          sourceDocumentId: doc.id,
          trust: "extracted" as const,
          recordedAt: new Date(report.date),
        },
      );
    }
    if (extracted.bloodGroup) {
      // H4: extraction output is machine-read text → "extracted" (matches
      // runtime doctor-actions). The golden conflict demo (self-reported O+
      // vs lab B+) needs a *verified* lab value, so seed an explicit
      // practitioner-verified observation exactly like a real lab result.
      await records.addObservation(
        rahul.id,
        {
          panel: "Blood Group",
          name: "Blood Group",
          valueString: extracted.bloodGroup,
          effectiveDate: report.date,
          flag: "normal" as const,
        },
        {
          authoredById: labUserId,
          organizationId: sunrise.organization.id,
          trust: "verified" as const,
          recordedAt: new Date(report.date),
        },
      );
    }
  }

  // Duplicate upload → duplicate-document conflict
  const dupBody = labReports[3].body;
  await ingestDocument({
    patientId: rahul.id,
    uploadedById: labUserId,
    organizationId: sunrise.organization.id,
    kind: "lab_report",
    title: "HbA1c & Fasting Glucose — Apr 2026 (copy)",
    mimeType: "text/plain",
    bytes: new TextEncoder().encode(dupBody),
    recordedDate: "2026-04-08",
  });

  console.log("→ Contradiction engine…");
  const conflictsFound = await contradictionEngine.detect(rahul.id);
  console.log(`   ${conflictsFound} conflict(s) detected`);

  console.log("→ Consent…");
  // Rahul grants Dr. Meera full access (she is his treating physician)
  await consent.grant({
    patientId: rahul.id,
    patientUserId: rahulUserId,
    granteeType: "practitioner",
    granteePractitionerId: meera.practitioner.id,
    scopes: ["demographics", "conditions", "allergies", "medications", "lab_results", "imaging", "procedures", "documents"],
    purpose: "treatment",
    days: 7,
    granteeUserId: meeraUserId,
  });
  // Note: Dr. Arjun has NO grant — demo the request/grant flow with him.

  /* ---------------------------------------------------------------- */
  console.log("→ Additional synthetic patients…");
  const extraPatients: Array<{ name: string; dob: string; sex: string; city: string; phone: string }> = [
    { name: "Priya Deshpande", dob: "1985-11-02", sex: "female", city: "Pune", phone: "+91 98111 22334" },
    { name: "Vikram Malhotra", dob: "1968-01-27", sex: "male", city: "Delhi", phone: "+91 99887 66554" },
    { name: "Sunita Patil", dob: "1992-07-19", sex: "female", city: "Nashik", phone: "+91 97654 32110" },
    { name: "Mohammed Farooq", dob: "1979-04-30", sex: "male", city: "Hyderabad", phone: "+91 90000 12345" },
    { name: "Anjali Menon", dob: "1996-12-05", sex: "female", city: "Kochi", phone: "+91 93456 78901" },
    { name: "Rajesh Khanna", dob: "1958-09-14", sex: "male", city: "Mumbai", phone: "+91 98220 55667" },
    { name: "Fatima Sheikh", dob: "2001-03-08", sex: "female", city: "Pune", phone: "+91 89765 43212" },
    { name: "Suresh Kulkarni", dob: "1975-06-21", sex: "male", city: "Pune", phone: "+91 96500 11122" },
  ];
  for (const p of extraPatients) {
    const patient = await patientService.create({
      fullName: p.name,
      dob: p.dob,
      sex: p.sex,
      phone: p.phone,
      addressCity: p.city,
      createdById: adminId,
      organizationId: cityGeneral.organization.id,
    });
    // A couple of starter records so search shows variety
    await records.addCondition(patient.id, { name: "Hypothyroidism", status: "chronic", onsetDate: "2021-08-01" }, provMeera);
    await records.addObservation(
      patient.id,
      { panel: "Thyroid", name: "TSH", value: 6.8, unit: "µIU/mL", referenceRangeLow: 0.4, referenceRangeHigh: 4.0, flag: "high", effectiveDate: "2026-02-10" },
      { authoredById: labUserId, organizationId: sunrise.organization.id, trust: "extracted" },
    );
  }

  console.log("→ Pre-generating the golden patient's SBAR summary…");
  {
    const { summarizer } = await import("../src/server/modules/ai/summarize");
    const { ALL_SCOPES } = await import("../src/server/modules/consent/service");
    await summarizer.generate({
      patientId: rahul.id,
      requestedById: meeraUserId,
      scopes: [...ALL_SCOPES],
    });
  }

  console.log("→ Audit chain verification…");
  const broken = await audit.verifyChain();
  console.log(broken === null ? "   chain intact ✓" : `   CHAIN BROKEN at seq ${broken}`);

  console.log("\n✅ Seed complete.");
  console.log("   Sign in (password for all: Password123!)");
  console.log("   admin@medilink.health  — platform admin");
  console.log("   meera@medilink.health  — verified doctor (has consent for Rahul)");
  console.log("   arjun@medilink.health  — verified cardiologist (no consent yet)");
  console.log("   lab@sunrise.health     — lab staff, Sunrise Diagnostics");
  console.log("   rahul@example.com      — patient (Rahul Sharma)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
