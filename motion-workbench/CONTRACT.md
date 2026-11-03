# 本机口播动效工作台接口约定

工作台支持效果目录浏览、筛选收藏、本期原句选择与持久保存、交接导出、实际候选定位。仅本机运行；不修改付费包、不批量渲染、不上传、不改历史成片。代码不包含效果目录或付费素材，使用外部资料时应自行确认授权；示例预览与本期成片分开。

## 数据

GET `/api/catalog` → `{version, source, generatedAt, effects}`。effect字段：`id,name,category,categoryLabel,description,signature,duration,videoRequirement,presenterMatte,requirements,previewUrl,posterUrl,officialUrl`。可选 `localExample` 为已验证历史案例，不等于本期采用。

GET `/api/state` → `{schemaVersion:1,revision,favorites:[],activeEpisodeId:null,episodes:[]}`。

episode：`{id,title,transcriptText,createdAt,updatedAt,selections:[]}`。

selection：`{id,effectId,anchor,text,note,startSec:null,endSec:null,candidatePath:'',candidateSec:null,reviewed:false}`。时间单位秒；拍前可空。text为要展示的文字/数据，不更改字幕。candidatePath仅允许当前口播项目edit/或outputs/内现有视频的相对路径。

PUT `/api/state`：body `{expectedRevision,state}`，成功返回新的完整state；409冲突，不可自动覆盖或清掉本地草稿；其他非2xx保留未保存内容。所有变更通过同一串行保存队列。端口仅127.0.0.1:5188，拒绝跨站写入。

GET `/api/export?episode=<id>&format=json|md`：下载已保存版本。导出状态为用户选择清单，不冒充已执行或已验收。若保存失败，前端禁止声称导出包含未保存修改。

GET `/api/media?path=<relative>`：只读播放允许范围内MP4/WebM/MOV，支持Range。

GET `/api/examples`：历史实片示例清单，包含名称、路径、关联效果、原句/定位时间及来源说明。界面明确标记历史示例，不自动写本期。

## 用户流程

左侧分类/收藏，中间图卡网格，右侧或抽屉为本期清单。点击图卡打开动态示例弹窗及中文动作/素材说明；加入本期时可填原句与显示内容。不自动预填未经用户确认的本期选择。可新建/切换本期，粘贴或导入TXT/SRT正文。选中正文原句可以填入选择项。编辑/移除选择需保存，关页未保存提醒。支持JSON备份导入，不静默覆盖冲突。

颜色从官方动效页面深黑/白黄示例提取，主界面深石墨+暖白/黄色强调；中文系统字体本机渲染，不外链字体。全部文案简体中文。图片与视频使用原站URL按需加载，不复制付费源码。
