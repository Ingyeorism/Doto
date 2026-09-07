# 도토 UI 이미지 시안 — 생성 프롬프트

기준 문서: `Doto_기획서.md` v1.0 (2026-09-05)

생성 방식: 내장 `image_gen` 도구. 실제 동작하는 앱이 아닌 UI 검토용 이미지입니다.

교사 보드는 같은 수업과 학생 글을 사용해 세 가지 시각 방향을 비교합니다. 이름과 글은 시안용 가상 데이터입니다.

## A · 따뜻한 도토리 / 교사 보드

파일: `01-warm-acorn-teacher.png`

```text
Use case: ui-mockup.
Create a high-fidelity, practical Korean classroom writing web app UI mockup for the product "도토" (Doto). It is a browser app for a teacher to read actual live student documents and give private feedback, with no login. Original tiny acorn brand mark beside "도토". All visible interface and document text must be correctly rendered Korean Hangul, crisp, professionally typeset. This is an actual flat app screen, edge-to-edge, no device bezel, no perspective, no scene props, no marketing captions outside the screen. Landscape, large high-resolution UI around 2400x1600, comfortable readable typography. It must look implementable, balanced and thoughtfully designed, with generous text area.
No AI features, scores, rankings, activity charts, progress meters, avatar photos, student surveillance, likes, reaction emojis, media attachments, login, pricing, oversized mascots, or network/server terminology. Do not turn student cards into statistics or empty wireframes. Real prose is essential. Restrained, clear line icons are welcome. All sample names and writings are fictitious.
Screen: teacher's live classroom board with an OPEN RIGHT DETAIL PANEL, while the class board remains visible to its left. Top bar shows acorn logo "도토", class title "우리 반 글쓰기", compact invite control "입장 코드 482 716", small "QR" control, "연결 28명", gear settings icon and quiet "수업 종료" button. A QR need not be drawn open.
Below, horizontal tabs "전체 글" (active) and "게시판"; a one-line class prompt banner with label "오늘의 글감" and content "마음에 오래 남은 하루를 써 보세요.", tiny "안내 수정" action. Board toolbar includes "학생 글", compact count "30명", "이름순", and card size control "작게 · 보통 · 크게", with "보통" selected.
Main left area about 68% of content width is a scrollable 3-column grid showing six student cards in two rows. Each card should show a name with small green connection dot, a full document title, substantial REAL text of at least 5-7 readable lines plus paragraph breaks, and tiny unobtrusive metadata "저장됨" and a short character count at bottom. Body text is dominant, not numbers or badges. Keep original basic paragraph formatting. No arbitrary student evaluation indicators. One card is selected with a clear restrained accent outline. Board has space to scroll to further rows.
Student card texts:
"김하늘" / "비 오는 날의 작은 친절" / "학교가 끝날 무렵 갑자기 비가 내렸다. 나는 우산을 가져오지 않아 현관 앞에 서 있었다.\n그때 지우가 다가와 우산을 함께 쓰자고 말했다. 집으로 가는 길은 조금 좁았지만, 마음은 이상하게 따뜻했다."
"이지우" / "할머니의 작은 정원" / "할머니 집 마당에는 작은 정원이 있다. 나는 주말마다 할머니와 함께 화분에 물을 준다.\n지난주에는 처음으로 꽃봉오리가 열렸다. 매일 조금씩 돌보면 작은 것도 멋지게 자란다는 것을 알았다."
"박서준" / "처음 만든 계란말이" / "일요일 아침에 아빠와 계란말이를 만들었다. 처음에는 모양이 자꾸 흐트러졌다.\n아빠는 천천히 해도 괜찮다고 말했다. 마지막 조각은 제법 예뻤다. 내가 만든 아침이라 더 맛있었다."
"최유나" / "운동장의 약속" / "쉬는 시간에 친구와 운동장을 걸었다. 우리는 다음 체육 시간에 같은 팀이 되기로 했다.\n친구와 이야기를 나누며 걷다 보니 종이 금방 울렸다. 평범한 하루에도 기억하고 싶은 순간이 있다."
"정도윤" / "도서관에서 찾은 모험" / "도서관 구석에서 낡은 책 한 권을 발견했다. 표지에는 작은 배가 그려져 있었다.\n책을 펼치자 바다를 여행하는 이야기가 시작되었다. 나는 한 시간 동안 의자에 앉아 먼 곳을 다녀왔다."
"한소은" / "창가의 새싹" / "창가에 놓인 화분에서 작은 싹이 나왔다. 며칠 동안 아무 변화가 없어 잊고 있었다.\n가까이 들여다보니 연두색 잎이 두 장 보였다. 기다리는 시간도 자라는 시간이라는 생각이 들었다."
Right detail panel 32% width, tall white reading surface: name "김하늘", tiny connected state, close X; clear toggle "직접 수정" visibly OFF, action "문장 표시". Document title "비 오는 날의 작은 친절", two paragraphs matching this student's board card but at larger readable font. Highlight only phrase "마음은 이상하게 따뜻했다." in soft yellow, visually distinct from ordinary underline. Below separator label "피드백", quote snippet matching highlighted phrase and teacher comment "그때 어떤 기분이었는지 한 문장 더 써 볼까요?". At bottom a compact composer with placeholder "하늘이에게 메시지 보내기" and button "보내기". The panel and body are sufficiently large to actually read. No comments from other students here.

Visual direction A: Warm acorn. Warm ivory background #F7F5EE, pure white document cards, muted forest green #315B45 for active controls, walnut brown tiny acorn icon, very subtle warm gray borders. Calm, welcoming, polished Korean classroom stationery feeling, not childish. Rounded rectangles around 14px, ample internal padding, almost no shadows. Korean sans-serif interface with elegant Korean serif document titles only; body text highly legible. Acorn identity expressed only in a tiny tasteful logo. Useful hierarchy and quiet warmth.
```

## B · 단정한 기록실 / 교사 보드

파일: `02-clear-teacher.png`

```text
Use case: ui-mockup.
Create a high-fidelity, practical Korean classroom writing web app UI mockup for the product "도토" (Doto). It is a browser app for a teacher to read actual live student documents and give private feedback, with no login. Original tiny acorn brand mark beside "도토". All visible interface and document text must be correctly rendered Korean Hangul, crisp, professionally typeset. This is an actual flat app screen, edge-to-edge, no device bezel, no perspective, no scene props, no marketing captions outside the screen. Landscape, large high-resolution UI around 2400x1600, comfortable readable typography. It must look implementable, balanced and thoughtfully designed, with generous text area.
No AI features, scores, rankings, activity charts, progress meters, avatar photos, student surveillance, likes, reaction emojis, media attachments, login, pricing, oversized mascots, or network/server terminology. Do not turn student cards into statistics or empty wireframes. Real prose is essential. Restrained, clear line icons are welcome. All sample names and writings are fictitious.
Screen: teacher's live classroom board with an OPEN RIGHT DETAIL PANEL, while the class board remains visible to its left. Top bar shows acorn logo "도토", class title "우리 반 글쓰기", compact invite control "입장 코드 482 716", small "QR" control, "연결 28명", gear settings icon and quiet "수업 종료" button. A QR need not be drawn open.
Below, horizontal tabs "전체 글" (active) and "게시판"; a one-line class prompt banner with label "오늘의 글감" and content "마음에 오래 남은 하루를 써 보세요.", tiny "안내 수정" action. Board toolbar includes "학생 글", compact count "30명", "이름순", and card size control "작게 · 보통 · 크게", with "보통" selected.
Main left area about 68% of content width is a scrollable 3-column grid showing six student cards in two rows. Each card should show a name with small green connection dot, a full document title, substantial REAL text of at least 5-7 readable lines plus paragraph breaks, and tiny unobtrusive metadata "저장됨" and a short character count at bottom. Body text is dominant, not numbers or badges. Keep original basic paragraph formatting. No arbitrary student evaluation indicators. One card is selected with a clear restrained accent outline. Board has space to scroll to further rows.
Student card texts:
"김하늘" / "비 오는 날의 작은 친절" / "학교가 끝날 무렵 갑자기 비가 내렸다. 나는 우산을 가져오지 않아 현관 앞에 서 있었다.\n그때 지우가 다가와 우산을 함께 쓰자고 말했다. 집으로 가는 길은 조금 좁았지만, 마음은 이상하게 따뜻했다."
"이지우" / "할머니의 작은 정원" / "할머니 집 마당에는 작은 정원이 있다. 나는 주말마다 할머니와 함께 화분에 물을 준다.\n지난주에는 처음으로 꽃봉오리가 열렸다. 매일 조금씩 돌보면 작은 것도 멋지게 자란다는 것을 알았다."
"박서준" / "처음 만든 계란말이" / "일요일 아침에 아빠와 계란말이를 만들었다. 처음에는 모양이 자꾸 흐트러졌다.\n아빠는 천천히 해도 괜찮다고 말했다. 마지막 조각은 제법 예뻤다. 내가 만든 아침이라 더 맛있었다."
"최유나" / "운동장의 약속" / "쉬는 시간에 친구와 운동장을 걸었다. 우리는 다음 체육 시간에 같은 팀이 되기로 했다.\n친구와 이야기를 나누며 걷다 보니 종이 금방 울렸다. 평범한 하루에도 기억하고 싶은 순간이 있다."
"정도윤" / "도서관에서 찾은 모험" / "도서관 구석에서 낡은 책 한 권을 발견했다. 표지에는 작은 배가 그려져 있었다.\n책을 펼치자 바다를 여행하는 이야기가 시작되었다. 나는 한 시간 동안 의자에 앉아 먼 곳을 다녀왔다."
"한소은" / "창가의 새싹" / "창가에 놓인 화분에서 작은 싹이 나왔다. 며칠 동안 아무 변화가 없어 잊고 있었다.\n가까이 들여다보니 연두색 잎이 두 장 보였다. 기다리는 시간도 자라는 시간이라는 생각이 들었다."
Right detail panel 32% width, tall white reading surface: name "김하늘", tiny connected state, close X; clear toggle "직접 수정" visibly OFF, action "문장 표시". Document title "비 오는 날의 작은 친절", two paragraphs matching this student's board card but at larger readable font. Highlight only phrase "마음은 이상하게 따뜻했다." in soft yellow, visually distinct from ordinary underline. Below separator label "피드백", quote snippet matching highlighted phrase and teacher comment "그때 어떤 기분이었는지 한 문장 더 써 볼까요?". At bottom a compact composer with placeholder "하늘이에게 메시지 보내기" and button "보내기". The panel and body are sufficiently large to actually read. No comments from other students here.

Visual direction B: Clear editorial workspace. Cool nearly white background #F3F5F8, white cards, charcoal typography #202932 and restrained deep blue #355F95 active accent. Thin precise borders, small corner radii around 5px, almost flat styling, strict aligned editorial grid, exceptionally crisp typography and compact top controls. Different visual feel from a cozy classroom: focused and professional but approachable to teachers. Slightly denser cards with more prose visible; no large sidebar. Small outlined acorn mark. Korean sans-serif interface and Korean serif prose, generous leading. Prioritize rapid reading of many student texts.
```

## C · 밝은 교실 / 교사 보드

파일: `03-bright-teacher.png`

```text
Use case: ui-mockup.
Create a high-fidelity, practical Korean classroom writing web app UI mockup for the product "도토" (Doto). It is a browser app for a teacher to read actual live student documents and give private feedback, with no login. Original tiny acorn brand mark beside "도토". All visible interface and document text must be correctly rendered Korean Hangul, crisp, professionally typeset. This is an actual flat app screen, edge-to-edge, no device bezel, no perspective, no scene props, no marketing captions outside the screen. Landscape, large high-resolution UI around 2400x1600, comfortable readable typography. It must look implementable, balanced and thoughtfully designed, with generous text area.
No AI features, scores, rankings, activity charts, progress meters, avatar photos, student surveillance, likes, reaction emojis, media attachments, login, pricing, oversized mascots, or network/server terminology. Do not turn student cards into statistics or empty wireframes. Real prose is essential. Restrained, clear line icons are welcome. All sample names and writings are fictitious.
Screen: teacher's live classroom board with an OPEN RIGHT DETAIL PANEL, while the class board remains visible to its left. Top bar shows acorn logo "도토", class title "우리 반 글쓰기", compact invite control "입장 코드 482 716", small "QR" control, "연결 28명", gear settings icon and quiet "수업 종료" button. A QR need not be drawn open.
Below, horizontal tabs "전체 글" (active) and "게시판"; a one-line class prompt banner with label "오늘의 글감" and content "마음에 오래 남은 하루를 써 보세요.", tiny "안내 수정" action. Board toolbar includes "학생 글", compact count "30명", "이름순", and card size control "작게 · 보통 · 크게", with "보통" selected.
Main left area about 68% of content width is a scrollable 3-column grid showing six student cards in two rows. Each card should show a name with small green connection dot, a full document title, substantial REAL text of at least 5-7 readable lines plus paragraph breaks, and tiny unobtrusive metadata "저장됨" and a short character count at bottom. Body text is dominant, not numbers or badges. Keep original basic paragraph formatting. No arbitrary student evaluation indicators. One card is selected with a clear restrained accent outline. Board has space to scroll to further rows.
Student card texts:
"김하늘" / "비 오는 날의 작은 친절" / "학교가 끝날 무렵 갑자기 비가 내렸다. 나는 우산을 가져오지 않아 현관 앞에 서 있었다.\n그때 지우가 다가와 우산을 함께 쓰자고 말했다. 집으로 가는 길은 조금 좁았지만, 마음은 이상하게 따뜻했다."
"이지우" / "할머니의 작은 정원" / "할머니 집 마당에는 작은 정원이 있다. 나는 주말마다 할머니와 함께 화분에 물을 준다.\n지난주에는 처음으로 꽃봉오리가 열렸다. 매일 조금씩 돌보면 작은 것도 멋지게 자란다는 것을 알았다."
"박서준" / "처음 만든 계란말이" / "일요일 아침에 아빠와 계란말이를 만들었다. 처음에는 모양이 자꾸 흐트러졌다.\n아빠는 천천히 해도 괜찮다고 말했다. 마지막 조각은 제법 예뻤다. 내가 만든 아침이라 더 맛있었다."
"최유나" / "운동장의 약속" / "쉬는 시간에 친구와 운동장을 걸었다. 우리는 다음 체육 시간에 같은 팀이 되기로 했다.\n친구와 이야기를 나누며 걷다 보니 종이 금방 울렸다. 평범한 하루에도 기억하고 싶은 순간이 있다."
"정도윤" / "도서관에서 찾은 모험" / "도서관 구석에서 낡은 책 한 권을 발견했다. 표지에는 작은 배가 그려져 있었다.\n책을 펼치자 바다를 여행하는 이야기가 시작되었다. 나는 한 시간 동안 의자에 앉아 먼 곳을 다녀왔다."
"한소은" / "창가의 새싹" / "창가에 놓인 화분에서 작은 싹이 나왔다. 며칠 동안 아무 변화가 없어 잊고 있었다.\n가까이 들여다보니 연두색 잎이 두 장 보였다. 기다리는 시간도 자라는 시간이라는 생각이 들었다."
Right detail panel 32% width, tall white reading surface: name "김하늘", tiny connected state, close X; clear toggle "직접 수정" visibly OFF, action "문장 표시". Document title "비 오는 날의 작은 친절", two paragraphs matching this student's board card but at larger readable font. Highlight only phrase "마음은 이상하게 따뜻했다." in soft yellow, visually distinct from ordinary underline. Below separator label "피드백", quote snippet matching highlighted phrase and teacher comment "그때 어떤 기분이었는지 한 문장 더 써 볼까요?". At bottom a compact composer with placeholder "하늘이에게 메시지 보내기" and button "보내기". The panel and body are sufficiently large to actually read. No comments from other students here.

Visual direction C: Bright friendly classroom. Off-white canvas #FAFAF6, white reading areas, gentle sage green #DCEAD8, pale butter yellow #FAEFC4 and muted peach #F7DED0 used ONLY as thin card header strips and small section accents, deep teal #2B665D controls, very readable charcoal body text. Large friendly 18px rounded card corners and tactile but very subtle shadows. Clear Korean rounded sans-serif headers, comfortable body sans-serif. Top tabs and key action controls have soft rounded shapes but remain compact. One tiny simple acorn icon, not a character illustration. Warm and inviting to younger children while preserving a useful dense multi-document teacher layout. Individual pastel accents must not suggest grades or status.
```
