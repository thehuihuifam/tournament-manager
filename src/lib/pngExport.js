/**
 * 브래킷 PNG 저장 (외부 라이브러리 없이 Canvas 2D 직접 렌더링, 2x 해상도)
 *
 * 코드 III 반영 수치: 카드 224×64, 열 간격 288, 행 높이 96,
 * 선수명 16px, 연결선 2px #94a3b8, 타임스탬프 #64748b.
 * 구형 브라우저 대응으로 roundRect 폴백을 포함한다 (E3).
 */

const CARD_W = 224;
const CARD_H = 64;
const COL_STEP = 288;
const ROW_H = 96;
const GAP = 64;

/** roundRect 미지원 브라우저용 폴백 */
function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function roundName(totalRounds, roundIndex) {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return '결승';
  if (remaining === 2) return '준결승 (4강)';
  return `${Math.pow(2, remaining)}강`;
}

/**
 * @param rounds buildRounds 결과
 * @param title 이미지 상단 제목
 */
export function exportBracketPng(rounds, title = '토너먼트 브래킷') {
  const totalRounds = rounds.length;
  const firstRoundMatches = rounds[0].length;
  const width = 80 + totalRounds * CARD_W + (totalRounds - 1) * GAP + 260;
  const height = 190 + firstRoundMatches * ROW_H;

  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(scale, scale);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 제목 + 일시
  ctx.fillStyle = '#1e3a8a';
  ctx.font = "bold 30px 'Noto Sans KR', sans-serif";
  ctx.fillText(title, 40, 46);
  ctx.fillStyle = '#64748b';
  ctx.font = "14px 'Noto Sans KR', sans-serif";
  ctx.fillText(new Date().toLocaleString('ko-KR'), 40, 68);

  const colX = (w) => 40 + w * COL_STEP;
  const rowY = (w, k) => 140 + (k + 0.5) * ROW_H * Math.pow(2, w);

  // 라운드 헤더
  ctx.font = "bold 16px 'Noto Sans KR', sans-serif";
  rounds.forEach((matches, w) => {
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText(roundName(totalRounds, w), colX(w) + CARD_W / 2, 100);
    ctx.textAlign = 'left';
  });

  // 연결선 (엘보우 커넥터)
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  for (let w = 0; w < totalRounds - 1; w++) {
    rounds[w].forEach((match, k) => {
      const x1 = colX(w) + CARD_W;
      const y1 = rowY(w, k);
      const x2 = colX(w + 1);
      const y2 = rowY(w + 1, Math.floor(k / 2));
      const midX = x1 + GAP / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(midX, y1);
      ctx.lineTo(midX, y2);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
  }

  const cellText = (player, pending) =>
    pending ? '미정' : player ? `${player.name} (${player.no})` : 'BYE';

  // 매치 카드
  rounds.forEach((matches, w) => {
    matches.forEach((match, k) => {
      const x = colX(w);
      const y = rowY(w, k) - CARD_H / 2;
      if (!match.p1 && !match.p2 && !match.p1Pending && !match.p2Pending) return;

      ctx.fillStyle = match.winner ? '#ecfdf5' : '#ffffff';
      ctx.strokeStyle = match.winner ? '#6ee7b7' : '#e2e8f0';
      ctx.lineWidth = 2;
      roundRectPath(ctx, x, y, CARD_W, CARD_H, 10);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y + CARD_H / 2);
      ctx.lineTo(x + CARD_W, y + CARD_H / 2);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();

      [
        [match.p1, match.p1Pending],
        [match.p2, match.p2Pending],
      ].forEach(([player, pending], row) => {
        const isWinner =
          !!match.winner && !!player && match.winner.id === player.id;
        ctx.font = `${isWinner ? 'bold ' : ''}16px 'Noto Sans KR', sans-serif`;
        ctx.fillStyle = isWinner ? '#1d4ed8' : player ? '#334155' : '#64748b';
        ctx.fillText(cellText(player, pending), x + 12, y + 22 + (row * CARD_H) / 2);
      });
    });
  });

  // 우승 트로피 박스
  const champion = rounds[totalRounds - 1][0].winner;
  if (champion) {
    const x = colX(totalRounds - 1) + CARD_W + GAP;
    const y = rowY(totalRounds - 1, 0) - 36;
    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, 200, 72, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b45309';
    ctx.font = "bold 20px 'Noto Sans KR', sans-serif";
    ctx.fillText(`🏆 ${champion.name}`, x + 16, y + 45);
  }

  const link = document.createElement('a');
  link.download = `bracket_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
