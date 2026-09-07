import type { BoardState } from "./board-state";

export const virtualStudents = [
  "김하늘",
  "이지우",
  "박서준",
  "최유나",
  "정도윤",
  "한소은",
];
export const simulationLessons = {
  review: {
    title: "우리 반이 권하는 책",
    prompt: "책 소개 한 문장 → 기억에 남는 장면과 이유 → 누구에게 권할지 써요.",
    groups: [
      {
        id: "recommend",
        title: "추천하고 싶은 책",
        description: "책 이름, 기억에 남는 장면, 추천하는 이유를 써요.",
      },
      {
        id: "different",
        title: "다른 생각이 든 책",
        description:
          "책을 읽고 아쉬웠던 점이나 다르게 생각한 점을 이유와 함께 써요.",
      },
    ],
  },
  heritage: {
    title: "우리 손으로 소개하는 국가유산",
    prompt:
      "이름·위치 → 새롭게 안 사실 두 가지 → 지켜야 하는 이유 → 자료 출처를 써요.",
    groups: [
      {
        id: "hwaseong",
        title: "수원 화성",
        description: "왜 만들었을까요? 쌓는 방법과 보존할 가치를 조사해요.",
      },
      {
        id: "cheomseongdae",
        title: "경주 첨성대",
        description:
          "어디에 있고 어떤 일을 했을까요? 근거를 찾아 내 말로 써요.",
      },
    ],
  },
};
export type SimulationLesson = keyof typeof simulationLessons;
export function simulationSeed(
  lesson: string,
  fallback: BoardState,
): BoardState {
  if (!(lesson in simulationLessons)) return fallback;
  const info = simulationLessons[lesson as SimulationLesson];
  return {
    participants: virtualStudents.map((name, id) => ({
      id,
      name,
      joinedAt: Date.now(),
      connected: true,
    })),
    title: info.title,
    groups: info.groups,
    docs: [],
    posts: [],
    feedback: [],
    comments: {},
    trash: [],
    sort: "oldest",
  };
}
