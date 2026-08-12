import { NextResponse } from 'next/server';
import { AutoMergeDB } from '../../../../lib/database.supabase';
import { getAuthorizationError, requireRepositoryRead } from '../../../../lib/codeup.authorization';

export async function GET(request) {
  try {
    await requireRepositoryRead(request);
    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page')) || 1, 1);
    const pageSize = Math.min(
      Math.max(parseInt(searchParams.get('pageSize')) || 20, 1),
      100
    );
    const offset = (page - 1) * pageSize;

    const [logs, totalCount] = await Promise.all([
      AutoMergeDB.getLogsByExecutionType('api_exception', pageSize, offset),
      AutoMergeDB.getLogsCountByExecutionType('api_exception'),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error('[异常日志 API] 查询失败:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json({
      success: false,
      message: authorizationError?.message || '查询异常日志失败',
    }, { status: authorizationError?.status || 500 });
  }
}
