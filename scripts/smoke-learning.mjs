import assert from "node:assert/strict";
import { initialDocs, initialFeedback, initialGroups } from "../src/data.ts";
import {
  cleanGroup,
  emptySource,
  participantsFromDocs,
  publicationState,
} from "../src/learning.ts";
import { restoreTrash, trashGroup } from "../src/board-state.ts";

const doc = { ...initialDocs[0], published: true, sources: [] };
assert.equal(publicationState(doc), "private");
assert.equal(
  publicationState(
    { ...doc, anchors: [], updated: "방금", sources: [emptySource()] },
    doc,
  ),
  "current",
);
assert.equal(
  publicationState({ ...doc, title: "다시 생각한 제목" }, doc),
  "changed",
);
const sourced = {
  ...doc,
  sources: [{ ...emptySource(), title: "공식 소개 자료" }],
};
assert.equal(publicationState(sourced, doc), "changed");
assert.equal(publicationState(sourced, { ...sourced }), "current");
console.log(
  "PASS 공개본과 원고 비교: 빈 출처·피드백 위치 제외, 제목·출처 변경 감지",
);

const optional = cleanGroup({
  ...initialGroups[0],
  questions: ["", " 질문 하나 ", "  "],
  resources: [
    { id: "blank", title: "", url: "" },
    { id: "link", title: "", url: "https://example.com/lesson" },
  ],
});
assert.deepEqual(optional.questions, ["질문 하나"]);
assert.equal(optional.resources.length, 1);
assert.equal(optional.resources[0].title, "선생님 자료");
assert.equal(
  cleanGroup({
    ...initialGroups[0],
    resources: [
      { id: "invalid", title: "잘못된 주소", url: "javascript:alert(1)" },
    ],
  }).resources.length,
  0,
);
console.log(
  "PASS 선택 입력: 빈 질문·자료 생략, 이름 생략 기본값, 실행 주소 제외",
);

const participants = participantsFromDocs([doc, { ...doc, id: 99 }]);
assert.equal(participants.length, 1);
participants.push({
  id: 100,
  name: "첫 글을 준비하는 학생",
  joinedAt: Date.now(),
  connected: true,
});
participants[0].help = {
  kind: "move",
  docId: doc.id,
  targetGroupId: "discovery",
  note: "",
  createdAt: Date.now(),
};
const seed = {
  title: "학습 도움 확인",
  groups: initialGroups,
  docs: [sourced],
  posts: [doc],
  participants,
  feedback: [{ ...initialFeedback[0], response: "revised" }],
  comments: {},
  sort: "oldest",
  trash: [],
};
const trashed = trashGroup(seed, doc.groupId);
assert.equal(trashed.docs.length, 0);
assert.equal(trashed.participants.length, 2);
const saved = JSON.parse(JSON.stringify(trashed));
const restored = restoreTrash(saved, saved.trash[0].id);
assert.deepEqual(restored.participants, participants);
assert.deepEqual(restored.docs[0].sources, sourced.sources);
assert.equal(restored.feedback[0].response, "revised");
assert.equal(publicationState(restored.docs[0], restored.posts[0]), "changed");
console.log(
  "PASS 참가자와 원고 분리, 저장·휴지통 복원 후 도움·출처·피드백 상태 유지",
);
