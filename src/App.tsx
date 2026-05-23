import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShoppingCart, 
  Coins, 
  Plus, 
  List, 
  Search, 
  Lock, 
  Unlock, 
  Trash2, 
  RotateCcw, 
  FileDown, 
  X, 
  Check, 
  AlertCircle, 
  Calendar, 
  User, 
  Coins as CoinIcon,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Download,
  LogIn,
  LogOut,
  Cloud,
  Database,
  Mail,
  Key,
  ShieldCheck
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Transaction, TransactionType } from './types';
import { auth, db, googleProvider } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp, 
  writeBatch 
} from 'firebase/firestore';

// Helper to format currency
const formatIDR = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

// Initial realistic default data
const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    jenis: 'penambahan',
    nama: 'Saldo Awal Kas Organisasi',
    nominal: 2500000,
    nominalFinal: 2500000,
    tanggal: '2026-05-20',
    treasurer: 'Siti Rahma',
    sumber: 'Kas Utama Divisi',
    locked: false,
    kembalian: 0
  },
  {
    id: 'tx-2',
    jenis: 'pengeluaran',
    nama: 'Beli Kertas HVS A4 & Tinta Printer',
    nominal: 185000,
    nominalFinal: 185000,
    tanggal: '2026-05-21',
    treasurer: 'Budi Santoso',
    locked: false,
    kembalian: 0
  },
  {
    id: 'tx-3',
    jenis: 'pengeluaran',
    nama: 'Kebutuhan Sembako & Kopi Pantry',
    nominal: 150000,
    nominalFinal: 125000,
    tanggal: '2026-05-22',
    treasurer: 'Ahmad Dahlan',
    locked: true,
    kembalian: 25000
  }
];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasOfflineData, setHasOfflineData] = useState(false);

  // Auth screen inputs
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Tab State: 'pengeluaran' | 'penambahan'
  const [activeTab, setActiveTab] = useState<TransactionType>('pengeluaran');

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pengeluaran' | 'penambahan' | 'locked' | 'unlocked'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  // Input States - Pengeluaran Form
  const [pNama, setPNama] = useState('');
  const [pNominal, setPNominal] = useState('');
  const [pTanggal, setPTanggal] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [pTreasurer, setPTreasurer] = useState('');

  // Input States - Penambahan Form
  const [tNominal, setTNominal] = useState('');
  const [tSumber, setTSumber] = useState('');
  const [tTreasurer, setTTreasurer] = useState('');

  // Notification Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modal State for "Kembalian" 
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [inputKembalian, setInputKembalian] = useState('');
  const [modalError, setModalError] = useState('');

  // Check if offline transactions exist for migration
  useEffect(() => {
    const saved = localStorage.getItem('petty_cash_transactions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHasOfflineData(true);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Utility to trigger custom toast notifications
  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 4000);
  };

  // Listen to Firestore real-time data
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const createdStr = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '';
        const updatedStr = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '';
        
        docs.push({
          id: docSnap.id,
          jenis: data.jenis,
          nama: data.nama,
          nominal: data.nominal,
          nominalFinal: data.nominalFinal,
          tanggal: data.tanggal,
          treasurer: data.treasurer,
          sumber: data.sumber,
          locked: data.locked,
          kembalian: data.kembalian,
          userId: data.userId,
          createdAt: createdStr,
          updatedAt: updatedStr,
        });
      });
      setTransactions(docs);
    }, (error) => {
      console.error("Firestore loading error:", error);
      triggerToast("Gagal menyinkronkan data dengan database Firestore.", "error");
    });

    return () => unsubscribe();
  }, [user]);

  // Math Derived States (single source of truth based on transactions list)
  const totalPenambahan = transactions
    .filter(t => t.jenis === 'penambahan')
    .reduce((sum, t) => sum + t.nominal, 0);

  const totalPengeluaran = transactions
    .filter(t => t.jenis === 'pengeluaran')
    .reduce((sum, t) => sum + t.nominalFinal, 0);

  const currentSaldo = totalPenambahan - totalPengeluaran;

  // Handles adding an Outflow (Pengeluaran)
  const handleAddPengeluaran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      triggerToast('Anda harus masuk log terlebih dahulu.', 'error');
      return;
    }
    const cleanNama = pNama.trim();
    const cleanTreasurer = pTreasurer.trim();
    const parsedNominal = parseFloat(pNominal);

    if (!cleanNama || isNaN(parsedNominal) || parsedNominal <= 0 || !pTanggal || !cleanTreasurer) {
      triggerToast('Harap lengkapi semua isian formulir pengeluaran dengan benar.', 'error');
      return;
    }

    if (parsedNominal > currentSaldo) {
      triggerToast(`Saldo tidak mencukupi! Saldo saat ini hanya ${formatIDR(currentSaldo)}.`, 'error');
      return;
    }

    const docId = `tx-${Date.now()}`;
    const newTx = {
      id: docId,
      jenis: 'pengeluaran' as const,
      nama: cleanNama,
      nominal: parsedNominal,
      nominalFinal: parsedNominal,
      tanggal: pTanggal,
      treasurer: cleanTreasurer,
      locked: false,
      kembalian: 0,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'transactions', docId), newTx);
      triggerToast('Pengeluaran berhasil dicatat ke Firebase!', 'success');
      // Reset inputs
      setPNama('');
      setPNominal('');
      setPTreasurer('');
    } catch (err: any) {
      console.error(err);
      triggerToast('Gagal menyimpan transaksi ke Firebase. Silakan periksa koneksi atau rules Anda.', 'error');
    }
  };

  // Handles adding an Inflow (Penambahan Saldo)
  const handleAddPenambahan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      triggerToast('Anda harus masuk log terlebih dahulu.', 'error');
      return;
    }
    const parsedNominal = parseFloat(tNominal);
    const cleanSumber = tSumber.trim();
    const cleanTreasurer = tTreasurer.trim();
    const todayStr = new Date().toISOString().split('T')[0];

    if (isNaN(parsedNominal) || parsedNominal <= 0 || !cleanSumber || !cleanTreasurer) {
      triggerToast('Harap lengkapi semua isian formulir penambahan saldo dengan benar.', 'error');
      return;
    }

    const docId = `tx-${Date.now()}`;
    const newTx = {
      id: docId,
      jenis: 'penambahan' as const,
      nama: 'Penambahan Saldo Kas',
      nominal: parsedNominal,
      nominalFinal: parsedNominal,
      tanggal: todayStr,
      treasurer: cleanTreasurer,
      sumber: cleanSumber,
      locked: false,
      kembalian: 0,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'transactions', docId), newTx);
      triggerToast('Saldo kas berhasil ditambahkan ke Firebase!', 'success');
      // Reset inputs
      setTNominal('');
      setTSumber('');
      setTTreasurer('');
    } catch (err: any) {
      console.error(err);
      triggerToast('Gagal menambahkan saldo ke Firebase.', 'error');
    }
  };

  // Handles opening the Return Change (Kembalian) modal
  const handleOpenKembalianModal = (txId: string) => {
    setSelectedTxId(txId);
    setInputKembalian('');
    setModalError('');
    setModalOpen(true);
  };

  // Submits the return change to a transaction
  const handleConfirmKembalian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxId || !user) return;

    const parsedKembalian = parseFloat(inputKembalian);
    if (isNaN(parsedKembalian) || parsedKembalian < 0) {
      setModalError('Masukkan nominal kembalian yang valid (minimal 0).');
      return;
    }

    const targetTx = transactions.find(t => t.id === selectedTxId);
    if (!targetTx) return;

    if (parsedKembalian > targetTx.nominal) {
      setModalError(`Kembalian tidak boleh melebihi pengeluaran asli (${formatIDR(targetTx.nominal)}).`);
      return;
    }

    try {
      const txRef = doc(db, 'transactions', selectedTxId);
      await updateDoc(txRef, {
        kembalian: parsedKembalian,
        nominalFinal: targetTx.nominal - parsedKembalian,
        locked: true,
        updatedAt: serverTimestamp()
      });
      setModalOpen(false);
      setSelectedTxId(null);
      triggerToast(`Kembalian ${formatIDR(parsedKembalian)} disimpan & transaksi dikunci!`, 'success');
    } catch (err: any) {
      console.error(err);
      setModalError('Gagal mengunci transaksi di Firebase.');
    }
  };

  // Handles deleting a transaction (allows backing out mistakes)
  const handleDeleteTransaction = async (txId: string) => {
    if (!user) return;
    const target = transactions.find(t => t.id === txId);
    if (!target) return;

    const confirmMsg = target.jenis === 'penambahan' 
      ? `Apakah Anda yakin ingin menghapus transaksi masuk senilai ${formatIDR(target.nominal)}? Tindakan ini akan memotong saldo saat ini di Firebase.`
      : `Apakah Anda yakin ingin menghapus transaksi keluar "${target.nama}" senilai ${formatIDR(target.nominalFinal)}? Tindakan ini akan mengembalikan nominal ke saldo saat ini di Firebase.`;

    if (window.confirm(confirmMsg)) {
      try {
        await deleteDoc(doc(db, 'transactions', txId));
        triggerToast('Transaksi berhasil dihapus dari Firebase!', 'info');
      } catch (err: any) {
        console.error(err);
        triggerToast('Gagal menghapus transaksi dari Firebase. Transaksi mungkin sudah dikunci.', 'error');
      }
    }
  };

  // Clear all transactions to reset board
  const handleResetBoard = async () => {
    if (!user) return;
    if (window.confirm('PERINGATAN: Apakah Anda yakin ingin menghapus semua catatan transaksi dan mereset saldo Petty Cash Anda ke nol di Firebase?')) {
      try {
        const batch = writeBatch(db);
        transactions.forEach((t) => {
          batch.delete(doc(db, 'transactions', t.id));
        });
        await batch.commit();
        triggerToast('Seluruh data Petty Cash telah direset di Firebase.', 'info');
      } catch (err: any) {
        console.error(err);
        triggerToast('Gagal mereset data di Firebase.', 'error');
      }
    }
  };

  // Migrate offline data to Firebase
  const handleMigrateOfflineData = async () => {
    if (!user) return;
    const saved = localStorage.getItem('petty_cash_transactions');
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Transaction[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const batch = writeBatch(db);
        parsed.forEach((t) => {
          const docId = t.id.startsWith('tx-') ? t.id : `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          const cleanedTx = {
            id: docId,
            jenis: t.jenis,
            nama: t.nama || 'Transaksi Kas',
            nominal: t.nominal,
            nominalFinal: t.nominalFinal,
            tanggal: t.tanggal,
            treasurer: t.treasurer || 'Bendahara',
            locked: t.locked || false,
            kembalian: t.kembalian || 0,
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...(t.jenis === 'penambahan' ? { sumber: t.sumber || 'Kas Utama' } : {})
          };
          batch.set(doc(db, 'transactions', docId), cleanedTx);
        });
        await batch.commit();
        localStorage.removeItem('petty_cash_transactions');
        setHasOfflineData(false);
        triggerToast('Berhasil mengunggah & menyinkronkan data lokal Anda ke Firebase!', 'success');
      }
    } catch (err: any) {
      console.error(err);
      triggerToast('Gagal memigrasikan data offline ke Firebase.', 'error');
    }
  };

  // Submit custom Email/Password auth
  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    const cleanEmail = authEmail.trim();
    const pswd = authPassword;

    if (!cleanEmail || !pswd) {
      setAuthError('Harap lengkapi email dan password.');
      setAuthSubmitting(false);
      return;
    }

    try {
      if (isSignUp) {
        // Sign Up with Email
        await createUserWithEmailAndPassword(auth, cleanEmail, pswd);
        triggerToast('Akun berhasil dibuat & masuk log otomatis!', 'success');
      } else {
        // Sign In with Email
        await signInWithEmailAndPassword(auth, cleanEmail, pswd);
        triggerToast('Berhasil masuk log!', 'success');
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Gagal melakukan autentikasi.';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Email sudah terdaftar. Silakan masuk log.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errorMsg = 'Email atau password salah.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Password harus minimal 6 karakter.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Format email tidak valid.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMsg = 'Provider Email/Password belum diaktifkan di Firebase Console Anda. Harap aktifkan di Firebase Console > Authentication > Sign-in method.';
      } else {
        errorMsg = `Error (${err.code || 'unknown'}): ${err.message || 'Silakan periksa konfigurasi Firebase Anda.'}`;
      }
      setAuthError(errorMsg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Google sign in helper
  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
      triggerToast('Berhasil masuk via Google!', 'success');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Popup ditutup sebelum proses login selesai.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setAuthError('Provider Google belum diaktifkan di Firebase Console Anda. Harap aktifkan di Firebase Console > Authentication > Sign-in method.');
      } else if (err.code === 'auth/popup-blocked') {
        setAuthError('Popup diblokir oleh browser. Harap buka aplikasi di Tab Baru (menggunakan tombol di kanan atas preview).');
      } else {
        setAuthError(`Gagal masuk via Google (${err.code || 'unknown'}): ${err.message || 'Coba lagi.'}`);
      }
    }
  };

  // Sign out helper
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      triggerToast('Berhasil keluar log.', 'info');
    } catch (err: any) {
      console.error(err);
      triggerToast('Gagal keluar log.', 'error');
    }
  };

  // Export current data as JSON file for storage
  const handleExportJSON = () => {
    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      saldoAkhir: currentSaldo,
      data: transactions
    }, null, 2);

    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `petty-cash-report-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    triggerToast('Laporan Petty Cash diunduh dalam format JSON', 'success');
  };

  // Filter and Sort Processing
  const filteredTransactions = transactions.filter(t => {
    // 1. Keyword search (by title, treasurer, fund source)
    const matchesSearch = 
      t.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.treasurer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.sumber && t.sumber.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Type/Lock Status selection dropdown
    if (typeFilter === 'pengeluaran') return t.jenis === 'pengeluaran';
    if (typeFilter === 'penambahan') return t.jenis === 'penambahan';
    if (typeFilter === 'locked') return t.locked === true;
    if (typeFilter === 'unlocked') return t.jenis === 'pengeluaran' && !t.locked;

    return true; // value 'all'
  }).sort((a, b) => {
    if (sortBy === 'date-desc') {
      return b.tanggal.localeCompare(a.tanggal) || b.id.localeCompare(a.id);
    }
    if (sortBy === 'date-asc') {
      return a.tanggal.localeCompare(b.tanggal) || a.id.localeCompare(b.id);
    }
    if (sortBy === 'amount-desc') {
      const valA = a.jenis === 'pengeluaran' ? a.nominalFinal : a.nominal;
      const valB = b.jenis === 'pengeluaran' ? b.nominalFinal : b.nominal;
      return valB - valA;
    }
    if (sortBy === 'amount-asc') {
      const valA = a.jenis === 'pengeluaran' ? a.nominalFinal : a.nominal;
      const valB = b.jenis === 'pengeluaran' ? b.nominalFinal : b.nominal;
      return valA - valB;
    }
    return 0;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-[#0051FF] text-white flex items-center justify-center shadow-lg shadow-blue-500/15 animate-pulse">
            <Wallet className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0051FF] animate-ping"></span>
            <span className="text-xs font-bold text-slate-500 tracking-wider">MENGHUBUNGKAN KE FIREBASE CLOUD DATABASE...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 select-none font-sans">
        <AnimatePresence>
          {toast && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
            >
              <div className={`p-4 rounded-xl shadow-lg border flex items-center gap-3 ${
                toast.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : toast.type === 'error' 
                  ? 'bg-rose-50 border-rose-200 text-rose-800' 
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <div className="shrink-0">
                  {toast.type === 'success' && <Check className="h-5 w-5 text-emerald-600" />}
                  {toast.type === 'error' && <AlertCircle className="h-5 w-5 text-rose-600" />}
                  {toast.type === 'info' && <AlertCircle className="h-5 w-5 text-blue-600" />}
                </div>
                <p className="text-xs font-medium leading-tight">{toast.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full max-w-md bg-white border border-slate-200/80 shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-[#0051FF] text-white p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl opacity-10 -mr-8 -mt-8"></div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="bg-white/15 p-2 rounded-lg border border-white/20">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">Petty Cash Cloud</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-1">Selamat datang kembali!</h2>
            <p className="text-xs text-blue-100 font-medium">Masuk untuk mensinkronisasi pengeluaran dan kas kecil organisasi secara real-time ke Firebase.</p>
          </div>

          <div className="p-8 space-y-6">
            <button
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Masuk dengan Google (Disarankan)</span>
            </button>

            <div className="flex items-center gap-3">
              <span className="flex-1 h-px bg-slate-100"></span>
              <span className="text-3xs uppercase font-extrabold tracking-widest text-slate-400">Atau Gunakan Email</span>
              <span className="flex-1 h-px bg-slate-100"></span>
            </div>

            <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
              <div className="space-y-3">
                <div className="form-group flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="cth: bendahara@organisasi.id"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 hover:border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0051FF] focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="form-group flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Kata Sandi</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="Minimal 6 karakter"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 hover:border-slate-300 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0051FF] focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-3xs font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-2.5 px-4 bg-[#0051FF] border border-[#0051FF] text-white hover:bg-[#0040DF] rounded-xl text-xs font-semibold disabled:pointer-events-none disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
              >
                {authSubmitting ? (
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <LogIn className="h-3.5 w-3.5" />
                )}
                <span>{isSignUp ? 'Daftar Akun Baru' : 'Masuk Jurnal Cloud'}</span>
              </button>
            </form>

            <p className="text-center text-xs text-slate-500">
              {isSignUp ? 'Sudah memiliki akun?' : 'Belum memiliki akun?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError('');
                }}
                className="text-[#0051FF] hover:underline font-bold bg-transparent border-none cursor-pointer"
              >
                {isSignUp ? 'Masuk Sekarang' : 'Daftar Sekarang'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="petty-cash-app" className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <div className={`p-4 rounded-xl shadow-lg border flex items-center gap-3 ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : toast.type === 'error' 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <div className="shrink-0">
                {toast.type === 'success' && <Check className="h-5 w-5 text-emerald-600" />}
                {toast.type === 'error' && <AlertCircle className="h-5 w-5 text-rose-600" />}
                {toast.type === 'info' && <AlertCircle className="h-5 w-5 text-blue-600" />}
              </div>
              <p className="text-sm font-medium leading-tight">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Block with Clean Black & Blue accents */}
        <header id="app-header" className="border-b border-slate-100 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="bg-[#0051FF] text-white p-2 rounded-lg flex items-center justify-center shadow-sm">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manajemen Petty Cash</h1>
                <p className="text-xs text-slate-500 font-medium">Buku Kas Kecil Digital Organisasi</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2 font-mono flex items-center gap-1.5 pt-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#0051FF] animate-pulse"></span>
              Sesi Sistem: <span className="font-semibold text-slate-600">2026-05-23 12:53:32 UTC</span>
            </p>
          </div>

          {/* Quick System Controls */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {/* User and Cloud Status Indicator */}
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-1.5 text-xs text-slate-700">
              <Cloud className="h-4 w-4 text-[#0051FF] shrink-0" />
              <div className="flex flex-col">
                <span className="font-extrabold text-[10px] uppercase text-[#0051FF] tracking-wider flex items-center gap-1">
                  Firebase Connected
                </span>
                <span className="font-medium text-slate-500 max-w-[150px] truncate" title={user?.email || 'User'}>
                  {user?.email || 'Organisasi Cloud'}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="ml-1 p-1 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-700 transition-all cursor-pointer focus:outline-none"
                title="Keluar dari Akun"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              id="export-btn"
              onClick={handleExportJSON}
              className="px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0040DF] bg-[#0051FF] border border-[#0051FF] rounded-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              title="Unduh Laporan Format JSON"
            >
              <Download className="h-3.5 w-3.5" />
              Ekspor Data
            </button>
            
            <button
              id="reset-btn"
              onClick={handleResetBoard}
              className="px-3.5 py-1.5 text-xs font-semibold text-[#0051FF] hover:bg-[#0051FF]/5 bg-transparent border border-[#0051FF]/30 hover:border-[#0051FF] rounded-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Mulai Ulang Spreadsheet Kas"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Kas
            </button>
          </div>
        </header>

        {/* Offline local data migration banner alert */}
        <AnimatePresence>
          {hasOfflineData && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 bg-blue-50/80 border border-blue-200/50 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 overflow-hidden shadow-sm"
            >
              <div className="flex items-start gap-3.5">
                <div className="bg-[#0051FF] text-white p-2.5 rounded-xl shrink-0 shadow-sm shadow-[#0051FF]/10">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Ditemukan Data Kas Lokal Offline</h4>
                  <p className="text-3xs text-slate-500 leading-normal mt-0.5 max-w-xl">Kami mendeteksi catatan transaksi petty cash offline yang tersimpan di perangkat Anda. Jika Anda ingin menggabungkannya ke dalam server Firebase cloud, Anda dapat mengunggahnya sekarang.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end md:self-auto shrink-0 font-sans">
                <button
                  onClick={() => {
                    localStorage.removeItem('petty_cash_transactions');
                    setHasOfflineData(false);
                    triggerToast('Jurnal lokal telah dibersihkan.', 'info');
                  }}
                  className="px-3.5 py-1.5 text-3xs font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all active:scale-95 cursor-pointer"
                >
                  Bersihkan
                </button>
                <button
                  onClick={handleMigrateOfflineData}
                  className="px-4 py-1.5 text-3xs font-extrabold text-white bg-[#0051FF] hover:bg-[#0040DF] border border-[#0051FF] rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Cloud className="h-3.5 w-3.5" />
                  Unggah ke Cloud
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard Financial Widgets Grid */}
        <div id="financial-summary-grid" className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          
          {/* Main Card: SALDO SAAT INI */}
          <div className="bg-[#0051FF] text-white border border-[#0051FF] rounded-2xl p-6 relative overflow-hidden shadow-sm shadow-[#0051FF]/10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl opacity-10 -mr-8 -mt-8 pointer-events-none"></div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-blue-100">Saldo Saat Ini</span>
              <span className="bg-white/15 text-white text-2xs px-2.5 py-0.5 rounded-full font-semibold border border-white/20">Aktif</span>
            </div>
            <div className="text-3xl font-bold font-mono tracking-tight text-white mb-1" id="current-saldo-number">
              {formatIDR(currentSaldo)}
            </div>
          </div>

          {/* Sub Card: TOTAL PENAMBAHAN */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Total Penambahan</span>
              <span className="p-0.5 px-1.5 text-[10px] text-[#0051FF] bg-blue-50 border border-blue-100 rounded-md font-semibold flex items-center gap-0.5">
                <TrendingUp className="h-2.5 w-2.5" /> Inflow
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {formatIDR(totalPenambahan)}
            </div>
          </div>

          {/* Sub Card: TOTAL PENGELUARAN */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Total Pengeluaran</span>
              <span className="p-0.5 px-1.5 text-[10px] text-rose-600 bg-rose-50 border border-rose-100 rounded-md font-semibold flex items-center gap-0.5">
                <TrendingDown className="h-2.5 w-2.5" /> Outflow
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {formatIDR(totalPengeluaran)}
            </div>
          </div>

        </div>

        {/* Lower Content Workspace Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT AREA: Switchable Forms For New Inputs (Span 4) */}
          <div id="forms-sidebar" className="lg:col-span-4 space-y-6">
            
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              
              {/* Tab Selector Buttons */}
              <div className="flex border-b border-slate-100">
                <button
                  id="tab-btn-pengeluaran"
                  onClick={() => setActiveTab('pengeluaran')}
                  className={`flex-1 py-3 text-center text-xs font-bold tracking-wide uppercase transition-all flex items-center justify-center gap-1.5 focus:outline-none border-b-2 cursor-pointer ${
                    activeTab === 'pengeluaran'
                      ? 'border-[#0051FF] text-[#0051FF] bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                  }`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                  Pengeluaran
                </button>
                <button
                  id="tab-btn-penambahan"
                  onClick={() => setActiveTab('penambahan')}
                  className={`flex-1 py-3 text-center text-xs font-bold tracking-wide uppercase transition-all flex items-center justify-center gap-1.5 focus:outline-none border-b-2 cursor-pointer ${
                    activeTab === 'penambahan'
                      ? 'border-[#0051FF] text-[#0051FF] bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                  }`}
                >
                  <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" />
                  Tambah Saldo
                </button>
              </div>

              {/* Form Content Wrapper */}
              <div className="p-5">
                
                {/* 1. EXPENSE (PENGELUARAN) FORM */}
                {activeTab === 'pengeluaran' && (
                  <form id="form-pengeluaran" onSubmit={handleAddPengeluaran} className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <div className="bg-rose-50 text-rose-600 p-1.5 rounded-md">
                        <ShoppingCart className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Form Pengeluaran</h3>
                        <p className="text-3xs text-slate-400">Catat belanja kas keluar</p>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      <div className="form-group flex flex-col gap-1">
                        <label htmlFor="p-nama-input" className="text-xs font-bold text-slate-700">Nama Pengeluaran</label>
                        <input
                          id="p-nama-input"
                          type="text"
                          value={pNama}
                          onChange={(e) => setPNama(e.target.value)}
                          placeholder="cth: Pembelian ATK Bulanan"
                          className="w-full text-xs px-3 py-2 border border-slate-200 hover:border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                        />
                      </div>

                      <div className="form-group flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <label htmlFor="p-nominal-input" className="text-xs font-bold text-slate-700">Nominal Belanja (Rp)</label>
                          {pNominal && !isNaN(parseFloat(pNominal)) && (
                            <span className="text-3xs font-mono font-bold text-slate-400">
                              {formatIDR(parseFloat(pNominal))}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                          <input
                            id="p-nominal-input"
                            type="number"
                            min="1"
                            value={pNominal}
                            onChange={(e) => setPNominal(e.target.value)}
                            placeholder="0"
                            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 hover:border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono transition-all"
                          />
                        </div>
                        {pNominal && parseFloat(pNominal) > currentSaldo && (
                          <span className="text-3xs text-rose-600 font-medium flex items-center gap-1 mt-0.5">
                            <AlertCircle className="h-2.5 w-2.5 inline shrink-0" />
                            Peringatan: Melebihi saldo aktif ({formatIDR(currentSaldo)})!
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="form-group flex flex-col gap-1">
                          <label htmlFor="p-tanggal-input" className="text-xs font-bold text-slate-700">Tanggal</label>
                          <input
                            id="p-tanggal-input"
                            type="date"
                            value={pTanggal}
                            onChange={(e) => setPTanggal(e.target.value)}
                            className="w-full text-xs px-3 py-2 border border-slate-200 hover:border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono transition-all"
                          />
                        </div>

                        <div className="form-group flex flex-col gap-1">
                          <label htmlFor="p-treasurer-input" className="text-xs font-bold text-slate-700">Bendahara (PJK)</label>
                          <input
                            id="p-treasurer-input"
                            type="text"
                            value={pTreasurer}
                            onChange={(e) => setPTreasurer(e.target.value)}
                            placeholder="Nama PIC"
                            className="w-full text-xs px-3 py-2 border border-slate-200 hover:border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      id="submit-pengeluaran-button"
                      type="submit"
                      disabled={!pNama || !pNominal || !pTreasurer || parseFloat(pNominal) > currentSaldo}
                      className="w-full mt-2 py-2 px-4 rounded-lg bg-[#0051FF] border border-[#0051FF] text-white font-semibold text-xs hover:bg-[#0040DF] active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Catat Pengeluaran
                    </button>
                  </form>
                )}

                {/* 2. TOPUP (PENAMBAHAN SALDO) FORM */}
                {activeTab === 'penambahan' && (
                  <form id="form-penambahan" onSubmit={handleAddPenambahan} className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-md">
                        <CoinIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Top Up Saldo</h3>
                        <p className="text-3xs text-slate-400">Tambah pagu kas masuk</p>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      <div className="form-group flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <label htmlFor="t-nominal-input" className="text-xs font-bold text-slate-700">Nominal Ditambahkan (Rp)</label>
                          {tNominal && !isNaN(parseFloat(tNominal)) && (
                            <span className="text-3xs font-mono font-bold text-slate-400">
                              {formatIDR(parseFloat(tNominal))}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                          <input
                            id="t-nominal-input"
                            type="number"
                            min="1"
                            value={tNominal}
                            onChange={(e) => setTNominal(e.target.value)}
                            placeholder="0"
                            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 hover:border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono transition-all"
                          />
                        </div>
                      </div>

                      <div className="form-group flex flex-col gap-1">
                        <label htmlFor="t-sumber-input" className="text-xs font-bold text-slate-700">Sumber Dana / Akun Asal</label>
                        <input
                          id="t-sumber-input"
                          type="text"
                          value={tSumber}
                          onChange={(e) => setTSumber(e.target.value)}
                          placeholder="cth: Tarik Tunai Rekening, Kas Mandiri"
                          className="w-full text-xs px-3 py-2 border border-slate-200 hover:border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                        />
                      </div>

                      <div className="form-group flex flex-col gap-1">
                        <label htmlFor="t-treasurer-input" className="text-xs font-bold text-slate-700">Penanggung Jawab (Treasurer)</label>
                        <input
                          id="t-treasurer-input"
                          type="text"
                          value={tTreasurer}
                          onChange={(e) => setTTreasurer(e.target.value)}
                          placeholder="Nama PIC penerima"
                          className="w-full text-xs px-3 py-2 border border-slate-200 hover:border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <button
                      id="submit-penambahan-button"
                      type="submit"
                      disabled={!tNominal || !tSumber || !tTreasurer}
                      className="w-full mt-2 py-2 px-4 rounded-lg bg-[#0051FF] border border-[#0051FF] text-white font-semibold text-xs hover:bg-[#0040DF] active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tambah Saldo
                    </button>
                  </form>
                )}

              </div>
            </div>

          </div>

          {/* RIGHT AREA: Search, Filters, Stats and Transactions Log (Span 8) */}
          <div id="logs-area" className="lg:col-span-8 space-y-4">
            
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              
              <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-100 text-slate-700 p-1.5 rounded-lg">
                    <List className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Log & Jurnal Transaksi</h2>
                    <p className="text-3xs text-slate-400">Seluruh riwayat pengisian dan pemakaian kas</p>
                  </div>
                </div>

                {/* Counter of shown logs */}
                <div className="text-3xs text-slate-500 font-medium">
                  Menampilkan <span className="font-bold text-slate-800">{filteredTransactions.length}</span> dari {transactions.length} transaksi
                </div>
              </div>

              {/* Filtering Controls Bar */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                  
                  {/* Search input bar */}
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      id="log-search-bar"
                      type="text"
                      className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 hover:border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400"
                      placeholder="Cari keterangan, bendahara, sumber dana..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Filters type */}
                  <div className="flex flex-wrap gap-2">
                    <div className="flex flex-col gap-0.5">
                      <select
                        id="filter-type-dropdown"
                        className="text-xs bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as any)}
                      >
                        <option value="all">Semua Jenis Transaksi</option>
                        <option value="pengeluaran">Khusus Pengeluaran</option>
                        <option value="penambahan">Khusus Pemasukan/Top-up</option>
                        <option value="locked">Terkunci (Ada Kembalian)</option>
                        <option value="unlocked">Belum Dikunci (Bisa Kembalian)</option>
                      </select>
                    </div>

                    {/* Sorting dropdown */}
                    <div className="flex flex-col gap-0.5">
                      <select
                        id="filter-sort-dropdown"
                        className="text-xs bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                      >
                        <option value="date-desc">Urutan: Tanggal Terbaru</option>
                        <option value="date-asc">Urutan: Tanggal Terlama</option>
                        <option value="amount-desc">Nominal: Tertinggi</option>
                        <option value="amount-asc">Nominal: Terendah</option>
                      </select>
                    </div>
                  </div>

                </div>
              </div>

              {/* Transactions Table Section */}
              <div className="overflow-x-auto">
                <table id="transaksi-table" className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-3 px-4 text-3xs font-bold text-slate-400 uppercase tracking-widest font-mono">Info Tanggal</th>
                      <th className="py-3 px-4 text-3xs font-bold text-slate-400 uppercase tracking-widest">Detail & Keterangan</th>
                      <th className="py-3 px-4 text-3xs font-bold text-slate-400 uppercase tracking-widest">Kategori</th>
                      <th className="py-3 px-4 text-3xs font-bold text-slate-400 uppercase tracking-widest text-right">Nominal (Rp)</th>
                      <th className="py-3 px-4 text-3xs font-bold text-slate-400 uppercase tracking-widest">Atas Nama PIC</th>
                      <th className="py-3 px-4 text-3xs font-bold text-slate-400 uppercase tracking-widest text-center">Kelola Kembalian</th>
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-slate-100 text-xs">
                    <AnimatePresence initial={false}>
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-450 bg-white">
                            <div className="max-w-xs mx-auto flex flex-col items-center gap-2">
                              <div className="bg-slate-50 p-3 rounded-full text-slate-400 border border-slate-100 mb-1">
                                <Search className="h-6 w-6" />
                              </div>
                              <p className="font-semibold text-slate-800 text-sm">Tidak ditemukan hasil</p>
                              <p className="text-3xs text-slate-405 leading-relaxed">
                                Coba ubah kata kunci pencarian atau ganti filter kategori tipe transaksi Anda.
                              </p>
                              {(searchQuery !== '' || typeFilter !== 'all') && (
                                <button
                                  onClick={() => {
                                    setSearchQuery('');
                                    setTypeFilter('all');
                                  }}
                                  className="mt-2 text-2xs font-semibold text-[#0051FF] hover:text-[#0040DF] underline focus:outline-none"
                                >
                                  Bersihkan Semua Filter
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((t, idx) => {
                          const isExpense = t.jenis === 'pengeluaran';
                          return (
                            <motion.tr 
                              key={t.id}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.15 }}
                              className={`group hover:bg-slate-50/50 transition-all ${t.locked ? 'bg-slate-50/[0.25]' : 'bg-white'}`}
                            >
                              {/* Date Block */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="font-semibold text-slate-800">{t.tanggal}</div>
                                <div className="text-3xs text-slate-400 font-mono flex items-center gap-0.5 mt-0.5">
                                  ID: {t.id}
                                </div>
                              </td>

                              {/* Description, Return details & Fund Sources */}
                              <td className="py-3 px-4 max-w-xs">
                                <div className="space-y-0.5">
                                  <div className="font-medium text-slate-900 leading-snug">{t.nama}</div>
                                  
                                  {isExpense && t.locked && t.kembalian > 0 && (
                                    <div className="text-3xs text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100 inline-flex items-center gap-1 font-medium mt-1">
                                      <CoinIcon className="h-2.5 w-2.5" />
                                      Kembalian Berhasil Masuk: <span className="font-bold">{formatIDR(t.kembalian)}</span>
                                    </div>
                                  )}

                                  {!isExpense && t.sumber && (
                                    <div className="text-3xs text-slate-500 flex items-center gap-1 mt-1">
                                      <span className="font-semibold text-slate-400">Sumber:</span> 
                                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">{t.sumber}</span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Badge Category (In / Out) */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                {isExpense ? (
                                  <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-3xs font-semibold bg-rose-50 border border-rose-100 text-rose-800">
                                    <span className="h-1 w-1 bg-rose-500 rounded-full"></span>
                                    Keluar
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-3xs font-semibold bg-emerald-50 border border-emerald-100 text-emerald-800">
                                    <span className="h-1 w-1 bg-emerald-500 rounded-full"></span>
                                    Masuk
                                  </span>
                                )}
                              </td>

                              {/* Value Code formatting */}
                              <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold">
                                {isExpense ? (
                                  <div className="text-rose-600">
                                    -{formatIDR(t.nominalFinal)}
                                    {t.kembalian > 0 && (
                                      <div className="text-3xs text-slate-400 line-through font-normal">
                                        {formatIDR(t.nominal)}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-emerald-700">
                                    +{formatIDR(t.nominal)}
                                  </div>
                                )}
                              </td>

                              {/* Treasurer Signature Name */}
                              <td className="py-3 px-4 text-slate-700 font-medium">
                                <div className="flex items-center gap-1 text-xs">
                                  <User className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span>{t.treasurer}</span>
                                </div>
                              </td>

                              {/* Action: Return Change Configuration (Input Kembalian) */}
                              <td className="py-3 px-4 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {isExpense ? (
                                    <>
                                      {t.locked ? (
                                        <div 
                                          title={`Sudah dikunci dengan kembalian ${formatIDR(t.kembalian)}`}
                                          className="text-3xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 inline-flex items-center gap-1 cursor-default select-none"
                                        >
                                          <Lock className="h-3 w-3" />
                                          Terkunci
                                        </div>
                                      ) : (
                                        <button
                                          id={`btn-kembalian-${t.id}`}
                                          onClick={() => handleOpenKembalianModal(t.id)}
                                          className="text-3xs font-semibold text-white bg-[#0051FF] hover:bg-[#0040DF] px-2.5 py-1 rounded-md border border-[#0051FF] inline-flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                        >
                                          <Coins className="h-3 w-3 shrink-0" />
                                          Kembalian
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-slate-300 font-mono">—</span>
                                  )}

                                  {/* Trash Button for error corrections */}
                                  <button
                                    onClick={() => handleDeleteTransaction(t.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    title="Hapus Catatan"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

            </div>

            {/* Total Balance Status Info bar */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600">
              <span className="font-medium flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Sistem aktif berjalan lancar
              </span>
              <span className="font-mono text-slate-500">
                Pencatatan kas kecil per: <strong>2026-05-23 BST</strong>
              </span>
            </div>

          </div>

        </div>

      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 mt-20 py-8 bg-slate-50 text-center">
        <p className="text-xs text-slate-400">
          Aplikasi Manajemen Petty Cash &copy; 2026. Didukung oleh single-client reactive state system.
        </p>
      </footer>

      {/* INPUT KEMBALIAN MODAL OVERLAY */}
      <AnimatePresence>
        {modalOpen && selectedTxId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Backdrop background */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setModalOpen(false);
                setSelectedTxId(null);
              }}
              className="fixed inset-0 bg-black/40 backdrop-blur-2xs"
            ></motion.div>

            {/* Modal Dialog Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl w-full max-w-sm relative z-10"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                    <CoinIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Input Uang Kembalian</h3>
                    <p className="text-3xs text-slate-400">Laporan sisa belanja kas kecil</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setModalOpen(false);
                    setSelectedTxId(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-lg transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Transaction description context */}
              {(() => {
                const t = transactions.find(tx => tx.id === selectedTxId);
                if (!t) return null;
                return (
                  <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-1.5 text-xs text-slate-600 border border-slate-100">
                    <div>
                      <span className="text-3xs text-slate-400 uppercase font-bold tracking-wider block">Keterangan Pengeluaran</span>
                      <span className="font-semibold text-slate-800 block truncate">{t.nama}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200/60 pt-1.5 mt-1.5 text-2xs">
                      <div>PIC: <strong>{t.treasurer}</strong></div>
                      <div>Nominal Asli: <strong className="text-slate-800 font-mono">{formatIDR(t.nominal)}</strong></div>
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleConfirmKembalian} className="space-y-4">
                <div className="form-group flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label htmlFor="modal-kembalian-input" className="text-xs font-bold text-slate-700">Nominal Uang Kembali</label>
                    {inputKembalian && !isNaN(parseFloat(inputKembalian)) && (
                      <span className="text-3xs font-mono font-bold text-blue-600">
                        {formatIDR(parseFloat(inputKembalian))}
                      </span>
                    )}
                  </div>
                  
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      id="modal-kembalian-input"
                      type="number"
                      min="0"
                      value={inputKembalian}
                      onChange={(e) => {
                        setInputKembalian(e.target.value);
                        setModalError('');
                      }}
                      placeholder="0"
                      autoFocus
                      className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 hover:border-slate-300 rounded-lg bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono transition-all"
                    />
                  </div>
                  
                  {modalError && (
                    <div className="text-3xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{modalError}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      setSelectedTxId(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0051FF] hover:bg-[#0040DF] rounded-lg shadow-sm border border-[#0051FF] active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5 font-bold" />
                    Konfirmasi
                  </button>
                </div>
              </form>
            </motion.div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
