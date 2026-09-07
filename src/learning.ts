import {
  toHtml,
  type BoardGroup,
  type Participant,
  type StudentDoc,
  type WritingSource,
} from "./data.ts";

export const emptySource = (): WritingSource => ({
  institution: "",
  title: "",
  date: "",
  url: "",
});
export function httpUrl(value: string): string {
  if (!value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
export const filledSources = (sources: WritingSource[] = []) =>
  sources
    .map((s) => ({
      institution: s.institution.trim(),
      title: s.title.trim(),
      date: s.date.trim(),
      url: s.url.trim(),
    }))
    .filter((s) => Object.values(s).some(Boolean));

export function publicationState(
  doc: StudentDoc,
  post?: StudentDoc,
): "private" | "current" | "changed" {
  if (!post || !doc.published) return "private";
  const content = (item: StudentDoc) =>
    JSON.stringify({
      title: item.title.trim(),
      html: toHtml(item),
      sources: filledSources(item.sources),
    });
  return content(doc) === content(post) ? "current" : "changed";
}
export function participantsFromDocs(docs: StudentDoc[]): Participant[] {
  return [
    ...new Map(
      docs
        .filter((d) => d.studentId >= 0)
        .map((d) => [
          d.studentId,
          {
            id: d.studentId,
            name: d.name,
            joinedAt: d.createdAt,
            connected: d.connected,
          },
        ]),
    ).values(),
  ];
}
export function cleanGroup(group: BoardGroup): BoardGroup {
  return {
    ...group,
    title: group.title.trim(),
    description: group.description.trim(),
    autoExpand: group.autoExpand === true,
    questions: (group.questions ?? []).map((q) => q.trim()).filter(Boolean),
    resources: (group.resources ?? [])
      .map((r) => ({
        ...r,
        title: r.title.trim() || "선생님 자료",
        url: httpUrl(r.url),
        caption: r.caption?.trim(),
      }))
      .filter((r) => r.url || r.image),
  };
}
