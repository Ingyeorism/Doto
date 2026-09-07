import type { Lesson } from "./classroom";
import type { StudentDoc } from "./data";
import { documentHtml, escapeHtml as esc } from "./safe-html";
import { filledSources, httpUrl } from "./learning";

export function lessonHtml(lesson: Lesson) {
  const b = lesson.board;
  const messages = (d: StudentDoc) =>
    (b.participants?.find((p) => p.id === d.studentId)?.messages || [])
      .filter((m) => m.docId === d.id)
      .map(
        (m) =>
          `<aside><strong>${m.sender === "teacher" ? "선생님의 답장" : "학생 메시지"}</strong><p style="white-space:pre-wrap">${esc(m.text)}</p></aside>`,
      )
      .join("");
  const body = (d: StudentDoc) =>
    `<div class="document-body">${documentHtml(d.html || d.paragraphs.map((p) => `<p>${esc(p)}</p>`).join(""))}</div>${
      filledSources(d.sources).length
        ? "<h4>출처</h4><ul>" +
          filledSources(d.sources)
            .map(
              (s) =>
                `<li>${esc([s.institution, s.title, s.date].filter(Boolean).join(" · "))} ${httpUrl(s.url) ? `<a href="${esc(httpUrl(s.url))}" rel="noreferrer">${esc(s.url)}</a>` : esc(s.url)}</li>`,
            )
            .join("") +
          "</ul>"
        : ""
    }`;
  const docs = (items: StudentDoc[]) =>
    items
      .map(
        (d) =>
          `<article><div class="label">${esc(d.name)}</div><h3>${esc(d.title || "제목 없는 글")}</h3>${body(d)}${b.feedback
            .filter((f) => f.docId === d.id)
            .map(
              (f) =>
                `<aside><strong>선생님의 피드백${f.response ? " · " + ({ read: "읽었어요", revised: "고쳤어요", confirmed: "확인 완료" }[f.response] || "다시 살펴봐요") : ""}</strong>${f.quote ? `<blockquote>${esc(f.quote)}</blockquote>` : ""}<p>${esc(f.message)}</p></aside>`,
            )
            .join("")}${messages(d)}</article>`,
      )
      .join("");
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'"><title>${esc(lesson.title)} · 도토 수업 결과</title><style>body{max-width:1000px;margin:40px auto;padding:0 24px;background:#faf8f2;color:#30392f;font:17px/1.9 sans-serif}h1,h2{color:#315b45}header{border-bottom:2px solid #315b45;margin-bottom:40px}article{background:white;border:1px solid #dddaca;border-radius:16px;padding:28px;margin:24px 0;overflow-wrap:anywhere}aside{background:#fff6d9;padding:14px 20px;margin-top:16px}.label,small{color:#666b60}blockquote{border-left:3px solid #c5af60;padding-left:14px;margin-left:0}section{margin-top:40px}a{color:#315b45}.document-body{line-height:1.6}.document-body p{margin-block:0;white-space:pre-wrap}.document-body p:empty::before{content:"\\200b"}@media print{body{background:white;margin:0;font-size:12pt}article{break-inside:avoid}h2{break-after:avoid}}</style><header><div class="label">도토 · 교사용 수업 결과</div><h1>${esc(lesson.title)}</h1><p>${esc(lesson.prompt)}</p><p>${new Date(lesson.createdAt).toLocaleDateString("ko-KR")} · 참여 ${b.participants?.length || 0}명 · 원고 ${b.docs.length}개</p><small>내보낸 시각: ${new Date().toLocaleString("ko-KR")} · 교사에게 전달되어 보관된 내용입니다.</small></header><h2>현재 원고와 개인 피드백</h2>${b.groups.map((g) => `<section><h2>${esc(g.title)}</h2><p>${esc(g.description)}</p>${(g.questions || []).map((q) => `<p>생각 질문: ${esc(q)}</p>`).join("")}${(g.resources || []).map((r) => `<p>${esc(r.title)} ${httpUrl(r.url) ? `<a href="${esc(httpUrl(r.url))}">자료 열기</a>` : ""}${r.image && /^data:image\/(png|jpeg|webp);base64,/.test(r.image) ? `<br><img style="max-width:100%" alt="${esc(r.caption || r.title)}" src="${esc(r.image)}">` : ""}</p>`).join("")}${docs(b.docs.filter((d) => d.groupId === g.id))}</section>`).join("")}<h2>게시판에 올린 완성본과 댓글</h2>${b.posts.map((p) => `<article><div class="label">${esc(p.name)} · ${esc(b.groups.find((g) => g.id === p.groupId)?.title || "")}</div><h3>${esc(p.title)}</h3>${body(p)}<h4>댓글</h4>${(b.comments[p.id] || []).map((c) => `<p><strong>${esc(c.name)}</strong> ${esc(c.text)}</p>`).join("") || "<p>댓글 없음</p>"}</article>`).join("") || "<p>게시한 글이 없습니다.</p>"}${
    b.trash.length
      ? `<h2>휴지통에 보관한 글</h2>${b.trash
          .map(
            (t) =>
              `<section><h3>${esc(t.group.title)} · ${new Date(t.deletedAt).toLocaleDateString("ko-KR")} 삭제</h3>${t.docs
                .map(
                  (d) =>
                    `<article><div class="label">${esc(d.name)}</div><h3>${esc(d.title)}</h3>${body(d)}${t.feedback
                      .filter((f) => f.docId === d.id)
                      .map(
                        (f) =>
                          `<aside>${f.quote ? `<blockquote>${esc(f.quote)}</blockquote>` : ""}<p>${esc(f.message)}</p></aside>`,
                      )
                      .join("")}${t.posts
                      .filter((p) => p.id === d.id)
                      .map((p) => `<h4>게시한 완성본</h4>${body(p)}`)
                      .join(
                        "",
                      )}${(t.comments[d.id] || []).map((c) => `<p><strong>${esc(c.name)}</strong> ${esc(c.text)}</p>`).join("")}</article>`,
                )
                .join("")}</section>`,
          )
          .join("")}`
      : ""
  }</html>`;
}
export function exportLesson(lesson: Lesson) {
  const url = URL.createObjectURL(
    new Blob(["\ufeff", lessonHtml(lesson)], {
      type: "text/html;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `도토_${lesson.title.replace(/[\\/:*?"<>|]/g, "_")}_${new Date(lesson.createdAt).toISOString().slice(0, 10)}.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
