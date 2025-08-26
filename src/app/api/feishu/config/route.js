import { AutoMergeDB } from '../../../../../lib/database.supabase';
import { NextRequest, NextResponse } from 'next/server';

// 获取飞书通知配置
export async function GET(request) {
  try {
    const config = await AutoMergeDB.getFeishuConfig();
    return NextResponse.json({ 
      success: true, 
      data: config || {
        webhook_url: '',
        enabled: true,
        notify_on_success: true,
        notify_on_failure: true,
        custom_message_template: null
      }
    });
  } catch (error) {
    console.error('获取飞书配置错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}

// 创建或更新飞书通知配置
export async function POST(request) {
  try {
    const body = await request.json();
    
    // 验证必填字段
    if (!body.webhook_url) {
      return NextResponse.json({
        success: false,
        message: 'Webhook URL 是必填字段'
      }, { status: 400 });
    }

    // 验证 Webhook URL 格式
    try {
      new URL(body.webhook_url);
    } catch {
      return NextResponse.json({
        success: false,
        message: 'Webhook URL 格式不正确'
      }, { status: 400 });
    }

    const config = await AutoMergeDB.createOrUpdateFeishuConfig({
      webhook_url: body.webhook_url,
      enabled: body.enabled,
      notify_on_success: body.notify_on_success,
      notify_on_failure: body.notify_on_failure,
      custom_message_template: body.custom_message_template
    });

    return NextResponse.json({ 
      success: true, 
      data: config,
      message: '飞书通知配置保存成功'
    });
  } catch (error) {
    console.error('保存飞书配置错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}

// 删除飞书通知配置
export async function DELETE(request) {
  try {
    await AutoMergeDB.deleteFeishuConfig();
    return NextResponse.json({ 
      success: true, 
      message: '飞书通知配置删除成功'
    });
  } catch (error) {
    console.error('删除飞书配置错误:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误',
      error: error.message 
    }, { status: 500 });
  }
}