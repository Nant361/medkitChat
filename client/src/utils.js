export function formatTime(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatDateTime(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function statusLabel(status, submitted) {
  if (!submitted) return 'Belum dikirim ke dokter';
  if (status === 'menunggu') return 'Menunggu dokter';
  if (status === 'dibalas_dokter') return 'Dibalas dokter';
  if (status === 'selesai') return 'Selesai';
  if (status === 'draft') return 'Draft';
  return status;
}
