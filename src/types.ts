export type TransactionType = 'pengeluaran' | 'penambahan';

export interface Transaction {
  id: string;
  jenis: TransactionType;
  nama: string;
  nominal: number;
  nominalFinal: number;
  tanggal: string;
  treasurer: string;
  sumber?: string;
  locked: boolean;
  kembalian: number;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}
