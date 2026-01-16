import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, deleteDoc, addDoc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { 
  Users, ShoppingCart, Utensils, LayoutDashboard, Trash2, Calendar as CalendarIcon, 
  Wallet, CreditCard, Lock, AlertCircle, LogOut, Settings, 
  AlertTriangle, Zap, History, Bell, Crown, Printer, RotateCcw, TrendingUp, TrendingDown,
  FileText, CheckCircle, XCircle
} from 'lucide-react';

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyCA4ZiHZT1ebHvsuDalF-ZUmI9etoCClm8",
  authDomain: "talukdar-meal-managment-system.firebaseapp.com",
  projectId: "talukdar-meal-managment-system",
  storageBucket: "talukdar-meal-managment-system.firebasestorage.app",
  messagingSenderId: "343333599497",
  appId: "1:343333599497:web:5f086f6b5014623fd07bd8",
  measurementId: "G-47XHE03SV4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = 'talukdar-meal-system'; 
const APP_NAME = "তালুকদার মিল ম্যানেজার";

// --- শেষ তারিখ কনফিগারেশন ---
const DUE_DATES = {
  MEAL: "5",    // মিলের টাকা ৫ তারিখ
  RENT: "8",    // বাসা ভাড়া ৮ তারিখ
  WIFI: "15",   // ওয়াইফাই বিল ১৫ তারিখ
  CURRENT: "25" // বিদ্যুৎ বিল ২৫ তারিখ
};

// --- Helper: Robust Safe Data Rendering (CRASH PROTECTION) ---
const safeStr = (val) => {
  if (val === null || val === undefined) return "";
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  return ""; 
};

const safeNum = (val) => {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const formatDate = (dateVal) => {
  if (!dateVal) return "";
  try {
    let d;
    if (dateVal && typeof dateVal.toDate === 'function') {
      d = dateVal.toDate();
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString('en-GB');
  } catch (e) {
    return "";
  }
};

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [members, setMembers] = useState([]);
  const [bazarList, setBazarList] = useState([]);
  const [meals, setMeals] = useState({}); 
  const [deposits, setDeposits] = useState([]);
  const [fines, setFines] = useState([]); 
  const [bills, setBills] = useState({ wifi: 0, current: 0, rent: 0 });
  const [billTracking, setBillTracking] = useState({}); 
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [permError, setPermError] = useState(null);
  
  const [isManager, setIsManager] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [dbPin, setDbPin] = useState("1234"); 
  const [pinError, setPinError] = useState(false);

  const [newMemberName, setNewMemberName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  // Auth & Init
  useEffect(() => {
    const backupTimer = setTimeout(() => setLoading(false), 5000);
    const initAuth = async () => {
      try {
        if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
          try { await signInWithCustomToken(auth, window.__initial_auth_token); } 
          catch { await signInAnonymously(auth); }
        } else { await signInAnonymously(auth); }
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => { unsubscribe(); clearTimeout(backupTimer); };
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;
    const handleError = (name) => (err) => {
      console.error(`${name} sync error:`, err);
      if (err.code === 'permission-denied') {
        setPermError(`Permission Error: ${name}`);
        setLoading(false);
      }
    };

    const unsubPin = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'manager_config'), (s) => { 
      if(s.exists()) setDbPin(safeStr(s.data().pin) || "1234"); 
    }, handleError("PIN"));
    
    const unsubBills = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'fixed_bills'), (s) => { 
      if(s.exists()) {
        const data = s.data();
        setBills({
          wifi: safeNum(data.wifi),
          current: safeNum(data.current),
          rent: safeNum(data.rent)
        });
      }
    }, handleError("Bills"));
    
    const unsubNotice = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'notice_config'), (s) => { 
      if(s.exists()) setNotice(safeStr(s.data().text)); 
    }, handleError("Notice"));
    
    const unsubMembers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'members'), (s) => { 
      setMembers(s.docs.map(d => ({ id: d.id, ...d.data() }))); 
      setLoading(false); 
    }, handleError("Members"));
    
    const unsubBazar = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'bazar'), (s) => setBazarList(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError("Bazar"));
    
    const unsubMeals = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'meals'), (s) => { 
      const m = {}; 
      s.docs.forEach(d => m[d.id] = d.data()); 
      setMeals(m); 
    }, handleError("Meals"));
    
    const unsubDeposits = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'deposits'), (s) => setDeposits(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError("Deposits"));
    
    const unsubFines = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'fines'), (s) => setFines(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError("Fines"));
    
    const unsubBillTracking = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'bill_tracking'), (s) => {
      const trackingData = {};
      s.docs.forEach(d => { trackingData[d.id] = d.data(); });
      setBillTracking(trackingData);
    }, handleError("Bill Tracking"));

    return () => { 
      unsubPin(); unsubBills(); unsubNotice(); unsubMembers(); unsubBazar(); 
      unsubMeals(); unsubDeposits(); unsubFines(); unsubBillTracking();
    };
  }, [user]);

  // --- ACTIONS ---
  const handleManagerLogin = (e) => {
    e.preventDefault();
    if (managerPin === dbPin) { setIsManager(true); setShowManagerModal(false); setManagerPin(''); setPinError(false); }
    else { setPinError(true); setManagerPin(''); }
  };

  const changePin = async () => {
    if (newPinInput.length !== 4) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'manager_config'), { pin: newPinInput });
    setShowPinChange(false); setNewPinInput(''); alert("পিন পরিবর্তন সফল হয়েছে!");
  };

  const updateNotice = async (e) => {
    e.preventDefault();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'notice_config'), { text: e.target.noticeText.value });
    alert("নোটিশ আপডেট হয়েছে!");
  };

  const updateBills = async (e) => {
    e.preventDefault();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'fixed_bills'), {
      wifi: Number(e.target.wifi.value),
      current: Number(e.target.current.value),
      rent: Number(e.target.rent.value)
    });
    alert("বিল আপডেট সফল!");
  };

  const toggleBillStatus = async (memberId, type) => {
    if (!isManager) return;
    const docId = `${memberId}_${selectedMonth}`;
    const currentData = billTracking[docId] || {};
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bill_tracking', docId), {
      ...currentData,
      [type]: !currentData[type],
      memberId,
      month: selectedMonth
    }, { merge: true });
  };

  const addMember = async () => {
    if (!newMemberName.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'members'), {
      name: newMemberName.trim(), isManagerTag: false, createdAt: new Date().toISOString()
    });
    setNewMemberName('');
  };

  const toggleManagerTag = async (id, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', id), { isManagerTag: !status });
  };

  const deleteMember = async (id) => {
    if (window.confirm("মেম্বার ডিলিট করতে চান?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', id));
  };

  const updateMeal = async (mId, count) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'meals', selectedDate), { ...(meals[selectedDate] || {}), [mId]: Number(count) });
  };

  const addDeposit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'deposits'), {
      memberId: e.target.memberId.value, amount: Number(e.target.amount.value), date: new Date().toISOString()
    });
    e.target.reset(); alert("জমা সফল হয়েছে!");
  };

  const addBazar = async (e) => {
    e.preventDefault();
    const form = e.target;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bazar'), {
      item: form.item.value, 
      amount: Number(form.amount.value), 
      memberId: form.memberId.value, 
      date: form.date.value,
      type: form.type.value
    });
    form.reset();
  };

  const addFine = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'fines'), {
      memberId: e.target.memberId.value, reason: e.target.reason.value, date: new Date().toISOString()
    });
    e.target.reset();
  };

  const resetMonth = async () => {
    if (!window.confirm("সতর্কতা: এটি বর্তমান মাসের সকল ডাটা মুছে ফেলবে।")) return;
    setLoading(true);
    try {
      const batchDelete = async (colName) => {
        const q = collection(db, 'artifacts', appId, 'public', 'data', colName);
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      };
      await Promise.all([batchDelete('bazar'), batchDelete('meals'), batchDelete('deposits'), batchDelete('fines'), batchDelete('bill_tracking')]);
      alert("ডাটা রিসেট সম্পন্ন!");
      setShowResetModal(false);
    } catch (e) { alert("Reset Error: " + e.message); }
    setLoading(false);
  };

  // --- Calculations ---
  const cashBazar = bazarList.filter(i => i.type === 'cash' || !i.type).reduce((a, b) => a + (safeNum(b.amount)), 0);
  const totalFineMeals = fines.length * 2;
  const totalMealsFromRecords = Object.values(meals).reduce((acc, day) => {
    return acc + Object.values(day).reduce((dayAcc, count) => dayAcc + (safeNum(count)), 0);
  }, 0);
  const totalMealFactor = totalMealsFromRecords + totalFineMeals;
  const mealRate = totalMealFactor > 0 ? (cashBazar / totalMealFactor).toFixed(2) : 0;
  
  const sharePerHead = {
    wifi: members.length > 0 ? (safeNum(bills.wifi) / members.length) : 0,
    current: members.length > 0 ? (safeNum(bills.current) / members.length) : 0,
    rent: members.length > 0 ? (safeNum(bills.rent) / members.length) : 0,
  };
  const billPerHead = (sharePerHead.wifi + sharePerHead.current + sharePerHead.rent).toFixed(2);
  
  const totalDeposits = deposits.reduce((a, b) => a + (safeNum(b.amount)), 0);
  const fundStatus = (totalDeposits - cashBazar).toFixed(2);

  const getMemberStats = (memberId) => {
    const mMeals = Object.values(meals).reduce((acc, day) => acc + (safeNum(day[memberId])), 0);
    const mDeposits = deposits.filter(d => d.memberId === memberId).reduce((acc, d) => acc + (safeNum(d.amount)), 0);
    const mFines = fines.filter(f => f.memberId === memberId).length;
    const mFineMeals = mFines * 2;
    const totalMeals = mMeals + mFineMeals;
    const mealCost = (totalMeals * mealRate);
    const totalCost = (mealCost + safeNum(billPerHead));
    const balance = (mDeposits - totalCost).toFixed(2);
    return { meals: mMeals, fineMeals: mFineMeals, mealCost: mealCost.toFixed(2), paid: mDeposits, balance };
  };

  const getMemberName = (id) => {
    const m = members.find(m => m.id === id);
    return m ? safeStr(m.name) : "অজানা";
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-bold text-slate-500 font-sans animate-pulse">লোডিং...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans selection:bg-indigo-100">
      {/* Modals */}
      {permError && <div className="fixed top-20 left-4 right-4 z-[200] bg-red-600 text-white p-4 rounded-xl shadow-xl flex items-center gap-3"><AlertCircle size={24}/><p className="text-sm font-bold">{permError}</p><button onClick={() => setPermError(null)} className="ml-auto">X</button></div>}
      
      {showManagerModal && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600"><Lock size={32}/></div>
            <h3 className="text-2xl font-black text-slate-800 mb-6">ম্যানেজার লগইন</h3>
            <form onSubmit={handleManagerLogin} className="space-y-4">
              <input type="password" value={managerPin} onChange={e => setManagerPin(e.target.value)} placeholder="• • • •" className="w-full p-4 rounded-2xl border-2 border-slate-100 text-center text-3xl font-black tracking-[1rem] outline-none focus:border-indigo-500 transition-colors" autoFocus />
              {pinError && <p className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded-lg">ভুল পিন!</p>}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowManagerModal(false)} className="p-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl">বাতিল</button>
                <button type="submit" className="p-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200">প্রবেশ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl border-t-4 border-red-500">
            <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
            <h3 className="text-xl font-black text-red-600 mb-2">সতর্কতা: রিসেট ডাটা</h3>
            <p className="text-slate-600 text-sm mb-6">আপনি কি নিশ্চিত যে আপনি বর্তমান মাসের সকল ডাটা মুছে নতুন মাস শুরু করতে চান?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetModal(false)} className="flex-1 p-3 font-bold bg-slate-100 rounded-xl text-slate-600">না</button>
              <button onClick={resetMonth} className="flex-1 p-3 font-bold bg-red-600 text-white rounded-xl shadow-lg shadow-red-200">হ্যাঁ, রিসেট</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`sticky top-0 z-50 px-4 py-3 bg-white/80 backdrop-blur-md border-b border-slate-100 flex justify-between items-center shadow-sm`}>
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">{APP_NAME}</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${isManager ? 'bg-green-500' : 'bg-slate-300'}`}></span>
            {isManager ? 'ম্যানেজার' : 'ভিউ মোড'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 print:hidden"><Printer size={18}/></button>
          <button onClick={() => isManager ? setIsManager(false) : setShowManagerModal(true)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${isManager ? 'bg-red-50 text-red-600' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'}`}>
            {isManager ? <><LogOut size={14}/> লগআউট</> : <><Lock size={14}/> লগইন</>}
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start">
                    <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Wallet size={14}/> ক্যাশ ফান্ডিং</p>
                    <div className="bg-white/20 p-1 px-2 rounded-lg text-[10px] font-bold backdrop-blur-sm flex items-center gap-1"><Clock size={10}/> Last Date: {DUE_DATES.MEAL} তারিখ</div>
                  </div>
                  <h2 className="text-4xl font-black mb-2">৳{fundStatus}</h2>
                  <div className="flex gap-3 text-xs font-medium bg-white/10 p-2 rounded-xl w-fit backdrop-blur-sm">
                    <span className="flex items-center gap-1"><TrendingUp size={12} className="text-green-300"/> জমা: ৳{totalDeposits}</span>
                    <span className="w-px bg-white/20"></span>
                    <span className="flex items-center gap-1"><TrendingDown size={12} className="text-red-300"/> খরচ: ৳{cashBazar}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">মিল রেট</p>
                  <h2 className="text-2xl font-black text-slate-800">৳{mealRate}</h2>
                </div>
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">মোট মিল</p>
                  <h2 className="text-2xl font-black text-orange-500">{totalMealsFromRecords}</h2>
                </div>
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center col-span-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">ফিক্সড বিল (জনপ্রতি)</p>
                      <h2 className="text-2xl font-black text-indigo-600">৳{billPerHead}</h2>
                    </div>
                    <div className="text-right text-[10px] font-bold text-slate-400 space-y-0.5">
                      <p>WiFi: ৳{sharePerHead.wifi.toFixed(0)} <span className="text-slate-300 text-[9px]">(Last Date: {DUE_DATES.WIFI})</span></p>
                      <p>বিদ্যুৎ: ৳{sharePerHead.current.toFixed(0)} <span className="text-slate-300 text-[9px]">(Last Date: {DUE_DATES.CURRENT})</span></p>
                      <p>ভাড়া: ৳{sharePerHead.rent.toFixed(0)} <span className="text-slate-300 text-[9px]">(Last Date: {DUE_DATES.RENT})</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {notice && (
              <div className="bg-orange-50 border border-orange-100 p-5 rounded-3xl relative overflow-hidden">
                <div className="absolute -right-4 -top-4 text-orange-200"><Bell size={64} /></div>
                <div className="relative z-10">
                  <h4 className="text-xs font-black text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-2"><Bell size={14}/> নোটিশ বোর্ড</h4>
                  <p className="text-sm font-bold text-orange-900 leading-relaxed">{safeStr(notice)}</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-700">সদস্যদের হিসাব</h3>
                <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-lg">{members.length} জন</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 font-bold">
                    <tr><th className="p-4">নাম</th><th className="p-4">মিল (দণ্ড)</th><th className="p-4">খরচ + বিল</th><th className="p-4">ব্যালেন্স</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {members.map(m => {
                      const st = getMemberStats(m.id);
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 flex items-center gap-1 font-bold text-sm text-slate-700">
                            {/* PROTECTED: safeStr and charAt */}
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px]">
                              {safeStr(m.name).charAt(0).toUpperCase()}
                            </div>
                            {safeStr(m.name)} {m.isManagerTag && <Crown size={12} className="text-amber-500 fill-amber-500"/>}
                          </td>
                          <td className="p-4 text-sm text-slate-600">{st.meals} <span className="text-red-500 text-xs font-bold">({st.fineMeals})</span></td>
                          <td className="p-4 text-xs text-slate-500 font-medium">৳{st.mealCost} + ৳{billPerHead}</td>
                          <td className={`p-4 font-black text-sm ${Number(st.balance) >= 0 ? 'text-green-600' : 'text-red-500'}`}>৳{st.balance}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- Bills Tab --- */}
        {activeTab === 'bills' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="font-black text-slate-800 flex items-center gap-2"><Zap size={20} className="text-amber-500"/> ফিক্সড বিল</h3>
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="p-2 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-slate-200" />
            </div>

            {isManager ? (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">বিল সেট করুন (পুরো মেসের জন্য)</h3>
                <form onSubmit={updateBills} className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">WiFi (Last: {DUE_DATES.WIFI})</label>
                    <input name="wifi" type="number" defaultValue={safeNum(bills.wifi)} className="w-full p-2 bg-slate-50 rounded-xl text-sm font-bold outline-none text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">বিদ্যুৎ (Last: {DUE_DATES.CURRENT})</label>
                    <input name="current" type="number" defaultValue={safeNum(bills.current)} className="w-full p-2 bg-slate-50 rounded-xl text-sm font-bold outline-none text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">ভাড়া (Last: {DUE_DATES.RENT})</label>
                    <input name="rent" type="number" defaultValue={safeNum(bills.rent)} className="w-full p-2 bg-slate-50 rounded-xl text-sm font-bold outline-none text-center" />
                  </div>
                  <button className="col-span-3 bg-slate-800 text-white p-3 rounded-xl text-xs font-bold shadow-lg shadow-slate-200 active:scale-95 transition-all">বিল আপডেট করুন</button>
                </form>
              </div>
            ) : (
              <div className="bg-indigo-50 p-5 rounded-3xl text-indigo-900 border border-indigo-100 grid grid-cols-3 gap-4 text-center">
                 <div><span className="text-[10px] uppercase font-bold opacity-60">WiFi (Last: {DUE_DATES.WIFI})</span><p className="font-black text-lg">৳{sharePerHead.wifi.toFixed(0)}</p></div>
                 <div className="border-x border-indigo-200"><span className="text-[10px] uppercase font-bold opacity-60">বিদ্যুৎ (Last: {DUE_DATES.CURRENT})</span><p className="font-black text-lg">৳{sharePerHead.current.toFixed(0)}</p></div>
                 <div><span className="text-[10px] uppercase font-bold opacity-60">ভাড়া (Last: {DUE_DATES.RENT})</span><p className="font-black text-lg">৳{sharePerHead.rent.toFixed(0)}</p></div>
              </div>
            )}

            <div className="grid gap-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider px-2">বিল পেমেন্ট স্ট্যাটাস ({selectedMonth})</h3>
              {members.map(m => {
                const docId = `${m.id}_${selectedMonth}`;
                const status = billTracking[docId] || {};
                const name = safeStr(m.name);
                return (
                  <div key={m.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                      <span className="font-bold text-slate-700 text-sm flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px]">{name.charAt(0).toUpperCase()}</div>
                        {name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">মোট: ৳{billPerHead}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => toggleBillStatus(m.id, 'wifi')} 
                        disabled={!isManager}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${status.wifi ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-100 text-red-400'}`}
                      >
                        {status.wifi ? <CheckCircle size={16}/> : <XCircle size={16}/>}
                        <span className="text-[9px] font-bold">WiFi (Last: {DUE_DATES.WIFI})</span>
                      </button>

                      <button 
                        onClick={() => toggleBillStatus(m.id, 'current')} 
                        disabled={!isManager}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${status.current ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-100 text-red-400'}`}
                      >
                        {status.current ? <CheckCircle size={16}/> : <XCircle size={16}/>}
                        <span className="text-[9px] font-bold">বিদ্যুৎ (Last: {DUE_DATES.CURRENT})</span>
                      </button>

                      <button 
                        onClick={() => toggleBillStatus(m.id, 'rent')} 
                        disabled={!isManager}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${status.rent ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-100 text-red-400'}`}
                      >
                        {status.rent ? <CheckCircle size={16}/> : <XCircle size={16}/>}
                        <span className="text-[9px] font-bold">ভাড়া (Last: {DUE_DATES.RENT})</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Meals Tab */}
        {activeTab === 'meals' && (
          <div className="space-y-4">
            <div className="sticky top-20 z-30 bg-white p-2 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100">
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 font-bold text-slate-700 outline-none text-center" />
            </div>
            <div className="grid gap-3">
              {members.length === 0 ? <p className="p-10 text-center text-slate-400 italic">মেম্বার যোগ করা নেই।</p> :
                members.map(m => (
                  <div key={m.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center animate-in fade-in">
                    <span className="font-bold text-sm text-slate-700">{safeStr(m.name)}</span>
                    <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl">
                      <button onClick={() => updateMeal(m.id, Math.max(0, (meals[selectedDate]?.[m.id] || 0) - 0.5))} disabled={!isManager} className="w-8 h-8 rounded-lg bg-white shadow-sm font-bold text-slate-600 disabled:opacity-50">-</button>
                      <span className="w-8 text-center font-black text-indigo-600">{meals[selectedDate]?.[m.id] || 0}</span>
                      <button onClick={() => updateMeal(m.id, (meals[selectedDate]?.[m.id] || 0) + 0.5)} disabled={!isManager} className="w-8 h-8 rounded-lg bg-indigo-600 shadow-sm font-bold text-white disabled:opacity-50">+</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Bazar Tab */}
        {activeTab === 'bazar' && (
          <div className="space-y-6">
            {isManager && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2"><ShoppingCart size={18} className="text-indigo-600"/> বাজার খরচ</h3>
                  <form onSubmit={addBazar} className="space-y-3">
                    <input name="item" placeholder="আইটেম নাম" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none" required />
                    <input name="amount" type="number" placeholder="৳ পরিমাণ" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none" required />
                    <select name="memberId" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none" required>
                      <option value="">কে বাজার করেছে?</option>
                      {members.map(m => <option key={m.id} value={m.id}>{safeStr(m.name)}</option>)}
                    </select>
                    {/* Date Input */}
                    <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none" required />
                    
                    <div className="flex gap-4 p-1 text-xs font-bold text-slate-500">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="type" value="cash" defaultChecked /> নগদ</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="type" value="credit" /> বাকি</label>
                    </div>
                    <button className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 active:scale-95 transition-transform">সেভ করুন</button>
                  </form>
                </div>
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2"><AlertTriangle size={18} className="text-red-500"/> দণ্ড (২ মিল)</h3>
                  <form onSubmit={addFine} className="space-y-3">
                    <select name="memberId" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none" required>
                      <option value="">কাকে দণ্ড দিবেন?</option>
                      {members.map(m => <option key={m.id} value={m.id}>{safeStr(m.name)}</option>)}
                    </select>
                    <input name="reason" placeholder="কারণ" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none" required />
                    <button className="w-full bg-red-500 text-white p-3 rounded-xl font-bold text-sm shadow-lg shadow-red-200 active:scale-95 transition-transform">দণ্ড দিন</button>
                  </form>
                </div>
              </div>
            )}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden divide-y">
               <div className="p-4 bg-slate-50 font-bold text-sm text-slate-600">লেনদেন তালিকা</div>
               <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                 {fines.map(f => (
                   <div key={f.id} className="p-4 flex justify-between items-center bg-red-50/50">
                     <div className="flex flex-col">
                       <span className="text-sm font-bold text-orange-800">দণ্ড: {safeStr(f.reason)}</span>
                       <span className="text-[10px] text-orange-400 font-bold uppercase">{getMemberName(f.memberId)}</span>
                     </div>
                     <span className="font-black text-orange-600 text-xs bg-white px-2 py-1 rounded-lg shadow-sm">+২ মিল</span>
                   </div>
                 ))}
                 {bazarList.slice().reverse().map(i => (
                   <div key={i.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                     <div className="flex flex-col">
                       <span className="font-bold text-slate-700 text-sm">{safeStr(i.item)}</span>
                       <span className="text-[10px] text-slate-400 font-medium">
                         {getMemberName(i.memberId)} • {formatDate(i.date)}
                       </span>
                     </div>
                     <div className="text-right">
                       <span className="font-black text-slate-800 text-sm bg-slate-100 px-2 py-1 rounded-lg block">৳{safeNum(i.amount)}</span>
                       <span className="text-[9px] text-slate-400 uppercase font-bold mt-1 block">{i.type === 'credit' ? 'বাকি' : 'নগদ'}</span>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {/* Manager Tab */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {isManager ? (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Notice & Settings */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><Settings size={18} className="text-slate-400"/> সেটিংস</h3>
                      <button onClick={() => setShowPinChange(!showPinChange)} className="text-[10px] font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">পিন বদলান</button>
                    </div>
                    {showPinChange ? (
                      <div className="flex gap-2"><input type="password" value={newPinInput} onChange={e => setNewPinInput(e.target.value)} placeholder="নতুন পিন" className="flex-1 p-2 bg-slate-50 rounded-xl text-sm font-bold outline-none" /><button onClick={changePin} className="bg-indigo-600 text-white px-4 rounded-xl text-xs font-bold">সেভ</button></div>
                    ) : (
                      <div className="flex gap-2"><input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="নতুন মেম্বার নাম" className="flex-1 p-2 bg-slate-50 rounded-xl text-sm font-bold outline-none" /><button onClick={addMember} className="bg-indigo-600 text-white px-4 rounded-xl text-xs font-bold">যোগ</button></div>
                    )}
                    <form onSubmit={updateNotice} className="flex gap-2 pt-2 border-t border-slate-100">
                      <input name="noticeText" placeholder="নোটিশ আপডেট করুন" className="flex-1 p-2 bg-slate-50 rounded-xl text-xs font-bold outline-none" />
                      <button className="bg-orange-500 text-white px-4 rounded-xl text-xs font-bold">আপডেট</button>
                    </form>
                  </div>

                  {/* Payment Entry */}
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-3xl shadow-lg text-white space-y-4">
                    <h3 className="font-bold flex items-center gap-2"><Wallet size={20}/> মিলের টাকা জমা</h3>
                    <form onSubmit={addDeposit} className="flex gap-2">
                      <select name="memberId" className="flex-1 p-3 rounded-xl bg-white/20 border border-white/30 text-white outline-none text-sm font-bold">
                        {members.map(m => <option key={m.id} value={m.id} className="text-slate-800">{safeStr(m.name)}</option>)}
                      </select>
                      <input name="amount" type="number" placeholder="৳" className="w-24 p-3 rounded-xl bg-white/20 border border-white/30 text-white outline-none text-sm font-bold placeholder-white/70" required />
                      <button className="bg-white text-emerald-600 px-6 rounded-xl font-black text-sm">জমা</button>
                    </form>
                  </div>
                </div>

                <button onClick={() => setShowResetModal(true)} className="w-full p-4 border-2 border-red-100 bg-red-50 text-red-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors">
                  <RotateCcw size={18}/> নতুন মাস শুরু করুন (রিসেট ডাটা)
                </button>
              </div>
            ) : (
              <div className="bg-white p-10 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300"><Lock size={32}/></div>
                <p className="text-slate-400 text-sm font-bold">অ্যাডমিন প্যানেলে প্রবেশ করতে লগইন করুন</p>
                <button onClick={() => setShowManagerModal(true)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200">ম্যানেজার লগইন</button>
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
               <div className="p-4 bg-slate-50 border-b font-bold text-sm text-slate-600 flex items-center gap-2"><History size={16}/> পেমেন্ট হিস্ট্রি</div>
               <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                  {deposits.length === 0 ? <p className="p-8 text-center text-slate-400 italic text-xs">কোন রেকর্ড নেই</p> :
                    deposits.slice().reverse().map(d => (
                      <div key={d.id} className="p-4 flex justify-between items-center text-sm hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 text-green-600 rounded-lg"><CreditCard size={14}/></div>
                          <div><p className="font-bold text-slate-700">{getMemberName(d.memberId)}</p><p className="text-[10px] text-slate-400 font-bold">{formatDate(d.date)}</p></div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-green-600">৳{safeNum(d.amount)}</span>
                          {isManager && <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'deposits', d.id))} className="text-slate-300 hover:text-red-500"><X size={14}/></button>}
                        </div>
                      </div>
                    ))}
               </div>
            </div>

            <div className="grid gap-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider px-2">মেম্বার কন্ট্রোল</h3>
              {members.map(m => {
                const name = safeStr(m.name);
                return (
                <div key={m.id} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black shadow-inner">{name.charAt(0).toUpperCase()}</div>
                    <div>
                      <span className="font-bold text-sm text-slate-700 flex items-center gap-1">{name} {m.isManagerTag && <Crown size={12} className="text-amber-500 fill-amber-500"/>}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{m.isManagerTag ? 'ম্যানেজার' : 'মেম্বার'}</span>
                    </div>
                  </div>
                  {isManager && (
                    <div className="flex gap-2">
                      <button onClick={() => toggleManagerTag(m.id, m.isManagerTag)} className={`p-2 rounded-lg border ${m.isManagerTag ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-100 text-slate-400'}`}><Crown size={16}/></button>
                      <button onClick={() => deleteMember(m.id)} className="p-2 bg-white border border-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={16}/></button>
                    </div>
                  )}
                </div>
              )})}
            </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-lg border-t border-slate-100 flex justify-around p-2 pb-4 z-[100] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'ড্যাশবোর্ড' },
          { id: 'meals', icon: Utensils, label: 'মিল' },
          { id: 'bazar', icon: ShoppingCart, label: 'বাজার' },
          { id: 'bills', icon: FileText, label: 'বিল' },
          { id: 'members', icon: Users, label: 'ম্যানেজার' }
        ].map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 ${activeTab === item.id ? 'text-indigo-600 bg-indigo-50 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
            <item.icon size={24} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            <span className="text-[10px] font-black">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
