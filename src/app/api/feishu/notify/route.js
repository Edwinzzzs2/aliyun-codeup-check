import { AutoMergeDB } from "../../../../../lib/database.supabase";
import { NextRequest, NextResponse } from "next/server";

// 发送飞书通知
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      type,
      taskName,
      status,
      message,
      mergeRequestId,
      mergeRequestUrl,
      repositoryName,
      sourceBranch,
      targetBranch,
      mergeTitle,
    } = body;

    // 获取飞书配置
    const config = await AutoMergeDB.getFeishuConfig();
    if (!config || !config.enabled) {
      return NextResponse.json({
        success: false,
        message: "飞书通知未启用或未配置",
      });
    }

    // 检查是否需要发送此类型的通知
    if (
      (status === "success" && !config.notify_on_success) ||
      (status === "failed" && !config.notify_on_failure)
    ) {
      return NextResponse.json({
        success: true,
        message: "根据配置跳过此类型通知",
      });
    }

    // 构建通知消息
    let notificationMessage;
    if (config.custom_message_template) {
      // 使用自定义模板
      notificationMessage = config.custom_message_template
        .replace("{taskName}", taskName || "未知任务")
        .replace("{status}", status === "success" ? "成功" : "失败")
        .replace("{message}", message || "")
        .replace("{mergeRequestId}", mergeRequestId || "")
        .replace("{mergeRequestUrl}", mergeRequestUrl || "")
        .replace("{repositoryName}", repositoryName || "")
        .replace("{sourceBranch}", sourceBranch || "")
        .replace("{targetBranch}", targetBranch || "")
        .replace("{mergeTitle}", mergeTitle || "");
    } else {
      // 使用默认模板
      const statusText = status === "success" ? "成功✅" : "失败❌";
      const title = `自动合并${statusText}`;

      notificationMessage = {
        msg_type: "interactive",
        card: {
          elements: [
            {
              tag: "div",
              text: {
                content: `**合并仓库:** ${repositoryName || "未知任务"}（任务名称：${taskName}）`,
                tag: "lark_md",
              },
            },
            {
              tag: "div",
              text: {
                content: `**合并分支:** ${sourceBranch || "未知"} → ${
                  targetBranch || "未知"
                }`,
                tag: "lark_md",
              },
            },
            {
              tag: "div",
              text: {
                content: `**合并信息:** ${message || "无"}`,
                tag: "lark_md",
              },
            },
          ],
          header: {
            title: {
              content: title,
              tag: "plain_text",
            },
            template: status === "success" ? "green" : "red",
          },
        },
      };

      // 添加按钮区域
      const actions = [
        {
          tag: "button",
          text: {
            content: "自动任务配置",
            tag: "plain_text",
          },
          type: "default",
          url: "https://www.decoffee.top/automerge",
        },
      ];

      // 如果有合并请求链接，添加查看合并请求按钮
      if (mergeRequestUrl) {
        actions.push({
          tag: "button",
          text: {
            content: "查看合并请求",
            tag: "plain_text",
          },
          type: "primary",
          url: mergeRequestUrl,
        });
      }

      notificationMessage.card.elements.push({
        tag: "action",
        actions: actions,
      });
    }

    // 发送到飞书
    const response = await fetch(config.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notificationMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`飞书API响应错误: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: "飞书通知发送成功",
      data: result,
    });
  } catch (error) {
    console.error("发送飞书通知错误:", error);
    return NextResponse.json(
      {
        success: false,
        message: "发送飞书通知失败",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
