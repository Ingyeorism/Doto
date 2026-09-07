export interface StudentDoc {
  id: number;
  studentId: number;
  groupId: string;
  createdAt: number;
  publishedAt?: number;
  manualOrder: number;
  anchors: FeedbackAnchor[];
  name: string;
  title: string;
  paragraphs: string[];
  html?: string;
  connected: boolean;
  updated: string;
  published: boolean;
  sources?: WritingSource[];
}

export interface WritingSource {
  institution: string;
  title: string;
  date: string;
  url: string;
}
export interface LessonResource {
  id: string;
  title: string;
  url: string;
  image?: string;
  caption?: string;
}
export interface HelpRequest {
  kind: "writing" | "move";
  docId?: number;
  targetGroupId?: string;
  note: string;
  createdAt: number;
}
export interface Participant {
  id: number;
  name: string;
  joinedAt: number;
  connected: boolean;
  help?: HelpRequest;
  messages?: TeacherMessage[];
}

export interface TeacherMessage {
  id: string;
  docId: number;
  sender: "teacher" | "student";
  text: string;
  createdAt: number;
  readAt?: number;
}

export interface FeedbackAnchor {
  relativeFrom?: string;
  relativeTo?: string;
  feedbackId: number;
  from: number;
  to: number;
  status: "active" | "deleted";
}
export interface FeedbackSelection {
  relativeFrom?: string;
  relativeTo?: string;
  from: number;
  to: number;
  quote: string;
}
export interface BoardGroup {
  id: string;
  title: string;
  description: string;
  questions?: string[];
  resources?: LessonResource[];
  collectSources?: boolean;
  autoExpand?: boolean;
}
export type PostSort = "oldest" | "newest" | "author" | "title" | "manual";
export interface BoardComment {
  id?: string;
  studentId?: number;
  name: string;
  text: string;
}
export const initialGroups: BoardGroup[] = [
  {
    id: "memory",
    title: "마음에 남은 하루",
    description: "오래 기억하고 싶은 하루를 들려주세요.",
  },
  {
    id: "discovery",
    title: "내가 발견한 작은 것",
    description: "평범한 일상에서 찾은 특별한 순간.",
  },
  {
    id: "challenge",
    title: "처음 해 본 일",
    description: "설레고 떨렸던 나의 첫 도전 이야기.",
  },
];

const stories = [
  [
    "김하늘",
    "비 오는 날의 작은 친절",
    "학교가 끝날 무렵 갑자기 비가 내렸다. 나는 우산을 가져오지 않아 현관 앞에 서 있었다.",
    "그때 지우가 다가와 우산을 함께 쓰자고 말했다. 집으로 가는 길은 조금 좁았지만, 마음은 이상하게 따뜻했다.",
    "빗방울이 우산 위를 두드리는 소리가 들렸다. 나는 지우에게 고맙다고 말했다. 다음에 비가 오면 내가 우산을 챙겨 와야겠다고 생각했다.",
  ],
  [
    "이지우",
    "할머니의 작은 정원",
    "할머니 집 마당에는 작은 정원이 있다. 나는 주말마다 할머니와 함께 화분에 물을 준다.",
    "지난주에는 처음으로 꽃봉오리가 열렸다. 매일 조금씩 돌보면 작은 것도 멋지게 자란다는 것을 알았다.",
    "할머니는 꽃이 피는 속도가 모두 다르다고 하셨다. 아직 피지 않은 화분에도 물을 골고루 주었다.",
  ],
  [
    "박서준",
    "처음 만든 계란말이",
    "일요일 아침에 아빠와 계란말이를 만들었다. 처음에는 모양이 자꾸 흐트러졌다.",
    "아빠는 천천히 해도 괜찮다고 말했다. 마지막 조각은 제법 예뻤다. 내가 만든 아침이라 더 맛있었다.",
    "다음 주에는 동생에게도 만들어 주기로 했다. 벌써 일요일 아침이 기다려진다.",
  ],
  [
    "최유나",
    "운동장의 약속",
    "쉬는 시간에 친구와 운동장을 걸었다. 우리는 다음 체육 시간에 같은 팀이 되기로 했다.",
    "친구와 이야기를 나누며 걷다 보니 종이 금방 울렸다. 평범한 하루에도 기억하고 싶은 순간이 있다.",
  ],
  [
    "정도윤",
    "도서관에서 찾은 모험",
    "도서관 구석에서 낡은 책 한 권을 발견했다. 표지에는 작은 배가 그려져 있었다.",
    "책을 펼치자 바다를 여행하는 이야기가 시작되었다. 나는 한 시간 동안 의자에 앉아 먼 곳을 다녀왔다.",
    "책장을 덮으니 창밖에 노을이 지고 있었다. 내일은 배가 어느 섬에 도착할지 궁금하다.",
  ],
  [
    "한소은",
    "창가의 새싹",
    "창가에 놓인 화분에서 작은 싹이 나왔다. 며칠 동안 아무 변화가 없어 잊고 있었다.",
    "가까이 들여다보니 연두색 잎이 두 장 보였다. 기다리는 시간도 자라는 시간이라는 생각이 들었다.",
  ],
  [
    "강민준",
    "조금 느려도 괜찮아",
    "자전거를 처음 배운 날, 운동장을 한 바퀴 도는 데 아주 오랜 시간이 걸렸다.",
    "아빠는 뒤에서 안장을 잡고 함께 걸었다. 혼자 달리고 있다는 걸 알았을 때, 바람 소리가 더 크게 들렸다.",
  ],
  [
    "오다은",
    "엄마에게 쓴 쪽지",
    "엄마가 좋아하는 머그컵 옆에 작은 쪽지를 놓았다. 무슨 말을 쓸까 한참 고민했다.",
    "결국 오늘도 고마워요, 하고 적었다. 저녁에 집에 돌아오니 내 책상에도 쪽지가 한 장 있었다.",
  ],
  [
    "김지호",
    "반가운 골목 고양이",
    "우리 집 앞 골목에는 노란 고양이가 산다. 멀리서 눈이 마주치면 늘 먼저 피하곤 했다.",
    "오늘은 내 옆으로 천천히 걸어왔다. 나는 움직이지 않고 기다렸다. 아주 조금 친구가 된 기분이었다.",
  ],
  [
    "윤서아",
    "우리만 아는 비밀 장소",
    "학교 뒤편 나무 아래에는 작은 벤치가 있다. 점심을 먹고 친구와 그곳에 앉았다.",
    "나뭇잎 사이로 들어오는 햇빛이 손등에 동그란 무늬를 만들었다. 아무 말 없이 앉아 있어도 좋았다.",
  ],
  [
    "임지안",
    "처음 해 본 심부름",
    "엄마가 두부 한 모를 사 와 달라고 하셨다. 지갑을 꼭 쥐고 동네 가게에 갔다.",
    "계산을 마치고 거스름돈을 두 번 세었다. 작은 봉투였지만 집에 돌아오는 발걸음은 제법 씩씩했다.",
  ],
  [
    "배현우",
    "저녁 하늘을 올려다보면",
    "학원에서 돌아오는 길에 하늘이 분홍색으로 물들어 있었다. 나는 잠시 걸음을 멈추었다.",
    "매일 같은 길을 걸어도 하늘은 조금씩 달랐다. 바쁜 날에도 한 번쯤 고개를 들어 봐야겠다.",
  ],
];

export const initialDocs: StudentDoc[] = stories.map(
  ([name, title, ...paragraphs], id) => ({
    id,
    studentId: id,
    groupId: [2, 6, 10].includes(id)
      ? "challenge"
      : [1, 4, 5, 8, 11].includes(id)
        ? "discovery"
        : "memory",
    createdAt: 1788566400000 + id * 60000,
    publishedAt: [1, 2, 4, 5, 7, 10].includes(id)
      ? 1788566400000 + id * 60000
      : undefined,
    manualOrder: id,
    anchors:
      id === 0
        ? [
            {
              feedbackId: 1,
              from:
                paragraphs[0].length +
                3 +
                paragraphs[1].indexOf("마음은 이상하게 따뜻했다."),
              to:
                paragraphs[0].length +
                3 +
                paragraphs[1].indexOf("마음은 이상하게 따뜻했다.") +
                "마음은 이상하게 따뜻했다.".length,
              status: "active",
            },
          ]
        : [],
    name,
    title,
    paragraphs,
    connected: id !== 9,
    updated: id === 9 ? "5분 전" : id % 3 === 0 ? "방금" : `${id + 1}분 전`,
    published: [1, 2, 4, 5, 7, 10].includes(id),
  }),
);

export interface Feedback {
  id: number;
  docId: number;
  studentId: number;
  quote?: string;
  message: string;
  response?: "read" | "revised" | "confirmed";
}
export const initialFeedback: Feedback[] = [
  {
    id: 1,
    docId: 0,
    studentId: 0,
    quote: "마음은 이상하게 따뜻했다.",
    message: "그때 어떤 기분이었는지 한 문장 더 써 볼까요?",
  },
  {
    id: 2,
    docId: 0,
    studentId: 0,
    message:
      "빗소리를 표현한 문장이 참 좋네요. 읽으면서 그날의 풍경이 떠올랐어요.",
  },
];
export const toHtml = (doc: StudentDoc) =>
  doc.html ??
  doc.paragraphs
    .map(
      (p) =>
        `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    )
    .join("");
export const charCount = (doc: StudentDoc) =>
  doc.paragraphs.join("").replace(/\s/g, "").length;
export type Screen =
  "start" | "join" | "teacher" | "board" | "student" | "write" | "history";
