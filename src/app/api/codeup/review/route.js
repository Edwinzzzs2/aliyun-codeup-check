import { NextResponse } from "next/server";
import { fetchCodeup, getRequestToken, validateRequiredParams } from "../utils.js";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      organization_id,
      repository_id,
      local_id,
      review_opinion = "PASS",
      review_comment = "",
    } = body || {};
    const token = getRequestToken(request);

    const requiredError = validateRequiredParams(
      { token, organization_id, repository_id, local_id },
      ["token", "organization_id", "repository_id", "local_id"]
    );
    if (requiredError) return requiredError;

    if (!["PASS", "NOT_PASS"].includes(review_opinion)) {
      return NextResponse.json(
        { error: "review_opinion 仅支持 PASS 或 NOT_PASS" },
        { status: 400 }
      );
    }

    const apiUrl = `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${encodeURIComponent(
      organization_id
    )}/repositories/${encodeURIComponent(
      repository_id
    )}/changeRequests/${encodeURIComponent(local_id)}/review`;
    const response = await fetchCodeup(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-yunxiao-token": token,
      },
      // 项目接口统一使用下划线字段，调用云效时再转换为其要求的驼峰字段。
      body: JSON.stringify({
        reviewOpinion: review_opinion,
        ...(review_comment ? { reviewComment: review_comment } : {}),
      }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok || data?.result === false) {
      return NextResponse.json(
        {
          error: "评审合并请求失败",
          details:
            data.errorDescription ||
            data.errorMessage ||
            data.message ||
            "当前用户可能不是评审人，或没有合并请求读写权限",
          errorCode: data.errorCode || data.code,
          requestId: data.requestId,
        },
        { status: response.ok ? 400 : response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "合并请求已通过",
      data,
    });
  } catch (error) {
    console.error("评审合并请求API错误:", error);
    return NextResponse.json(
      {
        error: "评审合并请求异常",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
