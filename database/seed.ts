import { PrismaClient, AuthProvider, FacilityType, HicsRole, IncidentType, IncidentSeverity, IncidentStatus, OperationalPeriodStatus, ObjectivePriority, NimsKind, ResourceStatus, ResourceSource, RequestStatus, RequestPriority, CostType, FemaPACategory, CostUnitPeriod } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Essential HICS database...\n');

  // ── Health System ──────────────────────────────────────────────────────────
  const healthSystem = await prisma.healthSystem.upsert({
    where: { id: 'a1b2c3d4-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'a1b2c3d4-0000-4000-8000-000000000001',
      name: 'Apex Regional Health System',
      shortName: 'ARHS',
      primaryContactEmail: 'admin@apexhealth.example',
      settings: {
        mfaPolicy: 'ADMIN_REQUIRED', // REQUIRED | ADMIN_REQUIRED | OPTIONAL
        maxConcurrentSessions: 3,
        passwordExpiryDays: 90,
        sessionTimeoutMinutes: 480, // 8 hours
      },
    },
  });
  console.log(`✅ Health system: ${healthSystem.name}`);

  // ── Facilities ────────────────────────────────────────────────────────────
  const facilityMain = await prisma.facility.upsert({
    where: { id: 'b1b2c3d4-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'b1b2c3d4-0000-4000-8000-000000000001',
      healthSystemId: healthSystem.id,
      name: 'Apex General Hospital',
      shortName: 'AGH',
      address: { street: '100 Medical Center Dr', city: 'Springfield', state: 'IL', zip: '62701' },
      phone: '217-555-0100',
      fax: '217-555-0101',
      licenseNumber: 'IL-HOSP-00123',
      facilityType: FacilityType.HOSPITAL,
      timezone: 'America/Chicago',
      emergencyContactName: 'Dr. Sarah Chen',
      emergencyContactPhone: '217-555-0199',
    },
  });

  const facilityClinic = await prisma.facility.upsert({
    where: { id: 'b1b2c3d4-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: 'b1b2c3d4-0000-4000-8000-000000000002',
      healthSystemId: healthSystem.id,
      name: 'Apex North Clinic',
      shortName: 'ANC',
      address: { street: '200 North Ave', city: 'Springfield', state: 'IL', zip: '62702' },
      phone: '217-555-0200',
      facilityType: FacilityType.CLINIC,
      timezone: 'America/Chicago',
      emergencyContactName: 'Dr. Marcus Webb',
      emergencyContactPhone: '217-555-0299',
    },
  });
  console.log(`✅ Facility 1: ${facilityMain.name}`);
  console.log(`✅ Facility 2: ${facilityClinic.name}`);

  // ── Departments ───────────────────────────────────────────────────────────
  const deptEmergency = await prisma.department.upsert({
    where: { id: 'c1b2c3d4-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'c1b2c3d4-0000-4000-8000-000000000001',
      facilityId: facilityMain.id,
      name: 'Emergency Department',
      code: 'ED',
    },
  });

  const deptAdmin = await prisma.department.upsert({
    where: { id: 'c1b2c3d4-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: 'c1b2c3d4-0000-4000-8000-000000000002',
      facilityId: facilityMain.id,
      name: 'Administration',
      code: 'ADMIN',
    },
  });

  // ── Generate credentials ──────────────────────────────────────────────────
  const SALT_ROUNDS = 12;

  const sysAdminPassword = `SysAdmin@${crypto.randomInt(1000, 9999)}!`;
  const facilityAdmin1Password = `FAdmin1@${crypto.randomInt(1000, 9999)}!`;
  const facilityAdmin2Password = `FAdmin2@${crypto.randomInt(1000, 9999)}!`;
  const icPassword = `IcUser@${crypto.randomInt(1000, 9999)}!`;

  const [sysAdminHash, fa1Hash, fa2Hash, icHash] = await Promise.all([
    bcrypt.hash(sysAdminPassword, SALT_ROUNDS),
    bcrypt.hash(facilityAdmin1Password, SALT_ROUNDS),
    bcrypt.hash(facilityAdmin2Password, SALT_ROUNDS),
    bcrypt.hash(icPassword, SALT_ROUNDS),
  ]);

  // ── Users ─────────────────────────────────────────────────────────────────
  const sysAdmin = await prisma.user.upsert({
    where: { email: 'sysadmin@apexhealth.example' },
    update: {},
    create: {
      id: 'd1b2c3d4-0000-4000-8000-000000000001',
      healthSystemId: healthSystem.id,
      email: 'sysadmin@apexhealth.example',
      firstName: 'System',
      lastName: 'Administrator',
      displayName: 'System Admin',
      jobTitle: 'System Administrator',
      passwordHash: sysAdminHash,
      authProvider: AuthProvider.LOCAL,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  const facilityAdmin1 = await prisma.user.upsert({
    where: { email: 'fadmin.agh@apexhealth.example' },
    update: {},
    create: {
      id: 'd1b2c3d4-0000-4000-8000-000000000002',
      healthSystemId: healthSystem.id,
      email: 'fadmin.agh@apexhealth.example',
      firstName: 'Jennifer',
      lastName: 'Torres',
      displayName: 'Jennifer Torres',
      jobTitle: 'Facility Administrator',
      employeeId: 'EMP-0001',
      passwordHash: fa1Hash,
      authProvider: AuthProvider.LOCAL,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  const facilityAdmin2 = await prisma.user.upsert({
    where: { email: 'fadmin.anc@apexhealth.example' },
    update: {},
    create: {
      id: 'd1b2c3d4-0000-4000-8000-000000000003',
      healthSystemId: healthSystem.id,
      email: 'fadmin.anc@apexhealth.example',
      firstName: 'Robert',
      lastName: 'Nguyen',
      displayName: 'Robert Nguyen',
      jobTitle: 'Facility Administrator',
      employeeId: 'EMP-0002',
      passwordHash: fa2Hash,
      authProvider: AuthProvider.LOCAL,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  const incidentCommander = await prisma.user.upsert({
    where: { email: 'dr.chen@apexhealth.example' },
    update: {},
    create: {
      id: 'd1b2c3d4-0000-4000-8000-000000000004',
      healthSystemId: healthSystem.id,
      email: 'dr.chen@apexhealth.example',
      firstName: 'Sarah',
      lastName: 'Chen',
      displayName: 'Dr. Sarah Chen',
      jobTitle: 'Chief Medical Officer',
      employeeId: 'EMP-0003',
      phoneMobile: '217-555-1234',
      passwordHash: icHash,
      authProvider: AuthProvider.LOCAL,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  console.log(`✅ Users created: ${sysAdmin.email}, ${facilityAdmin1.email}, ${facilityAdmin2.email}, ${incidentCommander.email}`);

  // ── Role assignments ──────────────────────────────────────────────────────
  await prisma.userFacilityRole.createMany({
    skipDuplicates: true,
    data: [
      // System admin gets SYSTEM_ADMIN role at both facilities
      {
        id: 'e1b2c3d4-0000-4000-8000-000000000001',
        userId: sysAdmin.id,
        facilityId: facilityMain.id,
        hicsRole: HicsRole.SYSTEM_ADMIN,
        isPrimaryFacility: true,
        assignedBy: sysAdmin.id,
      },
      {
        id: 'e1b2c3d4-0000-4000-8000-000000000002',
        userId: sysAdmin.id,
        facilityId: facilityClinic.id,
        hicsRole: HicsRole.SYSTEM_ADMIN,
        isPrimaryFacility: false,
        assignedBy: sysAdmin.id,
      },
      // Facility admins
      {
        id: 'e1b2c3d4-0000-4000-8000-000000000003',
        userId: facilityAdmin1.id,
        facilityId: facilityMain.id,
        hicsRole: HicsRole.FACILITY_ADMIN,
        isPrimaryFacility: true,
        assignedBy: sysAdmin.id,
      },
      {
        id: 'e1b2c3d4-0000-4000-8000-000000000004',
        userId: facilityAdmin2.id,
        facilityId: facilityClinic.id,
        hicsRole: HicsRole.FACILITY_ADMIN,
        isPrimaryFacility: true,
        assignedBy: sysAdmin.id,
      },
      // Incident commander
      {
        id: 'e1b2c3d4-0000-4000-8000-000000000005',
        userId: incidentCommander.id,
        facilityId: facilityMain.id,
        hicsRole: HicsRole.INCIDENT_COMMANDER,
        isPrimaryFacility: true,
        assignedBy: facilityAdmin1.id,
      },
    ],
  });

  // ── HICS Positions ────────────────────────────────────────────────────────
  const positions = [
    { hicsRole: HicsRole.INCIDENT_COMMANDER, displayName: 'Incident Commander', reportsToRole: null },
    { hicsRole: HicsRole.DEPUTY_INCIDENT_COMMANDER, displayName: 'Deputy Incident Commander', reportsToRole: HicsRole.INCIDENT_COMMANDER },
    { hicsRole: HicsRole.PUBLIC_INFORMATION_OFFICER, displayName: 'Public Information Officer', reportsToRole: HicsRole.INCIDENT_COMMANDER },
    { hicsRole: HicsRole.SAFETY_OFFICER, displayName: 'Safety Officer', reportsToRole: HicsRole.INCIDENT_COMMANDER },
    { hicsRole: HicsRole.LIAISON_OFFICER, displayName: 'Liaison Officer', reportsToRole: HicsRole.INCIDENT_COMMANDER },
    { hicsRole: HicsRole.MEDICAL_TECHNICAL_SPECIALIST, displayName: 'Medical Technical Specialist', reportsToRole: HicsRole.INCIDENT_COMMANDER },
    { hicsRole: HicsRole.OPERATIONS_SECTION_CHIEF, displayName: 'Operations Section Chief', reportsToRole: HicsRole.INCIDENT_COMMANDER },
    { hicsRole: HicsRole.PLANNING_SECTION_CHIEF, displayName: 'Planning Section Chief', reportsToRole: HicsRole.INCIDENT_COMMANDER },
    { hicsRole: HicsRole.LOGISTICS_SECTION_CHIEF, displayName: 'Logistics Section Chief', reportsToRole: HicsRole.INCIDENT_COMMANDER },
    { hicsRole: HicsRole.FINANCE_ADMIN_SECTION_CHIEF, displayName: 'Finance/Admin Section Chief', reportsToRole: HicsRole.INCIDENT_COMMANDER },
    { hicsRole: HicsRole.MEDICAL_CARE_BRANCH_DIRECTOR, displayName: 'Medical Care Branch Director', reportsToRole: HicsRole.OPERATIONS_SECTION_CHIEF },
    { hicsRole: HicsRole.INFRASTRUCTURE_BRANCH_DIRECTOR, displayName: 'Infrastructure Branch Director', reportsToRole: HicsRole.OPERATIONS_SECTION_CHIEF },
    { hicsRole: HicsRole.SECURITY_BRANCH_DIRECTOR, displayName: 'Security Branch Director', reportsToRole: HicsRole.OPERATIONS_SECTION_CHIEF },
    { hicsRole: HicsRole.RESOURCES_UNIT_LEADER, displayName: 'Resources Unit Leader', reportsToRole: HicsRole.PLANNING_SECTION_CHIEF },
    { hicsRole: HicsRole.SITUATION_UNIT_LEADER, displayName: 'Situation Unit Leader', reportsToRole: HicsRole.PLANNING_SECTION_CHIEF },
    { hicsRole: HicsRole.DOCUMENTATION_UNIT_LEADER, displayName: 'Documentation Unit Leader', reportsToRole: HicsRole.PLANNING_SECTION_CHIEF },
    { hicsRole: HicsRole.COMMUNICATIONS_UNIT_LEADER, displayName: 'Communications Unit Leader', reportsToRole: HicsRole.LOGISTICS_SECTION_CHIEF },
    { hicsRole: HicsRole.IT_SYSTEMS_UNIT_LEADER, displayName: 'IT Systems Unit Leader', reportsToRole: HicsRole.LOGISTICS_SECTION_CHIEF },
    { hicsRole: HicsRole.SUPPLY_UNIT_LEADER, displayName: 'Supply Unit Leader', reportsToRole: HicsRole.LOGISTICS_SECTION_CHIEF },
    { hicsRole: HicsRole.TIME_UNIT_LEADER, displayName: 'Time Unit Leader', reportsToRole: HicsRole.FINANCE_ADMIN_SECTION_CHIEF },
    { hicsRole: HicsRole.COST_UNIT_LEADER, displayName: 'Cost Unit Leader', reportsToRole: HicsRole.FINANCE_ADMIN_SECTION_CHIEF },
    { hicsRole: HicsRole.RESPONDER, displayName: 'Responder', reportsToRole: null },
  ];

  for (const pos of positions) {
    await prisma.position.upsert({
      where: {
        id: `f1b2c3d4-0000-4000-8000-${pos.hicsRole.slice(0, 12).padEnd(12, '0').toLowerCase().replace(/[^a-z0-9]/g, '0')}`,
      },
      update: {},
      create: {
        facilityId: facilityMain.id,
        hicsRole: pos.hicsRole,
        displayName: pos.displayName,
        reportsToRole: pos.reportsToRole,
      },
    });
  }

  console.log(`✅ HICS positions seeded for ${facilityMain.shortName}`);

  // ── Print credentials ─────────────────────────────────────────────────────
  // ── Phase 2: IAP Templates ────────────────────────────────────────────────
  const mciTemplate = await prisma.iapTemplate.upsert({
    where: { id: 'tmpl0001-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'tmpl0001-0000-4000-8000-000000000001',
      name: 'Mass Casualty Incident (MCI)',
      description: 'Standard template for multi-casualty events. Pre-fills ICS-202 objectives and ICS-215 hazard analysis.',
      healthSystemId: healthSystem.id,
      facilityId: facilityMain.id,
      createdById: facilityAdmin1.id,
    },
  });

  await prisma.iapTemplateFormDefault.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'tfd00001-0000-4000-8000-000000000001',
        templateId: mciTemplate.id,
        formNumber: '202',
        defaults: {
          incidentObjectives: '<p>1. Provide immediate life-saving care to all patients</p><p>2. Establish triage and treatment areas</p><p>3. Ensure clear communication with receiving hospitals</p><p>4. Document all patients and treatments</p>',
          generalSafety: '<p>All responders must wear appropriate PPE. No unauthorized personnel in the treatment zone.</p>',
          weatherForecast: '<p>Check local NWS forecast at time of incident.</p>',
          siteAccessEgress: '<p>Primary access: Main Emergency Department entrance. Egress: Side loading dock.</p>',
        },
      },
      {
        id: 'tfd00001-0000-4000-8000-000000000002',
        templateId: mciTemplate.id,
        formNumber: '215',
        defaults: {
          hazardRisk: '<p>Blood-borne pathogen exposure, secondary contamination from HAZMAT, crowd control risk</p>',
          countermeasures: '<p>PPE required for all clinical staff. Decontamination corridor established prior to patient entry.</p>',
          siteSafetyPlanRequired: 'YES',
        },
      },
    ],
  });

  const fireTemplate = await prisma.iapTemplate.upsert({
    where: { id: 'tmpl0002-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'tmpl0002-0000-4000-8000-000000000001',
      name: 'Internal Fire / Evacuation',
      description: 'Template for internal facility fires requiring partial or full evacuation.',
      healthSystemId: healthSystem.id,
      facilityId: facilityMain.id,
      createdById: facilityAdmin1.id,
    },
  });

  const utilityTemplate = await prisma.iapTemplate.upsert({
    where: { id: 'tmpl0003-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'tmpl0003-0000-4000-8000-000000000001',
      name: 'Utility Failure (Power / IT)',
      description: 'Template for major power outages or IT system failures affecting clinical operations.',
      healthSystemId: healthSystem.id,
      facilityId: null, // system-wide
      createdById: sysAdmin.id,
    },
  });

  console.log(`✅ IAP templates: ${mciTemplate.name}, ${fireTemplate.name}, ${utilityTemplate.name}`);

  // ── Phase 2: Objectives Bank ──────────────────────────────────────────────
  await prisma.objectivesBank.createMany({
    skipDuplicates: true,
    data: [
      { id: 'obj00001-0000-4000-8000-000000000001', healthSystemId: healthSystem.id, objectiveText: 'Establish and maintain unified command within 30 minutes of incident declaration.', priority: ObjectivePriority.CRITICAL, tags: ['command', 'general'], createdById: sysAdmin.id },
      { id: 'obj00001-0000-4000-8000-000000000002', healthSystemId: healthSystem.id, objectiveText: 'Account for all staff and patients within the affected area within 60 minutes.', priority: ObjectivePriority.HIGH, tags: ['accountability', 'general'], createdById: sysAdmin.id },
      { id: 'obj00001-0000-4000-8000-000000000003', healthSystemId: healthSystem.id, objectiveText: 'Maintain documentation of all actions and patient movements throughout the incident.', priority: ObjectivePriority.MEDIUM, tags: ['documentation', 'general'], createdById: sysAdmin.id },
      { id: 'obj00001-0000-4000-8000-000000000004', healthSystemId: healthSystem.id, objectiveText: 'Ensure all responders are briefed on safety hazards and PPE requirements before entering the scene.', priority: ObjectivePriority.CRITICAL, tags: ['safety', 'general'], createdById: sysAdmin.id },
      { id: 'obj00001-0000-4000-8000-000000000005', healthSystemId: healthSystem.id, objectiveText: 'Activate mutual aid agreements if patient surge exceeds 120% of capacity.', priority: ObjectivePriority.HIGH, tags: ['surge', 'mci'], createdById: facilityAdmin1.id },
      { id: 'obj00001-0000-4000-8000-000000000006', healthSystemId: healthSystem.id, objectiveText: 'Establish patient decontamination corridor prior to allowing entry to the emergency department.', priority: ObjectivePriority.CRITICAL, tags: ['decon', 'hazmat', 'mci'], createdById: facilityAdmin1.id },
      { id: 'obj00001-0000-4000-8000-000000000007', healthSystemId: healthSystem.id, objectiveText: 'Complete patient census and bed availability report within 15 minutes of activation.', priority: ObjectivePriority.HIGH, tags: ['census', 'capacity'], createdById: facilityAdmin1.id },
      { id: 'obj00001-0000-4000-8000-000000000008', healthSystemId: healthSystem.id, objectiveText: 'Notify all off-duty staff using the emergency notification system within 1 hour of declaration.', priority: ObjectivePriority.MEDIUM, tags: ['notification', 'staffing'], createdById: sysAdmin.id },
      { id: 'obj00001-0000-4000-8000-000000000009', healthSystemId: healthSystem.id, objectiveText: 'Maintain continuous situational awareness reports every 30 minutes to IC and section chiefs.', priority: ObjectivePriority.MEDIUM, tags: ['communications', 'general'], createdById: sysAdmin.id },
      { id: 'obj00001-0000-4000-8000-000000000010', healthSystemId: healthSystem.id, objectiveText: 'Initiate cost tracking for all incident-related expenditures from the time of declaration.', priority: ObjectivePriority.LOW, tags: ['finance', 'fema'], createdById: sysAdmin.id },
    ],
  });
  console.log('✅ 10 objectives seeded in objectives bank');

  // ── Phase 2: Tactics Bank ─────────────────────────────────────────────────
  await prisma.tacticsBank.createMany({
    skipDuplicates: true,
    data: [
      { id: 'tac00001-0000-4000-8000-000000000001', healthSystemId: healthSystem.id, tacticText: 'Deploy START triage tags to all clinical staff in the ED within 10 minutes.', tags: ['triage', 'mci'], createdById: facilityAdmin1.id },
      { id: 'tac00001-0000-4000-8000-000000000002', healthSystemId: healthSystem.id, tacticText: 'Stand up a family reunification area in the main lobby with a designated staff member.', tags: ['family', 'general'], createdById: sysAdmin.id },
      { id: 'tac00001-0000-4000-8000-000000000003', healthSystemId: healthSystem.id, tacticText: 'Redirect all non-emergency ambulances to alternate receiving hospitals via EMS coordinator.', tags: ['diversion', 'surge', 'mci'], createdById: facilityAdmin1.id },
      { id: 'tac00001-0000-4000-8000-000000000004', healthSystemId: healthSystem.id, tacticText: 'Activate Generator Test Protocol and verify all critical systems on backup power.', tags: ['utility', 'power'], createdById: sysAdmin.id },
      { id: 'tac00001-0000-4000-8000-000000000005', healthSystemId: healthSystem.id, tacticText: 'Establish a Joint Information Center (JIC) in the administrative conference room for media.', tags: ['media', 'pio', 'communications'], createdById: sysAdmin.id },
    ],
  });
  console.log('✅ 5 tactics seeded in tactics bank');

  // ── Phase 2: Sample Incident + Operational Periods + IAP ─────────────────
  const sampleIncident = await prisma.incident.upsert({
    where: { id: 'inc00001-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'inc00001-0000-4000-8000-000000000001',
      facilityId: facilityMain.id,
      healthSystemId: healthSystem.id,
      incidentNumber: 'APGE-2026-0001',
      name: 'Code Yellow — Mass Casualty (MCI Drill)',
      incidentType: IncidentType.MASS_CASUALTY,
      status: IncidentStatus.ACTIVE,
      severity: IncidentSeverity.LEVEL_2,
      declarationTime: new Date('2026-05-02T09:00:00Z'),
      location: 'Emergency Department — Parking Lot B',
      description: 'Multi-vehicle accident resulting in 12 patients. Drill exercise.',
      isExercise: true,
      createdById: facilityAdmin1.id,
      incidentCommanderId: incidentCommander.id,
    },
  });

  const period1 = await prisma.operationalPeriod.upsert({
    where: { id: 'op000001-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'op000001-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      periodNumber: 1,
      startTime: new Date('2026-05-02T09:00:00Z'),
      endTime: new Date('2026-05-02T21:00:00Z'),
      objectives: 'Establish command, triage all patients, initiate treatment.',
      status: OperationalPeriodStatus.ACTIVE,
      createdById: facilityAdmin1.id,
    },
  });

  const sampleIap = await prisma.iap.upsert({
    where: { id: 'iap00001-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'iap00001-0000-4000-8000-000000000001',
      operationalPeriodId: period1.id,
      status: 'DRAFT',
      completenessScore: 0,
      createdById: facilityAdmin1.id,
    },
  });

  // Seed position assignments for the sample incident
  await prisma.incidentPositionAssignment.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'ipa00001-0000-4000-8000-000000000001',
        incidentId: sampleIncident.id,
        hicsRole: HicsRole.INCIDENT_COMMANDER,
        assignedUserId: incidentCommander.id,
        assignedById: facilityAdmin1.id,
        isActive: true,
      },
    ],
  });

  console.log(`✅ Sample incident: ${sampleIncident.name} (${sampleIncident.incidentNumber})`);
  console.log(`✅ Operational Period 1 + Draft IAP created`);

  // ── Print credentials ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('SEEDED USER CREDENTIALS (save these — shown once)');
  console.log('═'.repeat(60));
  console.log(`SYSTEM_ADMIN   | sysadmin@apexhealth.example    | ${sysAdminPassword}`);
  console.log(`FACILITY_ADMIN | fadmin.agh@apexhealth.example   | ${facilityAdmin1Password}`);
  console.log(`FACILITY_ADMIN | fadmin.anc@apexhealth.example   | ${facilityAdmin2Password}`);
  console.log(`INCIDENT_CMD   | dr.chen@apexhealth.example      | ${icPassword}`);
  console.log('═'.repeat(60));
  // ── Phase 3: Resource Catalog ─────────────────────────────────────────────
  const resourceTypes = await Promise.all([
    prisma.resourceType.upsert({
      where: { id: 'rt000001-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: 'rt000001-0000-4000-8000-000000000001',
        facilityId: facilityMain.id,
        name: 'RN Nurse',
        nimsKind: NimsKind.PERSONNEL,
        nimsType: 'Type I',
        unit: 'hour',
        defaultCostPerUnit: new Decimal('75.00'),
        description: 'Registered nurse, any specialty',
      },
    }),
    prisma.resourceType.upsert({
      where: { id: 'rt000002-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: 'rt000002-0000-4000-8000-000000000001',
        facilityId: facilityMain.id,
        name: 'Physician (MD/DO)',
        nimsKind: NimsKind.PERSONNEL,
        nimsType: 'Type I',
        unit: 'hour',
        defaultCostPerUnit: new Decimal('175.00'),
        description: 'Licensed physician',
      },
    }),
    prisma.resourceType.upsert({
      where: { id: 'rt000003-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: 'rt000003-0000-4000-8000-000000000001',
        facilityId: facilityMain.id,
        name: 'Portable Generator (50kW)',
        nimsKind: NimsKind.EQUIPMENT,
        nimsType: 'Type II',
        unit: 'day',
        defaultCostPerUnit: new Decimal('850.00'),
        description: '50 kW diesel portable generator',
      },
    }),
    prisma.resourceType.upsert({
      where: { id: 'rt000004-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: 'rt000004-0000-4000-8000-000000000001',
        facilityId: facilityMain.id,
        name: 'Ambulance (ALS)',
        nimsKind: NimsKind.EQUIPMENT,
        nimsType: 'Type I',
        unit: 'hour',
        defaultCostPerUnit: new Decimal('125.00'),
        description: 'Advanced Life Support ambulance',
      },
    }),
    prisma.resourceType.upsert({
      where: { id: 'rt000005-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: 'rt000005-0000-4000-8000-000000000001',
        facilityId: facilityMain.id,
        name: 'N95 Respirator Mask',
        nimsKind: NimsKind.SUPPLY,
        unit: 'each',
        defaultCostPerUnit: new Decimal('2.50'),
        description: 'NIOSH-approved N95 filtering facepiece',
      },
    }),
    prisma.resourceType.upsert({
      where: { id: 'rt000006-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: 'rt000006-0000-4000-8000-000000000001',
        facilityId: facilityMain.id,
        name: 'IV Fluid (NS 1L)',
        nimsKind: NimsKind.SUPPLY,
        unit: 'bag',
        defaultCostPerUnit: new Decimal('4.75'),
        description: 'Normal saline 1-liter IV bag',
      },
    }),
    prisma.resourceType.upsert({
      where: { id: 'rt000007-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: 'rt000007-0000-4000-8000-000000000001',
        facilityId: facilityMain.id,
        name: 'Stretcher / Gurney',
        nimsKind: NimsKind.EQUIPMENT,
        unit: 'each',
        defaultCostPerUnit: new Decimal('50.00'),
        description: 'Standard wheeled patient stretcher',
      },
    }),
    prisma.resourceType.upsert({
      where: { id: 'rt000008-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: 'rt000008-0000-4000-8000-000000000001',
        facilityId: facilityMain.id,
        name: 'Incident Command Vehicle',
        nimsKind: NimsKind.EQUIPMENT,
        nimsType: 'Type I',
        unit: 'day',
        defaultCostPerUnit: new Decimal('400.00'),
        description: 'Mobile command post vehicle',
      },
    }),
    prisma.resourceType.upsert({
      where: { id: 'rt000009-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: 'rt000009-0000-4000-8000-000000000001',
        facilityId: facilityMain.id,
        name: 'DMAT Team (10-person)',
        nimsKind: NimsKind.TEAM,
        nimsType: 'Type II',
        unit: 'day',
        defaultCostPerUnit: new Decimal('12000.00'),
        description: 'Disaster Medical Assistance Team',
      },
    }),
    prisma.resourceType.upsert({
      where: { id: 'rt000010-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: 'rt000010-0000-4000-8000-000000000001',
        facilityId: facilityMain.id,
        name: 'Portable Water Purification Unit',
        nimsKind: NimsKind.EQUIPMENT,
        nimsType: 'Type III',
        unit: 'day',
        defaultCostPerUnit: new Decimal('600.00'),
        description: '500 GPH portable reverse-osmosis unit',
      },
    }),
  ]);
  console.log(`✅ Resource catalog: ${resourceTypes.length} types`);

  // Inventory for selected types
  await prisma.facilityResourceInventory.createMany({
    skipDuplicates: true,
    data: [
      {
        facilityId: facilityMain.id,
        resourceTypeId: 'rt000005-0000-4000-8000-000000000001',
        quantityOnHand: 2000,
        quantityAvailable: 1850,
        reorderPoint: 500,
      },
      {
        facilityId: facilityMain.id,
        resourceTypeId: 'rt000006-0000-4000-8000-000000000001',
        quantityOnHand: 500,
        quantityAvailable: 480,
        reorderPoint: 100,
      },
      {
        facilityId: facilityMain.id,
        resourceTypeId: 'rt000007-0000-4000-8000-000000000001',
        quantityOnHand: 30,
        quantityAvailable: 22,
        reorderPoint: 5,
      },
    ],
  });

  // ── Phase 3: Mutual Aid Agreement ────────────────────────────────────────
  const mutualAid1 = await prisma.mutualAidAgreement.upsert({
    where: { id: 'maa00001-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'maa00001-0000-4000-8000-000000000001',
      facilityId: facilityMain.id,
      partnerOrganizationName: 'Riverside County EMS',
      partnerContactName: 'Director Sarah Mitchell',
      partnerContactPhone: '951-555-0192',
      partnerContactEmail: 'smitchell@riversidecounty.example',
      agreementType: 'EMAC',
      agreementNumber: 'EMAC-2024-0017',
      effectiveDate: new Date('2024-01-01'),
      expirationDate: new Date('2026-12-31'),
      resourceCategories: ['PERSONNEL', 'EQUIPMENT', 'SUPPLY'],
      terms: 'Full EMAC activation terms per state compact. 24-hour notice required for non-emergency requests.',
      isActive: true,
    },
  });
  console.log(`✅ Mutual aid: ${mutualAid1.partnerOrganizationName}`);

  // ── Phase 3: Incident Resources ──────────────────────────────────────────
  const now = new Date();
  const etaInTransit = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2h from now

  const res1 = await prisma.incidentResource.upsert({
    where: { id: 'ir000001-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'ir000001-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      resourceTypeId: 'rt000001-0000-4000-8000-000000000001',
      name: 'RN Nurse — 4-person pool',
      quantity: 4,
      unit: 'person',
      source: ResourceSource.INTERNAL,
      status: ResourceStatus.AVAILABLE,
      arrivedAt: new Date(now.getTime() - 30 * 60 * 1000),
      orderedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
  });

  const res2 = await prisma.incidentResource.upsert({
    where: { id: 'ir000002-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'ir000002-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      resourceTypeId: 'rt000003-0000-4000-8000-000000000001',
      name: 'Portable Generator — Unit 3',
      quantity: 1,
      unit: 'each',
      source: ResourceSource.VENDOR,
      vendor: 'PowerFirst Rentals',
      status: ResourceStatus.IN_TRANSIT,
      eta: etaInTransit,
      orderedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
  });

  const res3 = await prisma.incidentResource.upsert({
    where: { id: 'ir000003-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'ir000003-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      resourceTypeId: 'rt000005-0000-4000-8000-000000000001',
      name: 'N95 Masks — 500ct case',
      quantity: 500,
      unit: 'each',
      source: ResourceSource.INTERNAL,
      status: ResourceStatus.ASSIGNED,
      orderedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      arrivedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      assignedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      assignedToSection: 'Operations',
      assignedToRole: 'Medical Care Branch Director',
      assignedToLocation: 'ED Triage',
    },
  });

  const res4 = await prisma.incidentResource.upsert({
    where: { id: 'ir000004-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'ir000004-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      resourceTypeId: 'rt000004-0000-4000-8000-000000000001',
      name: 'ALS Ambulance — Unit 7',
      quantity: 1,
      unit: 'each',
      source: ResourceSource.MUTUAL_AID,
      mutualAidAgreementId: mutualAid1.id,
      status: ResourceStatus.ORDERED,
      orderedAt: now,
    },
  });

  const res5 = await prisma.incidentResource.upsert({
    where: { id: 'ir000005-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'ir000005-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      resourceTypeId: 'rt000008-0000-4000-8000-000000000001',
      name: 'Mobile Command Post',
      quantity: 1,
      unit: 'each',
      source: ResourceSource.INTERNAL,
      status: ResourceStatus.AVAILABLE,
      arrivedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      orderedAt: new Date(now.getTime() - 10 * 60 * 60 * 1000),
    },
  });

  // Initial status history entries (fromStatus = null for first entries)
  await prisma.resourceStatusHistory.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'rsh00001-0000-4000-8000-000000000001',
        incidentResourceId: res1.id,
        fromStatus: null,
        toStatus: ResourceStatus.ORDERED,
        changedByUserId: incidentCommander.id,
        changedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        id: 'rsh00002-0000-4000-8000-000000000001',
        incidentResourceId: res1.id,
        fromStatus: ResourceStatus.ORDERED,
        toStatus: ResourceStatus.AVAILABLE,
        changedByUserId: incidentCommander.id,
        changedAt: new Date(now.getTime() - 30 * 60 * 1000),
        reason: 'Staff arrived at staging area',
      },
      {
        id: 'rsh00003-0000-4000-8000-000000000001',
        incidentResourceId: res2.id,
        fromStatus: null,
        toStatus: ResourceStatus.ORDERED,
        changedByUserId: incidentCommander.id,
        changedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      },
      {
        id: 'rsh00004-0000-4000-8000-000000000001',
        incidentResourceId: res2.id,
        fromStatus: ResourceStatus.ORDERED,
        toStatus: ResourceStatus.IN_TRANSIT,
        changedByUserId: incidentCommander.id,
        changedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        reason: 'Vendor confirmed dispatch',
        location: 'PowerFirst depot, 14 mi out',
      },
      {
        id: 'rsh00005-0000-4000-8000-000000000001',
        incidentResourceId: res3.id,
        fromStatus: null,
        toStatus: ResourceStatus.ORDERED,
        changedByUserId: incidentCommander.id,
        changedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      },
      {
        id: 'rsh00006-0000-4000-8000-000000000001',
        incidentResourceId: res3.id,
        fromStatus: ResourceStatus.ORDERED,
        toStatus: ResourceStatus.AVAILABLE,
        changedByUserId: incidentCommander.id,
        changedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      },
      {
        id: 'rsh00007-0000-4000-8000-000000000001',
        incidentResourceId: res3.id,
        fromStatus: ResourceStatus.AVAILABLE,
        toStatus: ResourceStatus.ASSIGNED,
        changedByUserId: incidentCommander.id,
        changedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        reason: 'Assigned to ED triage',
      },
    ],
  });
  console.log(`✅ Incident resources: 5 resources, status history seeded`);

  // ── Phase 3: Resource Request (ICS-213RR) ─────────────────────────────────
  const request1 = await prisma.resourceRequest.upsert({
    where: { id: 'rr000001-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'rr000001-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      requestedByUserId: incidentCommander.id,
      requestNumber: `213RR-${sampleIncident.incidentNumber}-0001`,
      status: RequestStatus.APPROVED,
      priority: RequestPriority.PRIORITY,
      missionAssignment: 'Establish extended care station in cafeteria',
      requestedForSection: 'Operations',
      deliveryLocation: 'Main Cafeteria — Ground Floor',
      neededDate: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      justification: 'Surge capacity needed to support 85+ overflow patients',
      estimatedCost: new Decimal('6250.00'),
      approvedByUserId: facilityAdmin1.id,
    },
  });

  await prisma.resourceRequestLineItem.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'rrli0001-0000-4000-8000-000000000001',
        requestId: request1.id,
        resourceTypeId: 'rt000001-0000-4000-8000-000000000001',
        resourceDescription: 'RN Nurses',
        quantity: new Decimal('8'),
        unit: 'person',
        estimatedUnitCost: new Decimal('75.00'),
        estimatedTotalCost: new Decimal('600.00'),
        filledQuantity: new Decimal('4'),
        notes: 'ED experience preferred',
      },
      {
        id: 'rrli0002-0000-4000-8000-000000000001',
        requestId: request1.id,
        resourceTypeId: 'rt000007-0000-4000-8000-000000000001',
        resourceDescription: 'Patient Stretchers',
        quantity: new Decimal('20'),
        unit: 'each',
        estimatedUnitCost: new Decimal('50.00'),
        estimatedTotalCost: new Decimal('1000.00'),
        filledQuantity: new Decimal('20'),
      },
      {
        id: 'rrli0003-0000-4000-8000-000000000001',
        requestId: request1.id,
        resourceTypeId: 'rt000006-0000-4000-8000-000000000001',
        resourceDescription: 'IV Fluid NS 1L',
        quantity: new Decimal('200'),
        unit: 'bag',
        estimatedUnitCost: new Decimal('4.75'),
        estimatedTotalCost: new Decimal('950.00'),
        filledQuantity: new Decimal('150'),
      },
    ],
  });

  const request2 = await prisma.resourceRequest.upsert({
    where: { id: 'rr000002-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'rr000002-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      requestedByUserId: incidentCommander.id,
      requestNumber: `213RR-${sampleIncident.incidentNumber}-0002`,
      status: RequestStatus.SUBMITTED,
      priority: RequestPriority.IMMEDIATE,
      missionAssignment: 'Backup power for ICU and OR',
      requestedForSection: 'Logistics',
      deliveryLocation: 'ICU Loading Dock (East Wing)',
      neededDate: new Date(now.getTime() + 1 * 60 * 60 * 1000),
      justification: 'Primary generator showing fault codes — imminent failure risk for life-safety loads',
      estimatedCost: new Decimal('1700.00'),
    },
  });

  await prisma.resourceRequestLineItem.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'rrli0004-0000-4000-8000-000000000001',
        requestId: request2.id,
        resourceTypeId: 'rt000003-0000-4000-8000-000000000001',
        resourceDescription: 'Portable Generator 50kW',
        quantity: new Decimal('2'),
        unit: 'each',
        estimatedUnitCost: new Decimal('850.00'),
        estimatedTotalCost: new Decimal('1700.00'),
        filledQuantity: new Decimal('0'),
        notes: 'Must be diesel — propane not permitted in ICU loading dock',
      },
    ],
  });

  console.log(`✅ Resource requests: ${request1.requestNumber} (APPROVED), ${request2.requestNumber} (SUBMITTED)`);

  // ── Phase 3: Cost Records ──────────────────────────────────────────────────
  const period1Id = sampleOperationalPeriod.id;

  const costRecordsData = [
    // Labor records
    {
      id: 'cr000001-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      operationalPeriodId: period1Id,
      submittedByUserId: incidentCommander.id,
      costType: CostType.LABOR,
      femaPaCategory: FemaPACategory.CAT_B,
      description: 'RN Nurse — Rebecca Torres',
      quantity: new Decimal('12'),
      unitPeriod: CostUnitPeriod.HOUR,
      unitCost: new Decimal('112.50'),
      totalCost: new Decimal('1350.00'),
      date: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      isApproved: true,
      approvedByUserId: facilityAdmin1.id,
      approvedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
    },
    {
      id: 'cr000002-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      operationalPeriodId: period1Id,
      submittedByUserId: incidentCommander.id,
      costType: CostType.LABOR,
      femaPaCategory: FemaPACategory.CAT_B,
      description: 'Physician — Dr. James Park',
      quantity: new Decimal('8'),
      unitPeriod: CostUnitPeriod.HOUR,
      unitCost: new Decimal('262.50'),
      totalCost: new Decimal('2100.00'),
      date: new Date(now.getTime() - 10 * 60 * 60 * 1000),
      isApproved: true,
      approvedByUserId: facilityAdmin1.id,
      approvedAt: new Date(now.getTime() - 7 * 60 * 60 * 1000),
    },
    {
      id: 'cr000003-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      operationalPeriodId: period1Id,
      submittedByUserId: incidentCommander.id,
      costType: CostType.LABOR,
      femaPaCategory: FemaPACategory.CAT_B,
      description: 'Security Officer — Overtime',
      quantity: new Decimal('6'),
      unitPeriod: CostUnitPeriod.HOUR,
      unitCost: new Decimal('52.50'),
      totalCost: new Decimal('315.00'),
      date: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      isApproved: false,
    },
    // Equipment records
    {
      id: 'cr000004-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      operationalPeriodId: period1Id,
      submittedByUserId: incidentCommander.id,
      costType: CostType.EQUIPMENT,
      femaPaCategory: FemaPACategory.CAT_B,
      description: 'Portable Generator Rental — PowerFirst Unit 3',
      quantity: new Decimal('1'),
      unitPeriod: CostUnitPeriod.DAY,
      unitCost: new Decimal('850.00'),
      totalCost: new Decimal('850.00'),
      vendor: 'PowerFirst Rentals',
      invoiceNumber: 'PFR-2024-8842',
      date: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      isApproved: true,
      approvedByUserId: facilityAdmin1.id,
      approvedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      id: 'cr000005-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      operationalPeriodId: period1Id,
      submittedByUserId: incidentCommander.id,
      costType: CostType.EQUIPMENT,
      femaPaCategory: FemaPACategory.CAT_B,
      description: 'Mobile Command Post — fuel & ops',
      quantity: new Decimal('8'),
      unitPeriod: CostUnitPeriod.HOUR,
      unitCost: new Decimal('45.00'),
      totalCost: new Decimal('360.00'),
      date: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      isApproved: true,
      approvedByUserId: facilityAdmin1.id,
      approvedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    },
    // Supply records
    {
      id: 'cr000006-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      operationalPeriodId: period1Id,
      submittedByUserId: incidentCommander.id,
      costType: CostType.SUPPLY,
      femaPaCategory: FemaPACategory.CAT_B,
      description: 'N95 Respirators — 500ct case',
      quantity: new Decimal('500'),
      unitPeriod: CostUnitPeriod.EACH,
      unitCost: new Decimal('2.50'),
      totalCost: new Decimal('1250.00'),
      vendor: 'MedSupply Direct',
      invoiceNumber: 'MSD-20240-5511',
      date: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      isApproved: true,
      approvedByUserId: facilityAdmin1.id,
      approvedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
    },
    {
      id: 'cr000007-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      operationalPeriodId: period1Id,
      submittedByUserId: incidentCommander.id,
      costType: CostType.SUPPLY,
      femaPaCategory: FemaPACategory.CAT_B,
      description: 'IV Fluid NS 1L — 200 bags',
      quantity: new Decimal('200'),
      unitPeriod: CostUnitPeriod.EACH,
      unitCost: new Decimal('4.75'),
      totalCost: new Decimal('950.00'),
      vendor: 'MedSupply Direct',
      invoiceNumber: 'MSD-20240-5512',
      date: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      isApproved: true,
      approvedByUserId: facilityAdmin1.id,
      approvedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
    // Contract records
    {
      id: 'cr000008-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      operationalPeriodId: period1Id,
      submittedByUserId: incidentCommander.id,
      costType: CostType.CONTRACT,
      femaPaCategory: FemaPACategory.CAT_B,
      description: 'Contracted cleaning / decontamination services',
      quantity: new Decimal('1'),
      unitPeriod: CostUnitPeriod.FLAT,
      unitCost: new Decimal('3500.00'),
      totalCost: new Decimal('3500.00'),
      vendor: 'BioClean Services LLC',
      invoiceNumber: 'BC-2024-0441',
      date: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      isApproved: false,
    },
    // Management/overhead
    {
      id: 'cr000009-0000-4000-8000-000000000001',
      incidentId: sampleIncident.id,
      operationalPeriodId: period1Id,
      submittedByUserId: facilityAdmin1.id,
      costType: CostType.OTHER,
      femaPaCategory: FemaPACategory.CAT_Z,
      description: 'EOC Activation — admin & overhead',
      quantity: new Decimal('1'),
      unitPeriod: CostUnitPeriod.FLAT,
      unitCost: new Decimal('750.00'),
      totalCost: new Decimal('750.00'),
      date: new Date(now.getTime() - 10 * 60 * 60 * 1000),
      isApproved: true,
      approvedByUserId: facilityAdmin1.id,
      approvedAt: new Date(now.getTime() - 9 * 60 * 60 * 1000),
    },
  ];

  await prisma.costRecord.createMany({ skipDuplicates: true, data: costRecordsData });

  // Labor sub-records
  await prisma.laborCostRecord.createMany({
    skipDuplicates: true,
    data: [
      {
        costRecordId: 'cr000001-0000-4000-8000-000000000001',
        personnelName: 'Rebecca Torres',
        role: 'RN — ED Float Pool',
        regularHours: new Decimal('8'),
        overtimeHours: new Decimal('4'),
        regularRate: new Decimal('75.00'),
        overtimeRate: new Decimal('112.50'),
        benefits: new Decimal('150.00'),
      },
      {
        costRecordId: 'cr000002-0000-4000-8000-000000000001',
        personnelName: 'Dr. James Park',
        role: 'ED Attending Physician',
        regularHours: new Decimal('8'),
        overtimeHours: new Decimal('0'),
        regularRate: new Decimal('175.00'),
        overtimeRate: new Decimal('262.50'),
        benefits: new Decimal('700.00'),
      },
      {
        costRecordId: 'cr000003-0000-4000-8000-000000000001',
        personnelName: 'Marcus Webb',
        role: 'Security Officer',
        regularHours: new Decimal('0'),
        overtimeHours: new Decimal('6'),
        regularRate: new Decimal('35.00'),
        overtimeRate: new Decimal('52.50'),
        benefits: new Decimal('0'),
      },
    ],
  });

  // Equipment sub-records
  await prisma.equipmentCostRecord.createMany({
    skipDuplicates: true,
    data: [
      {
        costRecordId: 'cr000004-0000-4000-8000-000000000001',
        equipmentDescription: 'Diesel Generator 50kW',
        hoursUsed: new Decimal('24'),
        hourlyRate: new Decimal('35.42'),
        mileage: new Decimal('14'),
        mileageRate: new Decimal('2.50'),
      },
      {
        costRecordId: 'cr000005-0000-4000-8000-000000000001',
        equipmentDescription: 'Mobile Command Post Vehicle',
        hoursUsed: new Decimal('8'),
        hourlyRate: new Decimal('45.00'),
      },
    ],
  });

  console.log(`✅ Cost records: ${costRecordsData.length} records (labor, equipment, supply, contract, overhead)`);

  // ── Phase 3: Cost Rollup (pre-computed snapshot) ──────────────────────────
  const approvedTotal = new Decimal('1350.00')
    .plus('2100.00')
    .plus('850.00')
    .plus('360.00')
    .plus('1250.00')
    .plus('950.00')
    .plus('750.00'); // excludes unapproved

  const runningTotal = approvedTotal.plus('315.00').plus('3500.00');

  await prisma.costRollup.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'rollup01-0000-4000-8000-000000000001',
        incidentId: sampleIncident.id,
        operationalPeriodId: period1Id,
        totalCost: runningTotal,
        approvedCost: approvedTotal,
        unapprovedCost: new Decimal('315.00').plus('3500.00'),
        laborCost: new Decimal('1350.00').plus('2100.00').plus('315.00'),
        equipmentCost: new Decimal('850.00').plus('360.00'),
        supplyCost: new Decimal('1250.00').plus('950.00'),
        contractCost: new Decimal('3500.00'),
        otherCost: new Decimal('750.00'),
        recordCount: 9,
        costByFemaCategory: {
          CAT_B: runningTotal.minus('750.00').toFixed(2),
          CAT_Z: '750.00',
        },
        costByPeriod: {},
        computedAt: new Date(),
      },
      {
        id: 'rollup02-0000-4000-8000-000000000001',
        incidentId: sampleIncident.id,
        operationalPeriodId: null,
        totalCost: runningTotal,
        approvedCost: approvedTotal,
        unapprovedCost: new Decimal('315.00').plus('3500.00'),
        laborCost: new Decimal('1350.00').plus('2100.00').plus('315.00'),
        equipmentCost: new Decimal('850.00').plus('360.00'),
        supplyCost: new Decimal('1250.00').plus('950.00'),
        contractCost: new Decimal('3500.00'),
        otherCost: new Decimal('750.00'),
        recordCount: 9,
        costByFemaCategory: {
          CAT_B: runningTotal.minus('750.00').toFixed(2),
          CAT_Z: '750.00',
        },
        costByPeriod: {
          [period1Id]: runningTotal.toFixed(2),
        },
        computedAt: new Date(),
      },
    ],
  });
  console.log(`✅ Cost rollups: period + incident-level snapshots`);

  // ── Print credentials ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('SEEDED USER CREDENTIALS (save these — shown once)');
  console.log('═'.repeat(60));
  console.log(`SYSTEM_ADMIN   | sysadmin@apexhealth.example    | ${sysAdminPassword}`);
  console.log(`FACILITY_ADMIN | fadmin.agh@apexhealth.example   | ${facilityAdmin1Password}`);
  console.log(`FACILITY_ADMIN | fadmin.anc@apexhealth.example   | ${facilityAdmin2Password}`);
  console.log(`INCIDENT_CMD   | dr.chen@apexhealth.example      | ${icPassword}`);
  console.log('═'.repeat(60));
  console.log('\nPhase 2 seed data:');
  console.log(`  Incident:   ${sampleIncident.incidentNumber} — ${sampleIncident.name}`);
  console.log(`  IAP ID:     ${sampleIap.id}  (status: DRAFT)`);
  console.log(`  Templates:  MCI, Internal Fire, Utility Failure`);
  console.log(`  Objectives: 10 entries | Tactics: 5 entries`);
  console.log('\nPhase 3 seed data:');
  console.log(`  Resource Types:     10`);
  console.log(`  Incident Resources: 5`);
  console.log(`  Resource Requests:  2 (1 APPROVED + 5 line items, 1 SUBMITTED + 1 line item)`);
  console.log(`  Cost Records:       ${costRecordsData.length} (labor + equipment + supply + contract + overhead)`);
  console.log(`  Mutual Aid:         1 (Riverside County EMS — EMAC)`);
  console.log(`  Cost Rollups:       2 (period + incident level)`);
  console.log('═'.repeat(60) + '\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
