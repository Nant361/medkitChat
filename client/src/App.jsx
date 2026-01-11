import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  closeConsultation,
  createConsultation,
  deleteConsultation,
  getConsultations,
  getUsers,
  login,
  listMessages,
  requestAiResponse,
  signUp,
  sendMessage,
  submitConsultation
} from './api';
import { formatDateTime, formatTime, statusLabel } from './utils';

const ROLE_LABELS = {
  patient: 'Pasien',
  doctor: 'Dokter'
};

const POLL_INTERVAL_MS = 4000;
const STORAGE_KEY = 'medikit-chat-auth';
const DOWNLOAD_URL =
  'https://drive.google.com/file/d/1DRZQQLs6eP9tcdKWTfeCL6BI6P4SecMO/view?usp=sharing';

function readStoredAuth() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const role = parsed?.role;
    const userId = typeof parsed?.userId === 'string' ? parsed.userId : '';
    if (!userId || (role !== 'patient' && role !== 'doctor')) return null;
    return { role, userId };
  } catch (error) {
    return null;
  }
}

function writeStoredAuth({ role, userId }) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ role, userId }));
  } catch (error) {
    // Ignore storage failures (private mode, quota, etc).
  }
}

function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Ignore storage failures (private mode, quota, etc).
  }
}

function App() {
  const [storedAuth] = useState(() => readStoredAuth());
  const [role, setRole] = useState(storedAuth?.role || 'patient');
  const [usersByRole, setUsersByRole] = useState({ patient: [], doctor: [] });
  const [currentUserId, setCurrentUserId] = useState(storedAuth?.userId || '');
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(storedAuth?.userId));
  const [loginMode, setLoginMode] = useState('login');
  const [loginRole, setLoginRole] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [consultations, setConsultations] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [doctorChoiceId, setDoctorChoiceId] = useState('');
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [showStartupPrompt, setShowStartupPrompt] = useState(true);

  const activeIdRef = useRef(activeId);
  const consultationsRef = useRef(consultations);
  const messagesRef = useRef(messages);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    consultationsRef.current = consultations;
  }, [consultations]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let mounted = true;
    Promise.all([getUsers('patient'), getUsers('doctor')])
      .then(([patients, doctors]) => {
        if (!mounted) return;
        setUsersByRole({ patient: patients, doctor: doctors });
        if (doctors.length > 0) setDoctorChoiceId(doctors[0].id);
      })
      .catch((error) => {
        if (!mounted) return;
        setStatusMessage(error.message);
      })
      .finally(() => {
        if (mounted) setUsersLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !usersLoaded) return;
    const list = usersByRole[role] || [];
    if (currentUserId && list.some((user) => user.id === currentUserId)) return;
    setIsAuthenticated(false);
    setCurrentUserId('');
    clearStoredAuth();
  }, [isAuthenticated, role, currentUserId, usersByRole, usersLoaded]);

  useEffect(() => {
    if (!currentUserId) {
      setConsultations([]);
      setActiveId('');
      setMessages([]);
      setUnread({});
      return;
    }

    let cancelled = false;

    const refreshConsultations = async (markUnread) => {
      try {
        const data = await getConsultations({ userId: currentUserId, role });
        if (cancelled) return;

        const nextActiveId = data.find((item) => item.id === activeIdRef.current)
          ? activeIdRef.current
          : data[0]?.id || '';

        if (markUnread) {
          setUnread((prev) => computeUnread(prev, consultationsRef.current, data, nextActiveId));
        }

        setConsultations(data);
        if (nextActiveId !== activeIdRef.current) {
          setActiveId(nextActiveId);
        }
      } catch (error) {
        if (!cancelled) setStatusMessage(error.message);
      }
    };

    setStatusMessage('');
    refreshConsultations(false);
    const interval = setInterval(() => refreshConsultations(true), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUserId, role]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const refreshMessages = async () => {
      try {
        const data = await listMessages({ id: activeId });
        if (cancelled) return;
        const currentMessages = messagesRef.current;
        const currentLastId = currentMessages[currentMessages.length - 1]?.id;
        const nextLastId = data[data.length - 1]?.id;
        setUnread((prev) => {
          const next = { ...prev };
          delete next[activeId];
          return next;
        });
        if (currentMessages.length === data.length && currentLastId === nextLastId) {
          return;
        }
        setMessages(data);
      } catch (error) {
        if (!cancelled) setStatusMessage(error.message);
      }
    };

    refreshMessages();
    const interval = setInterval(refreshMessages, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeConsultation = useMemo(
    () => consultations.find((item) => item.id === activeId) || null,
    [consultations, activeId]
  );

  const currentUser = useMemo(
    () => usersByRole[role].find((item) => item.id === currentUserId) || null,
    [usersByRole, role, currentUserId]
  );

  const hasAiMessages = useMemo(
    () => messages.some((message) => message.senderRole === 'ai'),
    [messages]
  );

  function mergeConsultations(prev, next) {
    const updated = prev.some((item) => item.id === next.id)
      ? prev.map((item) => (item.id === next.id ? { ...item, ...next } : item))
      : [next, ...prev];

    return [...updated].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  function computeUnread(prevUnread, prevList, nextList, activeId) {
    if (!Array.isArray(prevList) || prevList.length === 0) {
      return {};
    }

    const prevById = new Map(prevList.map((item) => [item.id, item.updatedAt]));
    const nextUnread = { ...prevUnread };

    nextList.forEach((item) => {
      if (item.id === activeId) return;
      const prevUpdatedAt = prevById.get(item.id);
      if (!prevUpdatedAt) {
        nextUnread[item.id] = true;
        return;
      }
      const prevTime = new Date(prevUpdatedAt).getTime();
      const nextTime = new Date(item.updatedAt).getTime();
      if (Number.isFinite(prevTime) && Number.isFinite(nextTime) && nextTime > prevTime) {
        nextUnread[item.id] = true;
      }
    });

    Object.keys(nextUnread).forEach((id) => {
      if (!nextList.some((item) => item.id === id)) {
        delete nextUnread[id];
      }
    });

    if (activeId && nextUnread[activeId]) {
      delete nextUnread[activeId];
    }

    return nextUnread;
  }

  function appendMessage(message) {
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev;
      return [...prev, message];
    });
  }

  async function handleCreateConsultation() {
    if (!currentUserId) return;
    setIsBusy(true);
    setStatusMessage('');
    try {
      const created = await createConsultation({ patientId: currentUserId });
      setConsultations((prev) => mergeConsultations(prev, created));
      setActiveId(created.id);
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSubmitOnly() {
    if (!activeConsultation) return;
    setIsBusy(true);
    setStatusMessage('');
    try {
      const updated = await submitConsultation({
        id: activeConsultation.id,
        doctorId: doctorChoiceId || undefined
      });
      setConsultations((prev) => mergeConsultations(prev, updated));
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCloseConsultation() {
    if (!activeConsultation) return;
    setIsBusy(true);
    setStatusMessage('');
    try {
      const updated = await closeConsultation({ id: activeConsultation.id });
      setConsultations((prev) => mergeConsultations(prev, updated));
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteConsultation() {
    if (!activeConsultation) return;
    const confirmed = window.confirm(
      'Hapus riwayat konsultasi ini? Semua pesan akan terhapus permanen.'
    );
    if (!confirmed) return;

    setIsBusy(true);
    setStatusMessage('');
    try {
      await deleteConsultation({ id: activeConsultation.id });
      const nextList = consultations.filter((item) => item.id !== activeConsultation.id);
      setConsultations(nextList);
      setUnread((prev) => {
        if (!prev[activeConsultation.id]) return prev;
        const next = { ...prev };
        delete next[activeConsultation.id];
        return next;
      });
      setActiveId(nextList[0]?.id || '');
      setMessages([]);
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSend(mode) {
    if (!activeConsultation || !draft.trim()) return;

    const content = draft.trim();
    setIsBusy(true);
    setStatusMessage('');

    try {
      if (role === 'patient' && mode === 'ai') {
        const response = await requestAiResponse({
          id: activeConsultation.id,
          patientId: currentUserId,
          complaint: content
        });
        appendMessage(response.patientMessage);
        appendMessage(response.aiMessage);
        if (response.consultation) {
          setConsultations((prev) => mergeConsultations(prev, response.consultation));
        }
        setDraft('');
        return;
      }

      if (role === 'patient' && !activeConsultation.submittedToDoctor) {
        const updated = await submitConsultation({
          id: activeConsultation.id,
          doctorId: doctorChoiceId || undefined
        });
        setConsultations((prev) => mergeConsultations(prev, updated));
      }

      const senderRole = role === 'doctor' ? 'doctor' : 'patient';
      const response = await sendMessage({
        id: activeConsultation.id,
        senderId: currentUserId,
        senderRole,
        content
      });

      appendMessage(response.message);
      if (response.consultation) {
        setConsultations((prev) => mergeConsultations(prev, response.consultation));
      }

      setDraft('');
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogin() {
    if (!loginRole) {
      setStatusMessage('Pilih peran login terlebih dahulu.');
      return;
    }
    const username = loginUsername.trim();
    const password = loginPassword;
    if (!username || !password) {
      setStatusMessage('Username dan password wajib diisi.');
      return;
    }

    setIsBusy(true);
    setStatusMessage('');
    try {
      const user = await login({ username, password });
      if (loginRole && user.role !== loginRole) {
        const roleLabel = ROLE_LABELS[user.role] || user.role;
        setStatusMessage(`Akun ini terdaftar sebagai ${roleLabel}. Silakan pilih login ${roleLabel}.`);
        setLoginPassword('');
        return;
      }
      const [patients, doctors] = await Promise.all([getUsers('patient'), getUsers('doctor')]);
      setUsersByRole({ patient: patients, doctor: doctors });
      if (doctors.length > 0) setDoctorChoiceId(doctors[0].id);
      setRole(user.role);
      setCurrentUserId(user.id);
      setIsAuthenticated(true);
      writeStoredAuth({ role: user.role, userId: user.id });
      setLoginPassword('');
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSignUp() {
    if (loginRole && loginRole !== 'patient') {
      setStatusMessage('Akun dokter tidak bisa dibuat dari halaman ini.');
      return;
    }
    const username = signUpUsername.trim();
    const password = signUpPassword;
    if (!username || !password) {
      setStatusMessage('Username dan password wajib diisi.');
      return;
    }

    setIsBusy(true);
    setStatusMessage('');
    try {
      const user = await signUp({ username, password });
      const [patients, doctors] = await Promise.all([getUsers('patient'), getUsers('doctor')]);
      setUsersByRole({ patient: patients, doctor: doctors });
      setRole(user.role);
      setCurrentUserId(user.id);
      setIsAuthenticated(true);
      writeStoredAuth({ role: user.role, userId: user.id });
      setSignUpUsername('');
      setSignUpPassword('');
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  function handleRolePick(nextRole) {
    setLoginRole(nextRole);
    setLoginMode('login');
    setLoginUsername('');
    setLoginPassword('');
    setSignUpUsername('');
    setSignUpPassword('');
    setStatusMessage('');
  }

  function handleRoleReset() {
    setLoginRole('');
    setLoginMode('login');
    setLoginUsername('');
    setLoginPassword('');
    setSignUpUsername('');
    setSignUpPassword('');
    setStatusMessage('');
  }

  function handleLogout() {
    setIsAuthenticated(false);
    setLoginRole('');
    setLoginMode('login');
    setLoginUsername('');
    setLoginPassword('');
    setSignUpUsername('');
    setSignUpPassword('');
    setCurrentUserId('');
    setConsultations([]);
    setActiveId('');
    setMessages([]);
    setUnread({});
    setDraft('');
    setStatusMessage('');
    clearStoredAuth();
  }

  function handleContinueDemo() {
    setShowStartupPrompt(false);
  }

  function handleDownloadProject() {
    setShowStartupPrompt(false);
    window.location.href = DOWNLOAD_URL;
  }

  function renderMessageLabel(message) {
    if (message.senderRole === 'ai') return 'Jawaban AI';
    if (message.senderRole === 'doctor') return 'Jawaban Resmi Dokter';
    return null;
  }

  function renderSenderName(message) {
    if (message.senderRole === 'ai') return 'AI Assistant';
    if (message.senderRole === 'doctor') return message.senderName || 'Dokter';
    return message.senderName || 'Pasien';
  }

  const canSignUp = loginRole === 'patient';
  const showLoginForm = loginMode === 'login' || !canSignUp;

  const page = !isAuthenticated ? (
    <div className="login">
      <section className="login-panel">
        <div className="brand">
          <div className="brand-mark">+</div>
          <div>
            <h1>Medikit Chat</h1>
            <p>AI edukasi awal, keputusan tetap dokter</p>
          </div>
        </div>
        <h2>Mulai konsultasi jarak jauh dengan pendamping edukasi awal.</h2>
        <p>
          Pasien bisa meminta edukasi awal dari AI sebelum dokter memberikan keputusan medis
          resmi. Semua riwayat percakapan tersimpan aman untuk kebutuhan konsultasi.
        </p>
        <div className="login-highlights">
          <div className="highlight">
            <h3>AI Opsional</h3>
            <p>Memberikan edukasi awal, bukan diagnosis.</p>
          </div>
          <div className="highlight">
            <h3>Dokter Pusat Keputusan</h3>
            <p>Jawaban akhir tetap oleh dokter/tenaga medis.</p>
          </div>
          <div className="highlight">
            <h3>Riwayat Tersimpan</h3>
            <p>Dokumentasi konsultasi tercatat untuk tindak lanjut.</p>
          </div>
        </div>
      </section>

      <section className="login-card">
        {!loginRole ? (
          <>
            <h2>Pilih peran</h2>
            <p>Pilih peran untuk masuk ke halaman login.</p>
            <div className="role-choice">
              <button
                type="button"
                className="role-choice-card"
                onClick={() => handleRolePick('patient')}
              >
                <div className="role-choice-tag">Pasien</div>
                <h3>Masuk sebagai pasien</h3>
                <p>Mulai konsultasi, minta edukasi AI, dan pilih dokter tujuan.</p>
              </button>
              <button
                type="button"
                className="role-choice-card"
                onClick={() => handleRolePick('doctor')}
              >
                <div className="role-choice-tag">Dokter</div>
                <h3>Masuk sebagai dokter</h3>
                <p>Kelola konsultasi pasien dan kirim jawaban resmi.</p>
              </button>
            </div>
            <div className="login-note">
              AI hanya memberi edukasi umum. Keputusan medis tetap oleh dokter.
            </div>
          </>
        ) : (
          <>
            <div className="login-head">
              <div className="login-role">
                <div className="role-chip">{ROLE_LABELS[loginRole]}</div>
                <span>Masuk sebagai {ROLE_LABELS[loginRole]}</span>
              </div>
              <button type="button" className="btn ghost small" onClick={handleRoleReset}>
                Ganti peran
              </button>
            </div>

            {canSignUp && (
              <div className="role-toggle mode-toggle">
                {[
                  { key: 'login', label: 'Masuk' },
                  { key: 'signup', label: 'Daftar' }
                ].map((item) => (
                  <button
                    key={item.key}
                    className={loginMode === item.key ? 'active' : ''}
                    onClick={() => {
                      setLoginMode(item.key);
                      setStatusMessage('');
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {showLoginForm ? (
              <>
                <h2>{loginRole === 'doctor' ? 'Masuk Dokter' : 'Masuk'}</h2>
                <p>
                  {loginRole === 'doctor'
                    ? 'Gunakan akun dokter yang sudah terdaftar.'
                    : 'Masukkan username dan password untuk masuk ke ruang konsultasi.'}
                </p>
                <div className="field">
                  <label>Username</label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(event) => setLoginUsername(event.target.value)}
                    placeholder="Masukkan username"
                    autoComplete="username"
                  />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                  />
                </div>
                {statusMessage && <div className="banner">{statusMessage}</div>}
                <button
                  className="btn primary"
                  onClick={handleLogin}
                  disabled={isBusy || !loginUsername.trim() || !loginPassword}
                >
                  Masuk ke dashboard
                </button>
              </>
            ) : (
              <>
                <h2>Daftar</h2>
                <p>Buat akun pasien dengan username dan password.</p>
                <div className="field">
                  <label>Username</label>
                  <input
                    type="text"
                    value={signUpUsername}
                    onChange={(event) => setSignUpUsername(event.target.value)}
                    placeholder="Buat username"
                    autoComplete="username"
                  />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input
                    type="password"
                    value={signUpPassword}
                    onChange={(event) => setSignUpPassword(event.target.value)}
                    placeholder="Buat password"
                    autoComplete="new-password"
                  />
                </div>
                {statusMessage && <div className="banner">{statusMessage}</div>}
                <button
                  className="btn primary"
                  onClick={handleSignUp}
                  disabled={isBusy || !signUpUsername.trim() || !signUpPassword}
                >
                  Daftar dan masuk
                </button>
              </>
            )}
            <div className="login-note">
              AI hanya memberi edukasi umum. Keputusan medis tetap oleh dokter.
            </div>
          </>
        )}
      </section>
    </div>
  ) : (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">+</div>
          <div>
            <h1>Medikit Chat</h1>
            <p>AI edukasi awal, keputusan tetap dokter</p>
          </div>
        </div>

        <div className="role-chip">{ROLE_LABELS[role]}</div>

        <div className="field">
          <label>Pengguna aktif</label>
          <div className="user-pill">{currentUser?.name || '-'}</div>
        </div>

        {role === 'patient' && (
          <button className="btn primary" onClick={handleCreateConsultation} disabled={isBusy}>
            Mulai konsultasi baru
          </button>
        )}

        <button className="btn ghost" onClick={handleLogout} disabled={isBusy}>
          Keluar
        </button>

        <div className="section-title">Riwayat konsultasi</div>
        <div className="consultation-list">
          {consultations.map((item, index) => (
            <button
              key={item.id}
              className={`consultation-card ${activeId === item.id ? 'active' : ''}`}
              style={{ animationDelay: `${index * 60}ms` }}
              onClick={() => setActiveId(item.id)}
            >
              <div className="consultation-title">
                <span>{role === 'doctor' ? item.patientName : item.doctorName || 'Belum ada dokter'}</span>
                {unread[item.id] && <span className="badge unread">Baru</span>}
              </div>
              <div className="consultation-meta">
                <span>{statusLabel(item.status, item.submittedToDoctor)}</span>
                <span>{formatDateTime(item.updatedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="chat">
        {activeConsultation ? (
          <>
            <div className="chat-header">
              <div>
                <h2>
                  {role === 'doctor'
                    ? `Konsultasi ${activeConsultation.patientName}`
                    : `Konsultasi dengan ${activeConsultation.doctorName || 'dokter'}`}
                </h2>
                <p>
                  Status: {statusLabel(activeConsultation.status, activeConsultation.submittedToDoctor)}
                </p>
              </div>
              <div className="chat-header-actions">
                <button className="btn danger" onClick={handleDeleteConsultation} disabled={isBusy}>
                  Hapus riwayat
                </button>
                {role === 'patient' && !activeConsultation.submittedToDoctor && (
                  <button className="btn ghost" onClick={handleSubmitOnly} disabled={isBusy}>
                    Lanjutkan ke dokter
                  </button>
                )}
                {role === 'doctor' && activeConsultation.status !== 'selesai' && (
                  <button className="btn ghost" onClick={handleCloseConsultation} disabled={isBusy}>
                    Selesaikan konsultasi
                  </button>
                )}
              </div>
            </div>

            {!activeConsultation.submittedToDoctor && role === 'patient' && (
              <div className="banner">
                Percakapan ini belum dikirim ke dokter. Anda bisa meminta edukasi awal dari AI,
                atau kirimkan ke dokter kapan saja.
              </div>
            )}

            {hasAiMessages && (
              <div className="banner ai">
                AI hanya memberikan edukasi umum, bukan diagnosis. Keputusan akhir tetap oleh dokter.
              </div>
            )}

            <div className="message-list">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.senderRole} ${
                    message.senderRole === role ? 'self' : 'other'
                  }`}
                >
                  {renderMessageLabel(message) && (
                    <div className="message-label">{renderMessageLabel(message)}</div>
                  )}
                  <div className="bubble">{message.content}</div>
                  <div className="message-meta">
                    {renderSenderName(message)} · {formatTime(message.createdAt)}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="composer">
              {role === 'patient' && !activeConsultation.submittedToDoctor && (
                <div className="field">
                  <label>Dokter tujuan</label>
                  <select
                    value={doctorChoiceId}
                    onChange={(event) => setDoctorChoiceId(event.target.value)}
                  >
                    {(usersByRole.doctor || []).map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <textarea
                placeholder={
                  role === 'doctor'
                    ? 'Tulis jawaban akhir dokter...'
                    : 'Tuliskan keluhan atau pertanyaan kesehatan...'
                }
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="composer-actions">
                {role === 'patient' && !activeConsultation.submittedToDoctor ? (
                  <>
                    <button
                      className="btn secondary"
                      onClick={() => handleSend('ai')}
                      disabled={isBusy || !draft.trim()}
                    >
                      Minta edukasi AI
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => handleSend('doctor')}
                      disabled={isBusy || !draft.trim()}
                    >
                      Kirim ke dokter
                    </button>
                  </>
                ) : (
                  <button
                    className="btn primary"
                    onClick={() => handleSend('doctor')}
                    disabled={isBusy || !draft.trim()}
                  >
                    {role === 'doctor' ? 'Kirim jawaban dokter' : 'Kirim pesan'}
                  </button>
                )}
              </div>
              {statusMessage && <div className="banner">{statusMessage}</div>}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div>
              <h3>Pilih konsultasi</h3>
              <p>Mulai konsultasi baru atau pilih riwayat yang sudah ada.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );

  return (
    <>
      {showStartupPrompt && (
        <div className="startup-overlay" role="dialog" aria-modal="true" aria-labelledby="startup-title">
          <div className="startup-modal">
            <div className="startup-tag">Medikit Chat</div>
            <h2 id="startup-title">Mulai dengan cepat</h2>
            <p>Ingin download project ini atau langsung lanjutkan demo aplikasinya?</p>
            <div className="startup-actions">
              <button type="button" className="btn primary" onClick={handleContinueDemo}>
                Lanjutkan demo
              </button>
              <button type="button" className="btn ghost" onClick={handleDownloadProject}>
                Download this project
              </button>
            </div>
            <div className="startup-note">
              Download akan membuka Google Drive di tab yang sama.
            </div>
          </div>
        </div>
      )}
      {page}
    </>
  );
}

export default App;
