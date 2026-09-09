import { useEffect, useRef, useState } from "react";
import { BookOpen, ExternalLink, ImagePlus, Plus, X } from "lucide-react";
import type { BoardGroup, LessonResource, StudentDoc } from "./data";
import { emptySource, httpUrl } from "./learning";
import { Button } from "./ui";
import { createUuid } from "./uuid";

const questionSets = {
  review: [
    "어떤 책을 읽었나요?",
    "기억에 남는 장면과 내 생각은 무엇인가요?",
    "누구에게 권하고 싶나요? 그 이유는 무엇인가요?",
  ],
  heritage: [
    "조사한 국가유산의 이름과 위치는 어디인가요?",
    "자료에서 새롭게 안 사실은 무엇인가요?",
    "왜 소중하게 지켜야 할까요?",
  ],
};

async function preparePicture(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const picture = new Image();
    picture.src = url;
    await picture.decode();
    const scale = Math.min(
      1,
      1280 / Math.max(picture.naturalWidth, picture.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("그림을 열 수 없어요.");
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/webp", 0.78);
    if (data.length > 950000) throw new Error("그림이 너무 커요.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function GroupLearningFields({
  group,
  onChange,
  onBusyChange,
}: {
  group: BoardGroup;
  onChange: (group: BoardGroup) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [questionExample, setQuestionExample] =
    useState<keyof typeof questionSets>("review");
  const [imageError, setImageError] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const latestGroup = useRef(group);
  latestGroup.current = group;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      onBusyChange(false);
    };
  }, [onBusyChange]);
  const resources = group.resources ?? [];
  const updateResource = (id: string, patch: Partial<LessonResource>) =>
    onChange({
      ...latestGroup.current,
      resources: (latestGroup.current.resources ?? []).map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    });
  return (
    <details className="group-learning-settings">
      <summary>
        수업 자료·글쓰기 도움 <span>선택</span>
      </summary>
      <p className="meta">
        필요한 것만 채워 주세요. 빈 질문과 빈 자료는 학생에게 보이지 않아요.
      </p>
      <div className="field">
        <strong>생각을 여는 질문</strong>
        <div
          className="row gap-8 template-choices"
          role="group"
          aria-label="질문 예시 선택"
        >
          <Button
            aria-pressed={questionExample === "review"}
            onClick={() => setQuestionExample("review")}
          >
            서평 예시
          </Button>
          <Button
            aria-pressed={questionExample === "heritage"}
            onClick={() => setQuestionExample("heritage")}
          >
            조사 예시
          </Button>
        </div>
        {[0, 1, 2].map((index) => (
          <input
            key={index}
            aria-label={`생각 질문 ${index + 1}`}
            placeholder={`예: ${questionSets[questionExample][index]}`}
            maxLength={140}
            value={group.questions?.[index] ?? ""}
            onChange={(e) => {
              const questions = [0, 1, 2].map(
                (i) => group.questions?.[i] ?? "",
              );
              questions[index] = e.target.value;
              onChange({ ...group, questions });
            }}
          />
        ))}
      </div>
      <label className="optional-check">
        <input
          type="checkbox"
          checked={!!group.collectSources}
          onChange={(e) =>
            onChange({ ...group, collectSources: e.target.checked })
          }
        />
        <span>
          <strong>출처 적는 칸 보여 주기</strong>
          <small>
            조사 수업에서 사용해요. 학생이 비워 두어도 글을 올릴 수 있어요.
          </small>
        </span>
      </label>
      <div className="resource-settings-title">
        <strong>추가자료</strong>
        <span className="meta">최대 2개 · 링크나 그림</span>
      </div>
      {resources.map((r, index) => (
        <div className="resource-form" key={r.id}>
          <div className="row space-between">
            <strong>자료 {index + 1}</strong>
            <Button
              variant="ghost"
              aria-label={`자료 ${index + 1} 삭제`}
              onClick={() =>
                onChange({
                  ...group,
                  resources: resources.filter((item) => item.id !== r.id),
                })
              }
            >
              <X size={16} />
              삭제
            </Button>
          </div>
          <label className="field">
            자료 이름
            <input
              value={r.title}
              maxLength={70}
              placeholder="예: 수원 화성 살펴보기 · 생략하면 ‘추가자료’"
              onChange={(e) => updateResource(r.id, { title: e.target.value })}
            />
          </label>
          <label className="field">
            자료 주소
            <input
              type="url"
              value={r.url}
              placeholder="https://… · 그림만 넣을 때는 생략"
              onChange={(e) => {
                e.target.setCustomValidity(
                  e.target.value.trim() && !httpUrl(e.target.value)
                    ? "http 또는 https로 시작하는 자료 주소를 넣어 주세요."
                    : "",
                );
                updateResource(r.id, { url: e.target.value });
              }}
              onBlur={(e) =>
                e.target.setCustomValidity(
                  e.target.value.trim() && !httpUrl(e.target.value)
                    ? "http 또는 https로 시작하는 자료 주소를 넣어 주세요."
                    : "",
                )
              }
            />
          </label>
          <label className="resource-file">
            <ImagePlus size={17} />
            <span>{r.image ? "그림 바꾸기" : "그림 넣기"}</span>
            <input
              type="file"
              disabled={imageBusy}
              accept="image/png,image/jpeg,image/webp"
              aria-label={`자료 ${index + 1} 그림 파일`}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (
                  !["image/png", "image/jpeg", "image/webp"].includes(
                    file.type,
                  ) ||
                  file.size > 20 * 1024 * 1024
                ) {
                  setImageError(
                    "20MB 이하의 PNG, JPG, WebP 그림을 골라 주세요.",
                  );
                  return;
                }
                setImageBusy(true);
                onBusyChange(true);
                const image = await preparePicture(file).catch(() => "");
                if (!mounted.current) return;
                setImageBusy(false);
                onBusyChange(false);
                if (!image) {
                  setImageError(
                    "그림을 읽지 못했어요. 다른 파일을 골라 주세요.",
                  );
                  return;
                }
                setImageError("");
                updateResource(r.id, { image });
              }}
            />
          </label>
          {r.image && (
            <>
              <img
                className="resource-image-preview"
                src={r.image}
                alt={r.caption || r.title || "자료 그림"}
              />
              <label className="field">
                그림 설명·출처
                <input
                  value={r.caption ?? ""}
                  maxLength={200}
                  placeholder="그림에서 볼 것과 출처 · 선택"
                  onChange={(e) =>
                    updateResource(r.id, { caption: e.target.value })
                  }
                />
              </label>
              <Button
                variant="ghost"
                onClick={() =>
                  updateResource(r.id, { image: undefined, caption: undefined })
                }
              >
                그림 빼기
              </Button>
            </>
          )}
        </div>
      ))}
      {imageError && (
        <p className="field-error" role="alert">
          {imageError}
        </p>
      )}
      {imageBusy && (
        <p className="meta" role="status">
          그림을 준비하고 있어요…
        </p>
      )}
      {resources.length < 2 && (
        <Button
          onClick={() =>
            onChange({
              ...group,
              resources: [
                ...resources,
                { id: createUuid(), title: "", url: "" },
              ],
            })
          }
        >
          <Plus size={16} />
          자료 추가
        </Button>
      )}
    </details>
  );
}

export function LessonMaterials({ group }: { group: BoardGroup }) {
  const [openImage, setOpenImage] = useState<string | null>(null);
  const resources = (group.resources ?? []).filter(
    (r) => httpUrl(r.url) || r.image,
  );
  if (!resources.length) return null;
  return (
    <div className="lesson-materials">
      <span className="materials-label">
        <BookOpen size={15} />
        추가자료
      </span>
      {resources.map((r) => (
        <div className="lesson-resource" key={r.id}>
          {httpUrl(r.url) && (
            <a href={httpUrl(r.url)} target="_blank" rel="noopener noreferrer">
              {r.title || "추가자료"}
              <ExternalLink size={14} />
              <span className="sr-only">새 탭에서 열기</span>
            </a>
          )}
          {r.image && (
            <>
              <button
                className="resource-image-button"
                type="button"
                onClick={() => setOpenImage(openImage === r.id ? null : r.id)}
                aria-expanded={openImage === r.id}
              >
                <img src={r.image} alt="" />
                {r.title || "추가자료"} · 그림{" "}
                {openImage === r.id ? "접기" : "보기"}
              </button>
              {openImage === r.id && (
                <figure>
                  <img
                    src={r.image}
                    alt={r.caption || r.title || "선생님이 준비한 그림"}
                  />
                  {r.caption && <figcaption>{r.caption}</figcaption>}
                </figure>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function SourceFields({
  doc,
  onUpdate,
}: {
  doc: StudentDoc;
  onUpdate: (changes: Partial<StudentDoc>) => void;
}) {
  const sources = doc.sources?.length ? doc.sources : [emptySource()];
  return (
    <details className="source-fields">
      <summary>
        출처 남기기{" "}
        <span>
          선택 ·{" "}
          {doc.sources?.filter((s) => Object.values(s).some((v) => v.trim()))
            .length || 0}
          개
        </span>
      </summary>
      <p className="meta">
        자료를 어디에서 읽었는지 아는 만큼 적어요. 주소는 안 적어도 되고, 빈칸이
        있어도 글을 올릴 수 있어요.
      </p>
      {sources.map((source, index) => (
        <div className="source-row" key={index}>
          <strong>출처 {index + 1}</strong>
          <div className="source-grid">
            {(
              [
                ["institution", "기관·만든 사람", "예: 국가유산청"],
                ["title", "자료 제목", "예: 수원 화성 소개"],
                ["date", "읽은 날짜", ""],
                ["url", "자료 주소 · 선택", "https://…"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label className="field" key={key}>
                {label}
                <input
                  aria-label={`출처 ${index + 1} ${label}`}
                  type={key === "date" ? "date" : "text"}
                  inputMode={key === "url" ? "url" : undefined}
                  value={source[key]}
                  maxLength={key === "url" ? 2000 : 180}
                  placeholder={placeholder}
                  onChange={(e) =>
                    onUpdate({
                      sources: sources.map((s, i) =>
                        i === index ? { ...s, [key]: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <Button
            variant="ghost"
            onClick={() =>
              onUpdate({ sources: sources.filter((_, i) => i !== index) })
            }
          >
            이 출처 지우기
          </Button>
        </div>
      ))}
      {sources.length < 3 && (
        <Button
          onClick={() => onUpdate({ sources: [...sources, emptySource()] })}
        >
          <Plus size={15} />
          출처 하나 더
        </Button>
      )}
    </details>
  );
}
