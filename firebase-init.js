/* إعدادات الاتصال بقاعدة بيانات Firebase الخاصة بمنظومة الجودة - سلسلة الإمداد */
const firebaseConfig = {
  apiKey: "AIzaSyA6F8XLqQmqTm62zSvnie9pKHaUcnl042A",
  authDomain: "qa-supply-chain.firebaseapp.com",
  projectId: "qa-supply-chain",
  storageBucket: "qa-supply-chain.firebasestorage.app",
  messagingSenderId: "554385909317",
  appId: "1:554385909317:web:eb98cadb4ae9701ebae52c"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
try{
  db.enablePersistence({synchronizeTabs:true}).catch(err=>{
    console.warn('Firestore offline persistence not enabled:', err.code);
  });
}catch(e){ console.warn('Firestore persistence setup failed', e); }
