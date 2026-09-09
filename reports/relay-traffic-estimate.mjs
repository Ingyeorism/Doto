// Synthetic byte estimate, not a network or N100 benchmark.
// Runs the current application's actual snapshot/chunk serialization methods.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { stripTypeScriptTypes } from 'node:module';
import * as Y from 'yjs';
import * as sync from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('src/classroom.ts', root), 'utf8');
const methods = [['sendSnapshot', 'syncDoc'], ['send', 'drain'], ['drain', 'sendSnapshot']].map(([name, next]) => {
  const start = source.indexOf('  private ' + name + '(');
  const end = source.indexOf('  private ' + next + '(', start);
  if (start < 0 || end < 0) throw Error('Method not found: ' + name);
  return source.slice(start, end);
}).join('\n');
const js = stripTypeScriptTypes(`class Meter {
  constructor(lesson) { this.lesson = lesson; }
  controller(id) { return id < -1; }
  ${methods}
}`);
const Meter = new Function('createUuid', `${js}; return Meter;`)(randomUUID);
const bytes = value => Buffer.byteLength(JSON.stringify(value));
function snapshotBytes(lesson, id) {
  let size = 0;
  const peer = { id, ready: true, queue: [], channel: {
    readyState: 'open', bufferedAmount: 0,
    send: raw => { size += Buffer.byteLength(raw); },
  }};
  new Meter(lesson).sendSnapshot(peer);
  return size;
}
const students = 30;
const body = '오늘 친구와 함께 학교에서 재미있는 이야기를 쓰고 서로의 생각을 나누었다. '.repeat(100).slice(0, 1000);
function fixture(imageBytes = 0) {
  const docs = Array.from({length: students}, (_, i) => ({
    id: 1000000000000 + i, studentId: i + 1, groupId: 'group-1',
    createdAt: 1788912000000, manualOrder: i, anchors: [], name: `학생${i + 1}`,
    title: '친구와 함께한 하루', paragraphs: [body], html: `<p>${body}</p>`,
    connected: true, updated: '오전 10:00', published: false, sources: [],
  }));
  return { id: '00000000-0000-4000-8000-000000000000', title: '우리 반 글쓰기',
    prompt: '', createdAt: 1788912000000, ended: false,
    settings: { locked: false, observe: false, feedback: true, editing: true, comments: true },
    members: [], controllers: [], board: {
      title: '우리 반 이야기', docs, posts: [], feedback: [], comments: {}, trash: [], sort: 'oldest',
      participants: docs.map(d => ({ id: d.studentId, name: d.name, joinedAt: d.createdAt, connected: true })),
      groups: [{ id: 'group-1', title: '우리 반 이야기', description: '',
        resources: imageBytes ? [{ id: 'image-1', title: '그림 자료', url: '',
          image: 'data:image/webp;base64,' + 'A'.repeat(imageBytes - 23) }] : [] }],
    }};
}
// IME behavior varies by browser. Compare insert-only and a simplified three-stage
// composition: insert initial consonant, replace with partial syllable, replace
// with final syllable. This is synthetic Y.XmlText, not an Android IME trace.
function editing(composition) {
  const y = new Y.Doc({ gc: false });
  const p = new Y.XmlElement('paragraph');
  const t = new Y.XmlText();
  y.getXmlFragment('body').insert(0, [p]); p.insert(0, [t]);
  let count = 0, total = 0;
  y.on('update', u => {
    const enc = encoding.createEncoder(); sync.writeUpdate(enc, u);
    count++; total += bytes({ type: 'sync', docId: 1000000000000,
      data: Buffer.from(encoding.toUint8Array(enc)).toString('base64') });
  });
  for (const c of body) {
    if (composition && /[가-힣]/.test(c)) {
      t.insert(t.length, 'ㄱ');
      y.transact(() => { t.delete(t.length - 1, 1); t.insert(t.length, '가'); });
      y.transact(() => { t.delete(t.length - 1, 1); t.insert(t.length, c); });
    } else t.insert(t.length, c);
  }
  const out = { messagesPerStudent: count, payloadBytesPerStudent: total,
    meanPacketBytes: total / count, fullYjsStateBytes: Y.encodeStateAsUpdate(y).length };
  y.destroy(); return out;
}
function lessonTraffic(imageBytes) {
  const lesson = fixture(imageBytes);
  let teacher = 0, all = 0;
  // All 30 students publish once, sequentially, then each leaves three comments.
  // Every action is assumed >120ms apart, so no global broadcast coalescing.
  // Includes the extra snapshot response to the actor in current receive().
  function action(actor) {
    teacher += snapshotBytes(lesson, -2);
    all += snapshotBytes(lesson, -2);
    for (let id = 1; id <= students; id++) all += snapshotBytes(lesson, id);
    all += snapshotBytes(lesson, actor);
  }
  for (const d of lesson.board.docs) {
    d.published = true; d.publishedAt = d.createdAt;
    lesson.board.posts.push(structuredClone(d)); action(d.studentId);
  }
  for (let i = 0; i < students * 3; i++) {
    const d = lesson.board.docs[i % students];
    const comments = lesson.board.comments[d.id] ??= [];
    comments.push({ id: `comment-${i}`, studentId: (i % students) + 1,
      name: `학생${(i % students) + 1}`, text: '친구의 생각을 읽으니 새로운 점을 알게 되었다.' });
    action((i % students) + 1);
  }
  return { boardActions: 120, teacherSnapshotTotalBytes: teacher,
    allSnapshotTotalBytes: all, finalTeacherSnapshotBytes: snapshotBytes(lesson, -2),
    finalStudentSnapshotBytes: snapshotBytes(lesson, 1) };
}
const typing = { insertOnly: editing(false), simplifiedComposition: editing(true) };
const wireAllowance = 1.5;
const scenarios = [0, 500000].map(imageBytes => {
  const board = lessonTraffic(imageBytes);
  const t = typing.simplifiedComposition.payloadBytesPerStudent * students;
  const teacherMB = (t + board.teacherSnapshotTotalBytes) * wireAllowance / 1e6;
  // Preserves the tablet host. Each student's edit crosses two relayed peer links:
  // student -> host, then host -> remote teacher. Each link is one relay egress copy.
  const allMB = (2 * t + board.allSnapshotTotalBytes) * wireAllowance / 1e6;
  return { serializedImageBytes: imageBytes, ...board,
    teacherRelayUploadMB: teacherMB, allRelayUploadMB: allMB,
    teacherAverageMbps40min: teacherMB * 8 / 2400,
    allAverageMbps40min: allMB * 8 / 2400 };
});
const assets = readdirSync(new URL('dist/assets/', root)).map(name => {
  const file = readFileSync(new URL(`dist/assets/${name}`, root));
  return { name, bytes: file.length, gzipBytes: gzipSync(file).length };
});
const output = { generatedAt: new Date().toISOString(),
  assumptions: { students, remoteTeachers: 1, separateHostTablet: true, durationMinutes: 40,
    finalCharactersPerStudent: body.length, commentsPerStudent: 3, wireAllowance,
    excludes: ['initial joins and reconnects', 'feedback and other commands', 'signaling and diagnostics',
      'page assets', 'application-level relay envelope', 'packet retransmission beyond allowance'],
    note: 'Serialized payload measurement with synthetic data; 50% transport allowance is assumed, not measured. No CPU/RAM benchmark.' },
  typing, scenarios, assets };
writeFileSync(new URL('relay-traffic-estimate.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));

