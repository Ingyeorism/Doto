import type {
  BoardComment,
  BoardGroup,
  Feedback,
  PostSort,
  StudentDoc,
  Participant,
} from "./data";
import { createUuid } from "./uuid";

export const TRASH_DAYS = 30;
const RETENTION_MS = TRASH_DAYS * 24 * 60 * 60 * 1000;
export interface TrashBatch {
  id: string;
  deletedAt: number;
  group: BoardGroup;
  groupIndex: number;
  docs: StudentDoc[];
  posts: StudentDoc[];
  feedback: Feedback[];
  comments: Record<number, BoardComment[]>;
}
export interface BoardState {
  participants?: Participant[];
  title: string;
  docs: StudentDoc[];
  posts: StudentDoc[];
  groups: BoardGroup[];
  feedback: Feedback[];
  comments: Record<number, BoardComment[]>;
  sort: PostSort;
  trash: TrashBatch[];
}
export const pruneTrash = (trash: TrashBatch[], now = Date.now()) =>
  trash.filter((item) => now - item.deletedAt < RETENTION_MS);

export function trashGroup(
  board: BoardState,
  groupId: string,
  now = Date.now(),
): BoardState {
  const groupIndex = board.groups.findIndex((g) => g.id === groupId);
  if (groupIndex < 0) return board;
  const docs = board.docs.filter((d) => d.groupId === groupId);
  const posts = board.posts.filter((p) => p.groupId === groupId);
  const ids = new Set([...docs, ...posts].map((d) => d.id));
  const batch: TrashBatch = {
    id: createUuid(),
    deletedAt: now,
    group: board.groups[groupIndex],
    groupIndex,
    docs,
    posts,
    feedback: board.feedback.filter((f) => ids.has(f.docId)),
    comments: Object.fromEntries(
      Object.entries(board.comments).filter(([id]) => ids.has(Number(id))),
    ),
  };
  return {
    ...board,
    groups: board.groups.filter((g) => g.id !== groupId),
    docs: board.docs.filter((d) => !ids.has(d.id)),
    posts: board.posts.filter((p) => !ids.has(p.id)),
    feedback: board.feedback.filter((f) => !ids.has(f.docId)),
    comments: Object.fromEntries(
      Object.entries(board.comments).filter(([id]) => !ids.has(Number(id))),
    ),
    trash: [...pruneTrash(board.trash, now), batch],
  };
}

export function restoreTrash(
  board: BoardState,
  batchId: string,
  docId?: number,
  now = Date.now(),
): BoardState {
  const batch = pruneTrash(board.trash, now).find((b) => b.id === batchId);
  if (!batch) return board;
  const docs = batch.docs.filter((d) => docId === undefined || d.id === docId);
  const posts = batch.posts.filter(
    (p) => docId === undefined || p.id === docId,
  );
  if (docId !== undefined && !docs.length && !posts.length) return board;
  const ids = new Set([...docs, ...posts].map((d) => d.id));
  const groups = [...board.groups];
  if (!groups.some((g) => g.id === batch.group.id))
    groups.splice(Math.min(batch.groupIndex, groups.length), 0, batch.group);
  const rest = {
    ...batch,
    docs: batch.docs.filter((d) => !ids.has(d.id)),
    posts: batch.posts.filter((p) => !ids.has(p.id)),
    feedback: batch.feedback.filter((f) => !ids.has(f.docId)),
    comments: Object.fromEntries(
      Object.entries(batch.comments).filter(([id]) => !ids.has(Number(id))),
    ),
  };
  return {
    ...board,
    groups,
    docs: [
      ...board.docs,
      ...docs.filter((d) => !board.docs.some((active) => active.id === d.id)),
    ],
    posts: [
      ...board.posts,
      ...posts.filter((p) => !board.posts.some((active) => active.id === p.id)),
    ],
    feedback: [
      ...board.feedback,
      ...batch.feedback.filter(
        (f) =>
          ids.has(f.docId) &&
          !board.feedback.some((active) => active.id === f.id),
      ),
    ],
    comments: {
      ...board.comments,
      ...Object.fromEntries(
        Object.entries(batch.comments).filter(([id]) => ids.has(Number(id))),
      ),
    },
    trash: pruneTrash(board.trash, now).flatMap((b) =>
      b.id !== batchId
        ? [b]
        : docId !== undefined && (rest.docs.length || rest.posts.length)
          ? [rest]
          : [],
    ),
  };
}

export function loadBoard(key: string, seed: BoardState): BoardState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return seed;
    const saved = JSON.parse(raw);
    if (
      saved.version !== 2 ||
      !Array.isArray(saved.board?.docs) ||
      !Array.isArray(saved.board?.trash) ||
      !Array.isArray(saved.board?.groups)
    )
      return seed;
    return { ...seed, ...saved.board, trash: pruneTrash(saved.board.trash) };
  } catch {
    return seed;
  }
}
