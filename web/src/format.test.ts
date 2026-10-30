import { describe, expect, it } from 'vitest';
import { formatTime, parseGenderToken, parseTime, teamAutoName, uid } from './format';

describe('parseTime', () => {
  it('parses seconds.millis', () => {
    expect(parseTime('23.456')).toBe(23456);
  });
  it('parses minutes:seconds.millis', () => {
    expect(parseTime('0:23.456')).toBe(23456);
  });
  it('parses 1-digit millis in m:ss.s form', () => {
    expect(parseTime('1:02.5')).toBe(62500);
  });
  it('parses bare seconds as N*1000 ms', () => {
    expect(parseTime('23')).toBe(23000);
  });
  it('returns null for non-numeric text', () => {
    expect(parseTime('abc')).toBeNull();
  });
  it('returns null for empty/whitespace', () => {
    expect(parseTime('')).toBeNull();
    expect(parseTime('   ')).toBeNull();
  });
  it('formats ms back to M:SS.mmm', () => {
    expect(formatTime(23456)).toBe('0:23.456');
    expect(formatTime(62500)).toBe('1:02.500');
  });
});

describe('parseGenderToken', () => {
  it('recognizes male tokens', () => {
    for (const t of ['남', '남자', '남성', '男', 'M', 'm', 'male', 'MALE']) {
      expect(parseGenderToken(t)).toBe('M');
    }
  });
  it('recognizes female tokens', () => {
    for (const t of ['여', '여자', '여성', '女', 'F', 'f', 'female', 'FEMALE']) {
      expect(parseGenderToken(t)).toBe('F');
    }
  });
  it('trims whitespace', () => {
    expect(parseGenderToken('  남 ')).toBe('M');
    expect(parseGenderToken(' f\t')).toBe('F');
  });
  it('returns null for unknown tokens', () => {
    expect(parseGenderToken('')).toBeNull();
    expect(parseGenderToken('X')).toBeNull();
    expect(parseGenderToken('남여')).toBeNull();
  });
});

describe('helpers', () => {
  it('uid has a prefix', () => {
    const id = uid('a');
    expect(id.startsWith('a-')).toBe(true);
  });
  it('teamAutoName은 A-Z 이후 AA·AB로 이어져 이름이 겹치지 않는다', () => {
    expect(teamAutoName(0)).toBe('A팀');
    expect(teamAutoName(1)).toBe('B팀');
    expect(teamAutoName(25)).toBe('Z팀');
    // 27번째 팀부터 'A팀'이 다시 나오면 서로 다른 팀이 같은 이름이 된다.
    expect(teamAutoName(26)).toBe('AA팀');
    expect(teamAutoName(27)).toBe('AB팀');
  });
});
