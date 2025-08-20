// 批量检测合并状态 - POST方法
export async function POST(request) {
  try {
    const body = await request.json();
    const { token, orgId, repoId, target, branches } = body;

    // 验证必填参数
    if (!token || !orgId || !repoId || !target) {
      return new Response(
        JSON.stringify({ 
          error: '缺少必填参数: token, orgId, repoId, target',
          errorDescription: '缺少必填参数',
          errorMessage: '请提供token、orgId、repoId和target参数',
          details: '缺少必填参数: token, orgId, repoId, target'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(branches) || branches.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'branches 必须是非空数组',
          errorDescription: '分支参数格式错误',
          errorMessage: 'branches参数必须是包含至少一个分支的数组',
          details: 'branches 必须是非空数组'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 计算3个月前的日期
    const now = new Date();
    const threeMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    const since = new Date(Date.UTC(
      threeMonthsAgoDate.getFullYear(),
      threeMonthsAgoDate.getMonth(),
      threeMonthsAgoDate.getDate(),
      0, 0, 0
    )).toISOString().replace(/\.\d{3}Z$/, 'Z');

    // 收集所有要检查的 commitId
    const sourceCommitIds = branches.map(branch => branch.commitId).filter(Boolean);
    if (sourceCommitIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: '没有找到有效的 commitId',
          errorDescription: '分支数据无效',
          errorMessage: '所有分支都缺少有效的commitId',
          details: '没有找到有效的 commitId'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 分页拉取目标分支最近3个月的提交
    let allTargetCommits = [];
    let page = 1;
    const perPage = 100;

    while (page <= 20) { // 最多 20 页
      const res = await fetch(
        `https://openapi-rdc.aliyuncs.com/oapi/v1/codeup/organizations/${orgId}/repositories/${repoId}/commits?refName=${encodeURIComponent(target)}&since=${encodeURIComponent(since)}&page=${page}&perPage=${perPage}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-yunxiao-token': token,
          },
        }
      );

      if (!res.ok) {
        return new Response(
          JSON.stringify({ 
            error: '获取目标分支提交记录失败',
            errorDescription: '无法获取目标分支的提交记录',
            errorMessage: '调用阿里云API获取提交记录时失败',
            details: '获取目标分支提交记录失败'
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      if (list.length === 0) break;
      
      allTargetCommits = allTargetCommits.concat(list);
      
      if (list.length < perPage) break; // 没有更多页
      page += 1;
    }

    // 创建目标分支提交ID的Set用于快速查找
    const targetCommitIdSet = new Set(allTargetCommits.map(commit => commit.id));

    // 批量检查每个分支的合并状态
    const results = branches.map(branch => {
      const isMerged = targetCommitIdSet.has(branch.commitId);
      return {
        branchName: branch.name,
        commitId: branch.commitId,
        merged: isMerged,
        status: isMerged ? 'merged' : 'not_merged'
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        target,
        checkedPeriod: '最近3个月',
        totalTargetCommits: allTargetCommits.length,
        results
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ 
        error: '批量检测异常', 
        errorDescription: '批量检测合并状态时发生异常',
        errorMessage: e.message,
        details: e.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}