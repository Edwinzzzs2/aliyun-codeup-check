const FLOW_PIPELINE_URL_PATTERN = /^(?:https?:\/\/)?flow\.aliyun\.com\/pipelines\/([^/?#]+)/i;
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

export function normalizePipelineId(value) {
  const input = String(value ?? "").trim();
  if (!input) return "";

  const flowUrlMatch = input.match(FLOW_PIPELINE_URL_PATTERN);
  if (flowUrlMatch) {
    try {
      return decodeURIComponent(flowUrlMatch[1]).trim();
    } catch {
      return flowUrlMatch[1].trim();
    }
  }

  // 看起来是网址却不是云效 Flow 地址时返回空值，避免把整段错误网址当成流水线 ID。
  if (ABSOLUTE_URL_PATTERN.test(input)) return "";
  return input;
}
