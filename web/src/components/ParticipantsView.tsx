import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useConfirm } from '../uic';
import { Athlete, Gender } from '../types';
import { cls, parseGenderToken, uid } from '../format';

interface ImportReport {
  added: number;
  skipped: number;
  defaulted: number;
  errors: { line: number; text: string; reason: string }[];
}

export function ParticipantsView() {
  const { state, dispatch } = useStore();
  const { askConfirm } = useConfirm();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('M');
  const [bulk, setBulk] = useState('');
  const [bulkMode, setBulkMode] = useState<'replace' | 'append'>('replace');
  const [report, setReport] = useState<ImportReport | null>(null);

  const lockedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ev of state.events) {
      if (!ev.matches) continue;
      for (const m of ev.matches) {
        for (const tid of [m.a, m.b]) {
          if (!tid) continue;
          if (tid.startsWith('ind-')) ids.add(tid.slice(4));
          else for (const mem of ev.teams.find((t) => t.id === tid)?.members ?? []) ids.add(mem);
        }
      }
    }
    return ids;
  }, [state.events]);

  const addOne = () => {
    if (!name.trim()) return;
    dispatch({ type: 'athlete/add', name, gender });
    setName('');
  };

  const doImport = () => {
    const lines = bulk.split(/\r?\n/);
    const list: Athlete[] = [];
    const errors: ImportReport['errors'] = [];
    let defaulted = 0;
    let skipped = 0;
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      // 헤더 행 자동 스킵
      if (i === 0 && /이름/.test(line) && /성별/.test(line)) {
        skipped++;
        return;
      }
      const parts = line.split(/[\t,;]+|\s{1,}/).filter(Boolean);
      let noIdx: number | null = null;
      let nameTok = '';
      let genderTok = '';
      if (parts.length >= 3) {
        if (/^\d+$/.test(parts[0])) {
          noIdx = 0;
          nameTok = parts[1];
          genderTok = parts.slice(2).join(' ');
        } else {
          nameTok = parts.slice(0, parts.length - 1).join(' ');
          genderTok = parts[parts.length - 1];
        }
      } else if (parts.length === 2) {
        const g = parseGenderToken(parts[1]);
        if (g) {
          nameTok = parts[0];
          genderTok = parts[1];
        } else {
          nameTok = parts.join(' ');
        }
      } else {
        nameTok = parts[0] ?? '';
      }
      const nm = nameTok.trim();
      if (!nm) {
        errors.push({ line: i + 1, text: raw, reason: '이름을 읽을 수 없습니다' });
        return;
      }
      let g = parseGenderToken(genderTok);
      if (!g) {
        g = 'M';
        defaulted++;
      }
      list.push({
        id: uid('a'),
        no: noIdx != null ? parseInt(parts[noIdx], 10) : 0,
        name: nm,
        gender: g,
      });
    });
    if (list.length > 0) {
      const maxNo = state.athletes.reduce((mx, x) => Math.max(mx, x.no), 0);
      dispatch({
        type: 'athlete/import',
        list: list.map((a, i) => ({ ...a, no: a.no > 0 ? 0 : maxNo + 1 + i })),
        mode: bulkMode,
      });
    }
    setReport({ added: list.length, skipped, defaulted, errors });
    if (list.length > 0) setBulk('');
  };

  const removeAthlete = (a: Athlete) => {
    if (lockedIds.has(a.id)) {
      askConfirm({
        title: '삭제할 수 없음',
        message: `"${a.name}"은(는) 대진이 생성된 종목에 진출해 있어서 삭제할 수 없습니다. 해당 종목의 대진을 초기화한 뒤 삭제하세요.`,
        confirmLabel: '확인',
        onConfirm: () => {},
      });
      return;
    }
    askConfirm({
      title: '참가자 삭제',
      message: `"${a.name}"을(를) 명단에서 삭제할까요? (더블 팀에서 함께 빠집니다)`,
      danger: true,
      confirmLabel: '참가자 삭제',
      onConfirm: () => dispatch({ type: 'athlete/remove', id: a.id }),
    });
  };

  const resetAll = () =>
    askConfirm({
      title: '전체 데이터 초기화',
      message: '참가자 명단, 모든 종목의 팀·대진·결과를 모두 삭제합니다. 되돌릴 수 없습니다.',
      danger: true,
      confirmLabel: '모든 데이터 삭제',
      onConfirm: () => dispatch({ type: 'reset/all' }),
    });

  return (
    <div className="part-grid">
      <section className="panel">
        <h2 className="panel-title">✍️ 개별 등록</h2>
        <div className="add-row">
          <input
            className="input"
            placeholder="이름 (예: 김수연)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addOne()}
          />
          <div className="seg" role="radiogroup" aria-label="성별">
            <button
              className={cls('seg-btn', gender === 'M' && 'active')}
              onClick={() => setGender('M')}
              aria-pressed={gender === 'M'}
            >
              🔵 남자
            </button>
            <button
              className={cls('seg-btn', gender === 'F' && 'active')}
              onClick={() => setGender('F')}
              aria-pressed={gender === 'F'}
            >
              🔴 여자
            </button>
          </div>
          <button className="btn primary" onClick={addOne}>
            ＋ 등록
          </button>
        </div>

        <h2 className="panel-title mt">📋 일괄 붙여넣기</h2>
        <p className="hint">
          한글 마당 대회 명단처럼 붙여넣으면 됩니다. 한 줄당 <b>번호(선택) · 이름 · 성별</b> (탭/공백/쉼표
          구분). 헤더 행은 자동 건너뜁니다.
        </p>
        <textarea
          className="textarea"
          placeholder={'번호\t이름\t성별\n1\t김수연\t여\n2\t박지훈\t남\n3\t최유진\t여'}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={7}
        />
        <div className="add-row">
          <div className="seg" role="radiogroup" aria-label="가져오기 방식">
            <button
              className={cls('seg-btn', bulkMode === 'replace' && 'active')}
              onClick={() => setBulkMode('replace')}
            >
              덮어쓰기
            </button>
            <button
              className={cls('seg-btn', bulkMode === 'append' && 'active')}
              onClick={() => setBulkMode('append')}
            >
              기존에 추가
            </button>
          </div>
          <button className="btn primary" onClick={doImport} disabled={!bulk.trim()} title="입력한 명단을 참가자 목록에 추가합니다" aria-label="입력한 명단을 참가자 목록에 추가합니다">
            ✅ 명단에 추가
          </button>
        </div>
        {report && (
          <div className="import-report">
            <b>가져오기 완료</b> · {report.added}명 등록
            {report.skipped > 0 && ` · 헤더 ${report.skipped}행 스킵`}
            {report.defaulted > 0 && (
              <span className="warn"> · 성별 누락 {report.defaulted}행 → 남자 기본값 (배지로 수정 가능)</span>
            )}
            {report.errors.length > 0 && (
              <span className="err"> · ⚠️ {report.errors.length}개 행 오류</span>
            )}
            {report.errors.slice(0, 5).map((e) => (
              <div key={e.line} className="import-err">
                {e.line}행: “{e.text}” — {e.reason}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="roster-head">
          <h2 className="panel-title">👥 참가자 명단</h2>
          <span className="chip">
            {state.athletes.length}명 · <b>🔵{state.athletes.filter((a) => a.gender === 'M').length}</b> ·{' '}
            <b>🔴{state.athletes.filter((a) => a.gender === 'F').length}</b>
          </span>
        </div>
        {state.athletes.length === 0 ? (
          <div className="empty">
            아직 등록된 참가자가 없습니다.
            <br />
            왼쪽에서 개별 등록 또는 일괄 붙여넣기로 추가하세요.
          </div>
        ) : (
          <ul className="roster">
            {state.athletes.map((a, i) => (
              <li key={a.id} className={cls('roster-row', lockedIds.has(a.id) && 'locked')}>
                <span className="roster-no">{a.no}</span>
                <input
                  className="roster-name"
                  value={a.name}
                  disabled={lockedIds.has(a.id)}
                  onChange={(e) =>
                    dispatch({ type: 'athlete/update', id: a.id, name: e.target.value })
                  }
                  aria-label="이름"
                />
                <button
                  className={cls('g-badge', a.gender === 'M' ? 'g-m' : 'g-f')}
                  disabled={lockedIds.has(a.id)}
                  onClick={() =>
                    dispatch({
                      type: 'athlete/update',
                      id: a.id,
                      gender: a.gender === 'M' ? 'F' : 'M',
                    })
                  }
                  title="클릭해서 성별 변경"
                  aria-label={`${a.name} 성별 ${a.gender === 'M' ? '남자' : '여자'}, 클릭하여 변경`}
                >
                  {a.gender === 'M' ? '🔵 남자' : '🔴 여자'}
                </button>
                <span className="roster-move">
                  <button disabled={i === 0 || lockedIds.has(a.id)} onClick={() => dispatch({ type: 'athlete/move', id: a.id, dir: -1 })} title="위로">
                    ↑
                  </button>
                  <button
                    disabled={i === state.athletes.length - 1 || lockedIds.has(a.id)}
                    onClick={() => dispatch({ type: 'athlete/move', id: a.id, dir: 1 })}
                    title="아래로"
                  >
                    ↓
                  </button>
                </span>
                <button className="roster-del" onClick={() => removeAthlete(a)} title="삭제">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint mt">
          <b>참가번호 순서가 개인전 시드 순서가 됩니다.</b> 대진이 생성된 종목의 참가자는 잠금(🔒)됩니다.
        </p>
        <div className="part-footer">
          <span className="save-note">💾 이 브라우저에 자동 저장 중 — 새로고침해도 유지되지만, 다른 PC·브라우저·시크릿 창에서는 보이지 않습니다. 미리 💾 내보내기로 백업해 두세요.</span>
          <button className="btn ghost-danger" onClick={resetAll}>
            🔄 처음부터 다시
          </button>
        </div>
      </section>
    </div>
  );
}
