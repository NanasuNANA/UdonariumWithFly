#!/usr/bin/env python3
"""Second-pass translation for remaining Japanese strings."""
import os

# These need to be in order: longer/more specific strings first
PASS2 = [
    # peer-menu: fix broken long sentences (where プライベート接続 was already swapped to 私人連線)
    ('※私人連線を使用する場合は、お互いのIDをユドナリウム外で共有してください。', '※使用私人連線時，請在應用程式外互相分享ID。'),
    ('※ルーム機能を利用している時は私人連線を利用できません。', '※使用房間功能時無法使用私人連線。'),
    # peer-menu: remaining
    ('色', '顏色'),
    ('ニックネーム', '暱稱'),
    # stand-element
    ('通常', '通常'),
    ('デフォルト', '預設'),
    ('指定画像', '指定圖片'),
    ('チャット末尾 または 指定画像', '聊天末尾 或 指定圖片'),
    ('チャット末尾 かつ 指定画像', '聊天末尾 且 指定圖片'),
    ('チャット末尾', '聊天末尾'),
    ('選択時のみ', '僅在選取時'),
    ('ネームタグ', '名稱標籤'),
    ('画像効果反映', '套用圖片效果'),
    ('回転反映', '套用旋轉'),
    ('口パク画像 (APNGなど)', '口型同步圖片（APNG等）'),
    ('Pos個別指定:', 'Pos個別指定:'),
    ('Height (0=指定無):', 'Height (0=不指定):'),
    ('指定無', '不指定'),
    ('キャラクター画像、臉部圖示が設定されていません', '尚未設定角色圖片或臉部圖示'),
    ('1行に一つ、冒頭@を付けるとマッチ時にテキストから切り取り\n@怒り\n@必殺技',
     '每行一個，開頭@時從文字中截取\n@憤怒\n@必殺技'),
    # chat-log-output
    ('選択した分頁', '所選分頁'),
    ('全ての分頁', '全部分頁'),
    ('テキスト', '文字'),
    ('HTML (画像あり)', 'HTML (含圖片)'),
    ('※<b>HTML（画像あり）</b> はZIPファイルとなります、<br>　フォルダ構造を保って解凍してください。',
     '※<b>HTML（含圖片）</b> 將輸出為ZIP檔案，<br>　請保留資料夾結構解壓縮。'),
    ('時刻：', '時刻：'),
    ('無', '無'),
    ('時：分', '時：分'),
    ('日付時刻', '日期時刻'),
    ('操作日誌を含める', '包含操作日誌'),
    ('日誌出力', '輸出日誌'),
    ('※チャット分頁が作成されていません。', '※尚未建立任何聊天分頁。'),
    # dice-symbol
    ("face == '裏'", "face == '裏'"),   # internal value, keep as-is
    ("face == '表'", "face == '表'"),   # internal value, keep as-is
    # overview-panel remaining
    ('表示', '顯示'),
    # range component remaining TS strings
    ('射程', '射程'),
    ('範囲', '範圍'),
    ('正方形', '正方形'),
    ('円形', '圓形'),
    ('扇形', '扇形'),
    # app.component.html
    ('操作ログ', '操作日誌'),
    ('ゲームテーブル', '遊戲桌面'),
    ('インベントリ', '物品欄'),
    ('環境設定', '環境設定'),
    ('接続情報', '連線資訊'),
    ('音楽プレイヤー', '音樂播放器'),
    ('カットイン設定', '插圖設定'),
    ('ダイスボット表設定', '骰子機器人表設定'),
    ('スタンド設定', '立繪設定'),
    ('テーブル設定', '桌面設定'),
    ('チャットタブ設定', '聊天分頁設定'),
    ('ファイル一覧', '檔案列表'),
    ('保存/読込', '儲存/讀取'),
    ('ルーム設定', '房間設定'),
    # game-data-element remaining
    ('テキスト', '文字'),
    ('数値', '數值'),
    ('チェックボックス', '勾選框'),
    ('能力値', '能力值'),
    ('リソース', '資源'),
    ('URL', 'URL'),
    ('色', '顏色'),
    ('カラーパレット', '顏色面板'),
    # card-stack-list remaining
    ('カードスタック', '牌堆'),
    # context-menu remaining
    ('カットイン', '插圖'),
    ('テーブルマスク', '地圖遮罩'),
    ('地形オブジェクト', '地形物件'),
    ('テキストノート', '文字便條'),
    ('ダイスシンボル', '骰子符號'),
    ('ここ以降はダイスボット説明', '以下是骰子機器人說明'),
    # game-table remaining
    ('このページを更新', '重新整理此頁面'),
    ('セーブデータを読み込む', '讀取存檔'),
    ('セーブデータを保存する', '儲存存檔'),
    ('データを初期化する', '初始化資料'),
    ('初期化', '初始化'),
    # password-check remaining
    ('パスワード', '密碼'),
    # open-url
    ('開く', '開啟'),
    # overview-panel remaining
    ('サイズ', '大小'),
    ('高度', '高度'),
    ('地形', '地形'),
    ('カード', '牌'),
    ('コイン', '硬幣'),
    # range remaining
    ('名前', '名稱'),
    ('前方', '前方'),
    ('後方', '後方'),
    # game-character remaining
    ('キャラクター', '角色'),
    ('向き', '方向'),
    # peer-menu remaining
    ('ニックネーム', '暱稱'),
    # misc
    ('コメント', '備注'),
    ('作者', '作者'),
    ('バージョン', '版本'),
    ('更新日', '更新日期'),
    ('作成日', '建立日期'),
]

def apply_translations(content, translations):
    for jp, zh in translations:
        content = content.replace(jp, zh)
    return content

def main():
    changed = []
    for dirpath in ['src/app/component', 'src/app/service', 'src/app/class', 'src/app']:
        for root, dirs, files in os.walk(dirpath):
            if root != dirpath and dirpath == 'src/app':
                break
            for filename in files:
                if filename.endswith(('.html', '.ts')):
                    path = os.path.join(root, filename)
                    try:
                        with open(path, 'r', encoding='utf-8') as f:
                            original = f.read()
                        translated = apply_translations(original, PASS2)
                        if translated != original:
                            with open(path, 'w', encoding='utf-8') as f:
                                f.write(translated)
                            changed.append(path)
                    except Exception as e:
                        print(f'Error processing {path}: {e}')

    # also index.html
    for path in ['src/index.html', 'src/app/app.component.html', 'src/app/app.component.ts']:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                original = f.read()
            translated = apply_translations(original, PASS2)
            if translated != original:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(translated)
                changed.append(path)

    print(f'第二次翻譯完成，共修改 {len(changed)} 個檔案：')
    for f in sorted(changed):
        print(f'  {f}')

if __name__ == '__main__':
    main()
