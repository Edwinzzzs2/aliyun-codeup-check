export const PROTECTED_BRANCH_NAMES = [
  "prod",
  "prod-gray",
  "dev",
  "test",
  "staging",
];

const protectedBranchNameSet = new Set(PROTECTED_BRANCH_NAMES);

/**
 * 保护分支校验统一忽略大小写和首尾空格，供页面与删除接口共同使用。
 */
export function getProtectedBranchNames(branchNames = []) {
  return branchNames.filter((branchName) =>
    protectedBranchNameSet.has(String(branchName).trim().toLowerCase())
  );
}
