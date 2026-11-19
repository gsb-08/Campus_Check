export const STORAGE_KEY = "campus-check-reformed:v1";

let observedValue;

export const CAMPUS = Object.freeze({
  name: "Vidya Pratishthan’s Kamalnayan Bajaj Institute of Engineering and Technology, Baramati",
  shortName: "VPKBIET",
});

export function emptyState(college = CAMPUS) {
  return {
    college: { name: college.name, shortName: college.shortName },
    mode: "local",
    classes: [],
    students: [],
    teachers: [],
    sessions: [],
  };
}

export function demoState() {
  const state = emptyState();
  state.mode = "demo";
  state.classes = [
    { id: "class-cse", name: "Computer Engineering A", subjects: ["Data Structures", "Database Systems"] },
    { id: "class-it", name: "Information Technology B", subjects: ["Web Technology", "Computer Networks"] },
    { id: "class-etc", name: "Electronics & Telecommunication A", subjects: ["Digital Electronics", "Signal Processing"] },
  ];
  state.teachers = [
    { id: "teacher-1", name: "Anika Deshmukh", email: "anika@example.com" },
    { id: "teacher-2", name: "Dev Kulkarni", email: "dev@example.com" },
    { id: "teacher-3", name: "Mira Patil", email: "mira@example.com" },
  ];

  const classRosters = [
    ["Aarav Joshi", "Diya Shinde", "Ishaan Rao", "Meera Jadhav", "Rohan Shah"],
    ["Aditi Bose", "Kabir Naik", "Nisha Iyer", "Riya Pawar", "Veer Mehta"],
    ["Arjun Sane", "Ira Chavan", "Neel More", "Sana Khan", "Soham Gokhale"],
  ];
  state.students = classRosters.flatMap((names, classIndex) => {
    const classId = state.classes[classIndex].id;
    return names.map((name, rosterIndex) => {
      const roll = String((classIndex + 1) * 100 + rosterIndex + 1);
      return { id: `student-${roll}`, name, roll, rfid: `DEMO-${roll}`, classId };
    });
  });

  const sampleSessions = [
    { daysAgo: 1, hour: 10, classIndex: 0, subjectIndex: 0, absent: [4] },
    { daysAgo: 2, hour: 13, classIndex: 1, subjectIndex: 0, absent: [] },
    { daysAgo: 4, hour: 11, classIndex: 2, subjectIndex: 0, absent: [1] },
    { daysAgo: 6, hour: 9, classIndex: 0, subjectIndex: 1, absent: [2] },
  ];
  const today = new Date();
  state.sessions = sampleSessions.map(({ daysAgo, hour, classIndex, subjectIndex, absent }, index) => {
    const group = state.classes[classIndex];
    const teacher = state.teachers[classIndex];
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, hour);
    const end = new Date(start.getTime() + 50 * 60 * 1000);
    const roster = state.students
      .filter((student) => student.classId === group.id)
      .map(({ id, name, roll, rfid }) => ({ id, name, roll, rfid }));

    return {
      id: `session-${index + 1}`,
      classId: group.id,
      className: group.name,
      subject: group.subjects[subjectIndex],
      teacherId: teacher.id,
      teacherName: teacher.name,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      roster,
      present: roster.filter((student, row) => !absent.includes(row)).map(({ id }) => id),
    };
  });
  return state;
}

function hasTextFields(record, fields) {
  return record && fields.every((field) => typeof record[field] === "string");
}

function hasRecords(records, fields) {
  return Array.isArray(records) && records.every((record) => hasTextFields(record, fields));
}

function isTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isWorkspace(state) {
  return Boolean(
    state &&
    hasTextFields(state.college, ["name", "shortName"]) &&
    ["demo", "local"].includes(state.mode) &&
    hasRecords(state.classes, ["id", "name"]) &&
    state.classes.every(({ subjects }) => Array.isArray(subjects) && subjects.every((subject) => typeof subject === "string")) &&
    hasRecords(state.students, ["id", "name", "roll", "rfid", "classId"]) &&
    hasRecords(state.teachers, ["id", "name", "email"]) &&
    hasRecords(state.sessions, ["id", "classId", "className", "subject", "teacherId", "teacherName"]) &&
    state.sessions.every((session) => (
      isTimestamp(session.startedAt) &&
      (session.endedAt === null || isTimestamp(session.endedAt)) &&
      hasRecords(session.roster, ["id", "name", "roll", "rfid"]) &&
      Array.isArray(session.present) && session.present.every((id) => typeof id === "string")
    ))
  );
}

export function loadState() {
  let saved;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error("This browser blocked access to saved workspace data.");
  }
  observedValue = saved;
  if (saved === null) return demoState();

  try {
    const state = JSON.parse(saved);
    if (isWorkspace(state)) return state;
  } catch {
    // An unreadable payload is handled the same way as a mismatched workspace.
  }
  throw new Error("The saved workspace could not be read. Reset the workspace in Settings to start again.");
}

export function saveState(state) {
  if (!isWorkspace(state)) throw new Error("Workspace data is incomplete and could not be saved.");

  let current;
  try {
    current = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error("This browser blocked access to saved workspace data.");
  }
  if (current !== (observedValue ?? null)) {
    throw new Error("The workspace changed in another tab. Review the updated data and try again.");
  }

  try {
    const next = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, next);
    observedValue = next;
  } catch {
    throw new Error("The workspace could not be saved. Check that this browser allows site storage and has free space.");
  }
}

export function id() {
  return globalThis.crypto.randomUUID?.() ??
    Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)), (part) => part.toString(16).padStart(8, "0")).join("");
}

function localDate(timestamp) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function csvCell(input) {
  const text = String(input ?? "");
  // Spreadsheet apps can interpret even quoted cells as formulas.
  const safe = /^[\t\r\n]|^\s*[=+@\-＝＋＠－]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportCsv(state, { classId, subject, sessionId, from, to } = {}) {
  const rows = [["Class", "Subject", "Teacher", "Session started", "Session ended", "Roll number", "Student", "Attendance"]];

  for (const session of state.sessions) {
    if (!session.endedAt || (classId && session.classId !== classId) ||
        (subject && session.subject !== subject) || (sessionId && session.id !== sessionId)) continue;

    const date = localDate(session.startedAt);
    if ((from && date < from) || (to && date > to)) continue;

    const present = new Set(session.present);
    for (const student of session.roster) {
      rows.push([
        session.className, session.subject, session.teacherName, session.startedAt, session.endedAt,
        student.roll, student.name, present.has(student.id) ? "Present" : "Absent",
      ]);
    }
  }

  const encoded = rows.map((row) => row.map(csvCell).join(","));
  return `${encoded.join("\r\n")}\r\n`;
}
