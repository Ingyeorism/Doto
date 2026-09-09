import type { PostSort, StudentDoc } from "./data";

export function sortBoardCards(
  posts: StudentDoc[],
  sort: PostSort,
  drafts: StudentDoc[] = [],
): StudentDoc[] {
  const ordered = [...posts].sort((a, b) => {
    const time = (d: StudentDoc) => d.publishedAt ?? d.createdAt;
    if (sort === "author")
      return a.name.localeCompare(b.name, "ko") || time(a) - time(b);
    if (sort === "title")
      return a.title.localeCompare(b.title, "ko") || time(a) - time(b);
    return sort === "newest" ? time(b) - time(a) : time(a) - time(b);
  });
  const cards = [...drafts, ...ordered];
  return sort === "manual"
    ? cards.sort((a, b) => a.manualOrder - b.manualOrder || a.id - b.id)
    : cards;
}

type OrderedBoard = {
  docs: StudentDoc[];
  posts: StudentDoc[];
  sort: PostSort;
};

export function moveBoardCard(
  board: OrderedBoard,
  id: number,
  groupId: string,
  beforeId?: number,
): OrderedBoard {
  const drafts = board.docs.filter((d) => d.studentId === -1 && !d.published);
  const cards = [...board.posts, ...drafts];
  const source = cards.find((d) => d.id === id);
  if (!source || beforeId === id) return board;

  // Preserve the visible order in every group when switching to manual layout.
  const orders = new Map(
    [...new Set([...cards.map((d) => d.groupId), groupId])].map((group) => [
      group,
      sortBoardCards(
        board.posts.filter((d) => d.groupId === group),
        board.sort,
        drafts.filter((d) => d.groupId === group),
      ).map((d) => d.id),
    ]),
  );
  const original = orders.get(groupId)!;
  const destination = original.filter((cardId) => cardId !== id);
  const index = beforeId === undefined ? -1 : destination.indexOf(beforeId);
  destination.splice(index < 0 ? destination.length : index, 0, id);
  if (
    source.groupId === groupId &&
    original.every((cardId, i) => cardId === destination[i])
  )
    return board;
  orders.set(
    source.groupId,
    orders.get(source.groupId)!.filter((cardId) => cardId !== id),
  );
  orders.set(groupId, destination);

  const positions = new Map(
    [...orders.values()].flatMap((ids) =>
      ids.map((cardId, i) => [cardId, i] as const),
    ),
  );
  const move = (items: StudentDoc[]) =>
    items.map((d) =>
      positions.has(d.id)
        ? {
            ...d,
            groupId: d.id === id ? groupId : d.groupId,
            manualOrder: positions.get(d.id)!,
          }
        : d,
    );
  return { docs: move(board.docs), posts: move(board.posts), sort: "manual" };
}
