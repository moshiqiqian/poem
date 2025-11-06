#  古诗词资源管理与智能处理系统

##  项目简介 (Overview)

本项目基于 **B/S（浏览器/服务器）架构** 构建，旨在实现古诗词资源的存储、展示与可视化分析。
 系统涵盖古诗词内容管理、评论互动、诗人关系图谱可视化等核心功能，实现中华文化资源的数字化与智能化管理。

本项目作为20330809146_谢浩源的资源库建设与智能处理作业，本届同学请避免重复使用项目导致冲突，谢谢。

[GitHub地址](https://github.com/moshiqiqian/poem)

##  核心功能

| 模块             | 描述                                    |
| ---------------- | --------------------------------------- |
| 古诗词资源库     | 存储与检索古诗词、诗人信息。            |
| 评论区           | 用户可对诗词发表评论与回复。            |
| 诗人关系图谱     | 使用 D3.js 可视化展示诗人间的历史关联。 |
| 完整 RESTful API | 提供增删改查接口，便于数据交互与扩展。  |

##  技术栈 (Technology Stack)

| 层次       | 技术                           | 说明                           |
| ---------- | ------------------------------ | ------------------------------ |
| 数据库     | MySQL                          | 存储诗词、诗人、评论与关系数据 |
| 后端       | Node.js + Express + TypeScript | 提供 RESTful API               |
| 前端       | HTML5 + 原生 JS (ES6+)         | 前端界面逻辑                   |
| 样式       | Tailwind CSS                   | 响应式、简洁美观               |
| 可视化     | D3.js v7                       | 力导向图可视化诗人关系         |
| 数据库驱动 | mysql2/promise                 | 异步连接池驱动                 |

------

##  项目结构 (Project Structure)

```
work/
├── index.html                 # 前端页面（使用 Fetch API 调用后端）
├── sql/
│   └── resmanage.sql          # 数据库初始化脚本
└── resource-backend/          # 后端应用目录
    ├── server.ts              # Node.js + Express 主服务器文件
    ├── package.json
    ├── package-lock.json
    └── node_modules/
```

------

## 快速复现指南 (Getting Started)

### 步骤 1：环境准备

 安装 Node.js 与 npm

从 [Node.js 官网](https://nodejs.org/) 下载并安装（推荐版本 ≥ 16）。

#### 安装 MySQL 

确保数据库服务已启动（默认主机 `localhost:3306`）。

------

### 步骤 2：初始化数据库

1. 将sql文件导入数据库。
2. 执行成功后可看到以下表格：
   - `poet` — 诗人信息表
   - `poem` — 古诗词表
   - `comment` — 评论表
   - `poet_relationship` — 诗人关系图谱表

------

### 步骤 3：启动后端服务

1. 进入后端项目目录：

   ```
   cd resource-backend
   ```

2. 安装依赖：

   ```
   npm install，因为上传了node_modules所以这个过程会较快。如果出现了环境依赖冲突建议删除node_modules文件夹重新执行命令。
   ```

3. 启动服务器：

   ```
   npx ts-node server.ts
   ```

4. 若启动成功，将在控制台看到：

   ```
   ✅ 数据库连接成功！
   🚀 服务器已在 http://localhost:3000 启动
   ```

> **默认端口：** `3000`
>  你可通过 `server.ts` 中的 `PORT` 常量进行修改。

------

### 步骤 4：运行前端界面

#### 直接打开本地文件

双击 `work/index.html` 即可打开页面。


