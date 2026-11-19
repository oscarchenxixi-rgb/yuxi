# FlowViz 流场可视化前端

基于《代码规范.pdf》和《基于流体仿真数据的三维 Web 可视化交互平台 PRD.pdf》的 Vue 3 前端联调版本。

## 本地运行

在仓库根目录使用 Node.js 24 执行以下命令，然后打开终端显示的本地地址。

```bash
npm ci
npm run dev
```

验证生产构建可执行 `npm run build`，再执行 `npm run preview` 并访问 `http://localhost:4173/`。

## 页面清单

- 首页：`/`
- 项目介绍：`/project`
- 案例库：`/cases`，支持关键词搜索、误差筛选、排序和案例指标对比
- 案例详情：`/cases/0415`, `/cases/0577`, `/cases/0072`
- 参数配置：`/simulation?case=0415`
- 关于我们：`/about`
- 404：`/404`

## 构建与服务器部署

PR、`main` 和 `linxi` 的推送会触发 GitHub Actions 构建，成功后可从对应运行下载 `linxi-website`。向包含工作流的提交推送 `linxi-v*` 标签时，工作流会创建预发布版本并附上 `linxi-website.zip`。

### 部署到域名根目录

1. 执行 `npm run build` 后上传 `dist/` **里面的文件**，或下载 Release 的 `linxi-website.zip` 并解压到服务器网站根目录。以下示例使用 `/var/www/flowviz`，该目录应直接包含 `index.html` 和 `assets/`。
2. 在 Nginx 中配置站点。将 `flowviz.example.com` 替换为服务器的实际域名或 IP。

   ```nginx
   server {
       listen 80;
       server_name flowviz.example.com;
       root /var/www/flowviz;
       index index.html;

       location /assets/ {
           try_files $uri =404;
       }

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

3. 运行 `sudo nginx -t` 检查配置，再运行 `sudo systemctl reload nginx`。在浏览器打开 `http://flowviz.example.com/`，随后直接打开并刷新 `http://flowviz.example.com/cases/0415`，验证子页面也能打开。

### 部署到已有站点的子目录

如果希望从 `http://flowviz.example.com/flowviz/` 访问，先以对应的基础路径重新构建。

```bash
npm run build -- --base=/flowviz/
```

例如，已有站点的 `root` 为 `/var/www/html` 时，将 `dist/` 的内容放到 `/var/www/html/flowviz/`，并在同一个 Nginx `server` 块加入以下配置。

```nginx
location = /flowviz {
    return 301 /flowviz/;
}

location /flowviz/assets/ {
    try_files $uri =404;
}

location /flowviz/ {
    try_files $uri $uri/ /flowviz/index.html;
}
```

重载后访问 `http://flowviz.example.com/flowviz/`。再直接打开并刷新 `http://flowviz.example.com/flowviz/simulation?case=0577`，确认案例与静态资源都能加载。

## 与其他组员集成

1. 数据组给出正式案例 JSON 后，将 `caseInfo.parameterSchema` 中的演示占位参数替换为真实 JSON 中 `presets` 和 `fields` 的字段结构；不要自行造数据。改动字段前应先与团队确认接口契约。
2. Mock 组提供 `submitSimulation()` 后，在 `SimulationPage.vue` 替换 `submitSimulationPreview()`；创建成功后通过 `router.push('/tasks/' + taskId)` 跳转；任务状态页与结果页交给其他组员维护。
3. Three.js 组提供 `FlowScene.vue` 后，将 `HomePage.vue` 内 `hero-preview` 占位区域换成接收 props 的三维组件。
4. 数据组提供论文授权预览图后，将 `CaseCard.vue` 和 `CaseDetailPage.vue` 的装饰性占位区域替换成真实案例图；严禁将占位图当作真实流场。
5. 当前主导航中的“历史记录（待接入）”为不可点击提示，等历史组完成 `/history` 再改为实际路由。

## 质量说明

- 所有标为“参考论文”的指标都来自 PRD V1.0，不是团队计算结果。
- 当前 0–10 演示滑块的数值**不是**任何流体工况参数，且它们来自单独标记的 UI-only schema；它们只用于联调校验、重置及加载动画。
- 成功弹窗只确认前端表单和加载交互，不表示任务已创建或仿真成功。
- 案例卡片、对比表和演示表单支持窄屏布局。
