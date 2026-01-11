# Model Sistem

## Model Konseptual (Tiga Lapisan)

```mermaid
flowchart LR
  UI[User Interface Layer\n- Halaman chat pasien\n- Konsultasi dokter\n- Riwayat konsultasi]
  APP[Application Logic Layer\n- Manajemen pesan\n- Manajemen konsultasi\n- Integrasi AI\n- Verifikasi dokter]
  DATA[Data Management Layer\n- Users\n- Consultations\n- Messages]

  UI --> APP --> DATA
```

## Model Interaksi AI (Opsional)

```mermaid
sequenceDiagram
  participant P as Pasien
  participant A as AI Assistant
  participant D as Dokter

  P->>A: Kirim keluhan (opsional)
  A-->>P: Edukasi awal (bukan diagnosis)
  P->>D: Lanjutkan konsultasi
  D-->>P: Jawaban resmi dokter
```

## Model Alur Proses (Sederhana)

```mermaid
flowchart TD
  L[Login] --> K[Pasien isi keluhan]
  K --> O{Pilih alur}
  O -->|Langsung ke dokter| D[Dokter meninjau]
  O -->|Minta AI| A[AI memberi edukasi awal]
  A --> D
  D --> R[Dokter jawab final]
  R --> S[Simpan riwayat konsultasi]
```

## Model Data (Ringkas)

```mermaid
erDiagram
  USERS {
    string id
    string name
    int age
    string gender
    string role
  }

  CONSULTATIONS {
    string id
    string patientId
    string doctorId
    string status
    string startedAt
    string endedAt
    boolean submittedToDoctor
  }

  MESSAGES {
    string id
    string consultationId
    string senderId
    string senderRole
    string content
    string createdAt
  }

  USERS ||--o{ CONSULTATIONS : creates
  USERS ||--o{ MESSAGES : sends
  CONSULTATIONS ||--o{ MESSAGES : contains
```

Catatan: respons AI direpresentasikan sebagai `MESSAGES.senderRole = 'ai'`.
