import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
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
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", department: "" });
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
  const [profileSaved, setProfileSaved] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const saveTimers = useRef({});

  function askConfirm(message, onConfirm) {
    setConfirmState({ message, onConfirm });
  }

  // restore session on first load
  useEffect(() => {
    if (!token) {
      setAuthChecked(true);
      return;
    }
    apiFetch("/auth/me", token)
      .then((data) => setLecturer(data))
      .catch(() => {
        localStorage.removeItem("rms_token");
        setToken("");
      })
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
      const path = authMode === "login" ? "/auth/login" : "/auth/register";
      const body =
        authMode === "login"
          ? { email: authForm.email, password: authForm.password }
          : {
              name: authForm.name,
              email: authForm.email,
              password: authForm.password,
              department: authForm.department,
            };
      const data = await apiFetch(path, null, { method: "POST", body: JSON.stringify(body) });
      localStorage.setItem("rms_token", data.token);
      setToken(data.token);
      setLecturer(data.lecturer);
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
        body: JSON.stringify({ code: newCode.trim(), title: newTitle.trim() }),
      });
      setCourses((prev) => [...prev, data]);
      setSelectedCourseId(data._id);
      setCourseSummaries((prev) => ({
        ...prev,
        [data._id]: { pass: 0, fail: 0, gradeCounts: { ...EMPTY_GRADES }, totalStudents: 0 },
      }));
      setNewTitle("");
      setNewCode("");
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
        body: JSON.stringify({ matric: "", name: "", test: 0, assignment: 0, attendance: 0, exam: 0 }),
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

  function goToPage(p) {
    setPage(p);
    setSidebarOpen(false);
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
            <GraduationCap size={22} color={GOLD} />
          </div>
          <h1 className="text-2xl mb-1" style={{ color: INK, fontFamily: SERIF, fontWeight: 600 }}>
            Results Portal
          </h1>
          <p className="text-sm mb-6" style={{ color: SLATE }}>
            {authMode === "login" ? "Sign in to your account." : "Create your lecturer account."}
          </p>

          {authMode === "register" && (
            <div className="mb-3">
              <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: MUTED }}>
                Full name
              </label>
              <input
                value={authForm.name}
                onChange={(e) => setAuthForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Dr. Funmilayo Adeyemi"
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

          {authMode === "register" && (
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
            test: clamp(parseInt(row.test, 10) || 0, 10),
            assignment: clamp(parseInt(row.assignment, 10) || 0, 10),
            attendance: clamp(parseInt(row.attendance, 10) || 0, 10),
            exam: clamp(parseInt(row.exam, 10) || 0, 70),
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
    const sample = "matric,name,test,assignment,attendance,exam\nU2022/300111,Sample Student,7,8,9,50\n";
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const col = (n) => (
    <th key={n} className="text-left px-3 py-2 text-xs uppercase tracking-wide" style={{ color: MUTED, fontFamily: SANS, borderBottom: `1px solid ${LINE}` }}>
      {n}
    </th>
  );

  function numInput(value, max, onChange) {
    return (
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || 0, max))}
        className="w-16 px-2 py-1 rounded-md text-sm outline-none"
        style={{ border: `1px solid ${LINE}`, fontFamily: MONO }}
      />
    );
  }

  return (
    <div>
      <div className="rounded-lg p-5 mb-6 overflow-x-auto" style={{ background: "#FFFFFF", border: `1px solid ${LINE}` }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: SLATE }}>{course.code}</div>
            <h2 style={{ color: INK, fontFamily: SERIF, fontWeight: 600, fontSize: "1.1rem" }}>{course.title}</h2>
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

        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Matric No", "Full Name", "Test /10", "Assign. /10", "Attend. /10", "Exam /70", "Total /100", "Grade", "Status", ""].map((n) => col(n))}</tr>
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
                <td colSpan={10} className="text-center py-6 text-sm" style={{ color: MUTED }}>
                  No students yet. Click "Add student" to begin.
                </td>
              </tr>
            )}
            {!studentsLoading &&
              students.map((s) => {
                const total = s.test + s.assignment + s.attendance + s.exam;
                const grade = getGrade(total);
                const status = getStatus(total);
                return (
                  <tr key={s._id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td className="px-3 py-2">
                      <input
                        value={s.matric}
                        onChange={(e) => updateStudent(course._id, s._id, "matric", e.target.value)}
                        placeholder="U2020/123456"
                        className="w-32 px-2 py-1 rounded-md text-sm outline-none"
                        style={{ border: `1px solid ${LINE}`, fontFamily: MONO }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={s.name}
                        onChange={(e) => updateStudent(course._id, s._id, "name", e.target.value)}
                        placeholder="Full name"
                        className="w-36 px-2 py-1 rounded-md text-sm outline-none"
                        style={{ border: `1px solid ${LINE}` }}
                      />
                    </td>
                    <td className="px-3 py-2">{numInput(s.test, 10, (v) => updateStudent(course._id, s._id, "test", v))}</td>
                    <td className="px-3 py-2">{numInput(s.assignment, 10, (v) => updateStudent(course._id, s._id, "assignment", v))}</td>
                    <td className="px-3 py-2">{numInput(s.attendance, 10, (v) => updateStudent(course._id, s._id, "attendance", v))}</td>
                    <td className="px-3 py-2">{numInput(s.exam, 70, (v) => updateStudent(course._id, s._id, "exam", v))}</td>
                    <td className="px-3 py-2 text-sm font-semibold" style={{ color: INK, fontFamily: MONO }}>
                      {total}
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold" style={{ color: GRADE_COLORS[grade] }}>
                      {grade}
                    </td>
                    <td className="px-3 py-2">
                      <GradeStamp status={status} />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() =>
                          askConfirm(`Remove ${s.name || "this student"} from ${course.code}?`, () => removeStudent(course._id, s._id))
                        }
                        aria-label="Remove student"
                      >
                        <Trash2 size={14} color={FAIL_C} />
                      </button>
                    </td>
                  </tr>
                );
              })}
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