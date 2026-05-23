# Security Specification - Petty Cash Management

Document ini mendefinisikan spesifikasi keamanan tingkat tinggi (Zero-Trust) untuk sistem manajemen Petty Cash menggunakan Firebase Firestore.

## 1. Data Invariants
1. **Kepemilikan Mandat (Identity)**: Setiap dokumen transaksi wajib memiliki field `userId` yang nilainya sama dengan UID pengguna yang terautentikasi (`request.auth.uid`).
2. **Kepatuhan Tipe (Schema & Type Safety)**: Field `jenis` hanya boleh berisi string `pengeluaran` atau `penambahan`. `nominal` dan `nominalFinal` wajib berupa bilangan positif.
3. **Keandalan Relasi (Integrity)**: Nominal `nominalFinal` pada pengeluaran harus divalidasi kembali setelah kembalian diinput: `nominalFinal == nominal - kembalian`.
4. **Imutabilitas Temporal**: Field `createdAt` tidak boleh diubah sekali dokumen dibuat.
5. **Kunci Akhir (Terminal State Locking)**: Transaksi yang sudah ditandai `locked: true` tidak dapat diubah lagi oleh pengguna biasa (Terminal State Lock).
6. **Validasi Waktu (Temporal Integrity)**: Field `createdAt` pada pembuatan wajib menggunakan server `request.time`, demikian juga `updatedAt` pada perbaruan data.
7. **Batas Ukuran**: Keterangan nama transaksi, treasurer, dan sumber dana dibatasi guna menghindari serangan Denial of Wallet (maksimum 128-250 karakter).

---

## 2. The "Dirty Dozen" Payloads (Aset Penyerangan)

Berikut adalah 12 payload jahat yang didesain untuk merusak integritas data kas, yang harus ditolak mutlak (`PERMISSION_DENIED`) oleh Security Rules:

### 1. Unauthenticated Write
Mencoba membuat transaksi baru tanpa login ke sistem Auth.
```json
{
  "id": "tx-malicious-1",
  "jenis": "pengeluaran",
  "nama": "Beli ATK",
  "nominal": 50000,
  "nominalFinal": 50000,
  "tanggal": "24-05-2026",
  "treasurer": "Penyusup",
  "locked": false,
  "kembalian": 0,
  "userId": "user-korban"
}
```

### 2. Identity Spoofing (Create)
Pengguna terautentikasi `user-penyerang` mencoba membuat dokumen transaksi atas nama `user-korban`.
```json
{
  "id": "tx-spoofed-2",
  "jenis": "pengeluaran",
  "nama": "Ganti Oli Inventaris",
  "nominal": 800000,
  "nominalFinal": 800000,
  "tanggal": "24-05-2026",
  "treasurer": "Penipu",
  "locked": false,
  "kembalian": 0,
  "userId": "user-korban" // Seharusnya user-penyerang
}
```

### 3. Identity Spoofing (Update)
Pengguna `user-penyerang` mencoba mengedit atau menyusup ke transaksi milik `user-korban` di database.
- **Target Path**: `/transactions/tx-korban-999` (dimiliki oleh `user-korban`)
- **Action**: `update`

### 4. ID Poisoning (Resource Poisoning)
Penyerang mengirimkan ID dokumen acak berukuran besar (misal 1MB teks sampah) untuk melumpuhkan performa database.
- **Target Path**: `/transactions/[SAMPAH_1MB_TEKS_JUNK]`

### 5. Penambahan Saldo dengan Nilai Negatif (Value Corrupt)
Mencoba memanipulasi perhitungan kas kecil dengan mengirimkan nilai nominal kurang dari atau sama dengan nol guna mengurangi saldo server secara destruktif.
```json
{
  "id": "tx-[#negative]",
  "jenis": "penambahan",
  "nama": "Top Up Kas",
  "nominal": -500000, // Nilai minus merusak sirkulasi saldo
  "nominalFinal": -500000,
  "tanggal": "2026-05-23",
  "treasurer": "Bendahara",
  "locked": false,
  "kembalian": 0,
  "userId": "user-penyerang"
}
```

### 6. Forge Timestamps (Create)
Mencoba mengirimkan data waktu lampau atau masa depan buatan klien untuk manipulasi audit log.
```json
{
  "id": "tx-forged-time",
  "jenis": "pengeluaran",
  "nama": "Beli Kertas",
  "nominal": 10000,
  "nominalFinal": 10000,
  "tanggal": "2026-05-23",
  "treasurer": "Hacker",
  "locked": false,
  "kembalian": 0,
  "userId": "user-penyerang",
  "createdAt": "2020-01-01T00:00:00Z" // Membawa waktu palsu, bukan request.time
}
```

### 7. Forge Timestamps (Update)
Mencoba memperbarui `updatedAt` dengan waktu palsu buatan lokal klien.

### 8. Shadow Field Injection (Ghost Keys)
Mencoba menyelundupkan field aneh yang tidak ada di struktur schema (seperti `isAdminOverride: true` atau `autoApprove: true`).
```json
{
  "id": "tx-ghost-1",
  ...
  "userId": "user-penyerang",
  "isAdminOverride": true, // Ghost field
  "autoApprove": "yes"
}
```

### 9. Lock Bypass Mode (Modifikasi Setelah Kunci)
Penyerang mengedit deskripsi pengeluaran yang statusnya sudah terkunci (`locked: true`).
- **Data Asli**: `locked: true`, `nama: "Beli Printer"`
- **Payload Baru**: `locked: true`, `nama: "Uang Dicuri"` (merusak audit log terkunci)

### 10. Nilai Kembalian Melebihi Belanja
Penyerang mengirim nilai kembalian 200.000 untuk transaksi belanja belanja asli yang bernilai 150.000 guna menghasilkan cetak saldo melambung (ilegal).
```json
{
  "id": "tx-inflation",
  "jenis": "pengeluaran",
  "nama": "Beli Konsumsi",
  "nominal": 150000,
  "nominalFinal": -50000, // Menghasilkan nilai minus akibat kembalian meluap
  "tanggal": "2026-05-23",
  "treasurer": "Penyusup",
  "locked": true,
  "kembalian": 200000
}
```

### 11. Immutability Violation (`id` / `jenis` change)
Mencoba mengubah tipe transaksi pengeluaran yang sudah ada menjadi penambahan saldo secara retrospektif.
- **Original**: `jenis: "pengeluaran"`
- **Updated Payload**: `jenis: "penambahan"` -> ILEGAL

### 12. Blanket List Requesting (Query Scraping)
Mencoba membaca daftar transaksi global tanpa memfilter berdasarkan `userId` kepemilikan sendiri.
- **Query**: `db.collection('transactions').get()` tanpa `.where('userId', '==', uid)`

---

## 3. Test Runner Specification
TDD validator diimplementasikan di `firestore.rules.test.ts` untuk memastikan bahwa semua kasus di atas ditolak oleh mesin aturan keamanan Firestore.
