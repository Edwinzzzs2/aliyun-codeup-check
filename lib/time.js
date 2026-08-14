'use strict';

const beijingTimestampFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function toBeijingTimestamp(input) {
  if (!input) return null;

  const parts = beijingTimestampFormatter.formatToParts(new Date(input));
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  // h23 应输出 00-23；仍兜底处理部分 Node/ICU 组合在午夜返回 24 的兼容性问题。
  const hour = value('hour') === '24' ? '00' : value('hour');

  return `${value('year')}-${value('month')}-${value('day')} ${hour}:${value('minute')}:${value('second')}`;
}

module.exports = { toBeijingTimestamp };
