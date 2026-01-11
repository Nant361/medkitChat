const { randomUUID } = require('crypto');
const express = require('express');
const cors = require('cors');

const {
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
} = require('./db');

const { generateAiResponse, generateLocalResponse, getAiMeta } = require('./ai');

function buildTransientMessage({ consultationId, senderId, senderRole, content, senderName }) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    consultationId,
    senderId: senderId || null,
    senderRole,
    content,
    createdAt: now,
    senderName: senderName || null
  };
}

async function getUpdatedConsultation(consultationId) {
  try {
    return await getConsultationWithNames(consultationId);
  } catch (error) {
    console.error('Load consultation failed:', error.message);
    return null;
  }
}

function createApp() {
  const app = express();

  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const allowedOrigins = CLIENT_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAllOrigins = allowedOrigins.includes('*');

  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    }
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, status: 'up' });
  });

  app.get('/api/users', async (req, res) => {
    try {
      const role = req.query.role || null;
      const users = await getUsers(role);
      res.json(users);
    } catch (error) {
      console.error('Get users failed:', error.message);
      res.status(500).json({ error: 'Gagal memuat pengguna' });
    }
  });

  app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body || {};
    const trimmedUsername = typeof username === 'string' ? username.trim() : '';
    const trimmedPassword = typeof password === 'string' ? password.trim() : '';

    if (!trimmedUsername) {
      return res.status(400).json({ error: 'Username wajib diisi' });
    }

    if (!trimmedPassword) {
      return res.status(400).json({ error: 'Password wajib diisi' });
    }

    try {
      const user = await createUser({
        username: trimmedUsername,
        password: trimmedPassword,
        role: 'patient'
      });
      return res.status(201).json(user);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Username sudah digunakan' });
      }
      console.error('Signup failed:', error.message);
      return res.status(500).json({ error: 'Gagal membuat akun' });
    }
  });

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body || {};
    const trimmedUsername = typeof username === 'string' ? username.trim() : '';
    const trimmedPassword = typeof password === 'string' ? password.trim() : '';

    if (!trimmedUsername || !trimmedPassword) {
      return res.status(400).json({ error: 'Username dan password wajib diisi' });
    }

    try {
      const user = await authenticateUser({ username: trimmedUsername, password: trimmedPassword });
      if (!user) {
        return res.status(401).json({ error: 'Username atau password salah' });
      }
      return res.json(user);
    } catch (error) {
      console.error('Login failed:', error.message);
      return res.status(500).json({ error: 'Gagal login' });
    }
  });

  app.get('/api/consultations', async (req, res) => {
    const { userId, role } = req.query;
    if (!userId || !role) {
      return res.status(400).json({ error: 'userId and role are required' });
    }

    try {
      if (role === 'patient') {
        const data = await listConsultationsByPatient(userId);
        return res.json(data);
      }

      if (role === 'doctor') {
        const data = await listConsultationsByDoctor(userId);
        return res.json(data);
      }

      return res.status(400).json({ error: 'Invalid role' });
    } catch (error) {
      console.error('Get consultations failed:', error.message);
      return res.status(500).json({ error: 'Gagal memuat konsultasi' });
    }
  });

  app.post('/api/consultations', async (req, res) => {
    const { patientId } = req.body || {};
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    try {
      const consultation = await createConsultation({ patientId });
      const withNames = await getUpdatedConsultation(consultation.id);
      return res.status(201).json(withNames);
    } catch (error) {
      console.error('Create consultation failed:', error.message);
      return res.status(500).json({ error: 'Gagal membuat konsultasi' });
    }
  });

  app.post('/api/consultations/:id/submit', async (req, res) => {
    const { id } = req.params;
    const { doctorId } = req.body || {};

    try {
      const consultation = await getConsultationById(id);
      if (!consultation) {
        return res.status(404).json({ error: 'Consultation not found' });
      }

      if (consultation.submittedToDoctor) {
        const existing = await getConsultationWithNames(id);
        return res.json(existing);
      }

      const assignedDoctor = doctorId ? await getUserById(doctorId) : await getDefaultDoctor();
      if (!assignedDoctor) {
        return res.status(400).json({ error: 'Doctor not available' });
      }

      await submitConsultation({ id, doctorId: assignedDoctor.id });
      const updated = await getUpdatedConsultation(id);
      return res.json(updated);
    } catch (error) {
      console.error('Submit consultation failed:', error.message);
      return res.status(500).json({ error: 'Gagal mengirim konsultasi' });
    }
  });

  app.post('/api/consultations/:id/close', async (req, res) => {
    const { id } = req.params;

    try {
      const consultation = await getConsultationById(id);
      if (!consultation) {
        return res.status(404).json({ error: 'Consultation not found' });
      }

      await closeConsultation({ id });
      const updated = await getUpdatedConsultation(id);
      return res.json(updated);
    } catch (error) {
      console.error('Close consultation failed:', error.message);
      return res.status(500).json({ error: 'Gagal menutup konsultasi' });
    }
  });

  app.delete('/api/consultations/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const consultation = await getConsultationById(id);
      if (!consultation) {
        return res.status(404).json({ error: 'Consultation not found' });
      }

      await deleteConsultation({ id });
      return res.json({ id });
    } catch (error) {
      console.error('Delete consultation failed:', error.message);
      return res.status(500).json({ error: 'Gagal menghapus konsultasi' });
    }
  });

  app.get('/api/consultations/:id/messages', async (req, res) => {
    const { id } = req.params;

    try {
      const consultation = await getConsultationById(id);
      if (!consultation) {
        return res.status(404).json({ error: 'Consultation not found' });
      }

      const data = await listMessages(id);
      return res.json(data);
    } catch (error) {
      console.error('List messages failed:', error.message);
      return res.status(500).json({ error: 'Gagal memuat pesan' });
    }
  });

  app.post('/api/consultations/:id/messages', async (req, res) => {
    const { id } = req.params;
    const { senderId, senderRole, content } = req.body || {};

    if (!senderRole || !content) {
      return res.status(400).json({ error: 'senderRole and content are required' });
    }

    try {
      const consultation = await getConsultationById(id);
      if (!consultation) {
        return res.status(404).json({ error: 'Consultation not found' });
      }

      if (senderRole === 'doctor' && !consultation.submittedToDoctor) {
        return res.status(400).json({ error: 'Consultation has not been submitted to doctor' });
      }

      const message = await addMessage({ consultationId: id, senderId, senderRole, content });

      if (senderRole === 'doctor') {
        await updateStatusToReplied({ id });
      }

      const updated = await getUpdatedConsultation(id);
      return res.status(201).json({ message, consultation: updated });
    } catch (error) {
      console.error('Send message failed:', error.message);
      return res.status(500).json({ error: 'Gagal mengirim pesan' });
    }
  });

  app.post('/api/consultations/:id/ai', async (req, res) => {
    const { id } = req.params;
    const { patientId, complaint } = req.body || {};

    if (!patientId || !complaint) {
      return res.status(400).json({ error: 'patientId and complaint are required' });
    }

    try {
      const consultation = await getConsultationById(id);
      if (!consultation) {
        return res.status(404).json({ error: 'Consultation not found' });
      }

      if (consultation.submittedToDoctor) {
        return res
          .status(400)
          .json({ error: 'AI response only available before submission to doctor' });
      }

      const patient = await getUserById(patientId);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      let aiText;
      try {
        aiText = await generateAiResponse({ complaint, patient });
      } catch (error) {
        console.warn('AI generation failed, using local response:', error.message);
        aiText = generateLocalResponse({ complaint, patient });
      }

      if (!aiText || !aiText.trim()) {
        aiText = generateLocalResponse({ complaint, patient });
      }

      let patientMessage;
      try {
        patientMessage = await addMessage({
          consultationId: id,
          senderId: patientId,
          senderRole: 'patient',
          content: complaint
        });
      } catch (error) {
        console.error('Persist patient message failed:', error.message);
        patientMessage = buildTransientMessage({
          consultationId: id,
          senderId: patientId,
          senderRole: 'patient',
          content: complaint,
          senderName: patient.name
        });
      }

      let aiMessage;
      try {
        aiMessage = await addMessage({
          consultationId: id,
          senderId: null,
          senderRole: 'ai',
          content: aiText
        });
      } catch (error) {
        console.error('Persist AI message failed:', error.message);
        aiMessage = buildTransientMessage({
          consultationId: id,
          senderId: null,
          senderRole: 'ai',
          content: aiText,
          senderName: 'AI Assistant'
        });
      }

      const updated = await getUpdatedConsultation(id);
      return res.status(201).json({ patientMessage, aiMessage, consultation: updated });
    } catch (error) {
      console.error('AI request failed:', error.message);
      return res.status(500).json({ error: 'AI gagal menghasilkan respon' });
    }
  });

  app.get('/api/ai/meta', (req, res) => {
    res.json(getAiMeta());
  });

  return app;
}

module.exports = { createApp };
