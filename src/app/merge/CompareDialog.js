import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
  Paper,
  IconButton,
  Tabs,
  Tab,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
} from "@mui/icons-material";

const CompareDialog = ({
  open,
  onClose,
  sourceBranch,
  targetBranch,
  token,
  orgId,
  repoId,
}) => {
  const [loading, setLoading] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0); // 0: 文件变更, 1: 提交记录

  // 当弹窗打开且有必要参数时，获取对比数据
  useEffect(() => {
    if (open && sourceBranch && targetBranch && token && orgId && repoId) {
      fetchCompareData();
    }
  }, [open, sourceBranch, targetBranch, token, orgId, repoId]);

  const fetchCompareData = async () => {
    setLoading(true);
    setError(null);
    setCompareData(null);

    try {
      const response = await fetch("/api/codeup/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          orgId,
          repoId,
          from: targetBranch?.name || targetBranch,
          to: sourceBranch?.name || sourceBranch,
          sourceType: "branch",
          targetType: "branch",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "获取对比数据失败");
      }

      setCompareData(result);
    } catch (err) {
      console.error("获取对比数据失败:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCompareData(null);
    setError(null);
    setActiveTab(0); // 重置为默认tab
    onClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "未知时间";
    return new Date(dateString).toLocaleString("zh-CN");
  };

  const renderCommitList = (commits) => {
    if (!commits || commits.length === 0) {
      return (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "center", py: 2 }}
        >
          没有提交记录
        </Typography>
      );
    }

    return (
      <Box>
        {commits.map((commit, index) => {
          // 获取完整的提交消息，按行分割
          const fullMessage = commit.message || commit.title || "无提交信息";
          const messageLines = fullMessage.split("\n").filter(line => line.trim());
          
          return (
            <Paper
              key={commit.id || index}
              sx={{ p: 1.5, mb: 1, bgcolor: "grey.50", borderRadius: 2 }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  mb: 1,
                }}
              >
                <Box sx={{ flex: 1, mr: 2 }}>
                  {/* 每行提交内容单独显示 */}
                  {messageLines.map((line, lineIndex) => (
                    <Typography
                      key={lineIndex}
                      variant="body2"
                      sx={{ 
                        fontWeight: lineIndex === 0 ? 600 : 400,
                        fontSize: "0.875rem",
                        mb: lineIndex === messageLines.length - 1 ? 0 : 0.5,
                        color: lineIndex === 0 ? "text.primary" : "text.secondary"
                      }}
                    >
                      {line}
                    </Typography>
                  ))}
                </Box>
                <Chip
                  label={commit.shortId || commit.id?.substring(0, 8)}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: "0.75rem", height: 20, flexShrink: 0 }}
                />
              </Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 1,
                }}
              >
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.75rem" }}
                  >
                    {commit.authorName} • {formatDate(commit.authoredDate)}
                  </Typography>
                </Box>
                {commit.stats && (
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Chip
                      icon={<AddIcon sx={{ fontSize: "0.75rem" }} />}
                      label={commit.stats.additions}
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ fontSize: "0.7rem", height: 18 }}
                    />
                    <Chip
                      icon={<RemoveIcon sx={{ fontSize: "0.75rem" }} />}
                      label={commit.stats.deletions}
                      size="small"
                      color="error"
                      variant="outlined"
                      sx={{ fontSize: "0.7rem", height: 18 }}
                    />
                  </Box>
                )}
              </Box>
            </Paper>
          );
        })}
      </Box>
    );
  };

  const renderFileDiffs = (diffs) => {
    if (!diffs || diffs.length === 0) {
      return (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "center", py: 2 }}
        >
          没有文件变更
        </Typography>
      );
    }

    return (
      <Box>
        {diffs.map((diff, index) => (
          <Accordion
            key={index}
            sx={{ mb: 1, "&:before": { display: "none" } }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ fontSize: "1.2rem" }} />}
              sx={{ minHeight: 40, "&.Mui-expanded": { minHeight: 40 } }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  width: "100%",
                  py: 0.5,
                }}
              >
                <EditIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
                <Typography
                  variant="body2"
                  sx={{ flex: 1, fontSize: "0.875rem", fontWeight: 500 }}
                >
                  {diff.newPath || diff.oldPath || "未知文件"}
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {diff.newFile && (
                    <Chip
                      label="新增"
                      size="small"
                      color="success"
                      sx={{ fontSize: "0.7rem", height: 18 }}
                    />
                  )}
                  {diff.deletedFile && (
                    <Chip
                      label="删除"
                      size="small"
                      color="error"
                      sx={{ fontSize: "0.7rem", height: 18 }}
                    />
                  )}
                  {diff.renamedFile && (
                    <Chip
                      label="重命名"
                      size="small"
                      color="info"
                      sx={{ fontSize: "0.7rem", height: 18 }}
                    />
                  )}
                  {diff.isBinary && (
                    <Chip
                      label="二进制"
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: "0.7rem", height: 18 }}
                    />
                  )}
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              {diff.diff ? (
                <Box
                  sx={{
                    fontSize: "0.7rem",
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    bgcolor: "#f8f9fa",
                    borderRadius: 1,
                    overflow: "auto",
                    maxHeight: "250px",
                    border: "1px solid #e0e0e0",
                    lineHeight: 1.4,
                  }}
                >
                  {/* 按行处理差异内容，添加背景色 */}
                  {diff.diff.split('\n').map((line, lineIndex) => {
                    let bgColor = 'transparent';
                    let textColor = 'inherit';
                    let borderLeft = 'none';
                    
                    // 根据行首字符判断类型并设置样式
                    if (line.startsWith('+')) {
                      bgColor = '#e6ffed'; // 浅绿色背景
                      textColor = '#28a745'; // 绿色文字
                      borderLeft = '3px solid #28a745';
                    } else if (line.startsWith('-')) {
                      bgColor = '#ffeef0'; // 浅红色背景
                      textColor = '#dc3545'; // 红色文字
                      borderLeft = '3px solid #dc3545';
                    } else if (line.startsWith('@@')) {
                      bgColor = '#f1f8ff'; // 浅蓝色背景
                      textColor = '#0366d6'; // 蓝色文字
                      borderLeft = '3px solid #0366d6';
                    }
                    
                    return (
                      <Box
                        key={lineIndex}
                        component="div"
                        sx={{
                          bgcolor: bgColor,
                          color: textColor,
                          borderLeft: borderLeft,
                          px: 1.5,
                          py: 0.2,
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          lineHeight: 'inherit',
                          '&:hover': {
                            bgcolor: bgColor === 'transparent' ? '#f5f5f5' : bgColor,
                          }
                        }}
                      >
                        {line || ' '} {/* 空行显示空格避免高度塌陷 */}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontStyle: "italic" }}
                >
                  无差异内容显示
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: "90vh", borderRadius: 2 },
      }}
    >
      <DialogTitle>
        代码对比: {targetBranch?.name || targetBranch} →{" "}
        {sourceBranch?.name || sourceBranch}
        <IconButton onClick={handleClose} size="small" sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, bgcolor: "#fafafa" }}>
        {loading && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "200px",
            }}
          >
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>正在获取对比数据...</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 1.5 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {compareData && !loading && (
          <Box>
            {/* Tab导航 */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
              <Tabs 
                value={activeTab} 
                onChange={(event, newValue) => setActiveTab(newValue)}
                sx={{ px: 1.5 }}
              >
                <Tab 
                  label={`文件变更 (${compareData.diffs?.length || 0})`} 
                  sx={{ fontSize: '0.875rem', fontWeight: 500 }}
                />
                <Tab 
                  label={`提交记录 (${compareData.commits?.length || 0})`} 
                  sx={{ fontSize: '0.875rem', fontWeight: 500 }}
                />
              </Tabs>
            </Box>

            {/* Tab内容 */}
            <Box sx={{ p: 1.5 }}>
              {activeTab === 0 && (
                <Box>
                  {renderFileDiffs(compareData.diffs)}
                </Box>
              )}
              {activeTab === 1 && (
                <Box>
                  {renderCommitList(compareData.commits)}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: "#f5f5f5",
          borderTop: "1px solid #e0e0e0",
        }}
      >
        <Button
          onClick={handleClose}
          variant="contained"
          color="primary"
          sx={{ minWidth: 80, fontSize: "0.875rem" }}
        >
          关闭
        </Button>
        {compareData && (
          <Button
            onClick={fetchCompareData}
            variant="outlined"
            disabled={loading}
            sx={{ minWidth: 80, fontSize: "0.875rem" }}
          >
            刷新数据
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CompareDialog;
