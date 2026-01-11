const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const STATUS = {
  DRAFT: 'draft',
  WAITING: 'menunggu',
  REPLIED: 'dibalas_dokter',
  DONE: 'selesai'
};

const DEMO_DOCTORS = [
  {
    name: 'Dr. Maya Pratama - Spesialis Penyakit Dalam',
    age: 41,
    gender: 'Perempuan',
    role: 'doctor',
    username: 'drmaya',
    password: 'dokter123'
  },
  {
    name: 'Dr. Andi Wijaya - Spesialis Anak',
    age: 38,
    gender: 'Laki-laki',
    role: 'doctor',
    username: 'drandi',
    password: 'dokter123'
  },
  {
    name: 'Dr. Siti Aulia - Spesialis Kebidanan dan Kandungan',
    age: 36,
    gender: 'Perempuan',
    role: 'doctor',
    username: 'drsiti',
    password: 'dokter123'
  },
  {
    name: 'Dr. Rafi Pratama - Spesialis Kulit dan Kelamin',
    age: 35,
    gender: 'Laki-laki',
    role: 'doctor',
    username: 'drrafi',
    password: 'dokter123'
  },
  {
    name: 'Dr. Nia Kusuma - Spesialis THT',
    age: 40,
    gender: 'Perempuan',
    role: 'doctor',
    username: 'drnia',
    password: 'dokter123'
  },
  {
    name: 'Dr. Budi Santoso - Spesialis Mata',
    age: 45,
    gender: 'Laki-laki',
    role: 'doctor',
    username: 'drbudi',
    password: 'dokter123'
  },
  {
    name: 'Dr. Intan Putri - Spesialis Saraf',
    age: 39,
    gender: 'Perempuan',
    role: 'doctor',
    username: 'drintan',
    password: 'dokter123'
  },
  {
    name: 'Dr. Dimas Prakoso - Spesialis Jantung',
    age: 42,
    gender: 'Laki-laki',
    role: 'doctor',
    username: 'drdimas',
    password: 'dokter123'
  },
  {
    name: 'Dr. Laila Fitria - Spesialis Bedah',
    age: 37,
    gender: 'Perempuan',
    role: 'doctor',
    username: 'drlaila',
    password: 'dokter123'
  },
  {
    name: 'Dr. Rizky Ananda - Spesialis Ortopedi',
    age: 43,
    gender: 'Laki-laki',
    role: 'doctor',
    username: 'drrizky',
    password: 'dokter123'
  }
];

const DEMO_PATIENTS = [
  {
    name: 'Ayu Lestari',
    age: 25,
    gender: 'Perempuan',
    role: 'patient',
    username: 'ayu',
    password: 'pasien123'
  },
  {
    name: 'Bima Hartanto',
    age: 32,
    gender: 'Laki-laki',
    role: 'patient',
    username: 'bima',
    password: 'pasien123'
  }
];

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabase;
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    role: row.role,
    username: row.username
  };
}

function mapConsultation(row) {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    status: row.status,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    endedAt: row.ended_at,
    submittedToDoctor: row.submitted_to_doctor,
    patientName: row.patient?.name || null,
    doctorName: row.doctor?.name || null
  };
}

function mapMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    consultationId: row.consultation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    content: row.content,
    createdAt: row.created_at,
    senderName: row.sender?.name || null
  };
}

async function seedIfNeeded() {
  const db = requireSupabase();
  const demoUsers = [...DEMO_DOCTORS, ...DEMO_PATIENTS];
  const demoUsernames = demoUsers.map((user) => user.username);

  const { data: existing, error } = await db
    .from('users')
    .select('id, username, name, role')
    .in('username', demoUsernames);

  if (error) throw error;

  const existingByUsername = new Map((existing || []).map((row) => [row.username, row]));
  const toInsert = demoUsers
    .filter((user) => !existingByUsername.has(user.username))
    .map((user) => ({
      name: user.name,
      age: user.age,
      gender: user.gender,
      role: user.role,
      username: user.username,
      password_hash: hashPassword(user.password)
    }));

  if (toInsert.length > 0) {
    const { error: insertError } = await db.from('users').insert(toInsert);
    if (insertError) throw insertError;
  }

  const doctorUpdates = DEMO_DOCTORS.map((doctor) => {
    const existingDoctor = existingByUsername.get(doctor.username);
    if (!existingDoctor || existingDoctor.role !== 'doctor') return null;
    const hasSpecialty = /\bSpesialis\b|\bSp\./i.test(existingDoctor.name || '');
    if (hasSpecialty || existingDoctor.name === doctor.name) return null;
    return { id: existingDoctor.id, name: doctor.name };
  }).filter(Boolean);

  for (const update of doctorUpdates) {
    const { error: updateError } = await db
      .from('users')
      .update({ name: update.name })
      .eq('id', update.id);
    if (updateError) throw updateError;
  }
}

async function getUsers(role) {
  const db = requireSupabase();
  let query = db.from('users').select('id, name, age, gender, role, username').order('name');
  if (role) query = query.eq('role', role);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapUser);
}

async function getUserById(id) {
  const db = requireSupabase();
  const { data, error } = await db
    .from('users')
    .select('id, name, age, gender, role, username')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return mapUser(data);
}

async function getDefaultDoctor() {
  const db = requireSupabase();
  const { data, error } = await db
    .from('users')
    .select('id, name, age, gender, role, username')
    .eq('role', 'doctor')
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return mapUser(data);
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

async function getUserAuthByUsername(username) {
  const db = requireSupabase();
  const { data, error } = await db
    .from('users')
    .select('id, name, age, gender, role, username, password_hash')
    .eq('username', username)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function createUser({ username, password, role }) {
  const db = requireSupabase();
  const payload = {
    name: username,
    username,
    role,
    password_hash: hashPassword(password)
  };

  const { data, error } = await db
    .from('users')
    .insert(payload)
    .select('id, name, age, gender, role, username')
    .single();

  if (error) throw error;
  return mapUser(data);
}

async function authenticateUser({ username, password }) {
  const row = await getUserAuthByUsername(username);
  if (!row) return null;
  if (!row.password_hash) return null;
  const isValid = verifyPassword(password, row.password_hash);
  if (!isValid) return null;
  return mapUser(row);
}

async function createConsultation({ patientId }) {
  const db = requireSupabase();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('consultations')
    .insert({
      patient_id: patientId,
      doctor_id: null,
      status: STATUS.DRAFT,
      started_at: now,
      updated_at: now,
      ended_at: null,
      submitted_to_doctor: false
    })
    .select(
      'id, patient_id, doctor_id, status, started_at, updated_at, ended_at, submitted_to_doctor'
    )
    .single();

  if (error) throw error;
  return mapConsultation(data);
}

async function submitConsultation({ id, doctorId }) {
  const db = requireSupabase();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('consultations')
    .update({
      doctor_id: doctorId,
      status: STATUS.WAITING,
      updated_at: now,
      submitted_to_doctor: true
    })
    .eq('id', id)
    .select(
      'id, patient_id, doctor_id, status, started_at, updated_at, ended_at, submitted_to_doctor'
    )
    .maybeSingle();

  if (error) throw error;
  return mapConsultation(data);
}

async function closeConsultation({ id }) {
  const db = requireSupabase();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('consultations')
    .update({
      status: STATUS.DONE,
      updated_at: now,
      ended_at: now
    })
    .eq('id', id)
    .select(
      'id, patient_id, doctor_id, status, started_at, updated_at, ended_at, submitted_to_doctor'
    )
    .maybeSingle();

  if (error) throw error;
  return mapConsultation(data);
}

async function updateStatusToReplied({ id }) {
  const db = requireSupabase();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('consultations')
    .update({
      status: STATUS.REPLIED,
      updated_at: now,
      ended_at: null
    })
    .eq('id', id)
    .select(
      'id, patient_id, doctor_id, status, started_at, updated_at, ended_at, submitted_to_doctor'
    )
    .maybeSingle();

  if (error) throw error;
  return mapConsultation(data);
}

async function addMessage({ consultationId, senderId, senderRole, content }) {
  const db = requireSupabase();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('messages')
    .insert({
      consultation_id: consultationId,
      sender_id: senderId || null,
      sender_role: senderRole,
      content,
      created_at: now
    })
    .select(
      'id, consultation_id, sender_id, sender_role, content, created_at, sender:sender_id(name)'
    )
    .single();

  if (error) throw error;

  const { error: touchError } = await db
    .from('consultations')
    .update({ updated_at: now })
    .eq('id', consultationId);

  if (touchError) throw touchError;

  return mapMessage(data);
}

async function listMessages(consultationId) {
  const db = requireSupabase();
  const { data, error } = await db
    .from('messages')
    .select(
      'id, consultation_id, sender_id, sender_role, content, created_at, sender:sender_id(name)'
    )
    .eq('consultation_id', consultationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data.map(mapMessage);
}

async function listConsultationsByPatient(patientId) {
  const db = requireSupabase();
  const { data, error } = await db
    .from('consultations')
    .select(
      'id, patient_id, doctor_id, status, started_at, updated_at, ended_at, submitted_to_doctor, patient:patient_id(name), doctor:doctor_id(name)'
    )
    .eq('patient_id', patientId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data.map(mapConsultation);
}

async function listConsultationsByDoctor(doctorId) {
  const db = requireSupabase();
  const { data, error } = await db
    .from('consultations')
    .select(
      'id, patient_id, doctor_id, status, started_at, updated_at, ended_at, submitted_to_doctor, patient:patient_id(name), doctor:doctor_id(name)'
    )
    .eq('doctor_id', doctorId)
    .eq('submitted_to_doctor', true)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data.map(mapConsultation);
}

async function getConsultationById(id) {
  const db = requireSupabase();
  const { data, error } = await db
    .from('consultations')
    .select(
      'id, patient_id, doctor_id, status, started_at, updated_at, ended_at, submitted_to_doctor'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return mapConsultation(data);
}

async function getConsultationWithNames(id) {
  const db = requireSupabase();
  const { data, error } = await db
    .from('consultations')
    .select(
      'id, patient_id, doctor_id, status, started_at, updated_at, ended_at, submitted_to_doctor, patient:patient_id(name), doctor:doctor_id(name)'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return mapConsultation(data);
}

async function deleteConsultation({ id }) {
  const db = requireSupabase();
  const { error } = await db.from('consultations').delete().eq('id', id);
  if (error) throw error;
  return true;
}

module.exports = {
  STATUS,
  seedIfNeeded,
  getUsers,
  getUserById,
  getDefaultDoctor,
  createUser,
  authenticateUser,
  createConsultation,
  submitConsultation,
  closeConsultation,
  updateStatusToReplied,
  addMessage,
  listMessages,
  listConsultationsByPatient,
  listConsultationsByDoctor,
  getConsultationById,
  getConsultationWithNames,
  deleteConsultation
};
