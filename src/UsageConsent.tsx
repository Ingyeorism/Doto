import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Modal } from "./ui";
import { USAGE_TERMS_VERSION } from "./usage-consent";
import "./usage-consent.css";

export function UsageTermsLink({
  label = "이용약관 · 개인정보 안내",
}: {
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open && wasOpen.current)
      trigger.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="usage-terms-link"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <Modal title="이용약관 · 개인정보 안내" onClose={() => setOpen(false)}>
          <div className="usage-terms-content">
            <p className="usage-terms-intro">
              우리 반이 함께 쓰는 도토, 이것만 알아 주세요.
            </p>
            <section>
              <h3>서로의 글과 마음을 존중해요</h3>
              <p>
                도토는 글쓰기와 피드백을 위한 교실 공간이에요. 다른 사람의 글을
                허락 없이 퍼 나르거나, 연락처·주소 같은 사적인 정보를 올리지
                말아 주세요. 입장 코드는 우리 반에서만 나눠요.
              </p>
            </section>
            <section>
              <h3>수업에 필요한 정보를 사용해요</h3>
              <p>
                이름 또는 별명, 작성한 글·댓글·피드백·메시지, 접속·재입장 정보를
                수업 참여, 글 저장, 피드백과 연결 유지에 사용해요. 실명 대신
                선생님이 알아볼 수 있는 별명을 써도 좋아요.
              </p>
            </section>
            <section>
              <h3>공유 범위는 이렇게 달라요</h3>
              <p>
                작성 중인 글과 개인 피드백·메시지는 작성 학생과 수업에 연결된
                선생님이 볼 수 있어요. 게시한 글과 이름·댓글은 같은 방의
                참여자에게 보여요.
              </p>
            </section>
            <section>
              <h3>글은 사용한 기기에 남아요</h3>
              <p>
                수업을 연 기기와 교사 기기에는 수업 사본이, 학생 기기에는 본인
                글과 전달받은 수업 자료가 브라우저 데이터 삭제 전까지 남아요.
                수업을 마쳐도 자동으로 지워지지 않으며, 내보낸 파일은 따로
                관리해야 해요.
              </p>
              <p>
                중앙 서버는 글 본문을 저장하지 않아요. 이름·방 정보·접속 신호는
                연결을 위해 임시 처리하고 방 정리 시 삭제해요. 서비스 접속 시
                연결 상태·오류 코드 등의 진단 기록을 남기며, 이름·글 본문·입장
                코드는 이 기록에 넣지 않아요. 진단 기록은 서버의 용량 한도에
                따라 오래된 순서로 교체돼요.
              </p>
            </section>
            <section>
              <h3>동의하지 않거나 삭제하고 싶다면</h3>
              <p>
                동의하지 않으면 방을 만들거나 입장하지 않고 안내만 볼 수 있어요.
                수업 자료의 삭제나 동의 철회는 수업을 연 선생님에게, 서버 기록은
                도토 운영자에게 요청해 주세요. 이 기기의 저장 정보는 브라우저의
                사이트 데이터 삭제로 지울 수 있어요.
              </p>
              <p>
                버튼으로 동의한 안내 버전·시각·동작은 이 브라우저에 최근 기록
                하나만 저장해요.
              </p>
            </section>
            <p className="usage-terms-school-note">
              선생님께: 만 14세 미만 학생의 개인정보 처리에 동의가 필요한 경우,
              수업 전에 법정대리인 동의와 학교의 절차를 확인해 주세요. 이 버튼
              동의가 그 절차를 대신하지는 않아요.
            </p>
            <div className="usage-terms-end">
              <small>안내 버전 {USAGE_TERMS_VERSION}</small>
              <Button onClick={() => setOpen(false)}>돌아가기</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function UsageConsentNotice({
  id,
  action,
}: {
  id: string;
  action: string;
}) {
  return (
    <div className="usage-consent-notice">
      <ShieldCheck size={18} aria-hidden="true" />
      <div>
        <p id={id}>
          <strong>{action}</strong> 버튼을 누르면 이용약관과 개인정보
          수집·이용에 동의해요.
        </p>
        <p className="usage-consent-summary">
          이름·별명과 글은 수업·피드백에 사용하고, 참여 기기에 보관해요.
        </p>
        <UsageTermsLink label="자세히 읽기" />
      </div>
    </div>
  );
}
