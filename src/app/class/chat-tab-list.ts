import { ChatMessage } from './chat-message';
import { ChatTab } from './chat-tab';
import { ImageFile } from './core/file-storage/image-file';
import { SyncObject } from './core/synchronize-object/decorator';
import { ObjectNode } from './core/synchronize-object/object-node';
import { InnerXml } from './core/synchronize-object/object-serializer';

@SyncObject('chat-tab-list')
export class ChatTabList extends ObjectNode implements InnerXml {
  private static _instance: ChatTabList;
  static get instance(): ChatTabList {
    if (!ChatTabList._instance) {
      ChatTabList._instance = new ChatTabList('ChatTabList');
      ChatTabList._instance.initialize();
    }
    return ChatTabList._instance;
  }

  get chatTabs(): ChatTab[] { return this.children as ChatTab[]; }

  addChatTab(chatTab: ChatTab): ChatTab
  addChatTab(tabName: string, identifier?: string): ChatTab
  addChatTab(...args: any[]): ChatTab {
    let chatTab: ChatTab = null;
    if (args[0] instanceof ChatTab) {
      chatTab = args[0];
    } else {
      let tabName: string = args[0];
      let identifier: string = args[1];
      chatTab = new ChatTab(identifier);
      chatTab.name = tabName;
      chatTab.initialize();
    }
    return this.appendChild(chatTab);
  }

  parseInnerXml(element: Element) {
    // XMLからの新規作成を許可せず、既存のオブジェクトを更新する
    for (let child of ChatTabList.instance.children) {
      child.destroy();
    }

    let context = ChatTabList.instance.toContext();
    context.syncData = this.toContext().syncData;
    ChatTabList.instance.apply(context);
    ChatTabList.instance.update();

    super.parseInnerXml.apply(ChatTabList.instance, [element]);
    this.destroy();
  }

  log(logFormat, dateFormat, isWriteOerationLog=true, imageDict?: {}, target?: ChatTab[]): string {
    if (!this.chatTabs || (target && target.length == 0)) return '';
    if (target && target.length > 1 && target.map(tab => tab.identifier).sort().join() == this.chatTabs.map(tab => tab.identifier).sort().join()) target = null;
    const messages = (target ? target : this.chatTabs).reduce((ac, chatTab) => {
        if (chatTab) ac.push(...chatTab.chatMessages.filter(chatMessage => chatMessage.isDisplayable && (isWriteOerationLog || !chatMessage.isOperationLog))
          .map(chatMessage => ({ index: chatMessage.index, tabName: chatTab.name, chatMessage: chatMessage }))); 
        return ac;
      }, []).sort((a, b) => a.index - b.index);
    const logBodyAry = [];
    let currentTabIdentifier = (messages.length > 0 ? messages[0].chatMessage.tabIdentifier : null);
    for (const message of messages) {
      if (currentTabIdentifier && currentTabIdentifier !== message.chatMessage.tabIdentifier) {
        currentTabIdentifier =  message.chatMessage.tabIdentifier;
        logBodyAry.push(logFormat == 0 ? '--------' : '<hr>');
      }
      logBodyAry.push(message.chatMessage.logFragment(logFormat, (target && target.length == 1) ? null : message.tabName, dateFormat, imageDict));
    }
    const logBody = logBodyAry.join("\n");
    return logFormat == 0 
      ? logBody
      : `<!DOCTYPE html>
<html lang="ja-JP">
<head>
<meta charset="UTF-8">
<title>Udonarium with Fly：聊天日誌：${ !target ? '全部分頁' : (target[0].name  == '' ? '（無名分頁）' : target[0].name) }${ target && target.length > 1 ? '、其他' : '' }${imageDict ? '（含圖片）' : ''}</title>
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<style>
${ ChatMessage.logCss(imageDict) }
</style>
</head>
<body>
${ logBody }
</body>
</html>`;
  }
}