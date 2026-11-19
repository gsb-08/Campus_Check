import { CAMPUS, STORAGE_KEY, demoState, emptyState, exportCsv, id, loadState, saveState } from './store.js';

const content = document.querySelector('#app-content');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const navigation = [...document.querySelectorAll('[data-view]')];
const views = {
  overview: 'Overview', attendance: 'Attendance', students: 'Students',
  classes: 'Classes', teachers: 'Teachers', reports: 'Reports', settings: 'Settings',
};

const paths = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="m9 5 11 7-11 7V5z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9"/><circle cx="9" cy="7" r="4"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  classes: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-12 5 2 2 4-4"/>',
  trend: '<path d="m3 17 6-6 4 4 7-8m-5 0h5v5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  scan: '<path d="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4m0-4h16"/>',
  history: '<path d="M3 12a9 9 0 1 1 2.5 6.3M3 7v5h5m4-5v5l3 2"/>',
};

function icon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

const todayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });
const percentage = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
const compare = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;
const blankFilters = () => ({ classId: '', subject: '', from: '', to: '' });
const searches = { students: '', classes: '', teachers: '' };
let reportFilters = blankFilters();
let state;
let storageIssue = '';
let activeSessionId = '';
let currentView = 'overview';
let toastTimer;
let dialogSubmit;
let dialogOpener;

try {
  state = loadState();
} catch (error) {
  state = demoState();
  storageIssue = error.message;
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 4200);
}

function persist(next, recovery = false) {
  if (storageIssue && !recovery) {
    throw new Error('Open Settings to reset browser storage before making changes.');
  }
  saveState(next);
  state = next;
  storageIssue = '';
}

function navigate(view) {
  if (view === currentView) {
    return;
  }
  location.hash = view === 'overview' ? '' : view;
}

function route() {
  const requested = location.hash.slice(1);
  const previous = currentView;
  currentView = Object.hasOwn(views, requested) ? requested : 'overview';
  render();
  if (previous !== currentView) content.focus();
}

function render() {
  const active = openSessions();
  document.querySelector('#page-title').textContent = views[currentView];
  const campusName = document.querySelector('#campus-name');
  campusName.textContent = state.college.name;
  campusName.title = state.college.name;
  document.querySelector('#campus-short').textContent = state.college.shortName;
  document.querySelector('#mode-label').textContent = state.mode === 'demo' ? 'Demo workspace' : 'Local workspace';
  document.title = `${views[currentView]} · Campus Check`;
  navigation.forEach(button => {
    const selected = button.dataset.view === currentView;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  const renderers = {
    overview: overview,
    attendance: () => attendance(active),
    students: () => directory('students'),
    classes: () => directory('classes'),
    teachers: () => directory('teachers'),
    reports,
    settings,
  };
  const warning = storageIssue ? `<div class="panel panel-body" role="alert"><strong>Browser storage needs attention.</strong> ${escape(storageIssue)} <button class="button subtle small" data-view="settings">Open settings</button></div>` : '';
  content.innerHTML = `<div class="view-stack">${warning}${renderers[currentView]()}</div>`;
}

function completedSessions() {
  return state.sessions.filter(session => session.endedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function openSessions() {
  return state.sessions.filter(session => !session.endedAt);
}

function attendanceRate(sessions) {
  const total = sessions.reduce((sum, session) => sum + session.roster.length, 0);
  const present = sessions.reduce((sum, session) => sum + session.present.length, 0);
  return total ? present / total : null;
}

function rateText(value) {
  return value === null ? '—' : percentage.format(value);
}

function dateText(value, showTime = false) {
  const date = new Date(value);
  return showTime ? `${todayFormat.format(date)} · ${timeFormat.format(date)}` : todayFormat.format(date);
}

function localDay(value) {
  const date = new Date(value);
  const pad = part => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function button(label, action, options = {}) {
  const { style = 'secondary', glyph, target, view, disabled = false } = options;
  const selector = view ? `data-view="${view}"` : `data-action="${action}"`;
  return `<button type="button" class="button ${style}" ${selector}${target ? ` data-id="${escape(target)}"` : ''}${disabled ? ' disabled' : ''}>${glyph ? icon(glyph) : ''}${escape(label)}</button>`;
}

function badge(label, style = 'neutral') {
  return `<span class="badge ${style}">${escape(label)}</span>`;
}

function empty(title, description) {
  return `<div class="empty-state"><div class="empty-icon">${icon('calendar', 22)}</div><strong>${escape(title)}</strong><p>${escape(description)}</p></div>`;
}

function stat(label, value, note, glyph) {
  return `<article class="stat-card"><div class="stat-icon">${icon(glyph, 21)}</div><div class="stat-label">${escape(label)}</div><div class="stat-value">${escape(value)}</div><p class="stat-note">${escape(note)}</p></article>`;
}

function panel(title, subtitle, body, extra = '') {
  return `<section class="panel"><div class="panel-heading"><div><h2>${escape(title)}</h2>${subtitle ? `<p>${escape(subtitle)}</p>` : ''}</div>${extra}</div>${body}</section>`;
}

function overview() {
  const sessions = completedSessions();
  const active = openSessions();
  const classStats = state.classes.map(group => {
    const matching = sessions.filter(session => session.classId === group.id);
    return { name: group.name, rate: attendanceRate(matching), count: matching.length };
  });
  const classRows = classStats.length ? `<div class="panel-body entry-list">${classStats.map(group => `
    <div class="progress-row"><div class="progress-label"><strong>${escape(group.name)}</strong><span>${rateText(group.rate)}</span></div>
    <progress class="inline-bar" value="${group.rate ?? 0}" max="1" aria-label="${escape(group.name)} attendance"></progress>
    <small class="muted">${group.count} completed ${group.count === 1 ? 'session' : 'sessions'}</small></div>`).join('')}</div>` :
    empty('No classes yet', 'Add a class to see attendance trends here.');
  const activity = sessions.slice(0, 5);
  const history = activity.length ? `<div class="panel-body entry-list">${activity.map(session => `
    <button class="activity-row" type="button" data-action="session-detail" data-id="${escape(session.id)}">
      <span class="activity-icon">${icon('history')}</span><span><strong>${escape(session.subject)}</strong>
      <small>${escape(session.className)} · ${dateText(session.startedAt)}</small></span>
      <span class="activity-value">${rateText(attendanceRate([session]))}${icon('arrow', 14)}</span></button>`).join('')}</div>` :
    empty('No completed sessions', 'Closed attendance sessions appear here.');

  return `
    <section class="hero"><div class="hero-content">
      <span class="hero-tag">${icon('calendar', 15)} ${escape(state.college.shortName)} Attendance</span>
      <h2 class="hero-title">Campus attendance<br class="hero-break"> in one place.</h2>
      <p class="hero-copy">Take attendance, organize your classes, and review session records from one workspace.</p>
      <div class="hero-actions">
        ${button('Start session', 'start-session', { style: 'primary', glyph: 'play' })}
        ${button('View reports', '', { style: 'secondary', view: 'reports', glyph: 'arrow' })}
      </div>
    </div><div class="hero-decoration" aria-hidden="true"></div></section>
    <section class="stats-grid" aria-label="Attendance summary">
      ${stat('Students', state.students.length, 'On the current roster', 'users')}
      ${stat('Classes', state.classes.length, 'Configured class groups', 'classes')}
      ${stat('Active sessions', active.length, `${sessions.length} completed`, 'calendar')}
      ${stat('Attendance rate', rateText(attendanceRate(sessions)), 'Across completed sessions', 'trend')}
    </section>
    <div class="overview-grid">
      ${panel('Recent sessions', 'Completed attendance records', history, button('All reports', '', { view: 'reports', style: 'subtle small', glyph: 'arrow' }))}
      ${panel('Attendance by class', 'Present marks across completed sessions', classRows)}
    </div>`;
}

function intro(title, description, actions = '') {
  return `<div class="page-intro"><div><h2>${escape(title)}</h2><p>${escape(description)}</p></div><div class="action-row">${actions}</div></div>`;
}

function table(headings, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headings.map(heading => `<th scope="col">${escape(heading)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function attendance(active) {
  const selected = active.find(session => session.id === activeSessionId) || active[0];
  activeSessionId = selected?.id || '';
  const start = button('Start session', 'start-session', { style: 'primary', glyph: 'plus' });
  const header = intro('Attendance sessions', 'Take attendance by class and subject.', start);
  if (!selected) {
    return header + panel('Active sessions', '', empty('No active sessions', 'Start a session to mark attendance for a class.'));
  }
  const selector = active.length > 1 ? `<div class="toolbar panel-body"><label for="active-session">Active session</label><select id="active-session">${active.map(session =>
    option(session.id, `${session.className} · ${session.subject}`, selected.id)).join('')}</select></div>` : '';
  const rows = [...selected.roster].sort((a, b) => compare(a.roll, b.roll)).map(student => {
    const marked = selected.present.includes(student.id);
    return `<tr><td>${escape(student.roll)}</td><td><strong>${escape(student.name)}</strong></td><td>${escape(student.rfid || '—')}</td><td>${badge(marked ? 'Present' : 'Unmarked', marked ? 'positive' : 'neutral')}</td><td>${button(marked ? 'Undo' : 'Mark present', 'toggle-present', { style: 'secondary small', target: student.id })}</td></tr>`;
  }).join('');
  const scanner = `<form class="panel-body inline-form" data-form="scan">
    <label for="scan-code">RFID or student code</label><div class="action-row">
    <input id="scan-code" name="code" placeholder="Scan or enter a code" autocomplete="off" spellcheck="false" maxlength="60" required>
    <button class="button primary" type="submit">${icon('scan')} Mark present</button></div>
    <p class="muted">Use a scanner that types the RFID code and presses Enter, or enter the code manually.</p>
    <p class="field-error" role="alert" hidden></p>
  </form>`;
  return header + panel(
    `${selected.className} · ${selected.subject}`,
    `${selected.teacherName} · ${selected.present.length} of ${selected.roster.length} present`,
    selector + scanner + table(['Roll number', 'Student', 'RFID / code', 'Status', 'Action'], rows),
    button('Close session', 'close-session', { style: 'secondary' }),
  );
}

function normalize(value) {
  return value.trim().toLocaleLowerCase();
}

function matches(query, ...values) {
  return !query || values.some(value => normalize(value ?? '').includes(query));
}

const directories = {
  students: { name: 'Student', title: 'Student roster', copy: 'Manage student names, roll numbers, class assignments, and optional RFID codes.', headings: ['Student', 'Roll number', 'Class', 'RFID / code', 'Actions'] },
  classes: { name: 'Class', title: 'Classes and subjects', copy: 'Set up the class groups and subject names used in attendance sessions.', headings: ['Class', 'Subjects', 'Students', 'Actions'] },
  teachers: { name: 'Teacher', title: 'Teacher directory', copy: 'Manage the teachers who can be assigned to attendance sessions.', headings: ['Teacher', 'Email', 'Actions'] },
};

function directory(kind) {
  const meta = directories[kind];
  const search = searches[kind];
  return intro(meta.title, meta.copy, button(`Add ${meta.name.toLowerCase()}`, 'add-entry', { style: 'primary', glyph: 'plus', target: kind }))
    + `<section class="panel"><div class="toolbar panel-body"><label class="search-field" for="directory-search">${icon('search')}<span class="sr-only">Search ${kind}</span>
    <input id="directory-search" type="search" placeholder="Search ${kind}…" value="${escape(search)}" autocomplete="off"></label></div>
    <div id="directory-results">${directoryResults(kind)}</div></section>`;
}

function directoryResults(kind) {
  const query = normalize(searches[kind]);
  const getClassName = classId => state.classes.find(group => group.id === classId)?.name || 'Unassigned';
  const rows = [...state[kind]].sort((a, b) => compare(a.name, b.name)).map(entry => {
    let columns;
    if (kind === 'students') {
      const className = getClassName(entry.classId);
      if (!matches(query, entry.name, entry.roll, entry.rfid, className)) return '';
      columns = `<td><strong>${escape(entry.name)}</strong></td><td>${escape(entry.roll)}</td><td>${escape(className)}</td><td>${escape(entry.rfid || '—')}</td>`;
    } else if (kind === 'classes') {
      if (!matches(query, entry.name, ...entry.subjects)) return '';
      const count = state.students.filter(student => student.classId === entry.id).length;
      columns = `<td><strong>${escape(entry.name)}</strong></td><td>${entry.subjects.map(subject => badge(subject)).join(' ')}</td><td>${count}</td>`;
    } else {
      if (!matches(query, entry.name, entry.email)) return '';
      columns = `<td><strong>${escape(entry.name)}</strong></td><td>${escape(entry.email || '—')}</td>`;
    }
    return `<tr>${columns}<td><div class="action-row">${button('Edit', 'edit-entry', { target: entry.id, style: 'subtle small' })}${button('Delete', 'delete-entry', { target: entry.id, style: 'subtle small' })}</div></td></tr>`;
  }).join('');
  const meta = directories[kind];
  return rows ? table(meta.headings, rows) : empty(
    query ? 'No matches' : `No ${kind} yet`,
    query ? 'Try another search term.' : `Add a ${meta.name.toLowerCase()} to get started.`,
  );
}

function option(value, label, selected = '') {
  return `<option value="${escape(value)}"${value === selected ? ' selected' : ''}>${escape(label)}</option>`;
}

function field(label, input) {
  return `<label class="field"><span>${escape(label)}</span>${input}</label>`;
}

function textField(label, name, value = '', options = {}) {
  const { type = 'text', length = 120, required = true, placeholder = '' } = options;
  return field(label, `<input name="${name}" type="${type}" value="${escape(value)}" maxlength="${length}"${required ? ' required' : ''}${placeholder ? ` placeholder="${escape(placeholder)}"` : ''} autocomplete="off">`);
}

function showDialog(title, description, fields, submit, handler, options = {}) {
  if (dialog.open) dialog.close();
  dialogOpener = document.activeElement;
  dialogSubmit = handler;
  const { danger = false, extra = '' } = options;
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  dialog.innerHTML = `<div class="dialog-body">
    <div class="dialog-header"><div><h2 id="dialog-title">${escape(title)}</h2>${description ? `<p>${escape(description)}</p>` : ''}</div>
    <button class="button subtle small icon-button" type="button" data-action="dismiss" aria-label="Close dialog">${icon('close')}</button></div>
    ${handler ? `<form class="form-grid" data-form="dialog" novalidate>${fields}<p class="field-error" role="alert" hidden></p>
    <div class="action-row dialog-actions"><button class="button secondary" type="button" data-action="dismiss">Cancel</button>
    <button class="button ${danger ? 'danger' : 'primary'}" type="submit">${escape(submit)}</button></div></form>` : fields}
    ${extra}
  </div>`;
  dialog.showModal();
  dialog.querySelector('form input, form select, form textarea')?.focus();
}

function showError(form, message) {
  const error = form.querySelector('.field-error');
  error.textContent = message;
  error.hidden = !message;
}

function replaceOrAppend(items, next) {
  return items.some(item => item.id === next.id) ? items.map(item => item.id === next.id ? next : item) : [...items, next];
}

function requiredValue(data, name, label) {
  const value = data.get(name)?.trim();
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function valueOf(data, name) {
  return data.get(name)?.trim() || '';
}

function addOrEdit(kind, entry) {
  const name = directories[kind].name;
  if (kind === 'students' && !state.classes.length) {
    showDialog('Set up a class first', 'Students need a class before they can be added to the roster.', '',
      '', null, { extra: button('Go to classes', '', { view: 'classes', style: 'primary' }) });
    return;
  }
  const fields = [
    textField(`${name} name`, 'name', entry?.name),
  ];
  if (kind === 'students') {
    fields.push(textField('Roll number', 'roll', entry?.roll, { length: 40 }));
    fields.push(field('Class', `<select name="classId" required>${option('', 'Choose a class')}${state.classes.map(group => option(group.id, group.name, entry?.classId)).join('')}</select>`));
    fields.push(textField('RFID or student code (optional)', 'rfid', entry?.rfid, { length: 60, required: false }));
  } else if (kind === 'classes') {
    fields.push(field('Subjects, one per line or separated by commas', `<textarea name="subjects" rows="4" maxlength="2000" required placeholder="Add at least one subject">${escape(entry?.subjects.join('\n') || '')}</textarea>`));
  } else {
    fields.push(textField('Email (optional)', 'email', entry?.email, { type: 'email', length: 180, required: false }));
  }

  showDialog(`${entry ? 'Edit' : 'Add'} ${name.toLowerCase()}`, '', fields.join(''), entry ? 'Save changes' : `Add ${name.toLowerCase()}`, data => {
    const next = { id: entry?.id || id(), name: requiredValue(data, 'name', `${name} name`) };
    const others = state[kind].filter(other => other.id !== next.id);
    if (kind === 'students') {
      next.roll = requiredValue(data, 'roll', 'Roll number');
      next.classId = requiredValue(data, 'classId', 'Class');
      if (!state.classes.some(group => group.id === next.classId)) throw new Error('Choose an available class.');
      next.rfid = valueOf(data, 'rfid');
      if (others.some(other => other.classId === next.classId && normalize(other.roll) === normalize(next.roll))) {
        throw new Error('That roll number is already used in this class.');
      }
      if (next.rfid && others.some(other => normalize(other.rfid) === normalize(next.rfid))) {
        throw new Error('That RFID or student code is already assigned.');
      }
    } else if (kind === 'classes') {
      const subjects = valueOf(data, 'subjects').split(/[\n,]/).map(subject => subject.trim()).filter(Boolean);
      next.subjects = [...new Map(subjects.map(subject => [normalize(subject), subject])).values()];
      if (!next.subjects.length) throw new Error('Add at least one subject.');
      if (next.subjects.length > 30 || next.subjects.some(subject => subject.length > 100)) {
        throw new Error('Enter up to 30 subjects, each 100 characters or fewer.');
      }
      if (others.some(other => normalize(other.name) === normalize(next.name))) throw new Error('A class with that name already exists.');
    } else {
      next.email = valueOf(data, 'email');
      if (next.email && others.some(other => normalize(other.email) === normalize(next.email))) {
        throw new Error('That email is already assigned.');
      }
    }
    persist({ ...state, [kind]: replaceOrAppend(state[kind], next) });
    finishDialog(`${name} ${entry ? 'updated' : 'added'}.`);
  });
}

function confirmDelete(kind, entry) {
  const name = directories[kind].name.toLowerCase();
  showDialog(`Delete ${name}?`, `Remove ${entry.name} from this workspace. Completed session records retain their original details.`,
    '', `Delete ${name}`, () => {
      if (kind === 'classes' && state.students.some(student => student.classId === entry.id)) {
        throw new Error('Move or remove this class’s students first.');
      }
      if (openSessions().some(session => (kind === 'classes' && session.classId === entry.id) ||
        (kind === 'teachers' && session.teacherId === entry.id) ||
        (kind === 'students' && session.roster.some(student => student.id === entry.id)))) {
        throw new Error('Close any active sessions using this record first.');
      }
      persist({ ...state, [kind]: state[kind].filter(item => item.id !== entry.id) });
      finishDialog(`${directories[kind].name} deleted.`);
    }, { danger: true });
}

function startSession() {
  const active = openSessions();
  const available = state.classes.filter(group => group.subjects.length &&
    state.students.some(student => student.classId === group.id) &&
    !active.some(session => session.classId === group.id));
  if (!available.length || !state.teachers.length) {
    const hasRoster = state.classes.some(group => state.students.some(student => student.classId === group.id));
    const advice = !state.classes.length ? ['Create a class and add subjects first.', 'classes', 'Go to classes']
      : !hasRoster ? ['Add students to a class before taking attendance.', 'students', 'Go to students']
      : !state.teachers.length ? ['Add a teacher before starting a session.', 'teachers', 'Go to teachers']
      : ['All classes with a roster already have an active session.', 'attendance', 'View attendance'];
    showDialog('Set up an attendance session', advice[0], '', '', null, {
      extra: button(advice[2], '', { view: advice[1], style: 'primary' }),
    });
    return;
  }
  const first = available[0];
  const fields = [
    field('Class', `<select name="classId" id="new-session-class" required>${available.map(group => option(group.id, group.name)).join('')}</select>`),
    field('Subject', `<select name="subject" id="new-session-subject" required>${first.subjects.map(subject => option(subject, subject)).join('')}</select>`),
    field('Teacher', `<select name="teacherId" required>${state.teachers.map(teacher => option(teacher.id, teacher.name)).join('')}</select>`),
  ].join('');
  showDialog('Start attendance session', 'Choose the class, subject, and teacher for this session.', fields, 'Start session', data => {
    const group = state.classes.find(item => item.id === data.get('classId'));
    const teacher = state.teachers.find(item => item.id === data.get('teacherId'));
    const subject = data.get('subject');
    if (!group?.subjects.includes(subject) || !teacher) throw new Error('Choose an available class, subject, and teacher.');
    if (openSessions().some(session => session.classId === group.id)) throw new Error('This class already has an active session.');
    const roster = state.students.filter(student => student.classId === group.id).map(({ id: studentId, name, roll, rfid }) => ({ id: studentId, name, roll, rfid }));
    if (!roster.length) throw new Error('Add students to the class before starting a session.');
    const session = {
      id: id(), classId: group.id, className: group.name, subject, teacherId: teacher.id,
      teacherName: teacher.name, startedAt: new Date().toISOString(), endedAt: null, roster, present: [],
    };
    persist({ ...state, sessions: [...state.sessions, session] });
    activeSessionId = session.id;
    finishDialog('Attendance session started.');
    navigate('attendance');
  });
}

function updateSession(session, changes) {
  persist({ ...state, sessions: state.sessions.map(item => item.id === session.id ? { ...item, ...changes } : item) });
}

function currentSession() {
  const session = openSessions().find(item => item.id === activeSessionId);
  if (!session) throw new Error('This session is no longer active.');
  return session;
}

function closeSession() {
  const session = currentSession();
  const missing = session.roster.length - session.present.length;
  const description = missing
    ? `${session.present.length} of ${session.roster.length} students are marked present. ${missing} ${missing === 1 ? 'student will be recorded as absent.' : 'students will be recorded as absent.'}`
    : 'All students are marked present. Closing the session saves the results to Reports.';
  showDialog('Close attendance session?', description, '', 'Close session', () => {
    const selected = currentSession();
    updateSession(selected, { endedAt: new Date().toISOString() });
    activeSessionId = '';
    finishDialog('Session closed. The record is available in Reports.');
    sessionDetail(selected.id);
  });
}

function togglePresent(studentId) {
  const selected = currentSession();
  const student = selected.roster.find(item => item.id === studentId);
  if (!student) return;
  const marked = selected.present.includes(studentId);
  updateSession(selected, { present: marked ? selected.present.filter(id => id !== studentId) : [...selected.present, studentId] });
  render();
  [...content.querySelectorAll('[data-action="toggle-present"]')].find(candidate => candidate.dataset.id === studentId)?.focus();
  notify(`${student.name} ${marked ? 'mark removed' : 'marked present'}.`);
}

function scan(form, data) {
  const code = requiredValue(data, 'code', 'RFID or student code');
  const selected = currentSession();
  const student = selected.roster.find(item => item.rfid && normalize(item.rfid) === normalize(code));
  if (!student) throw new Error('That code is outside the current session roster.');
  if (selected.present.includes(student.id)) {
    form.reset();
    form.elements.code.focus();
    showError(form, '');
    notify(`${student.name} is already present.`);
    return;
  }
  updateSession(selected, { present: [...selected.present, student.id] });
  render();
  content.querySelector('#scan-code').focus();
  notify(`${student.name} marked present.`);
}

function filterSessions() {
  return completedSessions().filter(session => {
    const day = localDay(session.startedAt);
    return (!reportFilters.classId || session.classId === reportFilters.classId)
      && (!reportFilters.subject || session.subject === reportFilters.subject)
      && (!reportFilters.from || day >= reportFilters.from)
      && (!reportFilters.to || day <= reportFilters.to);
  });
}

function reports() {
  const sessions = completedSessions();
  const classOptions = new Map(sessions.map(session => [session.classId, session.className]));
  state.classes.forEach(group => classOptions.set(group.id, group.name));
  const subjectOptions = [...new Set(sessions.filter(session => !reportFilters.classId || session.classId === reportFilters.classId).map(session => session.subject))].sort(compare);
  const filters = `<form class="panel-body filter-grid" id="report-filters" data-form="filters">
    ${field('Class', `<select name="classId">${option('', 'All classes')}${[...classOptions].sort((a, b) => compare(a[1], b[1])).map(([classId, name]) => option(classId, name, reportFilters.classId)).join('')}</select>`)}
    ${field('Subject', `<select name="subject">${option('', 'All subjects')}${subjectOptions.map(subject => option(subject, subject, reportFilters.subject)).join('')}</select>`)}
    ${field('From date', `<input type="date" name="from" value="${escape(reportFilters.from)}">`)}
    ${field('To date', `<input type="date" name="to" value="${escape(reportFilters.to)}">`)}
  </form>`;

  const filtered = filterSessions();
  const invalidDates = reportFilters.from && reportFilters.to && reportFilters.from > reportFilters.to;
  const results = filtered.length ? table(
    ['Date', 'Class', 'Subject', 'Teacher', 'Present', 'Rate', 'Details'],
    filtered.map(session => `<tr><td>${dateText(session.startedAt)}</td><td>${escape(session.className)}</td><td><strong>${escape(session.subject)}</strong></td>
      <td>${escape(session.teacherName)}</td><td>${session.present.length} / ${session.roster.length}</td><td>${badge(rateText(attendanceRate([session])), 'positive')}</td>
      <td>${button('View', 'session-detail', { target: session.id, style: 'subtle small' })}</td></tr>`).join(''),
  ) : empty(
    invalidDates ? 'Check the date range' : sessions.length ? 'No matching sessions' : 'No completed sessions',
    invalidDates ? 'Choose a start date on or before the end date.'
      : sessions.length ? 'Adjust the filters to see different records.' : 'Close an attendance session to create a report.',
  );
  return intro('Attendance reports', 'Review completed sessions and download records for your own analysis.',
    button('Export CSV', 'export-reports', { glyph: 'download', disabled: !filtered.length }))
    + panel('Completed sessions', `${filtered.length} ${filtered.length === 1 ? 'session matches' : 'sessions match'} the current filters`, filters + results, button('Clear filters', 'clear-filters', { style: 'subtle small' }));
}

function sessionDetail(sessionId) {
  const session = state.sessions.find(item => item.id === sessionId && item.endedAt);
  if (!session) throw new Error('This completed session could not be found.');
  const rows = [...session.roster].sort((a, b) => compare(a.roll, b.roll)).map(student => {
    const present = session.present.includes(student.id);
    return `<tr><td>${escape(student.roll)}</td><td><strong>${escape(student.name)}</strong></td><td>${badge(present ? 'Present' : 'Absent', present ? 'positive' : 'neutral')}</td></tr>`;
  }).join('');
  const counts = `<p class="muted">${session.present.length} of ${session.roster.length} present · ${rateText(attendanceRate([session]))}</p>`;
  showDialog(`${session.className} · ${session.subject}`, `${session.teacherName} · ${dateText(session.startedAt, true)}`,
    counts + table(['Roll number', 'Student', 'Status'], rows), '', null, {
      extra: `<div class="action-row dialog-actions">${button('Export session CSV', 'export-session', { target: session.id, glyph: 'download' })}${button('Done', 'dismiss', { style: 'primary' })}</div>`,
    });
}

function download(filters, filename) {
  const csv = exportCsv(state, filters);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('CSV downloaded.');
}

function settings() {
  return intro('Workspace settings', 'Update the campus branding and manage this browser’s attendance data.')
    + panel('College profile', 'These names appear in the workspace header and overview.', `
      <form class="panel-body form-grid" data-form="settings" novalidate>
        ${textField('College name', 'name', state.college.name, { length: 160 })}
        ${textField('Short name', 'shortName', state.college.shortName, { length: 24 })}
        <p class="field-error" role="alert" hidden></p>
        <div class="action-row"><button class="button primary" type="submit">Save profile</button></div>
      </form>`)
    + panel('Browser workspace', state.mode === 'demo' ? 'Currently using a workspace with fictional sample records.' : 'Currently using a local workspace on this browser.', `
      <div class="panel-body view-stack"><p class="muted">This app stores student records and attendance in this browser. Export CSV reports before switching workspaces or clearing browser data.</p>
      <div class="action-row">${button('Start a blank workspace', 'reset-local')}${button('Restore sample records', 'reset-demo')}</div></div>`);
}

function reset(mode) {
  const demo = mode === 'demo';
  showDialog(demo ? 'Restore sample records?' : 'Start a blank workspace?',
    demo ? 'Replace the current browser records and campus profile with the original sample workspace.'
      : 'Replace student, class, teacher, and session records on this browser. The current college profile is kept.',
    '', demo ? 'Restore sample records' : 'Start blank workspace', () => {
      persist(demo ? demoState() : emptyState(state.college || CAMPUS), true);
      activeSessionId = '';
      reportFilters = blankFilters();
      Object.keys(searches).forEach(kind => { searches[kind] = ''; });
      finishDialog(demo ? 'Sample records restored.' : 'Blank workspace ready.');
    }, { danger: true });
}

function saveSettings(form, data) {
  const college = { name: requiredValue(data, 'name', 'College name'), shortName: requiredValue(data, 'shortName', 'Short name') };
  persist({ ...state, college });
  showError(form, '');
  render();
  content.querySelector('[data-form="settings"] button').focus();
  notify('College profile saved.');
}

function finishDialog(message) {
  dialog.close();
  render();
  notify(message);
}

const actions = {
  'start-session': startSession,
  'close-session': closeSession,
  'toggle-present': togglePresent,
  'add-entry': kind => addOrEdit(kind),
  'edit-entry': entryId => {
    const entry = state[currentView]?.find(item => item.id === entryId);
    if (entry) addOrEdit(currentView, entry);
  },
  'delete-entry': entryId => {
    const entry = state[currentView]?.find(item => item.id === entryId);
    if (entry) confirmDelete(currentView, entry);
  },
  'session-detail': sessionDetail,
  'export-reports': () => download(reportFilters, 'campus-check-attendance.csv'),
  'export-session': sessionId => download({ sessionId }, 'campus-check-session.csv'),
  'clear-filters': () => {
    reportFilters = blankFilters();
    render();
    content.querySelector('#report-filters select')?.focus();
  },
  'reset-local': () => reset('local'),
  'reset-demo': () => reset('demo'),
  dismiss: () => dialog.close(),
};

document.addEventListener('click', event => {
  if (event.target.closest('.skip-link')) {
    event.preventDefault();
    content.focus();
    return;
  }
  const target = event.target.closest('[data-view], [data-action]');
  if (!target || target.disabled) return;
  if (target.dataset.view) {
    if (dialog.open) dialog.close();
    navigate(target.dataset.view);
    return;
  }
  try {
    actions[target.dataset.action]?.(target.dataset.id);
  } catch (error) {
    notify(error.message);
  }
});

document.addEventListener('submit', event => {
  const form = event.target;
  const kind = form.dataset.form;
  if (!kind) return;
  event.preventDefault();
  if (kind === 'filters') return;
  try {
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    if (kind === 'dialog') dialogSubmit?.(data);
    if (kind === 'scan') scan(form, data);
    if (kind === 'settings') saveSettings(form, data);
  } catch (error) {
    showError(form, error.message);
  }
});

document.addEventListener('input', event => {
  const field = event.target;
  if (field.id === 'directory-search' && Object.hasOwn(directories, currentView)) {
    searches[currentView] = field.value;
    content.querySelector('#directory-results').innerHTML = directoryResults(currentView);
  }
});

document.addEventListener('change', event => {
  const field = event.target;
  if (field.id === 'new-session-class') {
    const group = state.classes.find(item => item.id === field.value);
    dialog.querySelector('#new-session-subject').innerHTML = (group?.subjects || []).map(subject => option(subject, subject)).join('');
  }
  if (field.id === 'active-session') {
    activeSessionId = field.value;
    render();
    content.querySelector('#active-session')?.focus();
  }
  if (field.form?.id === 'report-filters') {
    reportFilters = { ...reportFilters, [field.name]: field.value };
    if (field.name === 'classId') reportFilters.subject = '';
    render();
    content.querySelector(`#report-filters [name="${field.name}"]`)?.focus();
  }
});

dialog.addEventListener('close', () => {
  if (dialog.open) return;
  dialogSubmit = null;
  if (dialogOpener instanceof HTMLElement && dialogOpener.isConnected) dialogOpener.focus();
  else content.focus();
  dialogOpener = null;
});

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try {
    state = loadState();
    storageIssue = '';
  } catch (error) {
    storageIssue = error.message;
  }
  if (dialog.open) dialog.close();
  render();
  notify(storageIssue ? 'Browser storage needs attention.' : 'Workspace updated from another tab.');
});

window.addEventListener('hashchange', route);
route();
