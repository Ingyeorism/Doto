import assert from "node:assert/strict";
import { initialDocs, initialFeedback, initialGroups } from "../src/data.ts";
import { trashGroup, restoreTrash, pruneTrash } from "../src/board-state.ts";
const now = Date.now();
const seed = {
  title: "휴지통 확인",
  groups: initialGroups,
  docs: initialDocs,
  posts: initialDocs.filter((d) => d.published),
  feedback: initialFeedback,
  comments: { 7: [{ name: "가상 학생", text: "댓글 보존 확인" }] },
  sort: "oldest",
  trash: [],
};
const deleted = trashGroup(seed, "memory", now);
assert.equal(deleted.groups.length, 2);
assert(!deleted.docs.some((d) => d.groupId === "memory"));
assert(!deleted.posts.some((d) => d.groupId === "memory"));
assert.equal(deleted.feedback.length, 0);
assert.equal(deleted.comments[7], undefined);
assert.equal(deleted.trash[0].docs.length, 4);
const persisted = JSON.parse(JSON.stringify(deleted));
const restored = restoreTrash(persisted, persisted.trash[0].id, undefined, now);
assert.deepEqual(restored.groups, seed.groups);
assert.deepEqual(
  restored.docs.sort((a, b) => a.id - b.id),
  JSON.parse(JSON.stringify(seed.docs)).sort((a, b) => a.id - b.id),
);
assert.deepEqual(restored.feedback, seed.feedback);
assert.deepEqual(restored.comments, seed.comments);
assert.deepEqual(
  restored.posts.sort((a, b) => a.id - b.id),
  [...seed.posts].sort((a, b) => a.id - b.id),
);
assert.equal(restored.trash.length, 0);
console.log(
  "PASS: nonempty group deletion, serialized recovery of draft/publication/feedback/comment",
);
const single = restoreTrash(deleted, deleted.trash[0].id, 0, now);
assert(single.docs.some((d) => d.id === 0));
assert(!single.docs.some((d) => d.id === 7));
assert.equal(single.trash[0].docs.length, 3);
assert.equal(single.feedback.length, 2);
const all = restoreTrash(single, single.trash[0].id, undefined, now);
assert.equal(all.docs.length, seed.docs.length);
assert.equal(new Set(all.groups.map((g) => g.id)).size, seed.groups.length);
assert.deepEqual(restoreTrash(all, deleted.trash[0].id, undefined, now), all);
console.log("PASS: individual restore then batch restore, no duplicates");
const empty = {
  ...seed,
  groups: [initialGroups[0]],
  docs: [],
  posts: [],
  feedback: [],
  comments: {},
};
const none = trashGroup(empty, "memory", now);
assert.equal(none.groups.length, 0);
assert.equal(
  restoreTrash(none, none.trash[0].id, undefined, now).groups.length,
  1,
);
console.log("PASS: last/empty group delete and restore");
assert.equal(pruneTrash(deleted.trash, now + 30 * 86400000 - 1).length, 1);
assert.equal(pruneTrash(deleted.trash, now + 30 * 86400000).length, 0);
assert.deepEqual(
  restoreTrash(deleted, deleted.trash[0].id, undefined, now + 30 * 86400000),
  deleted,
);
console.log("PASS: 30-day retention boundary");
