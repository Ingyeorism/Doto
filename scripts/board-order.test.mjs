import assert from "node:assert/strict";
import test from "node:test";
import { initialDocs } from "../src/data.ts";
import { moveBoardCard, sortBoardCards } from "../src/board-order.ts";

const card = (id, groupId, patch = {}) => ({
  ...initialDocs[0],
  id,
  studentId: id,
  groupId,
  title: `글 ${id}`,
  name: `학생 ${id}`,
  published: true,
  createdAt: id,
  publishedAt: id,
  manualOrder: 100 - id,
  ...patch,
});
const seed = (sort = "oldest") => {
  const posts = [
    card(1, "a"),
    card(2, "a"),
    card(3, "a"),
    card(4, "b"),
    card(5, "b"),
    card(6, "c"),
    card(7, "c"),
  ];
  return { docs: structuredClone(posts), posts, sort };
};
const ids = (board, groupId, includeDrafts = false) =>
  sortBoardCards(
    board.posts.filter((p) => p.groupId === groupId),
    board.sort,
    includeDrafts
      ? board.docs.filter(
          (d) => d.groupId === groupId && !d.published && d.studentId === -1,
        )
      : [],
  ).map((d) => d.id);

test("다른 그룹의 맨 위·중간·맨 아래와 빈 그룹에 놓은 위치로 이동", () => {
  for (const [beforeId, expected] of [
    [4, [1, 4, 5]],
    [5, [4, 1, 5]],
    [undefined, [4, 5, 1]],
  ]) {
    const board = seed();
    const next = moveBoardCard(board, 1, "b", beforeId);
    assert.deepEqual(ids(next, "b"), expected);
    assert.deepEqual(ids(next, "a"), [2, 3]);
    assert.deepEqual(ids(next, "c"), [6, 7]);
    assert.equal(next.sort, "manual");
    assert.equal(next.docs.find((d) => d.id === 1).groupId, "b");
    assert.deepEqual(ids(board, "a"), [1, 2, 3]);
  }
  assert.deepEqual(ids(moveBoardCard(seed(), 1, "empty"), "empty"), [1]);
});

test("같은 그룹에서 위로·아래로·맨 끝으로 순서를 변경", () => {
  const up = moveBoardCard(seed(), 3, "a", 1);
  assert.deepEqual(ids(up, "a"), [3, 1, 2]);
  const down = moveBoardCard(up, 3, "a", 2);
  assert.deepEqual(ids(down, "a"), [1, 3, 2]);
  assert.deepEqual(ids(moveBoardCard(down, 3, "a"), "a"), [1, 2, 3]);
});

test("어떤 정렬에서도 다른 글들의 현재 순서를 유지하며 직접 배치로 전환", () => {
  for (const sort of ["oldest", "newest", "author", "title", "manual"]) {
    const board = seed(sort);
    const target = ids(board, "b");
    const next = moveBoardCard(board, 1, "b", target[1]);
    assert.deepEqual(ids(next, "b"), [target[0], 1, target[1]]);
    assert.deepEqual(ids(next, "c"), ids(board, "c"));
    assert.deepEqual(
      ids(next, "a"),
      ids(board, "a").filter((id) => id !== 1),
    );
  }
});

test("교사 초안도 게시글 사이에 배치하고 학생의 비공개 글은 유지", () => {
  const board = seed();
  const privateDoc = card(10, "b", { published: false });
  board.docs.push(
    card(8, "a", { published: false, studentId: -1 }),
    card(9, "a", { published: false, studentId: -1 }),
    privateDoc,
  );
  const next = moveBoardCard(board, 8, "b", 5);
  assert.deepEqual(ids(next, "b", true), [4, 8, 5]);
  assert.deepEqual(ids(next, "a", true), [9, 1, 2, 3]);
  assert.equal(next.docs.find((d) => d.id === 8).published, false);
  assert.equal(
    next.posts.some((d) => d.id === 8),
    false,
  );
  assert.equal(
    next.docs.find((d) => d.id === 10),
    privateDoc,
  );
  const moved = moveBoardCard(next, 9, "b", 8);
  assert.deepEqual(ids(moved, "b", true), [4, 9, 8, 5]);
});

test("자기 위치에 놓거나 없는 글을 옮기면 정렬과 내용 유지", () => {
  const board = seed();
  assert.equal(moveBoardCard(board, 1, "a", 1), board);
  assert.equal(moveBoardCard(board, 1, "a", 2), board);
  assert.equal(moveBoardCard(board, 999, "a"), board);
});

test("저장 후 다시 읽어도 배치와 원고·게시본의 독립적인 내용 유지", () => {
  const board = seed();
  board.docs[0].title = "아직 게시하지 않은 수정";
  const next = JSON.parse(JSON.stringify(moveBoardCard(board, 1, "b", 5)));
  assert.deepEqual(ids(next, "b"), [4, 1, 5]);
  assert.equal(next.docs[0].title, "아직 게시하지 않은 수정");
  assert.equal(next.posts[0].title, "글 1");
  for (const post of next.posts) {
    const doc = next.docs.find((d) => d.id === post.id);
    assert.equal(doc.groupId, post.groupId);
    assert.equal(doc.manualOrder, post.manualOrder);
  }
});
