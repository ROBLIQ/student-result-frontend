import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  LogOut,
  Plus,
  Trash2,
  BookOpen,
  LayoutDashboard,
  GraduationCap,
  User,
  Upload,
  Download,
  Check,
  X,
  AlertCircle,
  Menu,
  AlertTriangle,
  Search,
  Shield,
  Users,
  ChevronDown,
  ChevronUp,
  BarChart2,
} from "lucide-react";

// ---------- API ----------
const API_BASE = "https://student-results-backend-kwqt.onrender.com/api";

async function apiFetch(path, token, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

// ---------- design tokens ----------
const INK = "#16243E";
const GOLD = "#C8973D";
const PAPER = "#FAF8F3";
const LINE = "#E7E1D6";
const SLATE = "#5B6472";
const MUTED = "#8A8275";
const PASS_C = "#2F6B4F";
const FAIL_C = "#8C2F39";

const SERIF = "'Fraunces', serif";
const SANS = "'Inter', sans-serif";
const MONO = "'IBM Plex Mono', monospace";

const GRADE_COLORS = { A: "#2F6B4F", B: "#5C8A6B", C: GOLD, D: "#B4793A", E: "#9C5B36", F: FAIL_C };
const EMPTY_GRADES = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };

function clamp(v, max) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(max, v));
}

function getGrade(total) {
  if (total >= 70) return "A";
  if (total >= 60) return "B";
  if (total >= 50) return "C";
  if (total >= 45) return "D";
  if (total >= 40) return "E";
  return "F";
}

function getStatus(total) {
  return total >= 40 ? "PASS" : "FAIL";
}

function GradeStamp({ status }) {
  const isPass = status === "PASS";
  const color = isPass ? PASS_C : FAIL_C;
  return (
    <span
      style={{
        display: "inline-block",
        border: `2px solid ${color}`,
        color,
        borderRadius: "9999px",
        padding: "2px 12px",
        fontFamily: MONO,
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.12em",
        transform: "rotate(-5deg)",
        textTransform: "uppercase",
        background: isPass ? "rgba(47,107,79,0.07)" : "rgba(140,47,57,0.07)",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-lg p-4" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
      <div className="text-xs uppercase tracking-wide" style={{ color: MUTED, fontFamily: SANS }}>
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1" style={{ color: INK, fontFamily: SERIF }}>
        {value}
      </div>
      {sub ? (
        <div className="text-xs mt-1" style={{ color: SLATE, fontFamily: SANS }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function ErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      className="flex items-start justify-between gap-3 px-4 py-3 rounded-md mb-5 text-sm"
      style={{ background: "rgba(140,47,57,0.07)", border: `1px solid ${FAIL_C}`, color: FAIL_C }}
    >
      <div className="flex items-center gap-2">
        <AlertCircle size={16} />
        {message}
      </div>
      <button onClick={onClose} aria-label="Dismiss">
        <X size={14} color={FAIL_C} />
      </button>
    </div>
  );
}

function ConfirmDialog({ state, onClose }) {
  if (!state) return null;
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(22,36,62,0.45)" }}
    >
      <div className="rounded-lg p-6 max-w-sm w-full" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2 mb-2" style={{ color: FAIL_C }}>
          <AlertCircle size={18} />
          <h3 style={{ color: INK, fontFamily: SERIF, fontWeight: 600, fontSize: "1rem" }}>Are you sure?</h3>
        </div>
        <p className="text-sm mb-5" style={{ color: SLATE }}>
          {state.message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150"
            style={{ border: `1px solid ${LINE}`, color: SLATE }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-md text-sm font-medium"
            style={{ background: FAIL_C, color: "#FFFFFF" }}
          >
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StudentResultsApp() {
  // ---- auth state ----
  const [token, setToken] = useState(() => localStorage.getItem("rms_token") || "");
  const [authChecked, setAuthChecked] = useState(false);
  const [lecturer, setLecturer] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'register'
  const [authRole, setAuthRole] = useState("lecturer"); // 'lecturer' | 'admin'
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", department: "", institution: "", secret: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);





  // ---- data state ----
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [courseSummaries, setCourseSummaries] = useState({});
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // ---- ui state ----
  const [page, setPage] = useState("overview");
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [newSemester, setNewSemester] = useState("");
  const [newSession, setNewSession] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const saveTimers = useRef({});
  const [carryoverData, setCarryoverData] = useState(null);
  const [carryoverLoading, setCarryoverLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [levelData, setLevelData] = useState(null);
  const [levelLoading, setLevelLoading] = useState(false);

  function askConfirm(message, onConfirm) {
    setConfirmState({ message, onConfirm });
  }

  // restore session on first load
  useEffect(() => {
    if (!token) {
      setAuthChecked(true);
      return;
    }
    // Try admin first, then lecturer
    apiFetch("/admin/me", token)
      .then((data) => {
        if (data.role === "admin") setAdminUser(data);
        else setLecturer(data);
      })
      .catch(() =>
        apiFetch("/auth/me", token)
          .then((data) => setLecturer(data))
          .catch(() => {
            localStorage.removeItem("rms_token");
            setToken("");
          })
      )
      .finally(() => setAuthChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load courses once logged in
  useEffect(() => {
    if (lecturer) loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturer]);

  // load students whenever the selected course changes
  useEffect(() => {
    if (selectedCourseId) loadStudents(selectedCourseId);
    else setSelectedStudents([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  async function loadCourses() {
    setCoursesLoading(true);
    try {
      const data = await apiFetch("/courses", token);
      setCourses(data);
      if (data.length) setSelectedCourseId((prev) => prev || data[0]._id);
      data.forEach((c) => loadSummary(c._id));
    } catch (err) {
      setGeneralError(err.message);
    } finally {
      setCoursesLoading(false);
    }
  }

  async function loadSummary(courseId) {
    try {
      const data = await apiFetch(`/courses/${courseId}/summary`, token);
      setCourseSummaries((prev) => ({ ...prev, [courseId]: data }));
    } catch {
      // non-fatal — chart just stays empty for this course
    }
  }

  async function loadStudents(courseId) {
    setStudentsLoading(true);
    try {
      const data = await apiFetch(`/students/course/${courseId}`, token);
      setSelectedStudents(data);
    } catch (err) {
      setGeneralError(err.message);
    } finally {
      setStudentsLoading(false);
    }
  }

  // ---- auth handlers ----
  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authRole === "admin") {
        const path = authMode === "login" ? "/admin/login" : "/admin/register";
        const body = authMode === "login"
          ? { email: authForm.email, password: authForm.password }
          : { name: authForm.name, email: authForm.email, password: authForm.password, institution: authForm.institution, secret: authForm.secret };
        const data = await apiFetch(path, null, { method: "POST", body: JSON.stringify(body) });
        localStorage.setItem("rms_token", data.token);
        setToken(data.token);
        setAdminUser(data.admin);
      } else {
        const path = authMode === "login" ? "/auth/login" : "/auth/register";
        const body = authMode === "login"
          ? { email: authForm.email, password: authForm.password }
          : { name: authForm.name, email: authForm.email, password: authForm.password, department: authForm.department };
        const data = await apiFetch(path, null, { method: "POST", body: JSON.stringify(body) });
        localStorage.setItem("rms_token", data.token);
        setToken(data.token);
        setLecturer(data.lecturer);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("rms_token");
    setToken("");
    setLecturer(null);
    setAdminUser(null);
    setCourses([]);
    setSelectedCourseId(null);
    setSelectedStudents([]);
    setCourseSummaries({});
    setPage("overview");
  }

  async function saveProfile(updated) {
    try {
      const data = await apiFetch("/auth/profile", token, { method: "PUT", body: JSON.stringify(updated) });
      setLecturer(data);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      setGeneralError(err.message);
    }
  }

  // ---- course handlers ----
  async function addCourse() {
    if (!newTitle.trim() || !newCode.trim()) return;
    try {
      const data = await apiFetch("/courses", token, {
        method: "POST",
        body: JSON.stringify({
          code: newCode.trim(),
          title: newTitle.trim(),
          level: newLevel,
          semester: newSemester,
          session: newSession.trim(),
        }),
      });
      setCourses((prev) => [...prev, data]);
      setSelectedCourseId(data._id);
      setCourseSummaries((prev) => ({
        ...prev,
        [data._id]: { pass: 0, fail: 0, gradeCounts: { ...EMPTY_GRADES }, totalStudents: 0 },
      }));
      setNewTitle("");
      setNewCode("");
      setNewLevel("");
      setNewSemester("");
      setNewSession("");
      setShowAddCourse(false);
    } catch (err) {
      setGeneralError(err.message);
    }
  }

  async function removeCourse(id) {
    try {
      await apiFetch(`/courses/${id}`, token, { method: "DELETE" });
      const remaining = courses.filter((c) => c._id !== id);
      setCourses(remaining);
      setCourseSummaries((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (selectedCourseId === id) setSelectedCourseId(remaining[0]?._id ?? null);
    } catch (err) {
      setGeneralError(err.message);
    }
  }

  // ---- student handlers ----
  async function addStudent(courseId) {
    try {
      const data = await apiFetch(`/students/course/${courseId}`, token, {
        method: "POST",
        body: JSON.stringify({ matric: "", name: "", department: "", programme: "", q1:0, q2:0, q3:0, q4:0, q5:0, q6:0, q7:0, q8:0, ca:0 }),
      });
      setSelectedStudents((prev) => [...prev, data]);
      loadSummary(courseId);
    } catch (err) {
      setGeneralError(err.message);
    }
  }

  async function addStudentsBulk(courseId, students) {
    try {
      const data = await apiFetch(`/students/course/${courseId}/bulk`, token, {
        method: "POST",
        body: JSON.stringify({ students }),
      });
      setSelectedStudents((prev) => [...prev, ...data.students]);
      loadSummary(courseId);
      return data;
    } catch (err) {
      setGeneralError(err.message);
      return { imported: 0, skipped: students.length };
    }
  }

  async function removeStudent(courseId, studentId) {
    try {
      await apiFetch(`/students/${studentId}`, token, { method: "DELETE" });
      setSelectedStudents((prev) => prev.filter((s) => s._id !== studentId));
      loadSummary(courseId);
    } catch (err) {
      setGeneralError(err.message);
    }
  }

  function updateStudent(courseId, studentId, field, value) {
    // update what's on screen immediately, so typing feels instant
    setSelectedStudents((prev) => prev.map((s) => (s._id === studentId ? { ...s, [field]: value } : s)));

    // wait until the lecturer pauses typing before actually saving,
    // and cancel any save that was already waiting for this same field
    const key = `${studentId}-${field}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);

    saveTimers.current[key] = setTimeout(async () => {
      try {
        await apiFetch(`/students/${studentId}`, token, {
          method: "PUT",
          body: JSON.stringify({ [field]: value }),
        });
        loadSummary(courseId);
      } catch (err) {
        setGeneralError(err.message);
      }
    }, 500);
  }

  async function globalSearch(params) {
    setSearchLoading(true);
    try {
      const qs = new URLSearchParams(params).toString();
      const data = await apiFetch(`/analysis/search?${qs}`, token);
      setSearchResults(data.results);
    } catch (err) {
      setGeneralError(err.message);
    } finally {
      setSearchLoading(false);
    }
  }

  async function loadLevelData() {
    setLevelLoading(true);
    try {
      const data = await apiFetch("/analysis/level-summary", token);
      setLevelData(data);
    } catch (err) {
      setGeneralError(err.message);
    } finally {
      setLevelLoading(false);
    }
  }

  async function loadCarryover() {
    try {
      const data = await apiFetch("/analysis/carryover", token);
      setCarryoverData(data);
    } catch (err) {
      setGeneralError(err.message);
    } finally {
      setCarryoverLoading(false);
    }
  }

  function goToPage(p) {
    setPage(p);
    setSidebarOpen(false);
    if (p === "carryover" && !carryoverData) loadCarryover();
    if (p === "level" && !levelData) loadLevelData();
  }

  const selectedCourse = courses.find((c) => c._id === selectedCourseId) || null;

  // ---- aggregate stats across all courses (for Overview) ----
  const overallGradeCounts = { ...EMPTY_GRADES };
  let overallPass = 0;
  let overallFail = 0;
  let totalStudents = 0;
  courses.forEach((c) => {
    const s = courseSummaries[c._id];
    if (!s) return;
    overallPass += s.pass;
    overallFail += s.fail;
    totalStudents += s.totalStudents;
    Object.keys(s.gradeCounts).forEach((g) => (overallGradeCounts[g] += s.gradeCounts[g]));
  });
  const passRate = overallPass + overallFail > 0 ? Math.round((overallPass / (overallPass + overallFail)) * 100) : 0;
  const barData = courses.map((c) => {
    const s = courseSummaries[c._id];
    return { name: c.code, Pass: s?.pass || 0, Fail: s?.fail || 0 };
  });
  const pieData = Object.entries(overallGradeCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v }));

  // ---------- LOADING / AUTH SCREENS ----------
  if (!authChecked) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: PAPER }}>
        <FontImport />
        <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>
          Checking your session…
        </p>
      </div>
    );
  }

  if (adminUser) {
    return <AdminDashboard admin={adminUser} token={token} onLogout={handleLogout} />;
  }

  if (!lecturer) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6" style={{ background: PAPER, fontFamily: SANS }}>
        <FontImport />
        <form
          onSubmit={handleAuthSubmit}
          className="w-full max-w-sm rounded-xl p-8 shadow-md"
          style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-5" style={{ background: INK }}>
            {authRole === "admin" ? <Shield size={22} color={GOLD} /> : <GraduationCap size={22} color={GOLD} />}
          </div>
          <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>
            Results Portal
          </h1>

          {/* Role tabs */}
          <div className="flex mb-4 rounded-md overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            {["lecturer", "admin"].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => { setAuthRole(role); setAuthError(""); }}
                className="flex-1 py-1.5 text-sm font-medium capitalize transition-colors duration-150"
                style={{
                  background: authRole === role ? INK : "#fff",
                  color: authRole === role ? PAPER : SLATE,
                }}
              >
                {role === "admin" ? "Admin" : "Lecturer"}
              </button>
            ))}
          </div>

          <p className="text-sm mb-4" style={{ color: SLATE }}>
            {authRole === "admin"
              ? authMode === "login" ? "Sign in to the admin dashboard." : "Create an admin account."
              : authMode === "login" ? "Sign in to your lecturer account." : "Create your lecturer account."}
          </p>

          {authMode === "register" && (
            <div className="mb-3">
              <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: MUTED }}>
                Full name
              </label>
              <input
                value={authForm.name}
                onChange={(e) => setAuthForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={authRole === "admin" ? "Admin name" : "Dr. Funmilayo Adeyemi"}
                className="w-full px-3 py-2 rounded-md outline-none text-sm"
                style={{ border: `1px solid ${LINE}`, color: INK }}
              />
            </div>
          )}

          <div className="mb-3">
            <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: MUTED }}>
              Email
            </label>
            <input
              type="email"
              required
              value={authForm.email}
              onChange={(e) => setAuthForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="you@university.edu.ng"
              className="w-full px-3 py-2 rounded-md outline-none text-sm"
              style={{ border: `1px solid ${LINE}`, color: INK }}
            />
          </div>

          <div className="mb-3">
            <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: MUTED }}>
              Password
            </label>
            <input
              type="password"
              required
              value={authForm.password}
              onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-md outline-none text-sm"
              style={{ border: `1px solid ${LINE}`, color: INK }}
            />
          </div>

          {authMode === "register" && authRole === "lecturer" && (
            <div className="mb-3">
              <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: MUTED }}>
                Department (optional)
              </label>
              <input
                value={authForm.department}
                onChange={(e) => setAuthForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="Computer Science"
                className="w-full px-3 py-2 rounded-md outline-none text-sm"
                style={{ border: `1px solid ${LINE}`, color: INK }}
              />
            </div>
          )}

          {authMode === "register" && authRole === "admin" && (
            <>
              <div className="mb-3">
                <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: MUTED }}>
                  Institution (optional)
                </label>
                <input
                  value={authForm.institution}
                  onChange={(e) => setAuthForm((f) => ({ ...f, institution: e.target.value }))}
                  placeholder="e.g. Federal Polytechnic, Ede"
                  className="w-full px-3 py-2 rounded-md outline-none text-sm"
                  style={{ border: `1px solid ${LINE}`, color: INK }}
                />
              </div>
              <div className="mb-3">
                <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: MUTED }}>
                  Admin Setup Key
                </label>
                <input
                  type="password"
                  value={authForm.secret}
                  onChange={(e) => setAuthForm((f) => ({ ...f, secret: e.target.value }))}
                  placeholder="Enter the admin secret key"
                  className="w-full px-3 py-2 rounded-md outline-none text-sm"
                  style={{ border: `1px solid ${LINE}`, color: INK }}
                />
                <p className="text-xs mt-1" style={{ color: MUTED }}>Contact the system developer for this key.</p>
              </div>
            </>
          )}

          {authError && (
            <div className="text-sm mb-3 px-3 py-2 rounded-md" style={{ background: "rgba(140,47,57,0.07)", color: FAIL_C }}>
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-2 rounded-md text-sm font-medium transition-colors duration-150"
            style={{ background: INK, color: PAPER, opacity: authLoading ? 0.7 : 1 }}
          >
            {authLoading ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}
          </button>

          <p className="text-xs mt-4 text-center" style={{ color: MUTED }}>
            {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setAuthMode((m) => (m === "login" ? "register" : "login"));
                setAuthError("");
              }}
              className="underline font-medium"
              style={{ color: INK }}
            >
              {authMode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    );
  }

  // ---------- APP SHELL ----------
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row" style={{ background: PAPER, fontFamily: SANS }}>
      <FontImport />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />

      {/* Mobile top bar */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30"
        style={{ background: INK }}
      >
        <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="p-1">
          <Menu size={22} color={PAPER} />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ background: GOLD, color: INK, fontFamily: SERIF }}
          >
            {lecturer.name.charAt(0).toUpperCase() || "L"}
          </div>
          <span className="text-sm font-medium truncate max-w-[140px]" style={{ color: PAPER }}>
            {lecturer.name}
          </span>
        </div>
      </div>

      {/* Mobile overlay behind drawer */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{ background: "rgba(22,36,62,0.5)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className="rms-sidebar w-60 flex-shrink-0 flex flex-col justify-between fixed md:static inset-y-0 left-0 z-40 transition-transform duration-200 md:translate-x-0"
        style={{ background: INK }}
      >
        <style>{`
          @media (max-width: 767px) {
            .rms-sidebar { transform: ${sidebarOpen ? "translateX(0)" : "translateX(-100%)"}; }
          }
        `}</style>
        <div>
          <div className="px-5 py-6 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                style={{ background: GOLD, color: INK, fontFamily: SERIF }}
              >
                {lecturer.name.charAt(0).toUpperCase() || "L"}
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-medium truncate" style={{ color: PAPER }}>
                  {lecturer.name}
                </div>
                <div className="text-xs uppercase tracking-wide" style={{ color: GOLD }}>
                  Lecturer
                </div>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 flex-shrink-0" aria-label="Close menu">
              <X size={18} color={PAPER} />
            </button>
          </div>

          <nav className="px-3 py-4 space-y-1">
            <SidebarItem icon={<LayoutDashboard size={16} />} label="Overview" active={page === "overview"} onClick={() => goToPage("overview")} />
            <SidebarItem icon={<BookOpen size={16} />} label="Courses & Results" active={page === "manage"} onClick={() => goToPage("manage")} />
            <SidebarItem icon={<Search size={16} />} label="Search Students" active={page === "search"} onClick={() => goToPage("search")} />
            <SidebarItem icon={<BarChart2 size={16} />} label="Level Analysis" active={page === "level"} onClick={() => goToPage("level")} />
            <SidebarItem icon={<AlertTriangle size={16} />} label="Carry-Over" active={page === "carryover"} onClick={() => goToPage("carryover")} />
            <SidebarItem icon={<User size={16} />} label="Profile" active={page === "profile"} onClick={() => goToPage("profile")} />
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-4 text-sm transition-colors duration-150"
          style={{ color: "rgba(255,255,255,0.7)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-x-auto w-full">

        <ErrorBanner message={generalError} onClose={() => setGeneralError("")} />

        {page === "overview" ? (
          <OverviewPage
            totalCourses={courses.length}
            totalStudents={totalStudents}
            passRate={passRate}
            overallFail={overallFail}
            barData={barData}
            pieData={pieData}
            loading={coursesLoading}
          />
        ) : page === "profile" ? (
          <ProfilePage lecturer={lecturer} saveProfile={saveProfile} profileSaved={profileSaved} />
        ) : page === "level" ? (
          <LevelAnalysisPage
            data={levelData}
            loading={levelLoading}
            onRefresh={loadLevelData}
          />
        ) : page === "search" ? (
          <SearchPage
            onSearch={globalSearch}
            results={searchResults}
            loading={searchLoading}
          />
        ) : page === "carryover" ? (
          <CarryoverPage
            data={carryoverData}
            loading={carryoverLoading}
            onRefresh={loadCarryover}
          />
        ) : (
          <ManagePage
            courses={courses}
            coursesLoading={coursesLoading}
            selectedCourse={selectedCourse}
            selectedCourseId={selectedCourseId}
            setSelectedCourseId={setSelectedCourseId}
            showAddCourse={showAddCourse}
            setShowAddCourse={setShowAddCourse}
            newTitle={newTitle}
            setNewTitle={setNewTitle}
            newCode={newCode}
            setNewCode={setNewCode}
            newLevel={newLevel}
            setNewLevel={setNewLevel}
            newSemester={newSemester}
            setNewSemester={setNewSemester}
            newSession={newSession}
            setNewSession={setNewSession}
            addCourse={addCourse}
            removeCourse={removeCourse}
            students={selectedStudents}
            studentsLoading={studentsLoading}
            summary={selectedCourseId ? courseSummaries[selectedCourseId] : null}
            addStudent={addStudent}
            addStudentsBulk={addStudentsBulk}
            removeStudent={removeStudent}
            updateStudent={updateStudent}
            askConfirm={askConfirm}
          />
        )}
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150"
      style={{ color: active ? INK : "rgba(255,255,255,0.75)", background: active ? GOLD : "transparent", fontWeight: active ? 600 : 400 }}
    >
      {icon}
      {label}
    </button>
  );
}

function ProfilePage({ lecturer, saveProfile, profileSaved }) {
  const [name, setName] = useState(lecturer.name || "");
  const [email, setEmail] = useState(lecturer.email || "");
  const [department, setDepartment] = useState(lecturer.department || "");

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    saveProfile({ name: name.trim(), email: email.trim(), department: department.trim() });
  }

  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>
        Profile
      </h1>
      <p className="text-sm mb-6" style={{ color: SLATE }}>
        Keep your details up to date.
      </p>

      <form onSubmit={handleSubmit} className="max-w-md rounded-lg p-6 space-y-4" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
        <div>
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: MUTED }}>
            Full name
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-md outline-none text-sm" style={{ border: `1px solid ${LINE}`, color: INK }} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: MUTED }}>
            Email
          </label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-md outline-none text-sm" style={{ border: `1px solid ${LINE}`, color: INK }} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: MUTED }}>
            Department
          </label>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Computer Science" className="w-full px-3 py-2 rounded-md outline-none text-sm" style={{ border: `1px solid ${LINE}`, color: INK }} />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium" style={{ background: INK, color: PAPER }}>
            Save changes
          </button>
          {profileSaved && (
            <span className="flex items-center gap-1 text-sm" style={{ color: PASS_C }}>
              <Check size={14} /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function OverviewPage({ totalCourses, totalStudents, passRate, overallFail, barData, pieData, loading }) {
  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>
        Overview
      </h1>
      <p className="text-sm mb-6" style={{ color: SLATE }}>
        A summary of results across all your courses.
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: MUTED }}>
          Loading…
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
            <StatCard label="Courses" value={totalCourses} />
            <StatCard label="Students" value={totalStudents} />
            <StatCard label="Pass rate" value={`${passRate}%`} />
            <StatCard label="Failing" value={overallFail} sub="across all courses" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg p-5" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: INK }}>
                Pass / Fail by course
              </h2>
              {barData.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData}>
                    <CartesianGrid stroke={LINE} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: SLATE }} />
                    <YAxis tick={{ fontSize: 12, fill: SLATE }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Pass" fill={PASS_C} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Fail" fill={FAIL_C} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-lg p-5" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: INK }}>
                Grade distribution
              </h2>
              {pieData.length === 0 ? (
                <EmptyChartNote />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={GRADE_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyChartNote() {
  return (
    <div className="h-[260px] flex items-center justify-center text-sm text-center px-6" style={{ color: MUTED }}>
      No results yet. Add a course and enter scores to see this chart.
    </div>
  );
}

function ManagePage(props) {
  const {
    courses,
    coursesLoading,
    selectedCourse,
    selectedCourseId,
    setSelectedCourseId,
    showAddCourse,
    setShowAddCourse,
    newTitle,
    setNewTitle,
    newCode,
    setNewCode,
    newLevel,
    setNewLevel,
    newSemester,
    setNewSemester,
    newSession,
    setNewSession,
    addCourse,
    removeCourse,
    students,
    studentsLoading,
    summary,
    addStudent,
    addStudentsBulk,
    removeStudent,
    updateStudent,
    askConfirm,
  } = props;

  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>
        Courses & Results
      </h1>
      <p className="text-sm mb-6" style={{ color: SLATE }}>
        Add your courses, then record and grade student scores.
      </p>

      <div className="grid gap-6 grid-cols-1 md:[grid-template-columns:260px_1fr]">
        <div className="rounded-lg p-4" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wide" style={{ color: MUTED }}>
              My courses
            </span>
            <button
              onClick={() => setShowAddCourse((v) => !v)}
              className="p-1 rounded-md transition-colors duration-150"
              style={{ background: showAddCourse ? LINE : "transparent" }}
              aria-label="Add course"
            >
              {showAddCourse ? <X size={15} color={SLATE} /> : <Plus size={15} color={INK} />}
            </button>
          </div>

          {showAddCourse && (
            <div className="mb-3 space-y-2 p-3 rounded-md" style={{ background: PAPER }}>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Course code e.g. CSC301"
                className="w-full px-2 py-1.5 rounded-md text-sm outline-none"
                style={{ border: `1px solid ${LINE}`, fontFamily: MONO }}
              />
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Course title"
                className="w-full px-2 py-1.5 rounded-md text-sm outline-none"
                style={{ border: `1px solid ${LINE}` }}
              />
              <select
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md text-sm outline-none"
                style={{ border: `1px solid ${LINE}`, background: "#fff", color: newLevel ? INK : MUTED }}
              >
                <option value="">Select level</option>
                <option>ND I</option>
                <option>ND II</option>
                <option>HND I</option>
                <option>HND II</option>
              </select>
              <select
                value={newSemester}
                onChange={(e) => setNewSemester(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md text-sm outline-none"
                style={{ border: `1px solid ${LINE}`, background: "#fff", color: newSemester ? INK : MUTED }}
              >
                <option value="">Select semester</option>
                <option>First Semester</option>
                <option>Second Semester</option>
              </select>
              <input
                value={newSession}
                onChange={(e) => setNewSession(e.target.value)}
                placeholder="Session e.g. 2024/2025"
                className="w-full px-2 py-1.5 rounded-md text-sm outline-none"
                style={{ border: `1px solid ${LINE}` }}
              />
              <button onClick={addCourse} className="w-full py-1.5 rounded-md text-sm font-medium" style={{ background: INK, color: PAPER }}>
                Add course
              </button>
            </div>
          )}

          <div className="space-y-1">
            {coursesLoading && (
              <p className="text-sm" style={{ color: MUTED }}>
                Loading…
              </p>
            )}
            {!coursesLoading && courses.length === 0 && (
              <p className="text-sm" style={{ color: MUTED }}>
                No courses yet.
              </p>
            )}
            {courses.map((c) => (
              <div
                key={c._id}
                onClick={() => setSelectedCourseId(c._id)}
                className="group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors duration-150"
                style={{
                  background: c._id === selectedCourseId ? PAPER : "transparent",
                  border: c._id === selectedCourseId ? `1px solid ${GOLD}` : "1px solid transparent",
                }}
              >
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: SLATE }}>{c.code}</div>
                  <div style={{ color: INK }}>{c.title}</div>
                  {(c.level || c.session) && (
                    <div className="text-xs mt-0.5" style={{ color: MUTED }}>
                      {[c.level, c.session].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    askConfirm(`Delete ${c.code} — ${c.title}? This will also delete all its students.`, () => removeCourse(c._id));
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove course"
                >
                  <Trash2 size={14} color={FAIL_C} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          {!selectedCourse ? (
            <div className="rounded-lg p-10 text-center" style={{ background: "#FFFFFF", border: `1px solid ${LINE}`, color: MUTED }}>
              Select a course on the left, or add a new one, to manage its students and grades.
            </div>
          ) : (
            <CourseSheet
              course={selectedCourse}
              students={students}
              studentsLoading={studentsLoading}
              summary={summary}
              addStudent={addStudent}
              addStudentsBulk={addStudentsBulk}
              removeStudent={removeStudent}
              updateStudent={updateStudent}
              askConfirm={askConfirm}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CourseSheet({ course, students, studentsLoading, summary, addStudent, addStudentsBulk, removeStudent, updateStudent, askConfirm }) {
  const fileInputRef = useRef(null);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterProg, setFilterProg] = useState("");

  // Filter students client-side based on search inputs
  const filteredStudents = students.filter((s) => {
    const q = filterQuery.toLowerCase();
    const matchQ = !q || (s.name || "").toLowerCase().includes(q) || (s.matric || "").toLowerCase().includes(q);
    const matchD = !filterDept || (s.department || "").toLowerCase().includes(filterDept.toLowerCase());
    const matchP = !filterProg || s.programme === filterProg;
    return matchQ && matchD && matchP;
  });

  const pass = summary?.pass || 0;
  const fail = summary?.fail || 0;
  const gradeCounts = summary?.gradeCounts || EMPTY_GRADES;
  const barData = [{ name: course.code, Pass: pass, Fail: fail }];
  const pieData = Object.entries(gradeCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v }));

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let skipped = 0;
        const rows = [];
        results.data.forEach((row) => {
          const matric = (row.matric || "").trim();
          const name = (row.name || "").trim();
          if (!matric || !name) {
            skipped += 1;
            return;
          }
          rows.push({
            matric,
            name,
            department: (row.department || "").trim(),
            programme:  (row.programme  || "").trim(),
            q1: clamp(parseInt(row.q1, 10) || 0, 999),
            q2: clamp(parseInt(row.q2, 10) || 0, 999),
            q3: clamp(parseInt(row.q3, 10) || 0, 999),
            q4: clamp(parseInt(row.q4, 10) || 0, 999),
            q5: clamp(parseInt(row.q5, 10) || 0, 999),
            q6: clamp(parseInt(row.q6, 10) || 0, 999),
            q7: clamp(parseInt(row.q7, 10) || 0, 999),
            q8: clamp(parseInt(row.q8, 10) || 0, 999),
            ca: clamp(parseInt(row.ca, 10) || 0, 30),
          });
        });
        const result = rows.length ? await addStudentsBulk(course._id, rows) : { imported: 0 };
        setUploadMessage(
          skipped > 0
            ? `Imported ${result.imported} student(s). Skipped ${skipped} row(s) missing matric or name.`
            : `Imported ${result.imported} student(s).`
        );
      },
      error: () => setUploadMessage("Could not read that file. Please upload a .csv file."),
    });
    e.target.value = "";
  }

  function handleDownloadSample() {
    const sample =
      "matric,name,department,programme,q1,q2,q3,q4,q5,q6,q7,q8,ca\n" +
      "U2022/300111,Sample Student,Computer Science,ND,8,9,7,6,8,7,6,9,25\n";
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const filename = `${course.code}_Results_${course.session || "export"}`;

    // Sheet 1: Full Results
    const rows = students.map((s, i) => {
      const et = Math.min(70, (s.q1||0)+(s.q2||0)+(s.q3||0)+(s.q4||0)+(s.q5||0)+(s.q6||0)+(s.q7||0)+(s.q8||0));
      const gt = Math.min(100, et + (s.ca||0));
      return [i+1, s.matric||"", s.name||"", s.department||"", s.programme||"",
              s.q1||0, s.q2||0, s.q3||0, s.q4||0, s.q5||0, s.q6||0, s.q7||0, s.q8||0,
              et, s.ca||0, gt, getGrade(gt), getStatus(gt)];
    });
    const resultsSheet = XLSX.utils.aoa_to_sheet([
      [`COURSE: ${course.code} — ${course.title}`],
      [`Level: ${course.level||"—"}   Semester: ${course.semester||"—"}   Session: ${course.session||"—"}`],
      [],
      ["#","Matric No","Full Name","Department","Programme","Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8","Exam Total /70","C.A /30","Grand Total /100","Grade","Status"],
      ...rows,
    ]);
    XLSX.utils.book_append_sheet(wb, resultsSheet, "Results");

    // Sheet 2: Analysis
    const failed = (summary?.failedStudents || []);
    const analysisSheet = XLSX.utils.aoa_to_sheet([
      ["RESULT ANALYSIS"],
      [],
      ["Total Registered", summary?.totalStudents || students.length],
      ["Total Sat for Exam", summary?.totalSat || 0],
      ["Total Passed",      summary?.pass || 0],
      ["Total Failed",      summary?.fail || 0],
      ["Pass Rate",         `${summary?.passRate || 0}%`],
      [],
      ["GRADE DISTRIBUTION"],
      ["Grade","Count"],
      ...Object.entries(summary?.gradeCounts || {}).map(([g,c]) => [g, c]),
      [],
      ["FAILED STUDENTS"],
      ["Matric No","Name","Department","Programme","Exam Total","C.A","Grand Total","Grade"],
      ...failed.map(s => [s.matric, s.name, s.department, s.programme, s.examTotal, s.ca, s.grandTotal, s.grade]),
    ]);
    XLSX.utils.book_append_sheet(wb, analysisSheet, "Analysis");

    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  function exportPDF() {
    const filename = `${course.code}_Results_${course.session || "export"}`;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 14;

    // ── Header ──────────────────────────────────────────────
    doc.setFillColor(22, 36, 62);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(`${course.code}  —  ${course.title}`, 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 151, 61);
    const meta = [
      course.level    && `Level: ${course.level}`,
      course.semester && `Semester: ${course.semester}`,
      course.session  && `Session: ${course.session}`,
    ].filter(Boolean).join("     |     ");
    if (meta) doc.text(meta, 14, 22);
    y = 36;

    // ── Summary Stats ────────────────────────────────────────
    doc.setFontSize(11);
    doc.setTextColor(22, 36, 62);
    doc.setFont("helvetica", "bold");
    doc.text("Result Summary", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Total Registered", "Total Sat for Exam", "Total Passed", "Total Failed", "Pass Rate"]],
      body: [[
        summary?.totalStudents ?? students.length,
        summary?.totalSat ?? 0,
        summary?.pass ?? 0,
        summary?.fail ?? 0,
        `${summary?.passRate ?? 0}%`,
      ]],
      theme: "grid",
      headStyles: { fillColor: [22, 36, 62], textColor: 255, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 10, fontStyle: "bold", halign: "center" },
      columnStyles: {
        2: { textColor: [47, 107, 79] },
        3: { textColor: [140, 47, 57] },
        4: { textColor: (summary?.passRate ?? 0) >= 50 ? [47, 107, 79] : [140, 47, 57] },
      },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ── Grade Distribution ───────────────────────────────────
    doc.setFontSize(11);
    doc.setTextColor(22, 36, 62);
    doc.setFont("helvetica", "bold");
    doc.text("Grade Distribution", 14, y);
    y += 3;

    const grades = summary?.gradeCounts || {};
    autoTable(doc, {
      startY: y,
      head: [["Grade", "A", "B", "C", "D", "E", "F"]],
      body: [["Count",
        grades.A ?? 0, grades.B ?? 0, grades.C ?? 0,
        grades.D ?? 0, grades.E ?? 0, grades.F ?? 0,
      ]],
      theme: "grid",
      headStyles: { fillColor: [22, 36, 62], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 10, halign: "center" },
      columnStyles: { 6: { textColor: [140, 47, 57] } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;

    // ── Full Results Table ───────────────────────────────────
    doc.setFontSize(11);
    doc.setTextColor(22, 36, 62);
    doc.setFont("helvetica", "bold");
    doc.text("Complete Student Results", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["#", "Matric No", "Name", "Dept", "Prog", "Q1","Q2","Q3","Q4","Q5","Q6","Q7","Q8", "Exam /70", "C.A /30", "Total /100", "Grade", "Status"]],
      body: students.map((s, i) => {
        const et = Math.min(70,(s.q1||0)+(s.q2||0)+(s.q3||0)+(s.q4||0)+(s.q5||0)+(s.q6||0)+(s.q7||0)+(s.q8||0));
        const gt = Math.min(100, et + (s.ca||0));
        const gr = getGrade(gt);
        const st = getStatus(gt);
        return [i+1, s.matric||"—", s.name||"—", s.department||"—", s.programme||"—",
                s.q1||0, s.q2||0, s.q3||0, s.q4||0, s.q5||0, s.q6||0, s.q7||0, s.q8||0,
                et, s.ca||0, gt, gr, st];
      }),
      theme: "striped",
      headStyles: { fillColor: [22, 36, 62], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [250, 248, 243] },
      didParseCell: (data) => {
        if (data.section === "body") {
          const status = data.row.raw[17];
          if (data.column.index === 17) {
            data.cell.styles.textColor = status === "PASS" ? [47,107,79] : [140,47,57];
            data.cell.styles.fontStyle = "bold";
          }
          if (data.column.index === 16 && status === "FAIL") {
            data.cell.styles.textColor = [140,47,57];
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    // ── Failed Students Page ─────────────────────────────────
    const failed = summary?.failedStudents || [];
    if (failed.length > 0) {
      doc.addPage();
      doc.setFillColor(22, 36, 62);
      doc.rect(0, 0, pageW, 20, "F");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(`Failed Students — ${course.code}`, 14, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 151, 61);
      doc.text(`${failed.length} student(s) failed this course`, 14, 17);

      autoTable(doc, {
        startY: 25,
        head: [["#", "Matric No", "Full Name", "Department", "Programme", "Exam Total /70", "C.A /30", "Grand Total /100", "Grade"]],
        body: failed.map((s, i) => [
          i+1, s.matric||"—", s.name||"—", s.department||"—", s.programme||"—",
          s.examTotal, s.ca, s.grandTotal, s.grade,
        ]),
        theme: "grid",
        headStyles: { fillColor: [140, 47, 57], textColor: 255, fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [255, 248, 248] },
        columnStyles: {
          7: { textColor: [140, 47, 57], fontStyle: "bold" },
          8: { textColor: [140, 47, 57], fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
      });

      // Footer note on failed page
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.setFont("helvetica", "italic");
      doc.text(
        `Generated by Student Results Management System  |  ${course.code}  |  ${new Date().toLocaleDateString()}`,
        14, pageH - 8
      );
    }

    doc.save(`${filename}.pdf`);
  }

  const col = (n) => (
    <th key={n} className="text-left px-3 py-2 text-xs uppercase tracking-wide" style={{ color: MUTED, fontFamily: SANS, borderBottom: `1px solid ${LINE}` }}>
      {n}
    </th>
  );

  return (
    <div>
      <div className="rounded-lg p-5 mb-6 overflow-x-auto" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: SLATE }}>{course.code}</div>
            <h2 style={{ color: INK, fontFamily: SERIF, fontWeight: 600, fontSize: "1.1rem" }}>{course.title}</h2>
            <div className="flex flex-wrap gap-2 mt-1">
              {course.level    && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: PAPER, border: `1px solid ${LINE}`, color: SLATE }}>{course.level}</span>}
              {course.semester && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: PAPER, border: `1px solid ${LINE}`, color: SLATE }}>{course.semester}</span>}
              {course.session  && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: PAPER, border: `1px solid ${LINE}`, color: SLATE }}>{course.session}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} style={{ display: "none" }} />
            <button
              onClick={handleDownloadSample}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150"
              style={{ border: `1px solid ${LINE}`, color: SLATE }}
            >
              <Download size={14} /> Sample CSV
            </button>
            <button
              onClick={handleUploadClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150"
              style={{ border: `1px solid ${INK}`, color: INK }}
            >
              <Upload size={14} /> Upload CSV
            </button>
            <button
              onClick={exportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150"
              style={{ background: PASS_C, color: "#FFFFFF" }}
            >
              <Download size={14} /> Export Excel
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150"
              style={{ background: FAIL_C, color: "#FFFFFF" }}
            >
              <Download size={14} /> Export PDF
            </button>
            <button onClick={() => addStudent(course._id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: INK, color: PAPER }}>
              <Plus size={14} /> Add student
            </button>
          </div>
        </div>

        {uploadMessage && (
          <div className="text-sm mb-3 px-3 py-2 rounded-md" style={{ background: PAPER, color: SLATE, border: `1px solid ${LINE}` }}>
            {uploadMessage}
          </div>
        )}

        {/* Within-course search & filter */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md flex-1 min-w-[180px]" style={{ border: `1px solid ${LINE}`, background: "#fff" }}>
            <Search size={13} color={MUTED} />
            <input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search by name or matric…"
              className="outline-none text-sm w-full"
              style={{ color: INK }}
            />
          </div>
          <input
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            placeholder="Filter by department…"
            className="px-3 py-1.5 rounded-md text-sm outline-none"
            style={{ border: `1px solid ${LINE}`, minWidth: 160 }}
          />
          <select
            value={filterProg}
            onChange={(e) => setFilterProg(e.target.value)}
            className="px-3 py-1.5 rounded-md text-sm outline-none"
            style={{ border: `1px solid ${LINE}`, background: "#fff", color: filterProg ? INK : MUTED }}
          >
            <option value="">All programmes</option>
            <option>ND</option>
            <option>HND</option>
          </select>
          {(filterQuery || filterDept || filterProg) && (
            <button
              onClick={() => { setFilterQuery(""); setFilterDept(""); setFilterProg(""); }}
              className="px-3 py-1.5 rounded-md text-sm"
              style={{ border: `1px solid ${LINE}`, color: FAIL_C }}
            >
              Clear filters
            </button>
          )}
          {(filterQuery || filterDept || filterProg) && (
            <span className="px-3 py-1.5 text-sm" style={{ color: MUTED }}>
              Showing {filteredStudents.length} of {students.length}
            </span>
          )}
        </div>

        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Matric No", "Full Name", "Dept.", "Programme", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Exam Total /70", "C.A /30", "Grand Total /100", "Grade", "Status", ""].map((n) => col(n))}</tr>
          </thead>
          <tbody>
            {studentsLoading && (
              <tr>
                <td colSpan={10} className="text-center py-6 text-sm" style={{ color: MUTED }}>
                  Loading students…
                </td>
              </tr>
            )}
            {!studentsLoading && students.length === 0 && (
              <tr>
                <td colSpan={18} className="text-center py-6 text-sm" style={{ color: MUTED }}>
                  No students yet. Click "Add student" to begin.
                </td>
              </tr>
            )}
            {!studentsLoading && students.length > 0 && filteredStudents.length === 0 && (
              <tr>
                <td colSpan={18} className="text-center py-6 text-sm" style={{ color: MUTED }}>
                  No students match your search/filter. Try clearing the filters.
                </td>
              </tr>
            )}
            {!studentsLoading &&
              filteredStudents.map((s) => (
                <StudentRow
                  key={s._id}
                  student={s}
                  courseId={course._id}
                  courseCode={course.code}
                  updateStudent={updateStudent}
                  removeStudent={removeStudent}
                  askConfirm={askConfirm}
                />
              ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg p-5" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: INK }}>
            {course.code} — Pass vs Fail
          </h3>
          {pass + fail === 0 ? (
            <EmptyChartNote />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData}>
                <CartesianGrid stroke={LINE} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: SLATE }} />
                <YAxis tick={{ fontSize: 12, fill: SLATE }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Pass" fill={PASS_C} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Fail" fill={FAIL_C} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-lg p-5" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: INK }}>
            {course.code} — Grade spread
          </h3>
          {pieData.length === 0 ? (
            <EmptyChartNote />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={GRADE_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <ResultAnalysis summary={summary} course={course} />
    </div>
  );
}


function StudentRow({ student, courseId, courseCode, updateStudent, removeStudent, askConfirm }) {
  const [matric, setMatric] = useState(student.matric || "");
  const [name,   setName]   = useState(student.name   || "");
  const [department, setDepartment] = useState(student.department || "");
  const [programme,  setProgramme]  = useState(student.programme  || "");
  const [q1, setQ1] = useState(student.q1 || 0);
  const [q2, setQ2] = useState(student.q2 || 0);
  const [q3, setQ3] = useState(student.q3 || 0);
  const [q4, setQ4] = useState(student.q4 || 0);
  const [q5, setQ5] = useState(student.q5 || 0);
  const [q6, setQ6] = useState(student.q6 || 0);
  const [q7, setQ7] = useState(student.q7 || 0);
  const [q8, setQ8] = useState(student.q8 || 0);
  const [ca, setCa] = useState(student.ca || 0);

  const examTotal  = Math.min(70, q1 + q2 + q3 + q4 + q5 + q6 + q7 + q8);
  const grandTotal = Math.min(100, examTotal + ca);
  const grade  = getGrade(grandTotal);
  const status = getStatus(grandTotal);

  function numField(value, setter, field, max) {
    return (
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const v = clamp(parseInt(e.target.value, 10) || 0, max);
          setter(v);
          updateStudent(courseId, student._id, field, v);
        }}
        className="w-14 px-1 py-1 rounded-md text-sm outline-none text-center"
        style={{ border: `1px solid ${LINE}`, fontFamily: MONO }}
      />
    );
  }

  return (
    <tr style={{ borderBottom: `1px solid ${LINE}` }}>
      <td className="px-3 py-2">
        <input
          value={matric}
          onChange={(e) => { setMatric(e.target.value); updateStudent(courseId, student._id, "matric", e.target.value); }}
          placeholder="U2020/123456"
          className="w-32 px-2 py-1 rounded-md text-sm outline-none"
          style={{ border: `1px solid ${LINE}`, fontFamily: MONO }}
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); updateStudent(courseId, student._id, "name", e.target.value); }}
          placeholder="Full name"
          className="w-36 px-2 py-1 rounded-md text-sm outline-none"
          style={{ border: `1px solid ${LINE}` }}
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={department}
          onChange={(e) => { setDepartment(e.target.value); updateStudent(courseId, student._id, "department", e.target.value); }}
          placeholder="e.g. Comp. Sci."
          className="w-28 px-2 py-1 rounded-md text-sm outline-none"
          style={{ border: `1px solid ${LINE}` }}
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={programme}
          onChange={(e) => { setProgramme(e.target.value); updateStudent(courseId, student._id, "programme", e.target.value); }}
          className="w-20 px-1 py-1 rounded-md text-sm outline-none"
          style={{ border: `1px solid ${LINE}`, color: programme ? INK : MUTED }}
        >
          <option value="">—</option>
          <option>ND</option>
          <option>HND</option>
        </select>
      </td>
      <td className="px-2 py-2">{numField(q1, setQ1, "q1", 999)}</td>
      <td className="px-2 py-2">{numField(q2, setQ2, "q2", 999)}</td>
      <td className="px-2 py-2">{numField(q3, setQ3, "q3", 999)}</td>
      <td className="px-2 py-2">{numField(q4, setQ4, "q4", 999)}</td>
      <td className="px-2 py-2">{numField(q5, setQ5, "q5", 999)}</td>
      <td className="px-2 py-2">{numField(q6, setQ6, "q6", 999)}</td>
      <td className="px-2 py-2">{numField(q7, setQ7, "q7", 999)}</td>
      <td className="px-2 py-2">{numField(q8, setQ8, "q8", 999)}</td>
      <td className="px-3 py-2 text-sm font-semibold text-center" style={{ color: examTotal === 70 ? PASS_C : INK, fontFamily: MONO }}>
        {examTotal}
      </td>
      <td className="px-2 py-2">{numField(ca, setCa, "ca", 30)}</td>
      <td className="px-3 py-2 text-sm font-semibold text-center" style={{ color: INK, fontFamily: MONO }}>
        {grandTotal}
      </td>
      <td className="px-3 py-2 text-sm font-semibold" style={{ color: GRADE_COLORS[grade] }}>
        {grade}
      </td>
      <td className="px-3 py-2">
        <GradeStamp status={status} />
      </td>
      <td className="px-3 py-2">
        <button
          onClick={() => askConfirm(`Remove ${name || "this student"} from ${courseCode}?`, () => removeStudent(courseId, student._id))}
          aria-label="Remove student"
        >
          <Trash2 size={14} color={FAIL_C} />
        </button>
      </td>
    </tr>
  );
}

function ResultAnalysis({ summary, course }) {
  if (!summary || summary.totalStudents === 0) return null;

  const {
    totalStudents, totalSat, pass, fail, passRate,
    failedStudents = [],
  } = summary;

  return (
    <div className="mt-6 rounded-lg p-5" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
      <h3 className="text-base font-semibold mb-4" style={{ color: INK, fontFamily: SERIF }}>
        Result Analysis — {course.code}
      </h3>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Registered", value: totalStudents },
          { label: "Sat for Exam", value: totalSat },
          { label: "Passed", value: pass, color: PASS_C },
          { label: "Failed", value: fail, color: FAIL_C },
          { label: "Pass Rate", value: `${passRate}%`, color: passRate >= 50 ? PASS_C : FAIL_C },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg p-3 text-center" style={{ background: PAPER, border: `1px solid ${LINE}` }}>
            <div className="text-xs uppercase tracking-wide mb-1" style={{ color: MUTED, fontFamily: SANS }}>{label}</div>
            <div className="text-xl font-semibold" style={{ color: color || INK, fontFamily: SERIF }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Failed students list */}
      {failedStudents.length > 0 ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: FAIL_C }} />
            <h4 className="text-sm font-semibold" style={{ color: INK }}>
              Failed Students ({failedStudents.length})
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["#", "Matric No", "Full Name", "Department", "Programme", "Exam Total", "C.A", "Grand Total", "Grade"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 text-xs uppercase tracking-wide"
                      style={{ color: MUTED, borderBottom: `1px solid ${LINE}`, fontFamily: SANS }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {failedStudents.map((s, i) => (
                  <tr key={s.matric + i} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td className="px-3 py-2 text-sm" style={{ color: MUTED }}>{i + 1}</td>
                    <td className="px-3 py-2 text-sm font-medium" style={{ color: INK, fontFamily: MONO }}>{s.matric || "—"}</td>
                    <td className="px-3 py-2 text-sm" style={{ color: INK }}>{s.name || "—"}</td>
                    <td className="px-3 py-2 text-sm" style={{ color: SLATE }}>{s.department || "—"}</td>
                    <td className="px-3 py-2 text-sm" style={{ color: SLATE }}>{s.programme || "—"}</td>
                    <td className="px-3 py-2 text-sm text-center" style={{ color: SLATE, fontFamily: MONO }}>{s.examTotal}</td>
                    <td className="px-3 py-2 text-sm text-center" style={{ color: SLATE, fontFamily: MONO }}>{s.ca}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-center" style={{ color: FAIL_C, fontFamily: MONO }}>{s.grandTotal}</td>
                    <td className="px-3 py-2 text-sm font-semibold" style={{ color: FAIL_C }}>{s.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-sm py-4 text-center rounded-md" style={{ background: "rgba(47,107,79,0.06)", color: PASS_C, border: `1px solid rgba(47,107,79,0.2)` }}>
          🎉 All students passed this course!
        </div>
      )}
    </div>
  );
}

function CarryoverPage({ data, loading, onRefresh }) {
  const byLevel = data?.byLevel || {};
  const levels  = Object.keys(byLevel);
  const total   = data?.totalCarryover || 0;

  // ── Excel Export ──────────────────────────────────────────
  function exportCarryoverExcel() {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryRows = [
      ["CARRY-OVER ANALYSIS REPORT"],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      ["Level", "No. of Carry-Over Students"],
      ...levels.map((lvl) => [lvl, byLevel[lvl].length]),
      [],
      ["TOTAL CARRY-OVER STUDENTS", total],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

    // One sheet per level
    levels.forEach((lvl) => {
      const students = byLevel[lvl];
      const rows = [
        [`CARRY-OVER STUDENTS — ${lvl}`],
        [],
        ["#", "Matric No", "Full Name", "Department", "Programme", "No. of Failed Courses", "Courses Failed"],
        ...students.map((s, i) => [
          i + 1,
          s.matric,
          s.name,
          s.department,
          s.programme,
          s.coursesFailed.length,
          s.coursesFailed.map((c) => `${c.code} (${c.grandTotal})`).join(", "),
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), lvl.replace("/", "-"));
    });

    XLSX.writeFile(wb, `Carryover_Analysis_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  // ── PDF Export ────────────────────────────────────────────
  function exportCarryoverPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    // Cover header
    doc.setFillColor(22, 36, 62);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Carry-Over Analysis Report", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 151, 61);
    doc.text(`Generated: ${new Date().toLocaleDateString()}     |     Total Carry-Over Students: ${total}`, 14, 22);

    // Summary table
    let y = 34;
    doc.setFontSize(11);
    doc.setTextColor(22, 36, 62);
    doc.setFont("helvetica", "bold");
    doc.text("Summary by Level", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Level", "No. of Carry-Over Students"]],
      body: [
        ...levels.map((lvl) => [lvl, byLevel[lvl].length]),
        ["TOTAL", total],
      ],
      theme: "grid",
      headStyles: { fillColor: [22, 36, 62], textColor: 255, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: "center", fontStyle: "bold", textColor: [140, 47, 57] } },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === levels.length) {
          data.cell.styles.fillColor = [22, 36, 62];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: 14, right: 14 },
    });

    // Per-level detail pages
    levels.forEach((lvl) => {
      doc.addPage();
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFillColor(140, 47, 57);
      doc.rect(0, 0, pageW, 22, "F");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(`Carry-Over Students — ${lvl}`, 14, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(255, 220, 180);
      doc.text(`${byLevel[lvl].length} student(s)`, 14, 18);

      autoTable(doc, {
        startY: 26,
        head: [["#", "Matric No", "Full Name", "Department", "Programme", "Courses Failed", "Details"]],
        body: byLevel[lvl].map((s, i) => [
          i + 1,
          s.matric || "—",
          s.name   || "—",
          s.department || "—",
          s.programme  || "—",
          s.coursesFailed.length,
          s.coursesFailed.map((c) => `${c.code} (${c.grandTotal})`).join(", "),
        ]),
        theme: "striped",
        headStyles: { fillColor: [140, 47, 57], textColor: 255, fontSize: 8.5, fontStyle: "bold" },
        bodyStyles: { fontSize: 8.5 },
        alternateRowStyles: { fillColor: [255, 248, 248] },
        columnStyles: { 5: { halign: "center", textColor: [140, 47, 57], fontStyle: "bold" } },
        margin: { left: 14, right: 14 },
      });

      doc.setFontSize(7.5);
      doc.setTextColor(160, 160, 160);
      doc.setFont("helvetica", "italic");
      doc.text(
        `Student Results Management System  |  Carry-Over Analysis  |  ${new Date().toLocaleDateString()}`,
        14,
        pageH - 6
      );
    });

    doc.save(`Carryover_Analysis_${new Date().toISOString().split("T")[0]}.pdf`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>
            Carry-Over Analysis
          </h1>
          <p className="text-sm" style={{ color: SLATE }}>
            Students who failed at least one course — counted once regardless of how many courses they failed.
          </p>
        </div>
        {!loading && data && (
          <div className="flex gap-2">
            <button
              onClick={exportCarryoverExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ background: PASS_C, color: "#FFF" }}
            >
              <Download size={14} /> Export Excel
            </button>
            <button
              onClick={exportCarryoverPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ background: FAIL_C, color: "#FFF" }}
            >
              <Download size={14} /> Export PDF
            </button>
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ border: `1px solid ${LINE}`, color: SLATE }}
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: MUTED }}>Loading carry-over data…</p>
      ) : !data ? (
        <p className="text-sm" style={{ color: MUTED }}>Click Refresh to load analysis.</p>
      ) : total === 0 ? (
        <div className="rounded-lg p-10 text-center" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
          <div className="text-3xl mb-2">🎉</div>
          <p className="font-semibold" style={{ color: PASS_C, fontFamily: SERIF }}>No carry-over students!</p>
          <p className="text-sm mt-1" style={{ color: SLATE }}>All students passed all courses.</p>
        </div>
      ) : (
        <>
          {/* Total summary card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg p-4 col-span-2 sm:col-span-1" style={{ background: FAIL_C, border: `1px solid ${FAIL_C}` }}>
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Total Carry-Over</div>
              <div className="text-3xl font-semibold" style={{ color: "#FFF", fontFamily: SERIF }}>{total}</div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>students across all courses</div>
            </div>
            {levels.map((lvl) => (
              <div key={lvl} className="rounded-lg p-4" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
                <div className="text-xs uppercase tracking-wide mb-1" style={{ color: MUTED }}>{lvl}</div>
                <div className="text-2xl font-semibold" style={{ color: INK, fontFamily: SERIF }}>{byLevel[lvl].length}</div>
                <div className="text-xs mt-1" style={{ color: SLATE }}>carry-over student(s)</div>
              </div>
            ))}
          </div>

          {/* Per-level tables */}
          {levels.map((lvl) => (
            <div key={lvl} className="rounded-lg p-5 mb-5" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: FAIL_C }} />
                <h2 className="font-semibold" style={{ color: INK, fontFamily: SERIF, fontSize: "1rem" }}>
                  {lvl} — {byLevel[lvl].length} Carry-Over Student(s)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["#", "Matric No", "Full Name", "Department", "Programme", "No. of Failed Courses", "Courses Failed"].map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 text-xs uppercase tracking-wide"
                          style={{ color: MUTED, borderBottom: `1px solid ${LINE}`, fontFamily: SANS }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byLevel[lvl].map((s, i) => (
                      <tr key={s.matric + i} style={{ borderBottom: `1px solid ${LINE}` }}>
                        <td className="px-3 py-2 text-sm" style={{ color: MUTED }}>{i + 1}</td>
                        <td className="px-3 py-2 text-sm font-medium" style={{ color: INK, fontFamily: MONO }}>{s.matric || "—"}</td>
                        <td className="px-3 py-2 text-sm" style={{ color: INK }}>{s.name || "—"}</td>
                        <td className="px-3 py-2 text-sm" style={{ color: SLATE }}>{s.department || "—"}</td>
                        <td className="px-3 py-2 text-sm" style={{ color: SLATE }}>{s.programme || "—"}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-center" style={{ color: FAIL_C }}>{s.coursesFailed.length}</td>
                        <td className="px-3 py-2 text-sm" style={{ color: SLATE }}>
                          <div className="flex flex-wrap gap-1">
                            {s.coursesFailed.map((c, ci) => (
                              <span
                                key={ci}
                                className="px-2 py-0.5 rounded text-xs"
                                style={{ background: "rgba(140,47,57,0.08)", color: FAIL_C, border: `1px solid rgba(140,47,57,0.2)`, fontFamily: MONO }}
                                title={`${c.title} — Grand Total: ${c.grandTotal}`}
                              >
                                {c.code} ({c.grandTotal})
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function SearchPage({ onSearch, results, loading }) {
  const [q, setQ]           = useState("");
  const [dept, setDept]     = useState("");
  const [prog, setProg]     = useState("");
  const [level, setLevel]   = useState("");
  const searchTimer = useRef(null);

  function handleSearch(e) {
    e.preventDefault();
    onSearch({ q, department: dept, programme: prog, level });
  }

  function handleKeyUp() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (q.length >= 2 || dept || prog || level) {
        onSearch({ q, department: dept, programme: prog, level });
      }
    }, 400);
  }

  const passed = results?.filter((r) => r.status === "PASS").length || 0;
  const failed = results?.filter((r) => r.status === "FAIL").length || 0;

  return (
    <div>
      <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>
        Search Students
      </h1>
      <p className="text-sm mb-5" style={{ color: SLATE }}>
        Search across all your courses by name, matric number, department, programme, or level.
      </p>

      {/* Search form */}
      <form
        onSubmit={handleSearch}
        className="rounded-lg p-4 mb-6"
        style={{ background: "#FFF", border: `1px solid ${LINE}` }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md col-span-1 sm:col-span-2"
            style={{ border: `1px solid ${LINE}`, background: PAPER }}
          >
            <Search size={14} color={MUTED} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyUp={handleKeyUp}
              placeholder="Name or matric number…"
              className="outline-none text-sm w-full"
              style={{ background: "transparent", color: INK }}
            />
          </div>
          <input
            value={dept}
            onChange={(e) => { setDept(e.target.value); }}
            onKeyUp={handleKeyUp}
            placeholder="Department"
            className="px-3 py-2 rounded-md text-sm outline-none"
            style={{ border: `1px solid ${LINE}` }}
          />
          <div className="flex gap-2">
            <select
              value={prog}
              onChange={(e) => { setProg(e.target.value); handleKeyUp(); }}
              className="flex-1 px-3 py-2 rounded-md text-sm outline-none"
              style={{ border: `1px solid ${LINE}`, background: "#FFF", color: prog ? INK : MUTED }}
            >
              <option value="">All programmes</option>
              <option>ND</option>
              <option>HND</option>
            </select>
            <select
              value={level}
              onChange={(e) => { setLevel(e.target.value); handleKeyUp(); }}
              className="flex-1 px-3 py-2 rounded-md text-sm outline-none"
              style={{ border: `1px solid ${LINE}`, background: "#FFF", color: level ? INK : MUTED }}
            >
              <option value="">All levels</option>
              <option>ND I</option>
              <option>ND II</option>
              <option>HND I</option>
              <option>HND II</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-md text-sm font-medium"
            style={{ background: INK, color: PAPER }}
          >
            Search
          </button>
          {(q || dept || prog || level) && (
            <button
              type="button"
              onClick={() => { setQ(""); setDept(""); setProg(""); setLevel(""); }}
              className="px-4 py-2 rounded-md text-sm"
              style={{ border: `1px solid ${LINE}`, color: SLATE }}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Results */}
      {loading && (
        <p className="text-sm" style={{ color: MUTED }}>Searching…</p>
      )}

      {!loading && results === null && (
        <div className="text-center py-12 rounded-lg" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
          <Search size={32} color={LINE} className="mx-auto mb-3" />
          <p className="text-sm" style={{ color: MUTED }}>Enter a name, matric number, or use the filters above to search.</p>
        </div>
      )}

      {!loading && results !== null && results.length === 0 && (
        <div className="text-center py-10 rounded-lg" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
          <p className="text-sm font-medium" style={{ color: INK }}>No students found</p>
          <p className="text-sm mt-1" style={{ color: MUTED }}>Try a different name, matric, or adjust the filters.</p>
        </div>
      )}

      {!loading && results && results.length > 0 && (
        <div className="rounded-lg" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
          {/* Result summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3" style={{ borderBottom: `1px solid ${LINE}` }}>
            <span className="text-sm font-medium" style={{ color: INK }}>
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </span>
            <div className="flex gap-3 text-sm">
              <span style={{ color: PASS_C }}>✓ {passed} passed</span>
              <span style={{ color: FAIL_C }}>✗ {failed} failed</span>
            </div>
          </div>

          {/* Results table */}
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Matric No", "Full Name", "Department", "Programme", "Course", "Level", "Session", "Exam /70", "C.A /30", "Total /100", "Grade", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 text-xs uppercase tracking-wide"
                      style={{ color: MUTED, borderBottom: `1px solid ${LINE}`, fontFamily: SANS, whiteSpace: "nowrap" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r._id || i} style={{ borderBottom: `1px solid ${LINE}`, background: i % 2 === 0 ? "#FFF" : PAPER }}>
                    <td className="px-3 py-2 text-sm font-medium" style={{ color: INK, fontFamily: MONO, whiteSpace: "nowrap" }}>{r.matric || "—"}</td>
                    <td className="px-3 py-2 text-sm" style={{ color: INK, whiteSpace: "nowrap" }}>{r.name || "—"}</td>
                    <td className="px-3 py-2 text-sm" style={{ color: SLATE }}>{r.department || "—"}</td>
                    <td className="px-3 py-2 text-sm" style={{ color: SLATE }}>{r.programme || "—"}</td>
                    <td className="px-3 py-2 text-sm" style={{ color: INK, whiteSpace: "nowrap" }}>
                      <span style={{ fontFamily: MONO, color: GOLD }}>{r.course?.code}</span>
                      {" — "}
                      <span style={{ color: SLATE }}>{r.course?.title}</span>
                    </td>
                    <td className="px-3 py-2 text-sm" style={{ color: SLATE, whiteSpace: "nowrap" }}>{r.course?.level || "—"}</td>
                    <td className="px-3 py-2 text-sm" style={{ color: SLATE, whiteSpace: "nowrap" }}>{r.course?.session || "—"}</td>
                    <td className="px-3 py-2 text-sm text-center" style={{ color: SLATE, fontFamily: MONO }}>{r.examTotal}</td>
                    <td className="px-3 py-2 text-sm text-center" style={{ color: SLATE, fontFamily: MONO }}>{r.ca}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-center" style={{ color: INK, fontFamily: MONO }}>{r.grandTotal}</td>
                    <td className="px-3 py-2 text-sm font-semibold" style={{ color: GRADE_COLORS[r.grade] || INK }}>{r.grade}</td>
                    <td className="px-3 py-2">
                      <GradeStamp status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================= ADMIN DASHBOARD =======================
function AdminDashboard({ admin, token, onLogout }) {
  const [page, setPage] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overview, setOverview]   = useState(null);
  const [lecturers, setLecturers] = useState(null);
  const [departments, setDepts]   = useState(null);
  const [failedData, setFailed]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [expandedLecturer, setExpandedLecturer] = useState(null);
  const [lecturerCourses, setLecturerCourses]   = useState({});
  const [failedFilters, setFailedFilters] = useState({ department:"", level:"", session:"" });
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }

  async function adminFetch(path) {
    return apiFetch(path, token);
  }

  useEffect(() => { loadPage("overview"); }, []);

  async function loadPage(p) {
    setPage(p);
    setSidebarOpen(false);
    setLoading(true);
    try {
      if (p === "overview"    && !overview)     setOverview(await adminFetch("/admin/overview"));
      if (p === "lecturers"   && !lecturers)    setLecturers(await adminFetch("/admin/lecturers"));
      if (p === "departments" && !departments)  setDepts(await adminFetch("/admin/departments"));
      if (p === "failed")                        setFailed(await adminFetch(`/admin/failed-students?department=${failedFilters.department}&level=${failedFilters.level}&session=${failedFilters.session}`));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleLecturer(id) {
    if (expandedLecturer === id) { setExpandedLecturer(null); return; }
    setExpandedLecturer(id);
    if (!lecturerCourses[id]) {
      const data = await adminFetch(`/admin/lecturers/${id}/courses`);
      setLecturerCourses((prev) => ({ ...prev, [id]: data }));
    }
  }

  async function deleteLecturer(id) {
    try {
      await apiFetch(`/admin/lecturers/${id}`, token, { method: "DELETE" });
      setLecturers((prev) => prev.filter((l) => l._id !== id));
      if (expandedLecturer === id) setExpandedLecturer(null);
      // Refresh overview stats since data changed
      setOverview(null);
    } catch (err) {
      console.error("Delete failed:", err.message);
    }
    setConfirmDelete(null);
  }

  async function applyFailedFilters() {
    setLoading(true);
    try {
      const { department, level, session } = failedFilters;
      setFailed(await adminFetch(`/admin/failed-students?department=${department}&level=${level}&session=${session}`));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row" style={{ background: PAPER, fontFamily: SANS }}>
      <FontImport />

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(22,36,62,0.5)" }}>
          <div className="rounded-lg p-6 max-w-sm w-full" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={18} color={FAIL_C} />
              <h3 className="font-semibold" style={{ color: INK, fontFamily: SERIF, fontSize: "1rem" }}>Delete Lecturer Account?</h3>
            </div>
            <p className="text-sm mb-1" style={{ color: SLATE }}>You are about to permanently delete:</p>
            <p className="text-sm font-semibold mb-3" style={{ color: FAIL_C }}>{confirmDelete.name}</p>
            <p className="text-sm mb-5" style={{ color: SLATE }}>
              This will also delete <strong>all their courses and student records</strong>. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-md text-sm font-medium" style={{ border: `1px solid ${LINE}`, color: SLATE }}>
                Cancel
              </button>
              <button onClick={() => deleteLecturer(confirmDelete.id)} className="px-4 py-2 rounded-md text-sm font-medium" style={{ background: FAIL_C, color: "#FFF" }}>
                Yes, delete account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30" style={{ background: "#7C3AED" }}>
        <button onClick={() => setSidebarOpen(true)} className="p-1"><Menu size={22} color="#FFF" /></button>
        <span className="text-sm font-semibold" style={{ color: "#FFF" }}>Admin Dashboard</span>
        <Shield size={18} color="#FFF" />
      </div>

      {sidebarOpen && <div className="md:hidden fixed inset-0 z-30" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setSidebarOpen(false)} />}

      {/* Admin Sidebar */}
      <aside
        className="rms-admin-sidebar w-60 flex-shrink-0 flex flex-col justify-between fixed md:static inset-y-0 left-0 z-40 transition-transform duration-200 md:translate-x-0"
        style={{ background: "#4C1D95" }}
      >
        <style>{`@media(max-width:767px){.rms-admin-sidebar{transform:${sidebarOpen?"translateX(0)":"translateX(-100%)"}}}`}</style>
        <div>
          <div className="px-5 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#7C3AED" }}>
                <Shield size={18} color="#FFF" />
              </div>
              <div>
                <div className="text-sm font-medium truncate" style={{ color: "#FFF" }}>{admin.name}</div>
                <div className="text-xs uppercase tracking-wide" style={{ color: "#A78BFA" }}>Administrator</div>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1"><X size={16} color="#FFF" /></button>
          </div>
          <nav className="px-3 py-4 space-y-1">
            {[
              { id:"overview",     icon:<LayoutDashboard size={16}/>, label:"Overview" },
              { id:"lecturers",    icon:<Users size={16}/>,           label:"Lecturers" },
              { id:"departments",  icon:<BookOpen size={16}/>,        label:"Departments" },
              { id:"failed",       icon:<AlertTriangle size={16}/>,   label:"Failed Students" },
            ].map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => loadPage(id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150"
                style={{ background: page === id ? "#7C3AED" : "transparent", color: page === id ? "#FFF" : "rgba(255,255,255,0.75)", fontWeight: page === id ? 600 : 400 }}
              >
                {icon}{label}
              </button>
            ))}
          </nav>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 px-5 py-4 text-sm" style={{ color: "rgba(255,255,255,0.7)", borderTop: "1px solid rgba(255,255,255,0.15)" }}>
          <LogOut size={15} /> Sign out
        </button>
      </aside>

      {/* Admin Main */}
      <main className="flex-1 p-4 md:p-8 overflow-x-auto w-full">
        {loading && <p className="text-sm mb-4" style={{ color: MUTED }}>Loading…</p>}

        {/* OVERVIEW */}
        {page === "overview" && overview && (
          <div>
            <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>Overview</h1>
            <p className="text-sm mb-6" style={{ color: SLATE }}>Institution-wide performance summary.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label:"Lecturers",   value: overview.lecturerCount },
                { label:"Courses",     value: overview.courseCount },
                { label:"Students",    value: overview.studentCount },
                { label:"Pass Rate",   value: `${overview.passRate}%`, color: overview.passRate >= 50 ? PASS_C : FAIL_C },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg p-4" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: MUTED }}>{label}</div>
                  <div className="text-2xl font-semibold" style={{ color: color || INK, fontFamily: SERIF }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-lg p-5" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: INK }}>Pass vs Fail (All Courses)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[{ name:"All", Pass: overview.pass, Fail: overview.fail }]}>
                    <CartesianGrid stroke={LINE} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: SLATE }} />
                    <YAxis tick={{ fontSize: 12, fill: SLATE }} allowDecimals={false} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Pass" fill={PASS_C} radius={[3,3,0,0]} />
                    <Bar dataKey="Fail" fill={FAIL_C} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-lg p-5" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: INK }}>Grade Distribution</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={Object.entries(overview.gradeCounts).filter(([,v])=>v>0).map(([k,v])=>({name:k,value:v}))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {Object.entries(overview.gradeCounts).filter(([,v])=>v>0).map(([k])=>(
                        <Cell key={k} fill={GRADE_COLORS[k]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} /><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* LECTURERS */}
        {page === "lecturers" && lecturers && (
          <div>
            <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>Lecturers</h1>
            <p className="text-sm mb-6" style={{ color: SLATE }}>{lecturers.length} lecturer(s) registered.</p>
            <div className="rounded-lg overflow-hidden" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["Name","Email","Department","Courses","Students","Passed","Failed","Pass Rate","",""].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wide" style={{ color: MUTED, borderBottom:`1px solid ${LINE}` }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {lecturers.map((l, i) => (
                    <>
                      <tr key={l._id} style={{ borderBottom:`1px solid ${LINE}`, background: i%2===0?"#FFF":PAPER }}>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: INK }}>{l.name}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: SLATE }}>{l.email}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: SLATE }}>{l.department||"—"}</td>
                        <td className="px-4 py-3 text-sm text-center" style={{ color: INK }}>{l.courseCount}</td>
                        <td className="px-4 py-3 text-sm text-center" style={{ color: INK }}>{l.studentCount}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium" style={{ color: PASS_C }}>{l.pass}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium" style={{ color: FAIL_C }}>{l.fail}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-center" style={{ color: l.passRate>=50?PASS_C:FAIL_C }}>{l.passRate}%</td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleLecturer(l._id)} className="text-xs px-2 py-1 rounded" style={{ border:`1px solid ${LINE}`, color: SLATE }}>
                            {expandedLecturer===l._id ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setConfirmDelete({ id: l._id, name: l.name })}
                            className="p-1.5 rounded-md transition-colors duration-150"
                            style={{ background: "rgba(140,47,57,0.08)", border: `1px solid rgba(140,47,57,0.2)` }}
                            title="Delete lecturer account"
                          >
                            <Trash2 size={14} color={FAIL_C} />
                          </button>
                        </td>
                      </tr>
                      {expandedLecturer===l._id && lecturerCourses[l._id] && (
                        <tr key={`${l._id}-courses`} style={{ background: "#F5F3FF" }}>
                          <td colSpan={9} className="px-6 py-3">
                            <p className="text-xs font-semibold mb-2" style={{ color: "#4C1D95" }}>Courses by {l.name}</p>
                            <div className="flex flex-wrap gap-2">
                              {lecturerCourses[l._id].map((c) => (
                                <div key={c._id} className="text-xs px-3 py-1.5 rounded-md" style={{ background: "#EDE9FE", color: "#4C1D95", border:"1px solid #DDD6FE" }}>
                                  <span style={{ fontFamily: MONO, fontWeight:600 }}>{c.code}</span>
                                  {" — "}{c.title}
                                  {c.level && ` · ${c.level}`}
                                  {" | "}<span style={{ color: PASS_C }}>{c.pass}P</span>
                                  {" / "}<span style={{ color: FAIL_C }}>{c.fail}F</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DEPARTMENTS */}
        {page === "departments" && departments && (
          <div>
            <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>Departmental Analysis</h1>
            <p className="text-sm mb-6" style={{ color: SLATE }}>Performance summary across all departments.</p>
            <div className="rounded-lg overflow-hidden" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["Department","Total Students","Passed","Failed","Pass Rate","Fail Rate"].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wide" style={{ color: MUTED, borderBottom:`1px solid ${LINE}` }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {departments.map((d, i) => (
                    <tr key={d.department} style={{ borderBottom:`1px solid ${LINE}`, background: i%2===0?"#FFF":PAPER }}>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: INK }}>{d.department}</td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: INK }}>{d.total}</td>
                      <td className="px-4 py-3 text-sm text-center font-medium" style={{ color: PASS_C }}>{d.pass}</td>
                      <td className="px-4 py-3 text-sm text-center font-medium" style={{ color: FAIL_C }}>{d.fail}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-center" style={{ color: d.passRate>=50?PASS_C:FAIL_C }}>{d.passRate}%</td>
                      <td className="px-4 py-3 text-sm font-semibold text-center" style={{ color: FAIL_C }}>{d.failRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FAILED STUDENTS */}
        {page === "failed" && (
          <div>
            <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>Failed Students</h1>
            <p className="text-sm mb-5" style={{ color: SLATE }}>All students who failed across all lecturers and courses.</p>
            <div className="flex flex-wrap gap-2 mb-5">
              <input value={failedFilters.department} onChange={e=>setFailedFilters(f=>({...f,department:e.target.value}))} placeholder="Filter by department" className="px-3 py-2 rounded-md text-sm outline-none" style={{ border:`1px solid ${LINE}` }} />
              <select value={failedFilters.level} onChange={e=>setFailedFilters(f=>({...f,level:e.target.value}))} className="px-3 py-2 rounded-md text-sm outline-none" style={{ border:`1px solid ${LINE}`, background:"#FFF", color: failedFilters.level?INK:MUTED }}>
                <option value="">All levels</option>
                {["ND I","ND II","HND I","HND II"].map(l=><option key={l}>{l}</option>)}
              </select>
              <input value={failedFilters.session} onChange={e=>setFailedFilters(f=>({...f,session:e.target.value}))} placeholder="Session e.g. 2024/2025" className="px-3 py-2 rounded-md text-sm outline-none" style={{ border:`1px solid ${LINE}` }} />
              <button onClick={applyFailedFilters} className="px-4 py-2 rounded-md text-sm font-medium" style={{ background: INK, color: PAPER }}>Apply</button>
            </div>
            {failedData && (
              <>
                <p className="text-sm mb-3 font-medium" style={{ color: FAIL_C }}>{failedData.total} failed student record(s) found</p>
                <div className="rounded-lg overflow-x-auto" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
                  <table className="w-full" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr>{["Matric No","Name","Department","Programme","Course","Level","Session","Lecturer","Exam","CA","Total","Grade"].map(h=>(
                        <th key={h} className="text-left px-3 py-2 text-xs uppercase tracking-wide whitespace-nowrap" style={{ color: MUTED, borderBottom:`1px solid ${LINE}` }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {failedData.failedStudents.map((s, i) => (
                        <tr key={i} style={{ borderBottom:`1px solid ${LINE}`, background: i%2===0?"#FFF":PAPER }}>
                          <td className="px-3 py-2 text-sm font-medium whitespace-nowrap" style={{ color: INK, fontFamily: MONO }}>{s.matric||"—"}</td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap" style={{ color: INK }}>{s.name||"—"}</td>
                          <td className="px-3 py-2 text-sm" style={{ color: SLATE }}>{s.department||"—"}</td>
                          <td className="px-3 py-2 text-sm" style={{ color: SLATE }}>{s.programme||"—"}</td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap" style={{ color: INK, fontFamily: MONO }}>{s.course?.code}</td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap" style={{ color: SLATE }}>{s.course?.level||"—"}</td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap" style={{ color: SLATE }}>{s.course?.session||"—"}</td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap" style={{ color: SLATE }}>{s.lecturer?.name||"—"}</td>
                          <td className="px-3 py-2 text-sm text-center" style={{ color: SLATE, fontFamily: MONO }}>{s.examTotal}</td>
                          <td className="px-3 py-2 text-sm text-center" style={{ color: SLATE, fontFamily: MONO }}>{s.ca}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-center" style={{ color: FAIL_C, fontFamily: MONO }}>{s.grandTotal}</td>
                          <td className="px-3 py-2 text-sm font-semibold" style={{ color: FAIL_C }}>{s.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function LevelAnalysisPage({ data, loading, onRefresh }) {
  const byLevel = data?.byLevel || {};
  const levels  = Object.keys(byLevel);
  const [activeLevel, setActiveLevel] = useState(null);

  // Set first level as active once data loads
  useEffect(() => {
    if (levels.length && !activeLevel) setActiveLevel(levels[0]);
  }, [levels]);

  const current = activeLevel ? byLevel[activeLevel] : null;

  // Chart data — one bar per level
  const barData = levels.map((lvl) => ({
    name: lvl,
    Pass: byLevel[lvl].passed,
    Fail: byLevel[lvl].failed,
    "Carry-Over": byLevel[lvl].carryoverCount,
  }));

  function exportLevelExcel() {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["LEVEL-BASED GENERAL COURSE ANALYSIS"],
      [`Generated: ${new Date().toLocaleDateString()}`],
      [],
      ["Level","Total Courses","Total Registrations","Passed","Failed","Pass Rate","Fail Rate","Carry-Over Students"],
      ...levels.map((lvl) => {
        const d = byLevel[lvl];
        return [lvl, d.totalCourses, d.totalRegistrations, d.passed, d.failed, `${d.passRate}%`, `${d.failRate}%`, d.carryoverCount];
      }),
    ]), "Summary");

    // One sheet per level
    levels.forEach((lvl) => {
      const d = byLevel[lvl];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        [`${lvl} — Course Breakdown`],
        [],
        ["Course Code","Course Title","Semester","Session","Total Students","Passed","Failed","Pass Rate"],
        ...d.courses.map((c) => [c.code, c.title, c.semester||"—", c.session||"—", c.students, c.passed, c.failed, `${c.passRate}%`]),
      ]), lvl.replace("/","-"));
    });

    XLSX.writeFile(wb, `Level_Analysis_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  function exportLevelPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(22, 36, 62);
    doc.rect(0, 0, pageW, 26, "F");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Level-Based General Course Analysis", 14, 11);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 151, 61);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 20);

    // Summary table
    let y = 32;
    doc.setFontSize(11);
    doc.setTextColor(22, 36, 62);
    doc.setFont("helvetica", "bold");
    doc.text("Summary by Level", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Level","Courses","Registrations","Passed","Failed","Pass Rate","Fail Rate","Carry-Over"]],
      body: levels.map((lvl) => {
        const d = byLevel[lvl];
        return [lvl, d.totalCourses, d.totalRegistrations, d.passed, d.failed, `${d.passRate}%`, `${d.failRate}%`, d.carryoverCount];
      }),
      theme: "grid",
      headStyles: { fillColor: [22, 36, 62], textColor: 255, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        5: { textColor: [47, 107, 79], fontStyle: "bold" },
        6: { textColor: [140, 47, 57], fontStyle: "bold" },
        7: { textColor: [140, 47, 57] },
      },
      margin: { left: 14, right: 14 },
    });

    // Per-level pages
    levels.forEach((lvl) => {
      doc.addPage();
      const d = byLevel[lvl];
      doc.setFillColor(22, 36, 62);
      doc.rect(0, 0, pageW, 22, "F");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(`${lvl} — Course Breakdown`, 14, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 151, 61);
      doc.text(`Pass Rate: ${d.passRate}%   |   Carry-Over Students: ${d.carryoverCount}`, 14, 18);

      autoTable(doc, {
        startY: 26,
        head: [["Course Code","Course Title","Semester","Session","Total Students","Passed","Failed","Pass Rate"]],
        body: d.courses.map((c) => [c.code, c.title, c.semester||"—", c.session||"—", c.students, c.passed, c.failed, `${c.passRate}%`]),
        theme: "striped",
        headStyles: { fillColor: [22, 36, 62], textColor: 255, fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 7: { textColor: [47, 107, 79], fontStyle: "bold" } },
        margin: { left: 14, right: 14 },
      });
    });

    doc.save(`Level_Analysis_${new Date().toISOString().split("T")[0]}.pdf`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>
            Level Analysis
          </h1>
          <p className="text-sm" style={{ color: SLATE }}>
            Performance summary for each level across all your courses.
          </p>
        </div>
        {!loading && data && (
          <div className="flex gap-2">
            <button onClick={exportLevelExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: PASS_C, color: "#FFF" }}>
              <Download size={14} /> Export Excel
            </button>
            <button onClick={exportLevelPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: FAIL_C, color: "#FFF" }}>
              <Download size={14} /> Export PDF
            </button>
            <button onClick={onRefresh} className="px-3 py-1.5 rounded-md text-sm" style={{ border: `1px solid ${LINE}`, color: SLATE }}>
              Refresh
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: MUTED }}>Loading level analysis…</p>
      ) : !data || levels.length === 0 ? (
        <div className="rounded-lg p-10 text-center" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
          <p className="text-sm font-medium" style={{ color: INK }}>No level data yet</p>
          <p className="text-sm mt-1" style={{ color: MUTED }}>Add courses with a Level set and upload student results to see analysis here.</p>
        </div>
      ) : (
        <>
          {/* Summary bar chart */}
          <div className="rounded-lg p-5 mb-6" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: INK }}>Pass / Fail / Carry-Over by Level</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData}>
                <CartesianGrid stroke={LINE} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: SLATE }} />
                <YAxis tick={{ fontSize: 12, fill: SLATE }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Pass" fill={PASS_C} radius={[3,3,0,0]} />
                <Bar dataKey="Fail" fill={FAIL_C} radius={[3,3,0,0]} />
                <Bar dataKey="Carry-Over" fill={GOLD} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Level summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {levels.map((lvl) => {
              const d = byLevel[lvl];
              const isActive = activeLevel === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => setActiveLevel(lvl)}
                  className="rounded-lg p-4 text-left transition-all duration-150"
                  style={{
                    background: isActive ? INK : "#FFF",
                    border: `2px solid ${isActive ? INK : LINE}`,
                  }}
                >
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: isActive ? "rgba(255,255,255,0.6)" : MUTED }}>{lvl}</div>
                  <div className="text-xl font-semibold mb-1" style={{ color: isActive ? "#FFF" : INK, fontFamily: SERIF }}>{d.totalRegistrations}</div>
                  <div className="text-xs" style={{ color: isActive ? GOLD : SLATE }}>registrations</div>
                  <div className="flex gap-2 mt-2 text-xs">
                    <span style={{ color: isActive ? "#86EFAC" : PASS_C }}>✓ {d.passRate}% pass</span>
                    <span style={{ color: isActive ? "#FCA5A5" : FAIL_C }}>✗ {d.failRate}% fail</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail for selected level */}
          {current && (
            <div className="rounded-lg p-5" style={{ background: "#FFF", border: `1px solid ${LINE}` }}>
              <div className="flex flex-wrap items-center gap-4 mb-5">
                <h2 className="text-base font-semibold" style={{ color: INK, fontFamily: SERIF }}>{activeLevel} — Detailed Breakdown</h2>
                <div className="flex flex-wrap gap-3 text-sm">
                  {[
                    { label: "Courses",        value: current.totalCourses },
                    { label: "Registrations",  value: current.totalRegistrations },
                    { label: "Passed",         value: current.passed,   color: PASS_C },
                    { label: "Failed",         value: current.failed,   color: FAIL_C },
                    { label: "Pass Rate",      value: `${current.passRate}%`, color: current.passRate>=50?PASS_C:FAIL_C },
                    { label: "Carry-Over",     value: current.carryoverCount, color: FAIL_C },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-3 py-1.5 rounded-md text-center" style={{ background: PAPER, border: `1px solid ${LINE}` }}>
                      <div className="text-xs" style={{ color: MUTED }}>{label}</div>
                      <div className="font-semibold" style={{ color: color || INK }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["#","Course Code","Course Title","Semester","Session","Students","Passed","Failed","Pass Rate"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-xs uppercase tracking-wide" style={{ color: MUTED, borderBottom: `1px solid ${LINE}`, fontFamily: SANS }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.courses.map((c, i) => (
                      <tr key={c.code} style={{ borderBottom: `1px solid ${LINE}`, background: i%2===0?"#FFF":PAPER }}>
                        <td className="px-3 py-2 text-sm" style={{ color: MUTED }}>{i+1}</td>
                        <td className="px-3 py-2 text-sm font-semibold" style={{ color: GOLD, fontFamily: MONO }}>{c.code}</td>
                        <td className="px-3 py-2 text-sm" style={{ color: INK }}>{c.title}</td>
                        <td className="px-3 py-2 text-sm" style={{ color: SLATE }}>{c.semester||"—"}</td>
                        <td className="px-3 py-2 text-sm" style={{ color: SLATE }}>{c.session||"—"}</td>
                        <td className="px-3 py-2 text-sm text-center" style={{ color: INK }}>{c.students}</td>
                        <td className="px-3 py-2 text-sm text-center font-medium" style={{ color: PASS_C }}>{c.passed}</td>
                        <td className="px-3 py-2 text-sm text-center font-medium" style={{ color: FAIL_C }}>{c.failed}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-center" style={{ color: c.passRate>=50?PASS_C:FAIL_C }}>
                          {c.passRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FontImport() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
    `}</style>
  );
}