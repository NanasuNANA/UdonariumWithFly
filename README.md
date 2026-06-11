# Udonarium with Fly 繁體中文版

[Udonarium with Fly](https://github.com/NanasuNANA/UdonariumWithFly)（由 [Udonarium](https://github.com/TK11235/udonarium) 改造而來的 TRPG 線上工具）的繁體中文版，由 [Double Plus Studio](https://github.com/Double-Plus-Studio) 維護。

**試用頁面：[https://double-plus-studio.github.io/](https://double-plus-studio.github.io/)**

---

## 主要特色（繼承自 UdonariumWithFly）

- 高度系統（棋子可設定立體高度）
- 聊天文字顏色自訂
- 立繪（Stand Image）支援
- 插圖（Cut-In）功能
- 多種圖片效果（透明、反轉、光環等）
- BCDice 內建骰子機器人
- BGM / 音效播放

## 與上游的差異

| 項目 | 此版本 |
|------|--------|
| UI 語言 | 繁體中文 |
| P2P 後端 | Trystero + Firebase（無需自建後端） |
| 上游追蹤 | 自動每週偵測，有更新時開 Issue 通知 |

---

## 建置與開發

### 環境需求

- Node.js 24+
- npm 11+

### 建置

```bash
git clone https://github.com/Double-Plus-Studio/UdonariumWithFly.git
cd UdonariumWithFly
git checkout zh-TW
npm install
```

建立 `src/assets/config.yaml`（參考下方設定），然後：

```bash
npm run build
```

產出在 `dist/udonarium/`。

---

## config.yaml 設定

```yaml
backend:
  mode: trystero  # 'trystero' | 'skyway2023' | 'skyway'

# --- Trystero + Firebase（推薦，無需自建後端）---
trystero:
  firebase:
    apiKey: your-api-key
    databaseURL: https://your-project-default-rtdb.firebaseio.com
    projectId: your-project-id
    appId: 1:xxx:web:xxx

# --- SkyWay 2023（需自建 token 後端）---
# backend:
#   mode: skyway2023
#   url: https://your-backend-hostname

# --- BCDice-API（選填，使用外部 API）---
# dice:
#   url: https://bcdice-api-endpoint
```

### Firebase 設定步驟

1. 前往 [Firebase Console](https://console.firebase.google.com/) 建立專案
2. 啟用 **Realtime Database**（選擇任一地區）
3. 建立 Web App，取得設定物件填入 `config.yaml`

---

## Branch 結構

| Branch | 用途 |
|--------|------|
| `withFly` | 追蹤上游（NanasuNANA/UdonariumWithFly） |
| `zh-TW` | 繁體中文翻譯與客製化（主要開發分支） |

### 合入上游更新

當 GitHub Actions 偵測到上游有新 commit，會自動開 Issue。收到通知後：

```bash
git fetch upstream
git checkout withFly
git merge upstream/withFly
git push origin withFly

git checkout zh-TW
git rebase withFly
# 解決衝突（主要是新增的日文字串需補翻譯）
git push origin zh-TW --force-with-lease
```

---

## License

[MIT License](LICENSE)

上游專案版權：
- [Udonarium](https://github.com/TK11235/udonarium) © TK11235
- [UdonariumWithFly](https://github.com/NanasuNANA/UdonariumWithFly) © Nanasu
- 部分程式碼來自 [Udonarium Lily](https://github.com/entyu/udonarium_lily) © entyu
