"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "th" | "en";

export const translations = {
  th: {
    // Nav
    appName: "TAPB Dice",
    appSubtitle: "D&D Dice Roller",
    guest: "ผู้มาเยือน",
    login: "เข้าสู่ระบบ",
    register: "สมัครสมาชิก",
    logout: "ออกจากระบบ",
    soundOn: "เปิดเสียง",
    soundOff: "ปิดเสียง",
    themeDark: "โหมดมืด",
    themeLight: "โหมดสว่าง",
    switchLang: "English",

    // Auth
    authTitle: "TAPB D&D Dice",
    authSubtitle: "ยินดีต้อนรับสู่อาณาจักรทอยลูกเต๋า D&D แบบเรียลไทม์",
    signInTab: "เข้าสู่ระบบ",
    signUpTab: "สมัครสมาชิกใหม่",
    fullName: "ชื่อ-นามสกุล หรือชื่อตัวละคร",
    fullNamePlaceholder: "เช่น Gandalf หรือ สมชาย",
    username: "ชื่อผู้ใช้ (Username)",
    usernamePlaceholder: "ชื่อสำหรับใช้ล็อกอิน",
    password: "รหัสผ่าน",
    passwordPlaceholder: "กรอกรหัสผ่านของคุณ",
    confirmPassword: "ยืนยันรหัสผ่าน",
    confirmPasswordPlaceholder: "กรอกรหัสผ่านอีกครั้ง",
    signingIn: "กำลังเข้าสู่ระบบ...",
    signingUp: "กำลังลงทะเบียน...",
    noAccount: "ยังไม่มีบัญชีใช่หรือไม่?",
    hasAccount: "มีบัญชีอยู่แล้วใช่หรือไม่?",
    passwordsMismatch: "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน",
    fillAllFields: "กรุณากรอกข้อมูลให้ครบทุกช่อง",

    // Lobby
    lobbyTitle: "ห้องโถงผจญภัย (Lobby)",
    lobbySubtitle: "เลือกสร้างห้องใหม่ หรือเข้าร่วมห้องของเพื่อนร่วมปาร์ตี้",
    createChamber: "สร้างห้องทอยเต๋าใหม่",
    chamberName: "ชื่อห้อง",
    chamberNamePlaceholder: "เช่น ค่ำคืนลุยดันเจี้ยน Dragon Heist",
    chamberPassword: "รหัสผ่านห้อง (ใส่หรือไม่ใส่ก็ได้)",
    chamberPasswordPlaceholder: "เว้นว่างไว้หากต้องการให้เป็นห้องสาธารณะ",
    createBtn: "สร้างห้องทันที",
    creating: "กำลังสร้างห้อง...",
    joinChamber: "เข้าร่วมด้วยรหัสห้อง",
    enterRoomCode: "รหัสห้อง (Room Code)",
    codePlaceholder: "เช่น DRAGON-849",
    enterRoomPassword: "รหัสผ่านห้อง",
    joinBtn: "เข้าร่วมห้อง",
    joining: "กำลังเข้า...",
    chambersList: "ห้องผจญภัยที่มีอยู่",
    myChambers: "ห้องที่คุณสร้าง",
    allChambers: "ห้องทั้งหมด",
    noRoomsFound: "ยังไม่มีห้องผจญภัยที่สร้างไว้",
    beTheFirstToCreate: "เป็นคนแรกที่สร้างห้องทอยเต๋าเลย!",
    lockedRoom: "ห้องล็อกรหัสผ่าน",
    publicRoom: "ห้องสาธารณะ",
    creator: "ผู้สร้าง",
    created: "สร้างเมื่อ",
    enterPasswordToJoin: "กรุณากรอกรหัสผ่านเพื่อเข้าห้องนี้",
    unlockAndEnter: "ปลดล็อกและเข้าห้อง",
    cancel: "ยกเลิก",

    // Room
    roomChamber: "ห้องผจญภัย",
    copyCode: "คัดลอกรหัส",
    codeCopied: "คัดลอกแล้ว!",
    shareLink: "แชร์ลิงก์ห้อง",
    linkCopied: "คัดลอกลิงก์แล้ว!",
    leaveRoom: "ออกจากห้อง",
    membersOnline: "สมาชิกในห้อง",
    activeParty: "ปาร์ตี้ในห้องผจญภัย",
    you: "คุณ",
    noMembersDetected: "ยังไม่มีเพื่อนร่วมปาร์ตี้อื่นในห้อง",
    diceTrayIdle: "เลือกเต๋าและกดทอย เพื่อทอยลงในถาด 3D",
    rollingStatus: "กำลังทอยลูกเต๋า...",
    rollFormula: "สูตรทอย",
    diceSelector: "เลือกชนิดลูกเต๋า D&D",
    count: "จำนวนลูก",
    modifier: "ตัวบวก/ลบ (Modifier)",
    castDice: "ทอยลูกเต๋า",
    rolling: "กำลังทอย...",
    advantage: "ทอย 2 ลูก (Advantage/Disadvantage)",
    rollHistory: "ประวัติการทอยสด",
    clearHistory: "ล้างประวัติหน้าจอ",
    noRollsYet: "ยังไม่มีใครทอยเต๋าในห้องนี้",
    chronicleUnwritten: "บันทึกชะตายังว่างเปล่า",
    rollDiceToRecordFate: "ทอยลูกเต๋าเพื่อเริ่มบันทึกชะตากรรมของปาร์ตี้!",
    rollsLabel: "ครั้ง",
    singleRollLabel: "ครั้ง",
    rolled: "ทอย",
    criticalHit: "CRITICAL HIT! (Nat 20)",
    criticalFail: "CRITICAL FAIL! (Nat 1)",
    total: "ผลรวม",
    diceOutcomes: "แต้มแต่ละลูก",
    unlockModalTitle: "ห้องนี้ถูกล็อกด้วยรหัสผ่าน",
    unlockModalDesc: "กรุณาใส่รหัสผ่านห้องเพื่อดูผลการทอยและเข้าร่วมปาร์ตี้",
    incorrectPassword: "รหัสผ่านห้องไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
    verifyAndJoin: "ยืนยันรหัสผ่าน",
    unlockChamber: "ปลดล็อกห้อง",
    protectedChamber: "ห้องที่มีรหัสผ่าน",
    providePasswordToJoin: "กรุณากรอกรหัสผ่านเพื่อเข้าห้อง",
    copyChamberCode: "คัดลอกรหัสห้อง",
    connectingToChamber: "กำลังเชื่อมต่อห้องผจญภัย...",
    chamberInaccessible: "ไม่สามารถเข้าสู่ห้องได้",
    roomNotFound: "ไม่พบข้อมูลห้องผจญภัยนี้",
    returnToLobby: "กลับสู่ห้องโถงผจญภัย",
    diceTrayTab: "ถาดเต๋า",
    rollHistoryTab: "ประวัติการทอย",
    membersTab: "สมาชิก",
    justNow: "เมื่อสักครู่",
  },
  en: {
    // Nav
    appName: "TAPB Dice",
    appSubtitle: "D&D Dice Roller",
    guest: "Guest",
    login: "Sign In",
    register: "Sign Up",
    logout: "Log Out",
    soundOn: "Sound On",
    soundOff: "Sound Muted",
    themeDark: "Dark Mode",
    themeLight: "Light Mode",
    switchLang: "ภาษาไทย",

    // Auth
    authTitle: "TAPB D&D Dice",
    authSubtitle: "Welcome to the real-time 3D collaborative D&D dice realm",
    signInTab: "Sign In",
    signUpTab: "Create Account",
    fullName: "Display Name / Character Name",
    fullNamePlaceholder: "e.g. Gandalf or Aragorn",
    username: "Username",
    usernamePlaceholder: "Your login handle",
    password: "Password",
    passwordPlaceholder: "Enter password",
    confirmPassword: "Confirm Password",
    confirmPasswordPlaceholder: "Re-enter password",
    signingIn: "Signing In...",
    signingUp: "Registering...",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    passwordsMismatch: "Passwords do not match",
    fillAllFields: "Please fill in all required fields",

    // Lobby
    lobbyTitle: "Adventurer's Lobby",
    lobbySubtitle: "Create a new chamber or join your party's dice room",
    createChamber: "Create New Chamber",
    chamberName: "Chamber Name",
    chamberNamePlaceholder: "e.g. Dragon Heist Session 1",
    chamberPassword: "Room Password (Optional)",
    chamberPasswordPlaceholder: "Leave blank for a public chamber",
    createBtn: "Create Chamber",
    creating: "Creating...",
    joinChamber: "Join by Chamber Code",
    enterRoomCode: "Chamber Code",
    codePlaceholder: "e.g. DRAGON-849",
    enterRoomPassword: "Chamber Password",
    joinBtn: "Join Chamber",
    joining: "Joining...",
    chambersList: "Available Chambers",
    myChambers: "My Chambers",
    allChambers: "All Chambers",
    noRoomsFound: "No active chambers found",
    beTheFirstToCreate: "Be the first to forge a dice chamber!",
    lockedRoom: "Password Protected",
    publicRoom: "Public Chamber",
    creator: "Creator",
    created: "Created",
    enterPasswordToJoin: "Please enter the password to unlock this chamber",
    unlockAndEnter: "Unlock & Enter",
    cancel: "Cancel",

    // Room
    roomChamber: "Chamber",
    copyCode: "Copy Code",
    codeCopied: "Copied!",
    shareLink: "Share Link",
    linkCopied: "Link Copied!",
    leaveRoom: "Leave Chamber",
    membersOnline: "Party Members",
    activeParty: "Party In Chamber",
    you: "You",
    noMembersDetected: "No party members detected.",
    diceTrayIdle: "Select dice below and click Cast to roll into the 3D tray",
    rollingStatus: "Rolling the dice...",
    rollFormula: "Formula",
    diceSelector: "Choose D&D Dice",
    count: "Count",
    modifier: "Modifier",
    castDice: "CAST DICE",
    rolling: "Rolling...",
    advantage: "2 Dice (Advantage / Disadvantage)",
    rollHistory: "Live Roll Chronicle",
    clearHistory: "Clear Screen Feed",
    noRollsYet: "No dice have been cast in this chamber yet",
    chronicleUnwritten: "The chronicle is unwritten.",
    rollDiceToRecordFate: "Roll the dice to record the party's fate!",
    rollsLabel: "rolls",
    singleRollLabel: "roll",
    rolled: "rolled",
    criticalHit: "CRITICAL HIT! (Nat 20)",
    criticalFail: "CRITICAL FAIL! (Nat 1)",
    total: "Total",
    diceOutcomes: "Dice Values",
    unlockModalTitle: "Chamber Password Required",
    unlockModalDesc: "Enter the chamber password to view rolls and join the party",
    incorrectPassword: "Incorrect chamber password. Please try again.",
    verifyAndJoin: "Verify & Enter",
    unlockChamber: "Unlock Chamber",
    protectedChamber: "Protected Chamber",
    providePasswordToJoin: "Provide password to join",
    copyChamberCode: "Copy Code",
    connectingToChamber: "Connecting to chamber...",
    chamberInaccessible: "Chamber Inaccessible",
    roomNotFound: "Room not found.",
    returnToLobby: "Return to Tavern Lobby",
    diceTrayTab: "Dice Tray",
    rollHistoryTab: "Chronicle",
    membersTab: "Party",
    justNow: "Just now",
  },
};

type Translations = typeof translations.th;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof Translations, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "th",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => key as string,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("th");

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("tapb_lang") as Language | null;
      if (savedLang === "th" || savedLang === "en") {
        setLanguageState(savedLang);
      }
    } catch {
      // ignore
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("tapb_lang", lang);
    } catch {
      // ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === "th" ? "en" : "th");
  };

  const t = (key: keyof Translations, params?: Record<string, string | number>): string => {
    const dict = translations[language] || translations.th;
    let text = (dict as any)[key] || (translations.en as any)[key] || key;
    if (params) {
      Object.entries(params).forEach(([pKey, pVal]) => {
        text = text.replace(new RegExp(`{${pKey}}`, "g"), String(pVal));
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
